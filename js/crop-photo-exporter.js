/**
 * JAYA AGROFARM NUSANTARA - CROP PHOTO EXPORTER
 * Format Portrait 4:5 (1080x1350 px) WhatsApp-Ready
 * CORS-safe image loading via Blob / DataURL to prevent tainted canvas.
 * Menghilangkan placeholder foto kosong jika foto tidak tersedia (layout otomatis menyesuaikan).
 */

/**
 * 1. Safe Vector Canvas Badges (100% Untainted)
 * Menggunakan Logo Resmi Jaya Agrofarm Nusantara (Emblem Emas & Padi)
 */
function drawVectorLogoBadge(ctx, x, y, size = 80) {
    ctx.save();
    const cx = x + size / 2;
    const cy = y + size / 2;
    const r = size / 2;

    // Lingkaran latar belakang gelap mewah
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Border lingkaran emas luar
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
    ctx.stroke();

    // Busur matahari terbit keemasan
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(cx - 4, cy - 2, r * 0.32, Math.PI, 0);
    ctx.fill();

    // Sinar matahari
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    for (let angle = Math.PI + 0.3; angle < Math.PI * 2 - 0.2; angle += 0.45) {
        const sx = (cx - 4) + Math.cos(angle) * (r * 0.36);
        const sy = (cy - 2) + Math.sin(angle) * (r * 0.36);
        const ex = (cx - 4) + Math.cos(angle) * (r * 0.52);
        const ey = (cy - 2) + Math.sin(angle) * (r * 0.52);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
    }

    // Alur bedengan sawah (furrows)
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.ellipse(cx - 4, cy + 8, r * 0.45, r * 0.26, 0, 0, Math.PI);
    ctx.fill();

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    for (let offset = -8; offset <= 8; offset += 5) {
        ctx.beginPath();
        ctx.moveTo(cx - 4 + offset * 2, cy - 2);
        ctx.lineTo(cx - 4 + offset * 3.5, cy + 18);
        ctx.stroke();
    }

    // Tangkai bulir padi emas di sisi kanan
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx + 8, cy, r * 0.65, Math.PI * 0.6, Math.PI * 1.45, true);
    ctx.stroke();

    // Bulir-bulir padi keemasan
    ctx.fillStyle = '#fbbf24';
    const grains = [
        { x: cx + 18, y: cy - 18, rot: 0.3 },
        { x: cx + 24, y: cy - 10, rot: 0.1 },
        { x: cx + 26, y: cy - 1, rot: -0.1 },
        { x: cx + 24, y: cy + 8, rot: -0.3 },
        { x: cx + 18, y: cy + 16, rot: -0.5 },
        { x: cx + 10, y: cy + 22, rot: -0.7 }
    ];
    grains.forEach(g => {
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.rotate(g.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, 4, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    ctx.restore();
}

/**
 * 2. Helper Memuat Image sebagai Blob
 * Memenuhi spesifikasi:
 * 1. fetch image URL
 * 2. mendapatkan response Blob
 * 3. membuat object URL
 * 4. membuat Image dari object URL (crossOrigin anonymous SEBELUM src)
 * 5. menunggu image.onload via Promise
 * 6. menggambar ke canvas
 * 7. export menggunakan canvas.toBlob()
 * 8. revoke object URL setelah selesai
 */
async function loadImageAsBlob(imageUrl, fallbackLabel = 'Foto tidak tersedia') {
    // URL kosong/falsy -> kembalikan status placeholder tanpa memuat gambar kosong
    if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') {
        return {
            imgElement: null,
            objectUrl: null,
            isBlob: false,
            isPlaceholder: true,
            revoke: () => {}
        };
    }

    const cleanUrl = imageUrl.trim();

    // Helper membuat HTMLImageElement dari Blob
    function createImageFromBlob(blob) {
        return new Promise((resolve, reject) => {
            try {
                const objectUrl = URL.createObjectURL(blob);
                const img = new Image();
                // CRITICAL: crossOrigin HARUS ditetapkan SEBELUM src
                img.crossOrigin = 'anonymous';
                img.src = objectUrl;

                img.onload = () => {
                    resolve({
                        imgElement: img,
                        objectUrl: objectUrl,
                        isBlob: true,
                        isPlaceholder: false,
                        revoke: () => {
                            try { URL.revokeObjectURL(objectUrl); } catch (e) {}
                        }
                    });
                };
                img.onerror = (err) => {
                    try { URL.revokeObjectURL(objectUrl); } catch (e) {}
                    reject(new Error('Gagal mendecode image blob: ' + (err?.message || 'format tidak didukung')));
                };
            } catch (err) {
                reject(err);
            }
        });
    }

    // Format data:image
    if (cleanUrl.startsWith('data:image/')) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = cleanUrl;
            if (img.complete) {
                return resolve({
                    imgElement: img,
                    objectUrl: null,
                    isBlob: false,
                    isPlaceholder: false,
                    revoke: () => {}
                });
            }
            img.onload = () => resolve({
                imgElement: img,
                objectUrl: null,
                isBlob: false,
                isPlaceholder: false,
                revoke: () => {}
            });
            img.onerror = () => resolve({
                imgElement: null,
                objectUrl: null,
                isBlob: false,
                isPlaceholder: true,
                revoke: () => {}
            });
        });
    }

    // Format blob: URL
    if (cleanUrl.startsWith('blob:')) {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = cleanUrl;
            if (img.complete) {
                return resolve({
                    imgElement: img,
                    objectUrl: cleanUrl,
                    isBlob: true,
                    isPlaceholder: false,
                    revoke: () => {}
                });
            }
            img.onload = () => resolve({
                imgElement: img,
                objectUrl: cleanUrl,
                isBlob: true,
                isPlaceholder: false,
                revoke: () => {}
            });
            img.onerror = () => resolve({
                imgElement: null,
                objectUrl: null,
                isBlob: false,
                isPlaceholder: true,
                revoke: () => {}
            });
        });
    }

    const isExternal = cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://');
    const isSameOrigin = typeof window !== 'undefined' && cleanUrl.startsWith(window.location.origin);

    // URL lokal / sama origin
    if (!isExternal || isSameOrigin) {
        try {
            const resp = await fetch(cleanUrl, { mode: 'cors' });
            if (resp.ok) {
                const blob = await resp.blob();
                return await createImageFromBlob(blob);
            }
        } catch (e) {
            console.warn('[loadImageAsBlob] Fetch lokal notice:', e.message);
        }
    } else {
        // URL eksternal (Supabase Storage / CDN):
        // 1. Coba direct fetch CORS sederhana
        try {
            const resp = await fetch(cleanUrl, { mode: 'cors' });
            if (resp.ok) {
                const blob = await resp.blob();
                return await createImageFromBlob(blob);
            }
        } catch (directCorsErr) {
            // Direct CORS tidak diizinkan, lanjut ke proxy
        }

        // 2. Coba fetch dengan header Supabase jika URL berasal dari supabase.co
        try {
            const headers = {};
            if (typeof window !== 'undefined' && window.__SUPABASE_CONFIG__?.key && cleanUrl.includes('supabase.co')) {
                headers['apikey'] = window.__SUPABASE_CONFIG__.key;
            }
            const resp2 = await fetch(cleanUrl, { mode: 'cors', headers });
            if (resp2.ok) {
                const blob = await resp2.blob();
                return await createImageFromBlob(blob);
            }
        } catch (e2) {
            // Abaikan
        }

        // 3. Fallback proxy internal server (/api/image-proxy)
        try {
            const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(cleanUrl)}`;
            const proxyResp = await fetch(proxyUrl);
            if (proxyResp.ok) {
                const blob = await proxyResp.blob();
                return await createImageFromBlob(blob);
            }
        } catch (proxyErr) {
            console.warn('[loadImageAsBlob] Proxy fetch notice:', proxyErr.message);
        }
    }

    // Jika seluruh upaya gagal, kembalikan null placeholder (tanpa membuat error tainted canvas)
    return {
        imgElement: null,
        objectUrl: null,
        isBlob: false,
        isPlaceholder: true,
        revoke: () => {}
    };
}

/**
 * 3. Helper Text Wrapping Canvas 2D
 */
function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 4) {
    if (!text) return y;
    const words = String(text).split(' ');
    let line = '';
    let currentY = y;
    let lineCount = 0;

    for (let n = 0; n < words.length; n++) {
        const testLine = line + (line ? ' ' : '') + words[n];
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
            lineCount++;
            if (lineCount >= maxLines) {
                ctx.fillText(line + '...', x, currentY);
                return currentY + lineHeight;
            }
            ctx.fillText(line, x, currentY);
            line = words[n];
            currentY += lineHeight;
        } else {
            line = testLine;
        }
    }
    if (line) {
        ctx.fillText(line, x, currentY);
        currentY += lineHeight;
    }
    return currentY;
}

/**
 * Aspect-ratio preserving cover draw for canvas images
 */
function drawImageCover(ctx, img, x, y, w, h, radius = 20) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.clip();

    const imgW = img.naturalWidth || img.width || 1;
    const imgH = img.naturalHeight || img.height || 1;
    const imgRatio = imgW / imgH;
    const targetRatio = w / h;

    let sx = 0, sy = 0, sw = imgW, sh = imgH;
    if (imgRatio > targetRatio) {
        sw = imgH * targetRatio;
        sx = (imgW - sw) / 2;
    } else {
        sh = imgW / targetRatio;
        sy = (imgH - sh) / 2;
    }

    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    ctx.restore();

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.stroke();
}

/**
 * 4. High-DPI Canvas 2D Renderer (1080x1350 px, Portrait 4:5 WhatsApp-Ready)
 * Menghasilkan gambar murni tanpa DOM foreignObject dan 100% bebas tainted canvas.
 * Jika FOTO TIDAK TERSEDIA: Blok foto dihilangkan seluruhnya, konten otomatis naik secara rapi.
 */
function renderCardDirectlyToCanvas2D(photoIndex, data, assets = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');

    // 1. Background dasar putih bersih
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1080, 1350);

    // 2. Border luar kartu halus
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 3;
    ctx.strokeRect(16, 16, 1048, 1318);

    const { crop = {}, plot = null, ageInfo = {}, batchNum = '001', todayFormatted = '' } = data;
    const blockName = (plot ? plot.name : crop.petakName) || 'Blok Lahan';
    const pageIndexStr = String(photoIndex).padStart(2, '0');
    const targetYieldText = Number(crop.targetYield || crop.target_yield || 0).toLocaleString('id-ID');

    // ==========================================
    // HEADER BERSAMA (Logo Resmi, Brand, Badge 0X/04)
    // ==========================================
    if (assets.logoImg && assets.logoImg.complete && assets.logoImg.naturalWidth > 0) {
        try {
            ctx.save();
            ctx.beginPath();
            ctx.arc(80, 80, 40, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(assets.logoImg, 40, 40, 80, 80);
            ctx.restore();
            ctx.strokeStyle = '#d4af37';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(80, 80, 40, 0, Math.PI * 2);
            ctx.stroke();
        } catch (e) {
            drawVectorLogoBadge(ctx, 40, 40, 80);
        }
    } else {
        // Fallback aman: Vector logo resmi Jaya Agrofarm (tidak pernah taint)
        drawVectorLogoBadge(ctx, 40, 40, 80);
    }

    ctx.fillStyle = '#064e3b';
    ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('JAYA AGROFARM NUSANTARA', 140, 76);

    ctx.fillStyle = '#059669';
    ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Smart Crop Engine • Laporan Siklus Tanaman', 140, 106);

    // Badge Halaman Elegan (01 / 04)
    ctx.fillStyle = '#064e3b';
    ctx.beginPath();
    ctx.roundRect(915, 48, 125, 48, 24);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${pageIndexStr} / 04`, 977, 79);
    ctx.textAlign = 'left';

    // Garis pemisah Header
    ctx.strokeStyle = '#ecfdf5';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(40, 140);
    ctx.lineTo(1040, 140);
    ctx.stroke();

    // ==========================================
    // FOTO 1 — RINGKASAN & STATUS TANAMAN
    // ==========================================
    if (photoIndex === 1) {
        // Label Siklus
        ctx.fillStyle = '#047857';
        ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(crop.cycleCode || ('SIKLUS #' + batchNum), 40, 185);

        // Nama Komoditas (Paling Menonjol)
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 44px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(crop.commodity || 'Tanaman Budidaya', 40, 240);

        // Sub-identitas
        ctx.fillStyle = '#475569';
        ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`Varietas: ${crop.variety || 'Standar'} • Blok: ${blockName} • Target: ${targetYieldText} kg`, 40, 280);

        const hasRealPhoto = assets.cropPhotoImg &&
                             assets.cropPhotoImg.complete &&
                             assets.cropPhotoImg.naturalWidth > 0 &&
                             !assets.isCropPhotoPlaceholder;

        // Penentuan teks metode tanam
        const methodText = ageInfo.isDirect
            ? (ageInfo.plantingMethod === 'direct_planting' ? 'Tanam Bibit Langsung (Direct Planting)' : 'Tanam Biji Langsung (Direct Sowing)')
            : 'Semai → Pindah Tanam (Nursery & Transplant)';

        if (hasRealPhoto) {
            // ==========================================
            // TATA LETAK DENGAN FOTO AKTUAL
            // ==========================================
            const photoX = 40;
            const photoY = 310;
            const photoW = 1000;
            const photoH = 300;

            try {
                drawImageCover(ctx, assets.cropPhotoImg, photoX, photoY, photoW, photoH, 20);
                // Badge dokumentasi di pojok bawah foto
                ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
                ctx.beginPath();
                ctx.roundRect(photoX + 16, photoY + photoH - 46, 260, 32, 8);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                ctx.fillText('📷 Dokumentasi Siklus Lahan', photoX + 28, photoY + photoH - 25);
            } catch (e) {
                console.warn('[Crop Photo Draw Notice]:', e);
            }

            // Kartu Status Pertumbuhan Aktif (Mulai di y = 635)
            ctx.fillStyle = '#ecfdf5';
            ctx.beginPath();
            ctx.roundRect(40, 635, 1000, 245, 22);
            ctx.fill();
            ctx.strokeStyle = '#a7f3d0';
            ctx.lineWidth = 3;
            ctx.stroke();

            ctx.fillStyle = '#059669';
            ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText('STATUS PERTUMBUHAN AKTIF', 70, 678);

            ctx.fillStyle = '#064e3b';
            ctx.font = 'bold 64px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText(ageInfo.primaryAgeText || '0 HST', 70, 750);

            ctx.fillStyle = '#065f46';
            ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText(`Fase: ${ageInfo.phase || 'Vegetatif'}`, 70, 796);

            if (ageInfo.secondaryAgeText) {
                ctx.fillStyle = '#047857';
                ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                ctx.fillText(`Info Masa Semai: ${ageInfo.secondaryAgeText}`, 70, 835);
            }

            // Kartu Kondisi & Metode (Pemisahan Vertikal Jelas, Anti Teks Bertabrakan)
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.roundRect(40, 900, 1000, 135, 18);
            ctx.fill();
            ctx.strokeStyle = '#d1fae5';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = '#64748b';
            ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText('KONDISI AKTUAL DI LAHAN:', 65, 932);

            ctx.fillStyle = '#064e3b';
            ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            drawWrappedText(ctx, ageInfo.growthStatus || 'Fase budidaya terkonfirmasi sesuai kondisi aktual di lahan.', 65, 962, 920, 28, 2);

            ctx.fillStyle = '#047857';
            ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText(`Metode Tanam: ${methodText}`, 65, 1018);

            // Kartu Jadwal Tanggal
            ctx.fillStyle = '#f8fafc';
            ctx.beginPath();
            ctx.roundRect(40, 1055, 1000, 185, 20);
            ctx.fill();
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = '#64748b';
            ctx.font = 'bold 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText('JADWAL & KALENDER TANAM', 70, 1092);

            ctx.fillStyle = '#0f172a';
            ctx.font = 'bold 21px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText(`Semai: ${ageInfo.seedingDateFormatted || '-'}`, 70, 1134);
            ctx.fillText(`Pindah Tanam: ${ageInfo.transplantDateFormatted || '-'}`, 70, 1172);
            ctx.fillText(`Hari Ini: ${todayFormatted}`, 70, 1210);

            ctx.fillStyle = '#064e3b';
            ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(`Target: ${targetYieldText} kg`, 995, 1172);
            ctx.fillStyle = '#047857';
            ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText(`Est. Panen: ${ageInfo.estimasiPanenRange || '-'}`, 995, 1210);
            ctx.textAlign = 'left';

        } else {
            // ==========================================
            // TATA LETAK TANPA FOTO (HAPUS TOTAL BLOK PLACEHOLDER)
            // Layout otomatis naik secara rapi, elegan, dan proporsional
            // ==========================================

            // 1. Kartu Utama Status Pertumbuhan Aktif (Mulai Langsung di y = 310)
            ctx.fillStyle = '#ecfdf5';
            ctx.beginPath();
            ctx.roundRect(40, 310, 1000, 320, 24);
            ctx.fill();
            ctx.strokeStyle = '#a7f3d0';
            ctx.lineWidth = 3;
            ctx.stroke();

            ctx.fillStyle = '#059669';
            ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText('STATUS PERTUMBUHAN AKTIF', 70, 360);

            ctx.fillStyle = '#064e3b';
            ctx.font = 'bold 84px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText(ageInfo.primaryAgeText || '0 HST', 70, 452);

            ctx.fillStyle = '#065f46';
            ctx.font = 'bold 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText(`Fase: ${ageInfo.phase || 'Vegetatif'}`, 70, 508);

            ctx.fillStyle = '#334155';
            ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText(`Masa Tanam: ${ageInfo.teksMasaTanam || 'Pertumbuhan di lahan aktif'}`, 70, 552);

            if (ageInfo.secondaryAgeText) {
                ctx.fillStyle = '#047857';
                ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                ctx.fillText(`Catatan Historis: ${ageInfo.secondaryAgeText}`, 70, 592);
            }

            // 2. Kartu Kondisi & Metode Budidaya (Terpisah Vertikal Secara Rapi)
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.roundRect(40, 655, 1000, 235, 20);
            ctx.fill();
            ctx.strokeStyle = '#d1fae5';
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Bagian Kondisi
            ctx.fillStyle = '#64748b';
            ctx.font = 'bold 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText('KONDISI TANAMAN DI LAHAN:', 70, 698);

            ctx.fillStyle = '#064e3b';
            ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            const conditionText = ageInfo.growthStatus || 'Fase budidaya terkonfirmasi sesuai kondisi aktual di lahan.';
            drawWrappedText(ctx, conditionText, 70, 735, 930, 32, 2);

            // Garis pemisah internal
            ctx.strokeStyle = '#f1f5f9';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(70, 810);
            ctx.lineTo(1010, 810);
            ctx.stroke();

            // Bagian Alur Siklus Tanam
            ctx.fillStyle = '#64748b';
            ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText('METODE & ALUR SIKLUS TANAM:', 70, 840);

            ctx.fillStyle = '#047857';
            ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText(methodText, 70, 868);

            // 3. Kartu Jadwal & Kalender Tanam (3 Kolom Nyaman Dipindai)
            ctx.fillStyle = '#f8fafc';
            ctx.beginPath();
            ctx.roundRect(40, 915, 1000, 195, 20);
            ctx.fill();
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = '#64748b';
            ctx.font = 'bold 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText('JADWAL & KALENDER TANAM', 70, 955);

            // Kolom 1: Tanggal Semai
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.roundRect(70, 975, 280, 110, 14);
            ctx.fill();
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = '#64748b';
            ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText('TANGGAL SEMAI', 90, 1008);
            ctx.fillStyle = '#0f172a';
            ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText(ageInfo.seedingDateFormatted || '-', 90, 1045);

            // Kolom 2: Tanggal Pindah Tanam
            ctx.fillStyle = '#ecfdf5';
            ctx.beginPath();
            ctx.roundRect(375, 975, 290, 110, 14);
            ctx.fill();
            ctx.strokeStyle = '#a7f3d0';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = '#059669';
            ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText(ageInfo.isDirect ? 'TANGGAL TANAM' : 'PINDAH TANAM (HST)', 395, 1008);
            ctx.fillStyle = '#064e3b';
            ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText(ageInfo.transplantDateFormatted || ageInfo.plantDateFormatted || '-', 395, 1045);

            // Kolom 3: Hari Ini
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.roundRect(690, 975, 320, 110, 14);
            ctx.fill();
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = '#64748b';
            ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText('TANGGAL LAPORAN', 710, 1008);
            ctx.fillStyle = '#0f172a';
            ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText(todayFormatted, 710, 1045);

            // 4. Banner Target Panen & Estimasi
            ctx.fillStyle = '#064e3b';
            ctx.beginPath();
            ctx.roundRect(40, 1130, 1000, 110, 18);
            ctx.fill();

            ctx.fillStyle = '#a7f3d0';
            ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText('TARGET PRODUKSI PANEN', 70, 1165);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText(`${targetYieldText} kg`, 70, 1205);

            ctx.fillStyle = '#a7f3d0';
            ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText('ESTIMASI RENTANG PANEN', 650, 1165);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText(ageInfo.estimasiPanenRange || 'Sesuai Siklus Komoditas', 650, 1205);
        }

    // ==========================================
    // FOTO 2 — KONDISI & REKOMENDASI HARI INI
    // ==========================================
    } else if (photoIndex === 2) {
        ctx.fillStyle = '#047857';
        ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`${crop.cycleCode || ('SIKLUS #' + batchNum)} • ${crop.commodity || 'Tanaman'} (${blockName})`, 40, 185);

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 42px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('Kondisi & Rekomendasi Hari Ini', 40, 238);

        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 21px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`Panduan fase ${ageInfo.phase || 'Aktif'} (${ageInfo.primaryAgeText || 'Hari Ini'})`, 40, 275);

        const boxes = [
            { title: '🎯 FOKUS HARI INI', text: ageInfo.focusToday || 'Pengakaran serabut aktif dan pembentukan tajuk tanaman seragam.', bg: '#f0fdfa', border: '#99f6e4', color: '#134e4a' },
            { title: '✅ REKOMENDASI SEKARANG', text: ageInfo.currentRecommendations || 'Pastikan kelembapan bedengan tetap stabil dan pantau perkembangan tunas baru.', bg: '#ecfdf5', border: '#a7f3d0', color: '#064e3b' },
            { title: '➡️ REKOMENDASI BERIKUTNYA', text: ageInfo.nextRecommendations || 'Siapkan pemantauan pembentukan bunga dan aplikasi pupuk seimbang.', bg: '#eef2ff', border: '#c7d2fe', color: '#1e1b4b' },
            { title: '🔍 PERLU DIAMATI', text: ageInfo.observationsNeeded || 'Kondisi daun, batang, tunas baru, serta ada/tidaknya gejala serangan hama atau penyakit.', bg: '#fffbeb', border: '#fde68a', color: '#78350f' }
        ];

        let startY = 310;
        boxes.forEach(b => {
            ctx.fillStyle = b.bg;
            ctx.beginPath();
            ctx.roundRect(40, startY, 1000, 200, 20);
            ctx.fill();
            ctx.strokeStyle = b.border;
            ctx.lineWidth = 3;
            ctx.stroke();

            ctx.fillStyle = b.color;
            ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText(b.title, 70, startY + 45);

            ctx.font = 'bold 23px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            drawWrappedText(ctx, b.text, 70, startY + 95, 930, 36, 3);
            startY += 225;
        });

        // Tahap Pertumbuhan Berikutnya
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.roundRect(40, startY, 1000, 70, 16);
        ctx.fill();
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('Tahap Pertumbuhan Berikutnya:', 70, startY + 44);

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(ageInfo.estimatedNextStage || 'Fase Pembungaan / Lanjut', 1000, startY + 44);
        ctx.textAlign = 'left';

    // ==========================================
    // FOTO 3 — TIMELINE PERTUMBUHAN & PANEN
    // ==========================================
    } else if (photoIndex === 3) {
        ctx.fillStyle = '#047857';
        ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`TIMELINE PERTUMBUHAN • ${crop.commodity || 'Tanaman'}`, 40, 185);

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 42px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('Lini Masa Fase Tanaman', 40, 238);

        ctx.fillStyle = '#059669';
        ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`Progress: ${ageInfo.progressPercent || 0}%`, 1040, 238);
        ctx.textAlign = 'left';

        // Progress bar horizontal
        ctx.fillStyle = '#f1f5f9';
        ctx.beginPath();
        ctx.roundRect(40, 265, 1000, 18, 9);
        ctx.fill();

        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        const progressW = Math.max(18, Math.min(1000 * (Number(ageInfo.progressPercent || 0) / 100), 1000));
        ctx.roundRect(40, 265, progressW, 18, 9);
        ctx.fill();

        const phases = ageInfo.phases || [];
        let pY = 320;
        phases.slice(0, 5).forEach((p, idx) => {
            const isCurrent = p.isCurrent || (ageInfo.activePhase && ageInfo.activePhase.name === p.name);
            ctx.fillStyle = isCurrent ? '#ecfdf5' : '#f8fafc';
            ctx.beginPath();
            ctx.roundRect(40, pY, 1000, 120, 18);
            ctx.fill();
            ctx.strokeStyle = isCurrent ? '#10b981' : '#e2e8f0';
            ctx.lineWidth = isCurrent ? 3 : 2;
            ctx.stroke();

            ctx.fillStyle = isCurrent ? '#064e3b' : '#334155';
            ctx.font = 'bold 25px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText(`${p.start}–${p.end} HST • ${p.label || p.name}`, 70, pY + 50);

            ctx.font = 'bold 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillStyle = isCurrent ? '#059669' : '#64748b';
            ctx.fillText(isCurrent ? '★ FASE AKTIF SAAT INI' : `Tahap ke-${idx + 1}`, 70, pY + 88);

            pY += 140;
        });

        // Banner Estimasi Panen
        ctx.fillStyle = '#064e3b';
        ctx.beginPath();
        ctx.roundRect(40, 1060, 1000, 180, 20);
        ctx.fill();

        ctx.fillStyle = '#a7f3d0';
        ctx.font = 'bold 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('ESTIMASI RENTANG PANEN', 70, 1115);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(ageInfo.estimasiPanenRange || 'Sesuai Siklus Komoditas', 70, 1165);

        ctx.fillStyle = '#a7f3d0';
        ctx.font = 'bold 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('TARGET PANEN', 750, 1115);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`${targetYieldText} kg`, 750, 1165);

    // ==========================================
    // FOTO 4 — PERAWATAN / CATATAN / INFORMASI PENTING
    // ==========================================
    } else if (photoIndex === 4) {
        ctx.fillStyle = '#047857';
        ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`${crop.cycleCode || ('SIKLUS #' + batchNum)} • ${crop.commodity || 'Tanaman'} (${blockName})`, 40, 185);

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 42px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('Perawatan & Informasi Penting', 40, 238);

        // 1. Instruksi Perawatan
        ctx.fillStyle = '#fffbeb';
        ctx.beginPath();
        ctx.roundRect(40, 280, 1000, 260, 20);
        ctx.fill();
        ctx.strokeStyle = '#fde68a';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#92400e';
        ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('📋 INSTRUKSI PERAWATAN HARI INI', 70, 335);

        ctx.fillStyle = '#78350f';
        ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const careText = ageInfo.currentInstruction || crop.careInstruction || 'Lakukan penyiraman teratur 1-2 kali sehari dan berikan pupuk sesuai dosis fase aktif.';
        drawWrappedText(ctx, `"${careText}"`, 70, 385, 930, 38, 3);

        // 2. Observasi Terakhir
        ctx.fillStyle = '#ecfdf5';
        ctx.beginPath();
        ctx.roundRect(40, 570, 1000, 280, 20);
        ctx.fill();
        ctx.strokeStyle = '#a7f3d0';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#065f46';
        ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('🔬 OBSERVASI LAPANGAN TERAKHIR', 70, 625);

        ctx.fillStyle = '#064e3b';
        ctx.font = 'bold 23px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const obsText = ageInfo.lastObservationSummary || 'Observasi kondisi tanaman terkonfirmasi sesuai target umur pertumbuhan.';
        drawWrappedText(ctx, obsText, 70, 675, 930, 36, 3);

        // 3. Catatan Siklus Lahan
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.roundRect(40, 880, 1000, 340, 20);
        ctx.fill();
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('📝 CATATAN SIKLUS LAHAN & REKOMENDASI UMUM', 70, 935);

        ctx.fillStyle = '#334155';
        ctx.font = 'bold 23px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const notesText = crop.notes || 'Selalu lakukan pengecekan saluran drainase bedengan, sanitasi gulma di sekitar perakaran, dan monitor berkala perkembangan pucuk tanaman.';
        drawWrappedText(ctx, notesText, 70, 990, 930, 36, 4);
    }

    // ==========================================
    // FOOTER BERSAMA
    // ==========================================
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(40, 1280);
    ctx.lineTo(1040, 1280);
    ctx.stroke();

    ctx.fillStyle = '#047857';
    ctx.font = 'bold 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Jaya Agrofarm Nusantara • Laporan Resmi Petak', 40, 1316);

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Hal. ${pageIndexStr} dari 04 • ${todayFormatted}`, 1040, 1316);
    ctx.textAlign = 'left';

    return canvas;
}

/**
 * 5. Render Card Photo ke Canvas resolusi tinggi (1080x1350 px)
 * Memuat semua assets secara aman dan terisolasi via Blob/DataURL
 */
async function renderCropPhotoToCanvas(photoIndex, data) {
    const { crop = {} } = data;
    const activeRevokers = [];

    try {
        // 1. Muat Logo Resmi secara aman via Blob/DataURL
        let logoImg = null;
        try {
            const logoAsset = await loadImageAsBlob('logo.png', 'Logo Jaya Agrofarm');
            logoImg = logoAsset.imgElement;
            if (typeof logoAsset.revoke === 'function') activeRevokers.push(logoAsset.revoke);
        } catch (logoErr) {
            console.warn('[renderCropPhotoToCanvas] Menggunakan logo vector badge fallback:', logoErr.message);
        }

        // 2. Muat Foto Tanaman Siklus jika ada (Supabase Storage atau eksternal)
        const cropPhotoUrl = crop.photo_url || crop.photoUrl || crop.imageUrl || crop.photo || crop.foto || null;
        let cropPhotoImg = null;
        let isPlaceholder = true;

        if (cropPhotoUrl) {
            try {
                const cropPhotoAsset = await loadImageAsBlob(cropPhotoUrl, 'Foto Siklus');
                cropPhotoImg = cropPhotoAsset.imgElement;
                isPlaceholder = cropPhotoAsset.isPlaceholder;
                if (typeof cropPhotoAsset.revoke === 'function') activeRevokers.push(cropPhotoAsset.revoke);
            } catch (cropErr) {
                console.warn('[renderCropPhotoToCanvas] Pemuatan foto tanaman gagal, sembunyikan foto:', cropErr.message);
                cropPhotoImg = null;
                isPlaceholder = true;
            }
        }

        // 3. Render langsung ke Canvas 2D (1080x1350 px, 100% untainted)
        const canvas = renderCardDirectlyToCanvas2D(photoIndex, data, {
            logoImg,
            cropPhotoImg,
            isCropPhotoPlaceholder: isPlaceholder
        });

        return canvas;
    } finally {
        // Bersihkan object URL setelah render selesai
        setTimeout(() => {
            activeRevokers.forEach(fn => {
                try { fn(); } catch (e) {}
            });
        }, 8000);
    }
}

/**
 * 6. Fallback darurat: 100% vector-only canvas rendering (zero external assets)
 */
function renderEmergencyFallbackCanvas(photoIndex, data) {
    return renderCardDirectlyToCanvas2D(photoIndex, data, {
        logoImg: null,
        cropPhotoImg: null,
        isCropPhotoPlaceholder: true
    });
}

/**
 * 7. Trigger download gambar secara aman via canvas.toBlob()
 */
function exportAndDownloadCanvas(canvas, fileName) {
    return new Promise((resolve, reject) => {
        try {
            if (canvas && canvas.toBlob) {
                canvas.toBlob(blob => {
                    if (!blob) {
                        try {
                            const dataUrl = canvas.toDataURL('image/png');
                            const a = document.createElement('a');
                            a.style.display = 'none';
                            a.href = dataUrl;
                            a.download = fileName;
                            document.body.appendChild(a);
                            a.click();
                            setTimeout(() => {
                                if (a.parentNode) document.body.removeChild(a);
                                resolve();
                            }, 500);
                        } catch (err2) {
                            reject(new Error('Gagal mengekspor canvas: ' + (err2.message || '')));
                        }
                        return;
                    }
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = fileName;
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                        if (a.parentNode) document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        resolve();
                    }, 500);
                }, 'image/png');
            } else {
                const dataUrl = canvas.toDataURL('image/png');
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = dataUrl;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    if (a.parentNode) document.body.removeChild(a);
                    resolve();
                }, 500);
            }
        } catch (err) {
            console.error('[exportAndDownloadCanvas] Error:', err);
            try {
                const dataUrl = canvas.toDataURL('image/png');
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = dataUrl;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    if (a.parentNode) document.body.removeChild(a);
                    resolve();
                }, 500);
            } catch (err3) {
                reject(err3);
            }
        }
    });
}

// Assign to window for global access
if (typeof window !== 'undefined') {
    window.CropPhotoExporter = {
        drawVectorLogoBadge,
        loadImageAsBlob,
        renderCardDirectlyToCanvas2D,
        renderCropPhotoToCanvas,
        renderEmergencyFallbackCanvas,
        exportAndDownloadCanvas
    };
    window.loadImageAsBlob = loadImageAsBlob;
}
