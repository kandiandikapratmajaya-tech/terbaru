/**
 * JAYA AGROFARM NUSANTARA - PUSAT LAPORAN & ANALITIK USAHA TANI
 * Modul Analitik Komprehensif: Kondisi Usaha, Keuangan, Panen, Profitabilitas, 
 * Performa Tanaman (HSS vs HST), Export PDF (jsPDF), Excel (SheetJS), CSV & JSON.
 * Data aktual terisolasi per tenant/user dengan zero console error.
 */

(function (window) {
    'use strict';

    // State Filter Aktif
    const reportFilter = {
        period: 'all',
        startDate: '',
        endDate: '',
        lahan: 'all',
        plotId: 'all',
        cropId: 'all'
    };

    // Cache instances chart agar tidak leak/overlap
    let financeChartInstance = null;
    let costChartInstance = null;

    // Cache data terfilter terakhir untuk modal & export
    let lastFilteredData = null;

    // Format Rupiah Helper
    function formatRupiah(num) {
        if (num === null || num === undefined || isNaN(num)) return 'Rp 0';
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            maximumFractionDigits: 0
        }).format(num);
    }

    function formatDateIndo(dateStr) {
        if (!dateStr) return '-';
        const d = (window.db && window.db.parseDate) ? window.db.parseDate(dateStr) : new Date(dateStr);
        if (!d || isNaN(d.getTime())) return String(dateStr);
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    function formatNumber(num, decimals = 0) {
        if (num === null || num === undefined || isNaN(num)) return '0';
        return Number(num).toLocaleString('id-ID', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }

    // Ekstraksi bobot panen (kg) dari transaksi keuangan atau catatan
    function extractHarvestWeightFromTransaction(item) {
        if (!item) return { weight: null, pricePerKg: null };
        const textToSearch = `${item.title || ''} ${item.notes || ''}`.toLowerCase();
        
        // Pola 1: explicit berat: 2.500 kg atau 250 kg
        const weightMatch = textToSearch.match(/(?:berat|hasil|panen|volume|jumlah)?\s*:?\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:kg|kilo|kilogram)\b/i);
        let weight = null;
        if (weightMatch && weightMatch[1]) {
            const rawVal = weightMatch[1].replace(/\./g, '').replace(',', '.');
            const parsed = parseFloat(rawVal);
            if (!isNaN(parsed) && parsed > 0) {
                weight = parsed;
            }
        }

        // Pola 2: harga per kg: @ Rp 5.000 atau @ 25.000/kg
        const priceMatch = textToSearch.match(/(?:@|harga|rp)?\s*:?\s*(?:rp\.?\s*)?([0-9]+(?:[.,][0-9]+)?)\s*(?:\/kg|per\s*kg)\b/i);
        let pricePerKg = null;
        if (priceMatch && priceMatch[1]) {
            const rawPrice = priceMatch[1].replace(/\./g, '').replace(',', '.');
            const parsedPrice = parseFloat(rawPrice);
            if (!isNaN(parsedPrice) && parsedPrice > 0) {
                pricePerKg = parsedPrice;
            }
        }

        const amount = Number(item.amount || 0);
        if (weight && !pricePerKg && weight > 0 && amount > 0) {
            pricePerKg = Math.round(amount / weight);
        } else if (!weight && pricePerKg && pricePerKg > 0 && amount > 0) {
            weight = Math.round((amount / pricePerKg) * 10) / 10;
        }

        return { weight, pricePerKg };
    }

    // Hitung Rentang Tanggal Filter Periode
    function getDateRangeForPeriod(periodType, customStart, customEnd) {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        const d = now.getDate();

        function toDateString(dateObj) {
            const yy = dateObj.getFullYear();
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dd = String(dateObj.getDate()).padStart(2, '0');
            return `${yy}-${mm}-${dd}`;
        }

        switch (periodType) {
            case 'today': {
                const todayStr = toDateString(now);
                return { start: todayStr, end: todayStr, label: 'Hari Ini' };
            }
            case 'this_week': {
                const weekStart = new Date(now.getTime() - 6 * 86400000);
                return { start: toDateString(weekStart), end: toDateString(now), label: '7 Hari Terakhir' };
            }
            case 'this_month': {
                const startM = new Date(y, m, 1);
                const endM = new Date(y, m + 1, 0);
                return { start: toDateString(startM), end: toDateString(endM), label: `Bulan Ini (${now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })})` };
            }
            case 'last_month': {
                const startLM = new Date(y, m - 1, 1);
                const endLM = new Date(y, m, 0);
                return { start: toDateString(startLM), end: toDateString(endLM), label: `Bulan Lalu (${startLM.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })})` };
            }
            case 'last_3_months': {
                const start3M = new Date(y, m - 2, 1);
                const end3M = new Date(y, m + 1, 0);
                return { start: toDateString(start3M), end: toDateString(end3M), label: '3 Bulan Terakhir' };
            }
            case 'this_year': {
                const startY = new Date(y, 0, 1);
                const endY = new Date(y, 11, 31);
                return { start: toDateString(startY), end: toDateString(endY), label: `Tahun ${y}` };
            }
            case 'custom': {
                if (customStart && customEnd) {
                    return { start: customStart, end: customEnd, label: `${formatDateIndo(customStart)} – ${formatDateIndo(customEnd)}` };
                }
                return { start: null, end: null, label: 'Rentang Kustom' };
            }
            case 'all':
            default:
                return { start: null, end: null, label: 'Semua Periode' };
        }
    }

    // Mesin Pengambil Data Terfilter Aktual
    function getFilteredReportData() {
        if (!window.db) {
            return {
                plots: [],
                crops: [],
                finance: [],
                activities: [],
                income: 0,
                expense: 0,
                netProfit: 0,
                marginPct: 0,
                harvests: [],
                costComposition: [],
                profitabilityRows: [],
                cropPerformances: [],
                recentActivities: [],
                periodInfo: { label: 'Semua Periode' },
                activeFilterSummary: 'Semua Data'
            };
        }

        const rawPlots = window.db.getPlots() || [];
        const rawCrops = window.db.getCrops() || [];
        const rawFinance = window.db.getFinance() || [];
        const rawActivities = window.db.getActivities() || [];

        const dateRange = getDateRangeForPeriod(reportFilter.period, reportFilter.startDate, reportFilter.endDate);

        // 1. Filter Plots
        let filteredPlots = rawPlots;
        if (reportFilter.lahan && reportFilter.lahan !== 'all') {
            filteredPlots = filteredPlots.filter(p => {
                const loc = (p.location || p.name || '').trim();
                return loc === reportFilter.lahan || p.id === reportFilter.lahan;
            });
        }
        if (reportFilter.plotId && reportFilter.plotId !== 'all') {
            filteredPlots = filteredPlots.filter(p => String(p.id) === String(reportFilter.plotId));
        }
        const activePlotIds = new Set(filteredPlots.map(p => String(p.id)));

        // 2. Filter Crops
        let filteredCrops = rawCrops;
        if (reportFilter.plotId && reportFilter.plotId !== 'all') {
            filteredCrops = filteredCrops.filter(c => String(c.plotId) === String(reportFilter.plotId));
        } else if (reportFilter.lahan && reportFilter.lahan !== 'all') {
            filteredCrops = filteredCrops.filter(c => activePlotIds.has(String(c.plotId)));
        }
        if (reportFilter.cropId && reportFilter.cropId !== 'all') {
            filteredCrops = filteredCrops.filter(c => String(c.id) === String(reportFilter.cropId));
        }
        const activeCropIds = new Set(filteredCrops.map(c => String(c.id)));

        // 3. Filter Finance
        let filteredFinance = rawFinance.filter(f => {
            // Filter Tanggal
            if (dateRange.start && dateRange.end) {
                const fDate = (f.date || f.transaction_date || '').slice(0, 10);
                if (fDate && (fDate < dateRange.start || fDate > dateRange.end)) {
                    return false;
                }
            }

            // Filter Lahan
            if (reportFilter.lahan && reportFilter.lahan !== 'all') {
                const fPlotId = f.plot_id || f.plotId;
                if (!fPlotId) return false;
                if (!activePlotIds.has(String(fPlotId))) return false;
            }

            // Filter Blok
            if (reportFilter.plotId && reportFilter.plotId !== 'all') {
                const fPlotId = f.plot_id || f.plotId;
                if (reportFilter.plotId === 'general') {
                    if (fPlotId) return false;
                } else if (String(fPlotId) !== String(reportFilter.plotId)) {
                    return false;
                }
            }

            // Filter Tanaman
            if (reportFilter.cropId && reportFilter.cropId !== 'all') {
                const fCropId = f.crop_id || f.cropId;
                if (reportFilter.cropId === 'general') {
                    if (fCropId) return false;
                } else if (String(fCropId) !== String(reportFilter.cropId)) {
                    return false;
                }
            }

            return true;
        });

        // 4. Hitung Finansial Terfilter
        const totalIncome = filteredFinance
            .filter(f => f.type === 'income')
            .reduce((acc, f) => acc + Number(f.amount || 0), 0);
        const totalExpense = filteredFinance
            .filter(f => f.type === 'expense')
            .reduce((acc, f) => acc + Number(f.amount || 0), 0);
        const netProfit = totalIncome - totalExpense;
        const marginPct = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

        // 5. Ekstraksi Data Hasil Panen Terfilter
        const harvestRecords = [];
        filteredFinance.forEach(f => {
            const isHarvestCategory = (f.category === 'Hasil Panen' || f.category === 'Penjualan Hasil Panen');
            const hasHarvestKeyword = (f.title || '').toLowerCase().includes('panen') || (f.notes || '').toLowerCase().includes('panen');
            if (f.type === 'income' && (isHarvestCategory || hasHarvestKeyword)) {
                const { weight, pricePerKg } = extractHarvestWeightFromTransaction(f);
                const matchedCrop = rawCrops.find(c => String(c.id) === String(f.crop_id || f.cropId));
                const matchedPlot = rawPlots.find(p => String(p.id) === String(f.plot_id || f.plotId || (matchedCrop ? matchedCrop.plotId : '')));

                harvestRecords.push({
                    id: f.id,
                    date: f.date || f.transaction_date,
                    plotName: matchedPlot ? matchedPlot.name : (matchedCrop ? matchedCrop.petakName : 'Lahan Umum'),
                    location: matchedPlot ? (matchedPlot.location || 'Sentra') : 'Sentra',
                    cropName: matchedCrop ? matchedCrop.commodity : 'Tanaman Umum',
                    variety: matchedCrop ? matchedCrop.variety : '-',
                    cycleCode: matchedCrop ? (matchedCrop.cycleCode || 'Siklus') : '-',
                    weightKg: weight,
                    pricePerKg: pricePerKg,
                    totalValue: Number(f.amount || 0),
                    notes: f.notes || f.title || ''
                });
            }
        });

        // Rekap Panen
        const totalHarvestKg = harvestRecords.reduce((acc, h) => acc + (h.weightKg || 0), 0);
        const totalHarvestValue = harvestRecords.reduce((acc, h) => acc + (h.totalValue || 0), 0);
        const avgPricePerKg = totalHarvestKg > 0 ? Math.round(totalHarvestValue / totalHarvestKg) : 0;
        const harvestFrequency = harvestRecords.length;

        // Rata-rata per blok & siklus
        const uniquePlotsWithHarvest = new Set(harvestRecords.map(h => h.plotName)).size;
        const uniqueCropsWithHarvest = new Set(harvestRecords.map(h => `${h.cropName}-${h.cycleCode}`)).size;
        const avgKgPerPlot = uniquePlotsWithHarvest > 0 ? (totalHarvestKg / uniquePlotsWithHarvest) : 0;
        const avgKgPerCrop = uniqueCropsWithHarvest > 0 ? (totalHarvestKg / uniqueCropsWithHarvest) : 0;

        // 6. Komposisi Biaya Produksi (Donut / Horizontal Bar)
        const costCategories = [
            'Pupuk',
            'Pestisida & Obat',
            'Benih & Bibit',
            'Upah Tenaga Kerja',
            'Irigasi & Air',
            'Sewa Alat & Mesin',
            'Operasional',
            'Pascapanen & Distribusi',
            'Saprotan',
            'Lain-lain'
        ];
        const costByCategoryMap = {};
        costCategories.forEach(cat => { costByCategoryMap[cat] = 0; });

        filteredFinance.filter(f => f.type === 'expense').forEach(f => {
            const cat = f.category || 'Lain-lain';
            let matchedCat = costCategories.find(c => c.toLowerCase() === cat.toLowerCase());
            if (!matchedCat) {
                if (cat.toLowerCase().includes('pupuk')) matchedCat = 'Pupuk';
                else if (cat.toLowerCase().includes('pestisida') || cat.toLowerCase().includes('obat')) matchedCat = 'Pestisida & Obat';
                else if (cat.toLowerCase().includes('benih') || cat.toLowerCase().includes('bibit')) matchedCat = 'Benih & Bibit';
                else if (cat.toLowerCase().includes('upah') || cat.toLowerCase().includes('tenaga')) matchedCat = 'Upah Tenaga Kerja';
                else if (cat.toLowerCase().includes('irigasi') || cat.toLowerCase().includes('air')) matchedCat = 'Irigasi & Air';
                else if (cat.toLowerCase().includes('alat') || cat.toLowerCase().includes('mesin') || cat.toLowerCase().includes('traktor')) matchedCat = 'Sewa Alat & Mesin';
                else if (cat.toLowerCase().includes('pascapanen') || cat.toLowerCase().includes('distribusi')) matchedCat = 'Pascapanen & Distribusi';
                else if (cat.toLowerCase().includes('saprotan')) matchedCat = 'Saprotan';
                else if (cat.toLowerCase().includes('operasional')) matchedCat = 'Operasional';
                else matchedCat = 'Lain-lain';
            }
            costByCategoryMap[matchedCat] = (costByCategoryMap[matchedCat] || 0) + Number(f.amount || 0);
        });

        const costComposition = Object.keys(costByCategoryMap)
            .map(category => {
                const amount = costByCategoryMap[category];
                const percentage = totalExpense > 0 ? (amount / totalExpense) * 100 : 0;
                return { category, amount, percentage };
            })
            .filter(c => c.amount > 0)
            .sort((a, b) => b.amount - a.amount);

        // 7. Profitabilitas per Blok / Siklus
        const profitabilityRows = [];
        filteredCrops.forEach(c => {
            const p = rawPlots.find(plot => String(plot.id) === String(c.plotId));
            const cropFinance = filteredFinance.filter(f => String(f.crop_id || f.cropId) === String(c.id));
            const cropExpense = cropFinance.filter(f => f.type === 'expense').reduce((sum, f) => sum + Number(f.amount || 0), 0);
            const cropIncome = cropFinance.filter(f => f.type === 'income').reduce((sum, f) => sum + Number(f.amount || 0), 0);
            const cropNet = cropIncome - cropExpense;
            const cropMargin = cropIncome > 0 ? (cropNet / cropIncome) * 100 : (cropExpense > 0 ? -100 : 0);

            // Panen terkait siklus ini
            const cropHarvests = harvestRecords.filter(h => h.cropName === c.commodity && h.cycleCode === (c.cycleCode || 'Siklus'));
            const cropHarvestKg = cropHarvests.reduce((sum, h) => sum + (h.weightKg || 0), 0);

            profitabilityRows.push({
                cropId: c.id,
                lahanName: p ? (p.location || p.name) : 'Lahan Utama',
                blockName: p ? p.name : (c.petakName || 'Blok Lahan'),
                commodity: c.commodity,
                variety: c.variety || '-',
                cycleCode: c.cycleCode || 'Siklus',
                totalExpense: cropExpense,
                totalHarvestKg: cropHarvestKg,
                totalIncome: cropIncome,
                netProfit: cropNet,
                marginPct: cropMargin,
                status: c.status || 'growing'
            });
        });

        // 8. Performa Siklus Tanaman (HSS vs HST строго terpisah)
        const cropPerformances = filteredCrops.map(c => {
            const p = rawPlots.find(plot => String(plot.id) === String(c.plotId));
            const ageInfo = window.db.calculateCropAge ? window.db.calculateCropAge(c) : null;
            
            const cropFinance = filteredFinance.filter(f => String(f.crop_id || f.cropId) === String(c.id));
            const cropExpense = cropFinance.filter(f => f.type === 'expense').reduce((sum, f) => sum + Number(f.amount || 0), 0);
            const cropIncome = cropFinance.filter(f => f.type === 'income').reduce((sum, f) => sum + Number(f.amount || 0), 0);
            const cropNet = cropIncome - cropExpense;

            return {
                id: c.id,
                commodity: c.commodity,
                variety: c.variety || '-',
                blockName: p ? p.name : (c.petakName || 'Blok Lahan'),
                seedingDate: c.seedingDate || c.seeding_date,
                transplantDate: c.transplantDate || c.transplant_date,
                hss: ageInfo ? ageInfo.hss : 0,
                hst: (ageInfo && ageInfo.isTransplanted) ? ageInfo.hst : null,
                isTransplanted: ageInfo ? ageInfo.isTransplanted : false,
                isDirect: ageInfo ? ageInfo.isDirect : false,
                status: c.status === 'harvested' ? 'Panen' : (c.status === 'completed' ? 'Selesai' : 'Aktif'),
                totalExpense: cropExpense,
                totalIncome: cropIncome,
                netProfit: cropNet,
                progress: c.progress || (ageInfo ? ageInfo.progressPercent : 0)
            };
        });

        // 9. Aktivitas Terbaru (Gabungan Perawatan + Finansial + Panen Aktual)
        const recentActivities = [];

        // Dari Activities Perawatan
        rawActivities.forEach(a => {
            const aCrop = rawCrops.find(c => String(c.id) === String(a.crop_id || a.cropId || a.batch_id));
            const aPlot = aCrop ? rawPlots.find(p => String(p.id) === String(aCrop.plotId)) : null;
            recentActivities.push({
                date: a.activity_date || a.date,
                type: 'care',
                icon: 'check-circle-2',
                iconColor: 'text-emerald-600 bg-emerald-50',
                title: a.title || 'Aktivitas Perawatan',
                block: aPlot ? aPlot.name : (aCrop ? aCrop.petakName : 'Lahan'),
                cropLabel: aCrop ? `${aCrop.commodity} (${aCrop.cycleCode || 'Siklus'})` : '-',
                cost: Number(a.cost || 0),
                nominalText: Number(a.cost || 0) > 0 ? `Biaya: ${formatRupiah(a.cost)}` : null
            });
        });

        // Dari Transaksi Finansial Terfilter (Top 10)
        filteredFinance.forEach(f => {
            const fCrop = rawCrops.find(c => String(c.id) === String(f.crop_id || f.cropId));
            const fPlot = rawPlots.find(p => String(p.id) === String(f.plot_id || f.plotId));
            const isIncome = f.type === 'income';
            recentActivities.push({
                date: f.date || f.transaction_date,
                type: 'finance',
                icon: isIncome ? 'arrow-down-left' : 'arrow-up-right',
                iconColor: isIncome ? 'text-emerald-700 bg-emerald-100' : 'text-rose-600 bg-rose-100',
                title: f.title || (isIncome ? 'Pemasukan Kas' : 'Pengeluaran Kas'),
                block: fPlot ? fPlot.name : (fCrop ? fCrop.petakName : 'Umum'),
                cropLabel: fCrop ? `${fCrop.commodity} (${fCrop.cycleCode || 'Siklus'})` : 'Umum',
                cost: Number(f.amount || 0),
                nominalText: `${isIncome ? '+' : '-'}${formatRupiah(f.amount)}`
            });
        });

        // Urutkan aktivitas dari yang paling baru
        recentActivities.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

        // Rangkuman Teks Filter Aktif
        let summaryParts = [];
        summaryParts.push(dateRange.label);
        if (reportFilter.lahan !== 'all') {
            summaryParts.push(`Lahan: ${reportFilter.lahan}`);
        }
        if (reportFilter.plotId !== 'all') {
            const p = rawPlots.find(plot => String(plot.id) === String(reportFilter.plotId));
            summaryParts.push(`Blok: ${p ? p.name : reportFilter.plotId}`);
        }
        if (reportFilter.cropId !== 'all') {
            const c = rawCrops.find(crop => String(crop.id) === String(reportFilter.cropId));
            summaryParts.push(`Siklus: ${c ? `${c.commodity} (${c.cycleCode || 'Siklus'})` : reportFilter.cropId}`);
        }

        const result = {
            plots: filteredPlots,
            allPlots: rawPlots,
            crops: filteredCrops,
            allCrops: rawCrops,
            finance: filteredFinance,
            income: totalIncome,
            expense: totalExpense,
            netProfit,
            marginPct,
            harvests: harvestRecords,
            harvestSummary: {
                totalKg: totalHarvestKg,
                totalValue: totalHarvestValue,
                avgPricePerKg,
                frequency: harvestFrequency,
                avgKgPerPlot,
                avgKgPerCrop
            },
            costComposition,
            profitabilityRows,
            cropPerformances,
            recentActivities: recentActivities.slice(0, 15),
            periodInfo: dateRange,
            activeFilterSummary: summaryParts.join(' • ')
        };

        lastFilteredData = result;
        return result;
    }

    // =========================================================================
    // RENDER UTAMA MODUL LAPORAN & ANALITIK
    // =========================================================================
    function renderReports() {
        populateReportFilterSelects();
        const data = getFilteredReportData();

        renderReportHeaderAndFilterSummary(data);
        renderReportKpis(data);
        renderReportFinanceChart(data);
        renderReportCostComposition(data);
        renderReportProfitabilityTable(data);
        renderReportHarvestSection(data);
        renderReportCropPerformanceTable(data);
        renderReportRecentActivities(data);

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    // 1. Populasi Dropdown Filter Berjenjang
    function populateReportFilterSelects() {
        if (!window.db) return;
        const plots = window.db.getPlots() || [];
        const crops = window.db.getCrops() || [];

        const selPeriod = document.getElementById('report-filter-period');
        const selLahan = document.getElementById('report-filter-lahan');
        const selPlot = document.getElementById('report-filter-plot');
        const selCrop = document.getElementById('report-filter-crop');

        if (selPeriod && reportFilter.period) {
            selPeriod.value = reportFilter.period;
            const customDateWrap = document.getElementById('report-custom-date-container');
            if (customDateWrap) {
                if (reportFilter.period === 'custom') {
                    customDateWrap.classList.remove('hidden');
                } else {
                    customDateWrap.classList.add('hidden');
                }
            }
        }

        // Lahan (Sentra / Lokasi)
        if (selLahan) {
            const locations = [];
            plots.forEach(p => {
                const loc = (p.location || '').trim();
                if (loc && !locations.includes(loc)) locations.push(loc);
            });
            const currentVal = selLahan.value || reportFilter.lahan;
            selLahan.innerHTML = `<option value="all">Semua Lahan (Sentra)</option>` +
                locations.map(l => `<option value="${l}">${l}</option>`).join('');
            if (currentVal && (currentVal === 'all' || locations.includes(currentVal))) {
                selLahan.value = currentVal;
            } else {
                selLahan.value = 'all';
            }
        }

        // Blok (Tergantung Lahan)
        if (selPlot) {
            const activeLahan = selLahan ? selLahan.value : 'all';
            const filteredPlots = (activeLahan !== 'all')
                ? plots.filter(p => (p.location || '').trim() === activeLahan)
                : plots;
            const currentPlot = selPlot.value || reportFilter.plotId;
            selPlot.innerHTML = `<option value="all">Semua Blok / Petak</option>` +
                `<option value="general">Umum (Bebas Blok)</option>` +
                filteredPlots.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
            if (currentPlot && (currentPlot === 'all' || currentPlot === 'general' || filteredPlots.some(p => String(p.id) === String(currentPlot)))) {
                selPlot.value = currentPlot;
            } else {
                selPlot.value = 'all';
            }
        }

        // Siklus Tanaman (Tergantung Blok)
        if (selCrop) {
            const activePlot = selPlot ? selPlot.value : 'all';
            let matchingCrops = crops;
            if (activePlot !== 'all') {
                if (activePlot === 'general') {
                    matchingCrops = [];
                } else {
                    matchingCrops = crops.filter(c => String(c.plotId) === String(activePlot));
                }
            }
            const currentCrop = selCrop.value || reportFilter.cropId;
            selCrop.innerHTML = `<option value="all">Semua Siklus Tanaman</option>` +
                `<option value="general">Umum (Bebas Siklus)</option>` +
                matchingCrops.map(c => {
                    const pl = plots.find(p => String(p.id) === String(c.plotId));
                    const plName = pl ? ` [${pl.name}]` : '';
                    return `<option value="${c.id}">${c.commodity} — ${c.cycleCode || 'Siklus'}${plName}</option>`;
                }).join('');
            if (currentCrop && (currentCrop === 'all' || currentCrop === 'general' || matchingCrops.some(c => String(c.id) === String(currentCrop)))) {
                selCrop.value = currentCrop;
            } else {
                selCrop.value = 'all';
            }
        }
    }

    // 2. Filter Handler UI
    function onReportPeriodChange(val) {
        reportFilter.period = val;
        const customDateWrap = document.getElementById('report-custom-date-container');
        if (customDateWrap) {
            if (val === 'custom') {
                customDateWrap.classList.remove('hidden');
            } else {
                customDateWrap.classList.add('hidden');
                applyReportFilters();
            }
        } else {
            applyReportFilters();
        }
    }

    function onReportLahanChange(val) {
        reportFilter.lahan = val;
        reportFilter.plotId = 'all';
        reportFilter.cropId = 'all';
        populateReportFilterSelects();
        applyReportFilters();
    }

    function onReportPlotChange(val) {
        reportFilter.plotId = val;
        reportFilter.cropId = 'all';
        populateReportFilterSelects();
        applyReportFilters();
    }

    function onReportCropChange(val) {
        reportFilter.cropId = val;
        applyReportFilters();
    }

    function applyReportFilters() {
        const selPeriod = document.getElementById('report-filter-period');
        const selLahan = document.getElementById('report-filter-lahan');
        const selPlot = document.getElementById('report-filter-plot');
        const selCrop = document.getElementById('report-filter-crop');
        const startDateInput = document.getElementById('report-filter-start-date');
        const endDateInput = document.getElementById('report-filter-end-date');

        if (selPeriod) reportFilter.period = selPeriod.value;
        if (selLahan) reportFilter.lahan = selLahan.value;
        if (selPlot) reportFilter.plotId = selPlot.value;
        if (selCrop) reportFilter.cropId = selCrop.value;
        if (startDateInput) reportFilter.startDate = startDateInput.value;
        if (endDateInput) reportFilter.endDate = endDateInput.value;

        const data = getFilteredReportData();
        renderReportHeaderAndFilterSummary(data);
        renderReportKpis(data);
        renderReportFinanceChart(data);
        renderReportCostComposition(data);
        renderReportProfitabilityTable(data);
        renderReportHarvestSection(data);
        renderReportCropPerformanceTable(data);
        renderReportRecentActivities(data);

        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    function resetReportFilters() {
        reportFilter.period = 'all';
        reportFilter.startDate = '';
        reportFilter.endDate = '';
        reportFilter.lahan = 'all';
        reportFilter.plotId = 'all';
        reportFilter.cropId = 'all';

        const startDateInput = document.getElementById('report-filter-start-date');
        const endDateInput = document.getElementById('report-filter-end-date');
        if (startDateInput) startDateInput.value = '';
        if (endDateInput) endDateInput.value = '';

        populateReportFilterSelects();
        applyReportFilters();
        if (typeof window.showToast === 'function') {
            window.showToast('Filter laporan telah direset ke seluruh data aktual.', 'info');
        }
    }

    // 3. Render Header & Teks Indikator Filter Aktif
    function renderReportHeaderAndFilterSummary(data) {
        const summaryBadge = document.getElementById('report-active-filter-badge');
        if (summaryBadge) {
            summaryBadge.textContent = data.activeFilterSummary || 'Semua Data';
        }
    }

    // 4. Render 5 KPI Utama
    function renderReportKpis(data) {
        const container = document.getElementById('report-kpi-cards');
        if (!container) return;

        const totalPlots = data.plots.length;
        const totalAreaM2 = data.plots.reduce((acc, p) => acc + Number(p.area || 0), 0);
        const totalAreaHa = (totalAreaM2 / 10000).toFixed(2);

        const totalCrops = data.crops.length;
        const activeCrops = data.crops.filter(c => c.status === 'growing').length;

        const isProfit = data.netProfit >= 0;
        const marginFormatted = (data.income > 0) ? `${data.marginPct.toFixed(1)}%` : '-';

        container.innerHTML = `
            <!-- KPI 1: TOTAL LAHAN / BLOK -->
            <div class="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-emerald-300 transition">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Lahan / Blok</span>
                    <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                        <i data-lucide="map" class="w-4 h-4"></i>
                    </div>
                </div>
                <div>
                    <div class="text-xl sm:text-2xl font-black text-slate-900">${totalPlots > 0 ? `${totalPlots} Blok` : '0 Blok'}</div>
                    <p class="text-xs text-slate-500 mt-0.5">
                        ${totalPlots > 0 ? `Luas: ${totalAreaHa} Ha (${formatNumber(totalAreaM2)} m²)` : 'Belum ada petak lahan terdaftar'}
                    </p>
                </div>
            </div>

            <!-- KPI 2: SIKLUS AKTIF -->
            <div class="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-emerald-300 transition">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Siklus Aktif</span>
                    <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                        <i data-lucide="sprout" class="w-4 h-4"></i>
                    </div>
                </div>
                <div>
                    <div class="text-xl sm:text-2xl font-black text-emerald-700">${activeCrops} Siklus</div>
                    <p class="text-xs text-slate-500 mt-0.5">
                        ${totalCrops > 0 ? `Dari total ${totalCrops} siklus budidaya` : 'Belum ada siklus budidaya'}
                    </p>
                </div>
            </div>

            <!-- KPI 3: TOTAL PENDAPATAN -->
            <div class="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-emerald-300 transition">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Pendapatan</span>
                    <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                        <i data-lucide="trending-up" class="w-4 h-4"></i>
                    </div>
                </div>
                <div>
                    <div class="text-xl sm:text-2xl font-black text-slate-900">${formatRupiah(data.income)}</div>
                    <p class="text-xs text-emerald-700 font-medium mt-0.5 flex items-center gap-1">
                        <i data-lucide="arrow-down-left" class="w-3.5 h-3.5"></i>
                        <span>Arus Kas Masuk Panen</span>
                    </p>
                </div>
            </div>

            <!-- KPI 4: TOTAL BIAYA -->
            <div class="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between hover:border-rose-300 transition">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Biaya</span>
                    <div class="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                        <i data-lucide="trending-down" class="w-4 h-4"></i>
                    </div>
                </div>
                <div>
                    <div class="text-xl sm:text-2xl font-black text-slate-900">${formatRupiah(data.expense)}</div>
                    <p class="text-xs text-rose-600 font-medium mt-0.5 flex items-center gap-1">
                        <i data-lucide="arrow-up-right" class="w-3.5 h-3.5"></i>
                        <span>Biaya Operasional & Saprotan</span>
                    </p>
                </div>
            </div>

            <!-- KPI 5: LABA BERSIH -->
            <div class="bg-white rounded-2xl p-4 sm:p-5 border ${isProfit ? 'border-emerald-200/90 bg-gradient-to-br from-white to-emerald-50/30' : 'border-rose-200/90 bg-gradient-to-br from-white to-rose-50/30'} shadow-xs flex flex-col justify-between">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-semibold ${isProfit ? 'text-emerald-800' : 'text-rose-800'} uppercase tracking-wider">Laba Bersih</span>
                    <div class="w-8 h-8 rounded-xl ${isProfit ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'} flex items-center justify-center font-bold text-xs">
                        <i data-lucide="${isProfit ? 'wallet' : 'alert-circle'}" class="w-4 h-4"></i>
                    </div>
                </div>
                <div>
                    <div class="text-xl sm:text-2xl font-black ${isProfit ? 'text-emerald-700' : 'text-rose-600'}">
                        ${isProfit ? '' : '-'}${formatRupiah(Math.abs(data.netProfit))}
                    </div>
                    <p class="text-xs text-slate-600 mt-0.5 flex items-center justify-between">
                        <span>Margin: <strong class="font-bold ${isProfit ? 'text-emerald-800' : 'text-rose-700'}">${marginFormatted}</strong></span>
                        <span class="text-[10px] text-slate-500">${data.income > 0 ? 'Optimal' : 'Nihil Pemasukan'}</span>
                    </p>
                </div>
            </div>
        `;
    }

    // 5. Render Grafik Perkembangan Pendapatan & Biaya (Chart.js)
    function renderReportFinanceChart(data) {
        const canvas = document.getElementById('chart-report-finance');
        const emptyState = document.getElementById('report-finance-chart-empty');
        if (!canvas) return;

        if (financeChartInstance) {
            financeChartInstance.destroy();
            financeChartInstance = null;
        }

        const financeList = data.finance || [];
        if (financeList.length === 0) {
            canvas.classList.add('hidden');
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }

        canvas.classList.remove('hidden');
        if (emptyState) emptyState.classList.add('hidden');

        // Kelompokkan data transaksi berdasarkan bulan (YYYY-MM)
        const monthGroups = {};
        financeList.forEach(f => {
            const dateStr = (f.date || f.transaction_date || '').slice(0, 7); // '2026-09'
            if (!dateStr) return;
            if (!monthGroups[dateStr]) {
                monthGroups[dateStr] = { income: 0, expense: 0 };
            }
            if (f.type === 'income') {
                monthGroups[dateStr].income += Number(f.amount || 0);
            } else if (f.type === 'expense') {
                monthGroups[dateStr].expense += Number(f.amount || 0);
            }
        });

        // Urutkan label bulan
        const sortedMonths = Object.keys(monthGroups).sort();
        if (sortedMonths.length === 0) {
            canvas.classList.add('hidden');
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }

        const labels = sortedMonths.map(ym => {
            const [y, m] = ym.split('-');
            const d = new Date(Number(y), Number(m) - 1, 1);
            return d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
        });

        const incomeData = sortedMonths.map(ym => monthGroups[ym].income);
        const expenseData = sortedMonths.map(ym => monthGroups[ym].expense);
        const profitData = sortedMonths.map(ym => monthGroups[ym].income - monthGroups[ym].expense);

        const ctx = canvas.getContext('2d');
        financeChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Pendapatan',
                        data: incomeData,
                        backgroundColor: '#10b981',
                        borderRadius: 6,
                        barPercentage: 0.6,
                        categoryPercentage: 0.7
                    },
                    {
                        label: 'Biaya',
                        data: expenseData,
                        backgroundColor: '#f43f5e',
                        borderRadius: 6,
                        barPercentage: 0.6,
                        categoryPercentage: 0.7
                    },
                    {
                        label: 'Laba Bersih',
                        data: profitData,
                        type: 'line',
                        borderColor: '#0284c7',
                        backgroundColor: '#0284c7',
                        borderWidth: 2.5,
                        pointBackgroundColor: '#ffffff',
                        pointBorderColor: '#0284c7',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            boxWidth: 12,
                            boxHeight: 12,
                            usePointStyle: true,
                            font: { size: 11, weight: 'bold', family: 'Plus Jakarta Sans' }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return ` ${context.dataset.label}: ${formatRupiah(context.parsed.y)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 10 } }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: '#f1f5f9' },
                        ticks: {
                            font: { size: 10 },
                            callback: function (val) {
                                if (val >= 1000000) return (val / 1000000) + ' Jt';
                                if (val >= 1000) return (val / 1000) + ' Rb';
                                return val;
                            }
                        }
                    }
                }
            }
        });
    }

    // 6. Render Komposisi Biaya Produksi (Donut + Breakdown Table)
    function renderReportCostComposition(data) {
        const canvas = document.getElementById('chart-report-cost');
        const breakdownEl = document.getElementById('report-cost-breakdown');
        const emptyState = document.getElementById('report-cost-empty');
        if (!canvas || !breakdownEl) return;

        if (costChartInstance) {
            costChartInstance.destroy();
            costChartInstance = null;
        }

        const comp = data.costComposition || [];
        if (comp.length === 0) {
            canvas.classList.add('hidden');
            breakdownEl.innerHTML = '';
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }

        canvas.classList.remove('hidden');
        if (emptyState) emptyState.classList.add('hidden');

        const palette = [
            '#059669', '#10b981', '#0284c7', '#38bdf8', '#8b5cf6',
            '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#64748b'
        ];

        const labels = comp.map(c => c.category);
        const amounts = comp.map(c => c.amount);
        const colors = comp.map((c, i) => palette[i % palette.length]);

        const ctx = canvas.getContext('2d');
        costChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: amounts,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#ffffff',
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const idx = context.dataIndex;
                                const item = comp[idx];
                                return ` ${item.category}: ${formatRupiah(item.amount)} (${item.percentage.toFixed(1)}%)`;
                            }
                        }
                    }
                },
                cutout: '68%'
            }
        });

        // List Rincian Bar Kanan / Bawah
        breakdownEl.innerHTML = comp.map((item, i) => {
            const color = palette[i % palette.length];
            return `
                <div class="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 last:border-0">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: ${color}"></span>
                        <span class="font-semibold text-slate-700 truncate">${item.category}</span>
                    </div>
                    <div class="text-right flex-shrink-0 pl-2">
                        <span class="font-bold text-slate-900">${formatRupiah(item.amount)}</span>
                        <span class="text-slate-400 text-[10px] ml-1">(${item.percentage.toFixed(1)}%)</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 7. Render Tabel Profitabilitas per Blok / Siklus
    function renderReportProfitabilityTable(data) {
        const tbody = document.getElementById('report-profitability-tbody');
        if (!tbody) return;

        const rows = data.profitabilityRows || [];
        if (rows.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="py-12 text-center text-slate-400 text-xs">
                        <div class="flex flex-col items-center justify-center gap-2">
                            <i data-lucide="scale" class="w-8 h-8 text-slate-300"></i>
                            <span class="font-semibold text-slate-600">Belum ada data profitabilitas siklus tanaman</span>
                            <span class="text-[11px] text-slate-400">Daftarkan siklus tanam atau catat transaksi keuangan untuk melihat profitabilitas.</span>
                            <button type="button" onclick="openModal('modal-crop')" class="mt-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition">
                                + Tambah Siklus Baru
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = rows.map(r => {
            const isProfit = r.netProfit >= 0;
            const marginText = r.totalIncome > 0 ? `${r.marginPct.toFixed(1)}%` : '-';
            const harvestText = r.totalHarvestKg > 0 ? `${formatNumber(r.totalHarvestKg)} kg` : '-';

            return `
                <tr class="border-b border-slate-100 hover:bg-slate-50/70 transition">
                    <td class="py-3 px-4 text-xs font-medium text-slate-600 whitespace-nowrap">${r.lahanName}</td>
                    <td class="py-3 px-4 text-xs font-bold text-slate-800 whitespace-nowrap">${r.blockName}</td>
                    <td class="py-3 px-4 text-xs font-semibold text-emerald-800 whitespace-nowrap">
                        ${r.commodity} <span class="text-[10px] text-slate-400 font-normal">(${r.variety})</span>
                    </td>
                    <td class="py-3 px-4 text-xs font-medium text-slate-600 whitespace-nowrap">${r.cycleCode}</td>
                    <td class="py-3 px-4 text-xs font-bold text-rose-600 whitespace-nowrap">${formatRupiah(r.totalExpense)}</td>
                    <td class="py-3 px-4 text-xs font-bold text-slate-700 whitespace-nowrap">${harvestText}</td>
                    <td class="py-3 px-4 text-xs font-bold text-emerald-700 whitespace-nowrap">${formatRupiah(r.totalIncome)}</td>
                    <td class="py-3 px-4 text-xs font-black whitespace-nowrap ${isProfit ? 'text-emerald-700' : 'text-rose-600'}">
                        ${isProfit ? '+' : '-'}${formatRupiah(Math.abs(r.netProfit))}
                    </td>
                    <td class="py-3 px-4 text-xs font-extrabold whitespace-nowrap ${isProfit ? 'text-emerald-800' : 'text-rose-700'}">
                        ${marginText}
                    </td>
                </tr>
            `;
        }).join('');
    }

    // 8. Render Section Hasil Panen
    function renderReportHarvestSection(data) {
        const hs = data.harvestSummary || {};
        const elTotalKg = document.getElementById('report-harvest-total-kg');
        const elCount = document.getElementById('report-harvest-count');
        const elAvgPlot = document.getElementById('report-harvest-avg-plot');
        const elAvgCrop = document.getElementById('report-harvest-avg-crop');
        const elTotalVal = document.getElementById('report-harvest-total-value');
        const elAvgPrice = document.getElementById('report-harvest-avg-price');

        if (elTotalKg) elTotalKg.textContent = hs.totalKg > 0 ? `${formatNumber(hs.totalKg)} kg` : '-';
        if (elCount) elCount.textContent = `${hs.frequency || 0} Kali`;
        if (elAvgPlot) elAvgPlot.textContent = hs.avgKgPerPlot > 0 ? `${formatNumber(hs.avgKgPerPlot, 1)} kg` : '-';
        if (elAvgCrop) elAvgCrop.textContent = hs.avgKgPerCrop > 0 ? `${formatNumber(hs.avgKgPerCrop, 1)} kg` : '-';
        if (elTotalVal) elTotalVal.textContent = formatRupiah(hs.totalValue);
        if (elAvgPrice) elAvgPrice.textContent = hs.avgPricePerKg > 0 ? `${formatRupiah(hs.avgPricePerKg)}/kg` : '-';

        const tbody = document.getElementById('report-harvest-tbody');
        if (!tbody) return;

        const harvests = data.harvests || [];
        if (harvests.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="py-12 text-center text-slate-400 text-xs">
                        <div class="flex flex-col items-center justify-center gap-2">
                            <i data-lucide="wheat" class="w-8 h-8 text-amber-300"></i>
                            <span class="font-bold text-slate-700 text-sm">Belum ada data panen</span>
                            <span class="text-xs text-slate-400 max-w-sm">Data panen akan otomatis terdeteksi saat Anda mencatat transaksi pemasukan dengan kategori 'Hasil Panen' atau mencantumkan bobot panen (kg).</span>
                            <button type="button" onclick="openModal('modal-finance')" class="mt-2 px-3.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition">
                                + Catat Transaksi Panen
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = harvests.map(h => {
            const weightText = h.weightKg ? `${formatNumber(h.weightKg)} kg` : '-';
            const priceText = h.pricePerKg ? formatRupiah(h.pricePerKg) : '-';

            return `
                <tr class="border-b border-slate-100 hover:bg-slate-50/70 transition">
                    <td class="py-3 px-4 text-xs font-medium text-slate-600 whitespace-nowrap">${formatDateIndo(h.date)}</td>
                    <td class="py-3 px-4 text-xs font-medium text-slate-700 whitespace-nowrap">${h.location}</td>
                    <td class="py-3 px-4 text-xs font-bold text-slate-800 whitespace-nowrap">${h.plotName}</td>
                    <td class="py-3 px-4 text-xs font-semibold text-emerald-800 whitespace-nowrap">${h.cropName}</td>
                    <td class="py-3 px-4 text-xs font-medium text-slate-600 whitespace-nowrap">${h.cycleCode}</td>
                    <td class="py-3 px-4 text-xs font-bold text-amber-700 whitespace-nowrap">${weightText}</td>
                    <td class="py-3 px-4 text-xs font-medium text-slate-600 whitespace-nowrap">${priceText}</td>
                    <td class="py-3 px-4 text-xs font-black text-emerald-700 whitespace-nowrap">${formatRupiah(h.totalValue)}</td>
                </tr>
            `;
        }).join('');
    }

    // 9. Render Section Performa Siklus Tanaman (HSS vs HST)
    function renderReportCropPerformanceTable(data) {
        const tbody = document.getElementById('report-crop-performance-tbody');
        if (!tbody) return;

        const crops = data.cropPerformances || [];
        if (crops.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="py-12 text-center text-slate-400 text-xs">
                        <div class="flex flex-col items-center justify-center gap-2">
                            <i data-lucide="sprout" class="w-8 h-8 text-slate-300"></i>
                            <span class="font-semibold text-slate-600">Belum ada siklus tanaman yang sesuai filter</span>
                            <button type="button" onclick="openModal('modal-crop')" class="mt-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition">
                                + Daftarkan Siklus Baru
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = crops.map(c => {
            const isProfit = c.netProfit >= 0;
            const hssDisplay = c.isDirect ? '-' : `${c.hss} HSS`;
            const hstDisplay = (c.isTransplanted && c.hst !== null)
                ? `<span class="font-bold text-emerald-700">${c.hst} HST</span>`
                : (c.isDirect ? `<span class="font-bold text-emerald-700">${c.hss} HST (Langsung)</span>` : '<span class="text-slate-400 text-[10px]">Persemaian</span>');

            let statusBadge = '';
            if (c.status === 'Panen') {
                statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Panen</span>';
            } else if (c.status === 'Selesai') {
                statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">Selesai</span>';
            } else {
                statusBadge = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Aktif</span>';
            }

            return `
                <tr class="border-b border-slate-100 hover:bg-slate-50/70 transition">
                    <td class="py-3 px-4 text-xs font-bold text-slate-900 whitespace-nowrap">
                        ${c.commodity} <span class="text-[10px] text-slate-500 font-normal">(${c.variety})</span>
                    </td>
                    <td class="py-3 px-4 text-xs font-medium text-slate-700 whitespace-nowrap">${c.blockName}</td>
                    <td class="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">${formatDateIndo(c.seedingDate)}</td>
                    <td class="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">${formatDateIndo(c.transplantDate)}</td>
                    <td class="py-3 px-4 text-xs font-semibold text-slate-700 whitespace-nowrap">${hssDisplay}</td>
                    <td class="py-3 px-4 text-xs whitespace-nowrap">${hstDisplay}</td>
                    <td class="py-3 px-4 text-xs whitespace-nowrap">${statusBadge}</td>
                    <td class="py-3 px-4 text-xs font-bold text-rose-600 whitespace-nowrap">${formatRupiah(c.totalExpense)}</td>
                    <td class="py-3 px-4 text-xs font-bold text-emerald-700 whitespace-nowrap">${formatRupiah(c.totalIncome)}</td>
                    <td class="py-3 px-4 text-xs font-black whitespace-nowrap ${isProfit ? 'text-emerald-700' : 'text-rose-600'}">
                        ${isProfit ? '+' : '-'}${formatRupiah(Math.abs(c.netProfit))}
                    </td>
                </tr>
            `;
        }).join('');
    }

    // 10. Render Aktivitas Terbaru (Timeline)
    function renderReportRecentActivities(data) {
        const container = document.getElementById('report-recent-activities-list');
        if (!container) return;

        const activities = data.recentActivities || [];
        if (activities.length === 0) {
            container.innerHTML = `
                <div class="py-8 text-center text-slate-400 text-xs">
                    <i data-lucide="calendar" class="w-6 h-6 text-slate-300 mx-auto mb-1"></i>
                    <span>Belum ada aktivitas atau transaksi terkini.</span>
                </div>
            `;
            return;
        }

        container.innerHTML = activities.map(act => {
            return `
                <div class="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
                    <div class="w-8 h-8 rounded-xl ${act.iconColor} flex items-center justify-center flex-shrink-0 mt-0.5">
                        <i data-lucide="${act.icon}" class="w-4 h-4"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between gap-2">
                            <h4 class="text-xs font-bold text-slate-800 truncate">${act.title}</h4>
                            <span class="text-[10px] text-slate-400 flex-shrink-0">${formatDateIndo(act.date)}</span>
                        </div>
                        <div class="flex items-center justify-between gap-2 mt-0.5">
                            <span class="text-[11px] text-slate-500 truncate">
                                ${act.block} • ${act.cropLabel}
                            </span>
                            ${act.nominalText ? `<span class="text-xs font-bold ${act.nominalText.startsWith('+') ? 'text-emerald-700' : 'text-rose-600'} flex-shrink-0">${act.nominalText}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // =========================================================================
    // MODAL SUB-VIEW: LAPORAN KEUANGAN, PANEN, PROFITABILITAS & DETAIL
    // =========================================================================
    function openReportModal(type, extraId = null) {
        const data = lastFilteredData || getFilteredReportData();
        const modal = document.getElementById(`modal-report-${type}`);
        if (!modal) return;

        if (type === 'finance') {
            renderModalFinanceContent(data);
        } else if (type === 'harvest') {
            renderModalHarvestContent(data);
        } else if (type === 'profitability') {
            renderModalProfitabilityContent(data);
        } else if (type === 'cycle_detail') {
            renderModalCycleDetailContent(data, extraId);
        }

        modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
        if (window.lucide) lucide.createIcons();
    }

    function closeReportModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            document.body.classList.remove('overflow-hidden');
        }
    }

    // Konten Modal Laporan Keuangan
    function renderModalFinanceContent(data) {
        const incomeEl = document.getElementById('modal-fin-income');
        const expenseEl = document.getElementById('modal-fin-expense');
        const profitEl = document.getElementById('modal-fin-profit');
        const tbody = document.getElementById('modal-fin-tbody');

        if (incomeEl) incomeEl.textContent = formatRupiah(data.income);
        if (expenseEl) expenseEl.textContent = formatRupiah(data.expense);
        if (profitEl) {
            const isProfit = data.netProfit >= 0;
            profitEl.textContent = (isProfit ? '+' : '-') + formatRupiah(Math.abs(data.netProfit));
            profitEl.className = isProfit ? 'text-xl font-black text-emerald-700' : 'text-xl font-black text-rose-600';
        }

        if (tbody) {
            if (data.finance.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400 text-xs">Belum ada transaksi pada periode yang dipilih.</td></tr>`;
                return;
            }
            tbody.innerHTML = data.finance.map(item => {
                const isInc = item.type === 'income';
                const p = data.allPlots.find(plot => String(plot.id) === String(item.plot_id || item.plotId));
                const c = data.allCrops.find(crop => String(crop.id) === String(item.crop_id || item.cropId));

                return `
                    <tr class="border-b border-slate-100 hover:bg-slate-50 text-xs">
                        <td class="py-2.5 px-3 whitespace-nowrap">${formatDateIndo(item.date)}</td>
                        <td class="py-2.5 px-3 whitespace-nowrap">
                            <span class="px-2 py-0.5 rounded-full font-bold text-[10px] ${isInc ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                                ${isInc ? 'Pemasukan' : 'Pengeluaran'}
                            </span>
                        </td>
                        <td class="py-2.5 px-3 font-semibold text-slate-800">${item.title}</td>
                        <td class="py-2.5 px-3 text-slate-600 whitespace-nowrap">${item.category}</td>
                        <td class="py-2.5 px-3 text-slate-600 whitespace-nowrap">${p ? p.name : 'Umum'}</td>
                        <td class="py-2.5 px-3 text-slate-600 whitespace-nowrap">${c ? `${c.commodity} (${c.cycleCode || 'Siklus'})` : 'Umum'}</td>
                        <td class="py-2.5 px-3 text-right font-black whitespace-nowrap ${isInc ? 'text-emerald-700' : 'text-rose-600'}">
                            ${isInc ? '+' : '-'}${formatRupiah(item.amount)}
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    // Konten Modal Laporan Panen
    function renderModalHarvestContent(data) {
        const totalKgEl = document.getElementById('modal-harv-total-kg');
        const totalValEl = document.getElementById('modal-harv-total-val');
        const avgPriceEl = document.getElementById('modal-harv-avg-price');
        const freqEl = document.getElementById('modal-harv-freq');
        const tbody = document.getElementById('modal-harv-tbody');

        const hs = data.harvestSummary || {};
        if (totalKgEl) totalKgEl.textContent = hs.totalKg > 0 ? `${formatNumber(hs.totalKg)} kg` : '-';
        if (totalValEl) totalValEl.textContent = formatRupiah(hs.totalValue);
        if (avgPriceEl) avgPriceEl.textContent = hs.avgPricePerKg > 0 ? `${formatRupiah(hs.avgPricePerKg)}/kg` : '-';
        if (freqEl) freqEl.textContent = `${hs.frequency || 0} Kali`;

        if (tbody) {
            if (data.harvests.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400 text-xs">Belum ada data panen yang tercatat.</td></tr>`;
                return;
            }
            tbody.innerHTML = data.harvests.map(h => {
                return `
                    <tr class="border-b border-slate-100 hover:bg-slate-50 text-xs">
                        <td class="py-2.5 px-3 whitespace-nowrap">${formatDateIndo(h.date)}</td>
                        <td class="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">${h.plotName}</td>
                        <td class="py-2.5 px-3 font-semibold text-emerald-800 whitespace-nowrap">${h.cropName} (${h.cycleCode})</td>
                        <td class="py-2.5 px-3 font-bold text-amber-700 whitespace-nowrap">${h.weightKg ? `${formatNumber(h.weightKg)} kg` : '-'}</td>
                        <td class="py-2.5 px-3 text-slate-600 whitespace-nowrap">${h.pricePerKg ? formatRupiah(h.pricePerKg) : '-'}</td>
                        <td class="py-2.5 px-3 text-right font-black text-emerald-700 whitespace-nowrap">${formatRupiah(h.totalValue)}</td>
                        <td class="py-2.5 px-3 text-slate-500 truncate max-w-xs">${h.notes || '-'}</td>
                    </tr>
                `;
            }).join('');
        }
    }

    // Konten Modal Analisis Profitabilitas
    function renderModalProfitabilityContent(data) {
        const biayEl = document.getElementById('modal-prof-biaya');
        const pendEl = document.getElementById('modal-prof-pendapatan');
        const labaEl = document.getElementById('modal-prof-laba');
        const margEl = document.getElementById('modal-prof-margin');
        const biayaPerKgEl = document.getElementById('modal-prof-biaya-kg');
        const pendPerKgEl = document.getElementById('modal-prof-pend-kg');
        const tbody = document.getElementById('modal-prof-tbody');

        const totalKg = data.harvestSummary.totalKg;
        const biayaPerKg = totalKg > 0 ? Math.round(data.expense / totalKg) : null;
        const pendPerKg = totalKg > 0 ? Math.round(data.income / totalKg) : null;

        if (biayEl) biayEl.textContent = formatRupiah(data.expense);
        if (pendEl) pendEl.textContent = formatRupiah(data.income);
        if (labaEl) {
            const isProfit = data.netProfit >= 0;
            labaEl.textContent = (isProfit ? '+' : '-') + formatRupiah(Math.abs(data.netProfit));
            labaEl.className = isProfit ? 'text-xl font-black text-emerald-700' : 'text-xl font-black text-rose-600';
        }
        if (margEl) margEl.textContent = data.income > 0 ? `${data.marginPct.toFixed(1)}%` : '-';
        if (biayaPerKgEl) biayaPerKgEl.textContent = biayaPerKg ? `${formatRupiah(biayaPerKg)}/kg` : '-';
        if (pendPerKgEl) pendPerKgEl.textContent = pendPerKg ? `${formatRupiah(pendPerKg)}/kg` : '-';

        if (tbody) {
            if (data.profitabilityRows.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400 text-xs">Belum ada data profitabilitas siklus.</td></tr>`;
                return;
            }
            tbody.innerHTML = data.profitabilityRows.map(r => {
                const isProf = r.netProfit >= 0;
                return `
                    <tr class="border-b border-slate-100 hover:bg-slate-50 text-xs">
                        <td class="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">${r.blockName}</td>
                        <td class="py-2.5 px-3 font-semibold text-emerald-800 whitespace-nowrap">${r.commodity} (${r.cycleCode})</td>
                        <td class="py-2.5 px-3 font-bold text-rose-600 whitespace-nowrap">${formatRupiah(r.totalExpense)}</td>
                        <td class="py-2.5 px-3 font-bold text-amber-700 whitespace-nowrap">${r.totalHarvestKg > 0 ? `${formatNumber(r.totalHarvestKg)} kg` : '-'}</td>
                        <td class="py-2.5 px-3 font-bold text-emerald-700 whitespace-nowrap">${formatRupiah(r.totalIncome)}</td>
                        <td class="py-2.5 px-3 font-black whitespace-nowrap ${isProf ? 'text-emerald-700' : 'text-rose-600'}">
                            ${isProf ? '+' : '-'}${formatRupiah(Math.abs(r.netProfit))}
                        </td>
                        <td class="py-2.5 px-3 font-bold whitespace-nowrap ${isProf ? 'text-emerald-800' : 'text-rose-700'}">
                            ${r.totalIncome > 0 ? `${r.marginPct.toFixed(1)}%` : '-'}
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    // =========================================================================
    // EXPORT LAPORAN: PDF (jsPDF & AutoTable)
    // =========================================================================
    async function downloadReportPDF() {
        const data = lastFilteredData || getFilteredReportData();
        const user = (window.auth && window.auth.getCurrentUser) ? window.auth.getCurrentUser() : null;
        const tenant = (window.auth && window.auth.getCurrentTenant) ? window.auth.getCurrentTenant() : null;

        // 1. Nama usaha diambil secara dinamis dari profil akun pengguna (bukan hardcode)
        let farmName = '';
        if (user && user.farm_name && user.farm_name.trim()) {
            farmName = user.farm_name.trim();
        } else if (tenant && tenant.name && tenant.name.trim()) {
            farmName = tenant.name.trim();
        } else if (user && user.name && user.name.trim()) {
            farmName = `Usaha Tani ${user.name.trim()}`;
        } else {
            farmName = 'Jaya Agrofarm';
        }

        // 2. Nama pemilik diambil secara dinamis dari profil akun yang terdaftar (bukan hardcode)
        let ownerName = '';
        if (user && user.name && user.name.trim()) {
            ownerName = user.name.trim();
        } else if (tenant && tenant.owner && tenant.owner.trim()) {
            ownerName = tenant.owner.trim();
        } else {
            ownerName = 'Pratama Jaya';
        }

        // 3. Tanggal cetak otomatis bahasa Indonesia lengkap saat PDF dibuat
        const now = new Date();
        const printDateFormatted = now.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        const dateStr = now.toISOString().slice(0, 10);

        if (typeof window.showToast === 'function') {
            window.showToast('Menyusun dokumen PDF laporan resmi...', 'info');
        }

        // Cek ketersediaan jsPDF
        const { jsPDF } = window.jspdf || {};
        if (!jsPDF) {
            console.warn('[PDF] jsPDF belum terload, fallback ke window.print()');
            window.print();
            return;
        }

        try {
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            let currentY = 16;

            // 1. Header & Kop Laporan Resmi (Minimalis, Premium, Profesional)
            const barX = 14;
            const barWidth = 3.5;
            const textX = 21;

            // Baris 1: Judul Utama Laporan (Elemen Paling Dominan)
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14.5);
            doc.setTextColor(15, 23, 42); // Dark navy (Slate-900)
            doc.text('LAPORAN & ANALITIK USAHA TANI KOMPREHENSIF', textX, currentY + 5.5);

            // Baris 2: Nama Usaha Pengguna (Elemen Kedua yang Menonjol)
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(30, 41, 59); // Slate-800
            doc.text(farmName, textX, currentY + 12);

            // Baris 3: Pemilik Usaha (Identitas Pemilik yang Terdaftar)
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9.5);
            doc.setTextColor(71, 85, 105); // Slate-600
            doc.text(`Pemilik: ${ownerName}`, textX, currentY + 17);

            // Baris 4: Informasi Penerbit (Kecil, Rapi, Elegan)
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139); // Slate-500
            doc.text('Diterbitkan oleh Jaya Agrofarm Nusantara', textX, currentY + 23);

            // Baris 5: Tanggal Cetak Otomatis
            doc.text(`Tanggal Cetak: ${printDateFormatted}`, textX, currentY + 27.5);

            // Garis Aksen Vertikal Hijau Khas Jaya Agrofarm di Sebelah Kiri
            const barHeight = 29.5;
            doc.setFillColor(16, 185, 129); // Emerald-500
            doc.rect(barX, currentY, barWidth, barHeight, 'F');

            currentY += barHeight + 7;

            // Garis Pembatas Halus & Elegan
            doc.setDrawColor(226, 232, 240); // Slate-200
            doc.setLineWidth(0.5);
            doc.line(14, currentY, pageWidth - 14, currentY);
            currentY += 6;

            // Metadata Filter Aktif (Tanpa kata "Periode" dan tanpa kata "Tenant")
            let cleanFilterSummary = (data.activeFilterSummary || '')
                .replace(/Semua Periode/gi, 'Semua Data')
                .replace(/Periode\s*:\s*/gi, '')
                .replace(/Periode\s*/gi, '')
                .replace(/Tenant\s*:\s*/gi, '')
                .replace(/Tenant\s*/gi, '')
                .trim();
            if (!cleanFilterSummary || cleanFilterSummary === '•') {
                cleanFilterSummary = 'Semua Data';
            }
            if (cleanFilterSummary.startsWith('• ')) {
                cleanFilterSummary = cleanFilterSummary.slice(2).trim();
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(30, 41, 59);
            doc.text('PARAMETER FILTER AKTIF:', 14, currentY);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(71, 85, 105);
            doc.text(cleanFilterSummary, 62, currentY);
            currentY += 8;

            // 2. Ringkasan Eksekutif (KPI Box)
            const marginText = data.income > 0 ? `${data.marginPct.toFixed(1)}%` : '-';
            doc.autoTable({
                startY: currentY,
                head: [['TOTAL LAHAN', 'SIKLUS AKTIF', 'TOTAL PENDAPATAN', 'TOTAL BIAYA', 'LABA BERSIH', 'MARGIN']],
                body: [[
                    `${data.plots.length} Blok`,
                    `${data.crops.filter(c => c.status === 'growing').length} Aktif`,
                    formatRupiah(data.income),
                    formatRupiah(data.expense),
                    formatRupiah(data.netProfit),
                    marginText
                ]],
                theme: 'grid',
                styles: { font: 'helvetica', fontSize: 8, halign: 'center', cellPadding: 3 },
                headStyles: { fillColor: [21, 128, 61], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                margin: { left: 14, right: 14 }
            });

            currentY = doc.lastAutoTable.finalY + 8;

            // 3. Tabel Performa Siklus Tanaman (HSS vs HST)
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(15, 23, 42);
            doc.text('I. PERFORMA SIKLUS TANAMAN (HSS vs HST)', 14, currentY);
            currentY += 3;

            const cropRows = data.cropPerformances.map(c => [
                c.commodity,
                c.blockName,
                formatDateIndo(c.seedingDate),
                formatDateIndo(c.transplantDate),
                c.isDirect ? '-' : `${c.hss} HSS`,
                (c.isTransplanted && c.hst !== null) ? `${c.hst} HST` : (c.isDirect ? `${c.hss} HST` : 'Persemaian'),
                c.status,
                formatRupiah(c.totalExpense),
                formatRupiah(c.totalIncome),
                formatRupiah(c.netProfit)
            ]);

            doc.autoTable({
                startY: currentY,
                head: [['Komoditas', 'Blok', 'Tgl Semai', 'Tgl Pindah', 'HSS', 'HST', 'Status', 'Biaya', 'Pendapatan', 'Laba']],
                body: cropRows.length > 0 ? cropRows : [['-', '-', '-', '-', '-', '-', 'Belum ada data', '-', '-', '-']],
                theme: 'striped',
                styles: { font: 'helvetica', fontSize: 7, cellPadding: 2 },
                headStyles: { fillColor: [51, 65, 85], textColor: 255 },
                margin: { left: 14, right: 14 }
            });

            currentY = doc.lastAutoTable.finalY + 8;

            // 4. Tabel Hasil Panen
            if (currentY > pageHeight - 40) {
                doc.addPage();
                currentY = 15;
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(15, 23, 42);
            doc.text('II. HASIL PANEN & PENJUALAN', 14, currentY);
            currentY += 3;

            const harvestRows = data.harvests.map(h => [
                formatDateIndo(h.date),
                h.plotName,
                h.cropName,
                h.cycleCode,
                h.weightKg ? `${formatNumber(h.weightKg)} kg` : '-',
                h.pricePerKg ? formatRupiah(h.pricePerKg) : '-',
                formatRupiah(h.totalValue)
            ]);

            doc.autoTable({
                startY: currentY,
                head: [['Tanggal', 'Blok Lahan', 'Komoditas', 'Siklus', 'Berat (kg)', 'Harga/kg', 'Total Nilai']],
                body: harvestRows.length > 0 ? harvestRows : [['-', '-', '-', '-', '-', '-', 'Belum ada data panen']],
                theme: 'striped',
                styles: { font: 'helvetica', fontSize: 7, cellPadding: 2 },
                headStyles: { fillColor: [245, 158, 11], textColor: 255 },
                margin: { left: 14, right: 14 }
            });

            currentY = doc.lastAutoTable.finalY + 8;

            // 5. Tabel Transaksi Keuangan Terakhir
            if (currentY > pageHeight - 40) {
                doc.addPage();
                currentY = 15;
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(15, 23, 42);
            doc.text('III. MUTASI KEUANGAN (ARUS KAS)', 14, currentY);
            currentY += 3;

            const financeRows = data.finance.slice(0, 20).map(f => {
                const isInc = f.type === 'income';
                return [
                    formatDateIndo(f.date),
                    isInc ? 'Masuk (+)' : 'Keluar (-)',
                    f.category,
                    f.title,
                    isInc ? `+${formatRupiah(f.amount)}` : `-${formatRupiah(f.amount)}`
                ];
            });

            doc.autoTable({
                startY: currentY,
                head: [['Tanggal', 'Tipe', 'Kategori', 'Uraian Transaksi', 'Nominal']],
                body: financeRows.length > 0 ? financeRows : [['-', '-', '-', 'Belum ada transaksi', '-']],
                theme: 'striped',
                styles: { font: 'helvetica', fontSize: 7, cellPadding: 2 },
                headStyles: { fillColor: [71, 85, 105], textColor: 255 },
                margin: { left: 14, right: 14 }
            });

            // Nomor Halaman
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(7);
                doc.setTextColor(148, 163, 184);
                doc.text(`Jaya Agrofarm Nusantara • Dokumen Resmi Usaha Tani • Halaman ${i} dari ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
            }

            const safeFileName = farmName.replace(/[^a-zA-Z0-9_-]/g, '_');
            doc.save(`Laporan-Usaha-Tani-${safeFileName}-${dateStr}.pdf`);
            if (typeof window.showToast === 'function') {
                window.showToast('Dokumen PDF berhasil diunduh!', 'success');
            }
        } catch (err) {
            console.error('[downloadReportPDF] Error:', err);
            window.print();
        }
    }

    // =========================================================================
    // EXPORT LAPORAN: EXCEL (SheetJS .XLSX Asli dengan 6 Worksheets)
    // =========================================================================
    function downloadReportExcel() {
        const data = lastFilteredData || getFilteredReportData();
        const user = (window.auth && window.auth.getCurrentUser) ? window.auth.getCurrentUser() : null;
        const tenant = (window.auth && window.auth.getCurrentTenant) ? window.auth.getCurrentTenant() : null;

        let farmName = '';
        if (user && user.farm_name && user.farm_name.trim()) {
            farmName = user.farm_name.trim();
        } else if (tenant && tenant.name && tenant.name.trim()) {
            farmName = tenant.name.trim();
        } else if (user && user.name && user.name.trim()) {
            farmName = `Usaha Tani ${user.name.trim()}`;
        } else {
            farmName = 'Jaya Agrofarm';
        }

        let ownerName = '';
        if (user && user.name && user.name.trim()) {
            ownerName = user.name.trim();
        } else if (tenant && tenant.owner && tenant.owner.trim()) {
            ownerName = tenant.owner.trim();
        } else {
            ownerName = 'Pratama Jaya';
        }

        const now = new Date();
        const printDateFormatted = now.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        const dateStr = now.toISOString().slice(0, 10);
        const safeFileName = farmName.replace(/[^a-zA-Z0-9_-]/g, '_');

        if (typeof window.XLSX === 'undefined') {
            console.warn('[Excel] SheetJS belum terload, fallback ke CSV');
            downloadReportCSV();
            return;
        }

        try {
            const wb = XLSX.utils.book_new();

            // Sheet 1: Ringkasan Eksekutif
            const summaryAoa = [
                ['LAPORAN & ANALITIK USAHA TANI KOMPREHENSIF'],
                [`Nama Usaha:`, farmName],
                [`Pemilik:`, ownerName],
                [`Diterbitkan Oleh:`, 'Jaya Agrofarm Nusantara'],
                [`Tanggal Cetak:`, printDateFormatted],
                [`Parameter Filter:`, (data.activeFilterSummary || '').replace(/Semua Periode/gi, 'Semua Data').replace(/Periode\s*:\s*/gi, '').replace(/Periode\s*/gi, '')],
                [],
                ['METRIK UTAMA', 'NILAI'],
                ['Total Blok Lahan', `${data.plots.length} Blok`],
                ['Siklus Budidaya Aktif', `${data.crops.filter(c => c.status === 'growing').length} Siklus`],
                ['Total Pendapatan', data.income],
                ['Total Biaya Produksi', data.expense],
                ['Laba Bersih', data.netProfit],
                ['Margin Keuntungan', data.income > 0 ? `${data.marginPct.toFixed(2)}%` : '0%'],
                ['Total Hasil Panen', `${data.harvestSummary.totalKg || 0} kg`],
                ['Total Omset Penjualan Panen', data.harvestSummary.totalValue || 0],
                ['Rata-rata Harga Jual per kg', data.harvestSummary.avgPricePerKg || 0]
            ];
            const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
            XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');

            // Sheet 2: Keuangan
            const finAoa = [
                ['Tanggal', 'Jenis', 'Kategori', 'Uraian Transaksi', 'Lahan / Blok', 'Tanaman / Siklus', 'Nominal (Rp)', 'Catatan']
            ];
            data.finance.forEach(f => {
                const p = data.allPlots.find(plot => String(plot.id) === String(f.plot_id || f.plotId));
                const c = data.allCrops.find(crop => String(crop.id) === String(f.crop_id || f.cropId));
                finAoa.push([
                    f.date || f.transaction_date,
                    f.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
                    f.category,
                    f.title,
                    p ? p.name : 'Umum',
                    c ? `${c.commodity} (${c.cycleCode || 'Siklus'})` : 'Umum',
                    Number(f.amount || 0),
                    f.notes || ''
                ]);
            });
            const wsFinance = XLSX.utils.aoa_to_sheet(finAoa);
            XLSX.utils.book_append_sheet(wb, wsFinance, 'Keuangan');

            // Sheet 3: Panen
            const harvAoa = [
                ['Tanggal Panen', 'Lokasi Sentra', 'Blok Lahan', 'Komoditas', 'Siklus', 'Berat (kg)', 'Harga / kg (Rp)', 'Total Nilai (Rp)', 'Catatan']
            ];
            data.harvests.forEach(h => {
                harvAoa.push([
                    h.date,
                    h.location,
                    h.plotName,
                    h.cropName,
                    h.cycleCode,
                    h.weightKg || 0,
                    h.pricePerKg || 0,
                    h.totalValue,
                    h.notes || ''
                ]);
            });
            const wsHarvest = XLSX.utils.aoa_to_sheet(harvAoa);
            XLSX.utils.book_append_sheet(wb, wsHarvest, 'Panen');

            // Sheet 4: Profitabilitas
            const profAoa = [
                ['Lahan (Lokasi)', 'Blok Petak', 'Komoditas', 'Siklus', 'Total Biaya (Rp)', 'Total Panen (kg)', 'Pendapatan (Rp)', 'Laba Bersih (Rp)', 'Margin (%)']
            ];
            data.profitabilityRows.forEach(r => {
                profAoa.push([
                    r.lahanName,
                    r.blockName,
                    `${r.commodity} (${r.variety})`,
                    r.cycleCode,
                    r.totalExpense,
                    r.totalHarvestKg,
                    r.totalIncome,
                    r.netProfit,
                    r.totalIncome > 0 ? Number(r.marginPct.toFixed(2)) : 0
                ]);
            });
            const wsProfit = XLSX.utils.aoa_to_sheet(profAoa);
            XLSX.utils.book_append_sheet(wb, wsProfit, 'Profitabilitas');

            // Sheet 5: Siklus Tanaman
            const cropAoa = [
                ['Komoditas', 'Varietas', 'Blok Lahan', 'Tanggal Semai', 'Tanggal Pindah Tanam', 'Umur HSS', 'Umur HST', 'Status', 'Total Biaya (Rp)', 'Pendapatan (Rp)', 'Laba (Rp)']
            ];
            data.cropPerformances.forEach(c => {
                cropAoa.push([
                    c.commodity,
                    c.variety,
                    c.blockName,
                    c.seedingDate || '-',
                    c.transplantDate || '-',
                    c.isDirect ? '-' : c.hss,
                    (c.isTransplanted && c.hst !== null) ? c.hst : (c.isDirect ? c.hss : 'Persemaian'),
                    c.status,
                    c.totalExpense,
                    c.totalIncome,
                    c.netProfit
                ]);
            });
            const wsCrops = XLSX.utils.aoa_to_sheet(cropAoa);
            XLSX.utils.book_append_sheet(wb, wsCrops, 'Siklus Tanaman');

            // Sheet 6: Perawatan / Aktivitas
            const actAoa = [
                ['Tanggal', 'Jenis Kegiatan', 'Judul Aktivitas', 'Blok', 'Tanaman / Siklus', 'Tenaga Kerja', 'Biaya (Rp)', 'Keterangan']
            ];
            (window.db.getActivities() || []).forEach(a => {
                const aCrop = data.allCrops.find(c => String(c.id) === String(a.crop_id || a.cropId));
                const aPlot = aCrop ? data.allPlots.find(p => String(p.id) === String(aCrop.plotId)) : null;
                actAoa.push([
                    a.activity_date || a.date,
                    a.type,
                    a.title,
                    aPlot ? aPlot.name : 'Lahan',
                    aCrop ? `${aCrop.commodity} (${aCrop.cycleCode || 'Siklus'})` : '-',
                    a.worker_count || a.workerCount || 1,
                    Number(a.cost || 0),
                    a.description || ''
                ]);
            });
            const wsAct = XLSX.utils.aoa_to_sheet(actAoa);
            XLSX.utils.book_append_sheet(wb, wsAct, 'Perawatan');

            XLSX.writeFile(wb, `Laporan-Usaha-Tani-${tenantSlug}-${dateStr}.xlsx`);
            if (typeof window.showToast === 'function') {
                window.showToast('Workbook Excel (.xlsx) berhasil diunduh!', 'success');
            }
        } catch (err) {
            console.error('[downloadReportExcel] Error:', err);
            downloadReportCSV();
        }
    }

    // =========================================================================
    // EXPORT LAPORAN: CSV (UTF-8 BOM Compatible dengan Excel)
    // =========================================================================
    function downloadReportCSV() {
        const data = lastFilteredData || getFilteredReportData();
        const tenant = (window.auth && window.auth.getCurrentTenant) ? window.auth.getCurrentTenant() : null;
        const tenantSlug = tenant ? tenant.slug : 'agrofarm';
        const dateStr = new Date().toISOString().slice(0, 10);

        const rows = [
            ['Tanggal', 'Tipe', 'Kategori', 'Uraian', 'Lahan/Blok', 'Tanaman/Siklus', 'Nominal', 'Catatan']
        ];

        data.finance.forEach(f => {
            const p = data.allPlots.find(plot => String(plot.id) === String(f.plot_id || f.plotId));
            const c = data.allCrops.find(crop => String(crop.id) === String(f.crop_id || f.cropId));
            rows.push([
                f.date || f.transaction_date,
                f.type,
                f.category,
                `"${(f.title || '').replace(/"/g, '""')}"`,
                `"${(p ? p.name : 'Umum').replace(/"/g, '""')}"`,
                `"${(c ? `${c.commodity} (${c.cycleCode || 'Siklus'})` : 'Umum').replace(/"/g, '""')}"`,
                f.amount,
                `"${(f.notes || '').replace(/"/g, '""')}"`
            ]);
        });

        const csvContent = '\uFEFF' + rows.map(e => e.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Keuangan-Usaha-Tani-${tenantSlug}-${dateStr}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        if (typeof window.showToast === 'function') {
            window.showToast('File CSV berhasil diunduh!', 'success');
        }
    }

    // Assign ke window global
    window.FarmAnalyticsReport = {
        renderReports,
        getFilteredReportData,
        onReportPeriodChange,
        onReportLahanChange,
        onReportPlotChange,
        onReportCropChange,
        applyReportFilters,
        resetReportFilters,
        openReportModal,
        closeReportModal,
        downloadReportPDF,
        downloadReportExcel,
        downloadReportCSV
    };

    window.renderReports = renderReports;
    window.onReportPeriodChange = onReportPeriodChange;
    window.onReportLahanChange = onReportLahanChange;
    window.onReportPlotChange = onReportPlotChange;
    window.onReportCropChange = onReportCropChange;
    window.applyReportFilters = applyReportFilters;
    window.resetReportFilters = resetReportFilters;
    window.openReportModal = openReportModal;
    window.closeReportModal = closeReportModal;
    window.downloadReportPDF = downloadReportPDF;
    window.downloadReportExcel = downloadReportExcel;
    window.downloadReportCSV = downloadReportCSV;

})(window);
