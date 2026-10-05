/**
 * Repositori Database & Multi-Tenant Data Store (Jaya Agrofarm Nusantara)
 * Menyediakan integrasi penuh ke Supabase PostgreSQL untuk seluruh data utama:
 * - crops (Tanaman / Siklus Tanam)
 * - plots (Lahan / Petak)
 * - activities (Aktivitas Perawatan)
 * - inventory (Stok & Saprotan)
 * - finance (Keuangan Kas)
 * Serta kalkulasi siklus biologis & umur tanaman (HST / DAP).
 */

// ====================================================
// MASTER 18 KOMODITAS PERMANEN (TIDAK BOLEH BERUBAH / BERTAMBAH)
// ====================================================
const MASTER_COMMODITIES = {
    'Cabai Rawit': {
        name: 'Cabai Rawit',
        nurseryPhases: [
            { name: 'Fase Semai Awal', shortName: 'Semai Awal', start: 0, end: 7, label: '0–7 HSS', description: 'Persemaian benih, menjaga kelembaban media semai, dan pencegahan rebah kecambah.' },
            { name: 'Fase Semai Lanjut', shortName: 'Semai Lanjut', start: 8, end: 18, label: '8–18 HSS', description: 'Pertumbuhan daun sejati, pemupukan hayati/organik perakaran dosis rendah.' },
            { name: 'Aklimatisasi / Siap Tanam', shortName: 'Siap Tanam', start: 19, end: 25, label: '19–25 HSS', description: 'Pengenalan sinar matahari penuh (hardening) sebelum dipindah tanam ke lahan.' }
        ],
        fieldPhases: [
            { name: 'Fase Vegetatif Awal', shortName: 'Vegetatif Awal', start: 0, end: 25, label: '0–25 HST', description: 'Pemulihan akar pasca pindah tanam, pengairan teratur, dan pemupukan NPK awal.' },
            { name: 'Fase Vegetatif', shortName: 'Vegetatif', start: 26, end: 60, label: '26–60 HST', description: 'Pertumbuhan percabangan dan daun aktif, aplikasi pupuk NPK seimbang.' },
            { name: 'Fase Generatif', shortName: 'Generatif', start: 61, end: 90, label: '61–90 HST', description: 'Pembungaan dan pembuahan lebat, suplai kalium dan kalsium tinggi.' },
            { name: 'Fase Produksi', shortName: 'Produksi', start: 91, end: 120, label: '91–120 HST', description: 'Pematangan buah cabai, panen bertahap, dan pemupukan pemeliharaan.' }
        ],
        phases: [
            { name: 'Fase Semai', shortName: 'Semai', start: 0, end: 25, label: '0–25 Semai', description: 'Persemaian benih, menjaga kelembaban media semai, dan pencegahan rebah kecambah.' },
            { name: 'Fase Vegetatif', shortName: 'Vegetatif', start: 26, end: 60, label: '26–60 Vegetatif', description: 'Pertumbuhan percabangan dan daun aktif, aplikasi pupuk NPK seimbang.' },
            { name: 'Fase Generatif', shortName: 'Generatif', start: 61, end: 120, label: '61–120 Generatif', description: 'Pembungaan dan pembuahan lebat, suplai kalium dan kalsium tinggi.' }
        ],
        harvest: { start: 90, end: 120, label: '90–120 Panen', targetDays: 105 }
    },
    'Cabai Merah': {
        name: 'Cabai Merah',
        phases: [
            { name: 'Fase Semai', shortName: 'Semai', start: 0, end: 25, label: '0–25 Semai', description: 'Persemaian dan adaptasi bibit pada tray semai atau polybag kecil.' },
            { name: 'Fase Vegetatif', shortName: 'Vegetatif', start: 26, end: 60, label: '26–60 Vegetatif', description: 'Pertumbuhan tajuk tanaman dan pengokohan batang utama.' },
            { name: 'Fase Generatif', shortName: 'Generatif', start: 61, end: 120, label: '61–120 Generatif', description: 'Pembungaan, pematangan buah merah, dan panen bertahap.' }
        ],
        harvest: { start: 90, end: 120, label: '90–120 Panen', targetDays: 105 }
    },
    'Tomat': {
        name: 'Tomat',
        phases: [
            { name: 'Fase Semai', shortName: 'Semai', start: 0, end: 25, label: '0–25 Semai', description: 'Penyemaian benih hingga tumbuh 4-5 helai daun sejati.' },
            { name: 'Fase Vegetatif', shortName: 'Vegetatif', start: 26, end: 50, label: '26–50 Vegetatif', description: 'Pemasangan lanjaran/ajir dan pemupukan pembentukan batang tegak.' },
            { name: 'Fase Generatif', shortName: 'Generatif', start: 51, end: 100, label: '51–100 Generatif', description: 'Pembungaan tandan pertama hingga pengisian dan pematangan buah.' }
        ],
        harvest: { start: 75, end: 100, label: '75–100 Panen', targetDays: 85 }
    },
    'Terong': {
        name: 'Terong',
        phases: [
            { name: 'Fase Semai', shortName: 'Semai', start: 0, end: 30, label: '0–30 Semai', description: 'Pembibitan 4-5 minggu hingga perakaran kokoh dan siap pindah tanam.' },
            { name: 'Fase Vegetatif', shortName: 'Vegetatif', start: 31, end: 60, label: '31–60 Vegetatif', description: 'Pertumbuhan percabangan V dan pembentukan daun lebar.' },
            { name: 'Fase Generatif', shortName: 'Generatif', start: 61, end: 100, label: '61–100 Generatif', description: 'Pembungaan ungu dan pembesaran buah terong.' }
        ],
        harvest: { start: 75, end: 100, label: '75–100 Panen', targetDays: 85 }
    },
    'Mentimun': {
        name: 'Mentimun',
        phases: [
            { name: 'Fase Semai', shortName: 'Semai', start: 0, end: 14, label: '0–14 Semai', description: 'Persemaian cepat atau tanam benih langsung pada bedengan berlanjaran.' },
            { name: 'Fase Vegetatif', shortName: 'Vegetatif', start: 15, end: 30, label: '15–30 Vegetatif', description: 'Perambatan sulur aktif dan pembentukan tunas lateral produktif.' },
            { name: 'Fase Generatif', shortName: 'Generatif', start: 31, end: 60, label: '31–60 Generatif', description: 'Pembungaan kuning dan pembesaran buah mentimun yang sangat cepat.' }
        ],
        harvest: { start: 40, end: 60, label: '40–60 Panen', targetDays: 50 }
    },
    'Kacang Panjang': {
        name: 'Kacang Panjang',
        phases: [
            { name: 'Fase Semai', shortName: 'Semai', start: 0, end: 10, label: '0–10 Semai', description: 'Perkecambahan dan pertumbuhan bibit awal di sekitar lanjaran.' },
            { name: 'Fase Vegetatif', shortName: 'Vegetatif', start: 11, end: 25, label: '11–25 Vegetatif', description: 'Perambatan lilitan ke lanjaran dan pembentukan daun majemuk.' },
            { name: 'Fase Generatif', shortName: 'Generatif', start: 26, end: 60, label: '26–60 Generatif', description: 'Pembungaan kupu-kupu dan pemanjangan polong polongan hijau.' }
        ],
        harvest: { start: 45, end: 60, label: '45–60 Panen', targetDays: 55 }
    },
    'Sawi': {
        name: 'Sawi',
        phases: [
            { name: 'Fase Semai', shortName: 'Semai', start: 0, end: 10, label: '0–10 Semai', description: 'Persemaian benih halus pada tray atau bedengan semai terlindung.' },
            { name: 'Fase Vegetatif', shortName: 'Vegetatif', start: 11, end: 25, label: '11–25 Vegetatif', description: 'Pembentukan roset daun hijau segar dan pembesaran pelepah.' },
            { name: 'Fase Panen', shortName: 'Panen', start: 25, end: 40, label: '25–40 Panen', description: 'Pemanenan daun sawi segar sebelum terbentuk kuncup bunga.' }
        ],
        harvest: { start: 25, end: 40, label: '25–40 Panen', targetDays: 32 }
    },
    'Kangkung': {
        name: 'Kangkung',
        phases: [
            { name: 'Fase Semai', shortName: 'Semai', start: 0, end: 7, label: '0–7 Semai', description: 'Perkecambahan biji cepat dan kemunculan kotiledon hijau.' },
            { name: 'Fase Vegetatif', shortName: 'Vegetatif', start: 8, end: 25, label: '8–25 Vegetatif', description: 'Pertumbuhan tunas batang berongga dan helai daun memanjang.' },
            { name: 'Fase Panen', shortName: 'Panen', start: 25, end: 35, label: '25–35 Panen', description: 'Pemanenan cabut atau potong pada umur optimal renyah.' }
        ],
        harvest: { start: 25, end: 35, label: '25–35 Panen', targetDays: 30 }
    },
    'Bayam': {
        name: 'Bayam',
        phases: [
            { name: 'Fase Semai', shortName: 'Semai', start: 0, end: 7, label: '0–7 Semai', description: 'Penyebaran biji halus dan kemunculan bibit rapat seragam.' },
            { name: 'Fase Vegetatif', shortName: 'Vegetatif', start: 8, end: 25, label: '8–25 Vegetatif', description: 'Pembentukan daun bulat oval dan penebalan batang sukulen.' },
            { name: 'Fase Panen', shortName: 'Panen', start: 25, end: 40, label: '25–40 Panen', description: 'Pemanenan cabut sebelum batang mengeras dan berbunga.' }
        ],
        harvest: { start: 25, end: 40, label: '25–40 Panen', targetDays: 30 }
    },
    'Bawang Merah': {
        name: 'Bawang Merah',
        phases: [
            { name: 'Fase Semai / Pembibitan', shortName: 'Semai/Pembibitan', start: 0, end: 10, label: '0–10 Semai', description: 'Penanaman umbi bibit kupas dan pembentukan akar basal.' },
            { name: 'Fase Vegetatif', shortName: 'Vegetatif', start: 11, end: 35, label: '11–35 Vegetatif', description: 'Pertunasan anakan daun silindris dan anakan rumpun produktif.' },
            { name: 'Fase Generatif / Pembentukan Umbi', shortName: 'Generatif/Umbi', start: 36, end: 75, label: '36–75 Generatif', description: 'Diferensiasi dan pembesaran umbi lapis merah keunguan.' }
        ],
        harvest: { start: 60, end: 75, label: '60–75 Panen', targetDays: 68 }
    },
    'Bawang Putih': {
        name: 'Bawang Putih',
        phases: [
            { name: 'Fase Semai / Pembibitan', shortName: 'Semai/Pembibitan', start: 0, end: 10, label: '0–10 Semai', description: 'Penanaman siung bibit terverifikasi pada suhu sejuk dataran tinggi.' },
            { name: 'Fase Vegetatif', shortName: 'Vegetatif', start: 11, end: 45, label: '11–45 Vegetatif', description: 'Pertumbuhan vegetatif daun pipih dan perakaran dalam.' },
            { name: 'Fase Generatif / Pembentukan Umbi', shortName: 'Generatif/Umbi', start: 46, end: 120, label: '46–120 Generatif', description: 'Pembentukan dan pembagian siung umbi dalam tanah.' }
        ],
        harvest: { start: 90, end: 120, label: '90–120 Panen', targetDays: 105 }
    },
    'Jagung': {
        name: 'Jagung',
        phases: [
            { name: 'Fase Semai', shortName: 'Semai', start: 0, end: 14, label: '0–14 Semai', description: 'Perkecambahan dan kemunculan daun V1 hingga V3.' },
            { name: 'Fase Vegetatif', shortName: 'Vegetatif', start: 15, end: 45, label: '15–45 Vegetatif', description: 'Pertumbuhan vegetatif pesat, pembentukan ruas batang, dan inisiasi tongkol.' },
            { name: 'Fase Generatif', shortName: 'Generatif', start: 46, end: 100, label: '46–100 Generatif', description: 'Kemunculan bunga jantan (tassel), rambut tongkol (silking), dan pengisian bulir.' }
        ],
        harvest: { start: 90, end: 110, label: '90–110 Panen', targetDays: 100 }
    },
    'Padi': {
        name: 'Padi',
        phases: [
            { name: 'Persemaian', shortName: 'Persemaian', start: 0, end: 21, label: '0–21 Persemaian', description: 'Persemaian basah/kering 3 minggu hingga siap pindah tanam.' },
            { name: 'Fase Vegetatif', shortName: 'Vegetatif', start: 22, end: 50, label: '22–50 Vegetatif', description: 'Pembentukan anakan aktif, anakan maksimum, dan perbanyakan rumpun.' },
            { name: 'Fase Generatif', shortName: 'Generatif', start: 51, end: 110, label: '51–110 Generatif', description: 'Inisiasi malai (bunting), keluarnya malai (heading), dan pengisian bulir padi.' }
        ],
        harvest: { start: 100, end: 120, label: '100–120 Panen', targetDays: 115 }
    },
    'Padi Ketan': {
        name: 'Padi Ketan',
        phases: [
            { name: 'Persemaian', shortName: 'Persemaian', start: 0, end: 21, label: '0–21 Persemaian', description: 'Persemaian benih ketan hingga perakaran kokoh.' },
            { name: 'Fase Vegetatif', shortName: 'Vegetatif', start: 22, end: 50, label: '22–50 Vegetatif', description: 'Pembentukan rumpun dan penyerapan hara untuk batang.' },
            { name: 'Fase Generatif', shortName: 'Generatif', start: 51, end: 110, label: '51–110 Generatif', description: 'Pengisian bulir amilopektin tinggi khas ketan hingga bernas.' }
        ],
        harvest: { start: 100, end: 120, label: '100–120 Panen', targetDays: 115 }
    },
    'Kedelai': {
        name: 'Kedelai',
        phases: [
            { name: 'Fase Semai', shortName: 'Semai', start: 0, end: 10, label: '0–10 Semai', description: 'Perkecambahan dan pembentukan bintil akar awal (Rhizobium).' },
            { name: 'Fase Vegetatif', shortName: 'Vegetatif', start: 11, end: 35, label: '11–35 Vegetatif', description: 'Pertumbuhan percabangan dan nodul penambat nitrogen aktif.' },
            { name: 'Fase Generatif', shortName: 'Generatif', start: 36, end: 100, label: '36–100 Generatif', description: 'Pembungaan ketiak daun dan pengisian biji polong kedelai.' }
        ],
        harvest: { start: 80, end: 100, label: '80–100 Panen', targetDays: 90 }
    },
    'Kacang Tanah': {
        name: 'Kacang Tanah',
        phases: [
            { name: 'Fase Semai', shortName: 'Semai', start: 0, end: 10, label: '0–10 Semai', description: 'Perkecambahan benih polong dalam tanah gembur.' },
            { name: 'Fase Vegetatif', shortName: 'Vegetatif', start: 11, end: 35, label: '11–35 Vegetatif', description: 'Pertumbuhan daun tetrafoliat dan pengokohan kanopi.' },
            { name: 'Fase Generatif', shortName: 'Generatif', start: 36, end: 110, label: '36–110 Generatif', description: 'Pembungaan kuning dan penusukan ginofor (calon polong) ke dalam tanah.' }
        ],
        harvest: { start: 90, end: 110, label: '90–110 Panen', targetDays: 100 }
    },
    'Semangka': {
        name: 'Semangka',
        phases: [
            { name: 'Fase Semai', shortName: 'Semai', start: 0, end: 14, label: '0–14 Semai', description: 'Persemaian benih berkulit keras pada polybag semai.' },
            { name: 'Fase Vegetatif', shortName: 'Vegetatif', start: 15, end: 35, label: '15–35 Vegetatif', description: 'Pemangkasan cabang primer dan pemeliharaan 2-3 cabang produktif.' },
            { name: 'Fase Generatif', shortName: 'Generatif', start: 36, end: 80, label: '36–80 Generatif', description: 'Penyerbukan bunga betina daun ke-12 dan pembesaran buah semangka.' }
        ],
        harvest: { start: 60, end: 80, label: '60–80 Panen', targetDays: 70 }
    },
    'Melon': {
        name: 'Melon',
        phases: [
            { name: 'Fase Semai', shortName: 'Semai', start: 0, end: 14, label: '0–14 Semai', description: 'Penyemaian higienis pada greenhouse atau sungkup pembibitan.' },
            { name: 'Fase Vegetatif', shortName: 'Vegetatif', start: 15, end: 35, label: '15–35 Vegetatif', description: 'Perambatan vertikal pada tali ajir dan pewiwilan tunas air.' },
            { name: 'Fase Generatif', shortName: 'Generatif', start: 36, end: 75, label: '36–75 Generatif', description: 'Seleksi 1-2 buah terbaik per pohon, pembentukan jaring (netting), dan peningkatan brix.' }
        ],
        harvest: { start: 60, end: 75, label: '60–75 Panen', targetDays: 68 }
    }
};

const MASTER_COMMODITY_NAMES = Object.keys(MASTER_COMMODITIES);

function matchMasterCommodity(rawName) {
    if (!rawName) return 'Padi';
    const clean = String(rawName).trim();
    if (MASTER_COMMODITIES[clean]) return clean;

    const lower = clean.toLowerCase();
    for (const name of MASTER_COMMODITY_NAMES) {
        if (name.toLowerCase() === lower) return name;
    }
    for (const name of MASTER_COMMODITY_NAMES) {
        if (lower.startsWith(name.toLowerCase())) return name;
    }
    for (const name of MASTER_COMMODITY_NAMES) {
        if (lower.includes(name.toLowerCase()) || name.toLowerCase().includes(lower)) {
            return name;
        }
    }
    return 'Padi';
}

window.MASTER_COMMODITIES = MASTER_COMMODITIES;
window.MASTER_COMMODITY_NAMES = MASTER_COMMODITY_NAMES;
window.matchMasterCommodity = matchMasterCommodity;

// ====================================================
// FUNGSI HELPER TANGGAL & UMUR TANAMAN (HSS VS HST)
// ====================================================
function parseDateParts(dateInput) {
    if (!dateInput) return null;
    if (dateInput instanceof Date) {
        return {
            year: dateInput.getFullYear(),
            month: dateInput.getMonth(),
            day: dateInput.getDate()
        };
    }
    const str = String(dateInput).trim().split('T')[0];
    const parts = str.split('-');
    if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
            return { year: y, month: m, day: d };
        }
    }
    const dObj = new Date(dateInput);
    if (!isNaN(dObj.getTime())) {
        return { year: dObj.getFullYear(), month: dObj.getMonth(), day: dObj.getDate() };
    }
    return null;
}

function calculateDayDifference(fromInput, toInput) {
    const fromP = parseDateParts(fromInput);
    const toP = parseDateParts(toInput);
    if (!fromP || !toP) return 0;
    const utcFrom = Date.UTC(fromP.year, fromP.month, fromP.day);
    const utcTo = Date.UTC(toP.year, toP.month, toP.day);
    return Math.floor((utcTo - utcFrom) / 86400000);
}

function extractAgroDatesFromNotes(notes) {
    if (!notes || typeof notes !== 'string') return { seedingDate: null, transplantDate: null, plantingMethod: null, cleanNotes: notes || '' };
    const match = notes.match(/\[AGRO_DATES:seeding=([^,\]]*),transplant=([^,\]]*)(?:,method=([^\]]*))?\]/);
    if (match) {
        return {
            seedingDate: match[1] || null,
            transplantDate: match[2] || null,
            plantingMethod: match[3] || null,
            cleanNotes: notes.replace(match[0], '').trim()
        };
    }
    return { seedingDate: null, transplantDate: null, plantingMethod: null, cleanNotes: notes };
}

function embedAgroDatesInNotes(notes, seedingDate, transplantDate, plantingMethod = 'nursery_transplant') {
    const clean = (notes || '').replace(/\[AGRO_DATES:[^\]]*\]/g, '').trim();
    const tag = `[AGRO_DATES:seeding=${seedingDate || ''},transplant=${transplantDate || ''},method=${plantingMethod || ''}]`;
    return clean ? `${clean}\n${tag}` : tag;
}

window.parseDateParts = parseDateParts;
window.calculateDayDifference = calculateDayDifference;
window.extractAgroDatesFromNotes = extractAgroDatesFromNotes;
window.embedAgroDatesInNotes = embedAgroDatesInNotes;

// ====================================================
// CORE DATABASE SERVICE TERHUBUNG KE SUPABASE POSTGRESQL
// ====================================================
class FarmDatabaseService {
    constructor() {
        this.currentTenantId = null;
        this.plots = [];
        this.crops = [];
        this.activities = [];
        this.inventory = [];
        this.finance = [];
        this.observations = [];
        this.feedbacks = [];
        this.isLoaded = false;
    }

    setTenant(tenantId) {
        if (!tenantId) throw new Error('Tenant akun belum teridentifikasi.');
        this.currentTenantId = tenantId;
    }

    getService() {
        return window.databaseService || null;
    }

    getAppToday(refDate = null) {
        if (refDate) {
            const p = parseDateParts(refDate);
            if (p) return p;
        }
        if (typeof document !== 'undefined') {
            const todayInput = document.getElementById('ai-input-today-date');
            if (todayInput && todayInput.value) {
                const p = parseDateParts(todayInput.value);
                if (p) return p;
            }
        }
        const now = new Date();
        return {
            year: now.getFullYear(),
            month: now.getMonth(),
            day: now.getDate()
        };
    }

    calculateAgeBreakdown(seedingDate, transplantDate, refDate = null, plantingMethod = 'nursery_transplant', plantDate = null) {
        const todayParts = this.getAppToday(refDate);
        const utcToday = Date.UTC(todayParts.year, todayParts.month, todayParts.day);

        const isDirect = (plantingMethod === 'direct_sowing' || plantingMethod === 'direct_planting');

        if (isDirect) {
            // Tanam langsung: TIDAK ADA HSS!
            // HST = hari ini - tanggal tanam
            const baseDate = plantDate || transplantDate || seedingDate;
            let hst = 0;
            if (baseDate) {
                const bParts = parseDateParts(baseDate);
                if (bParts) {
                    const utcB = Date.UTC(bParts.year, bParts.month, bParts.day);
                    hst = Math.max(0, Math.floor((utcToday - utcB) / 86400000));
                }
            }
            return {
                hss: null,
                hst: hst,
                isTransplanted: true,
                isDirect: true,
                transplantStatus: plantingMethod === 'direct_sowing' ? 'Tanam Biji Langsung (HST)' : 'Tanam Umbi/Stek Langsung (HST)',
                todayParts,
                todayDateStr: `${todayParts.year}-${String(todayParts.month + 1).padStart(2, '0')}-${String(todayParts.day).padStart(2, '0')}`
            };
        }

        let hss = 0;
        if (seedingDate) {
            const sParts = parseDateParts(seedingDate);
            if (sParts) {
                const utcS = Date.UTC(sParts.year, sParts.month, sParts.day);
                hss = Math.max(0, Math.floor((utcToday - utcS) / 86400000));
            }
        }

        let hst = null;
        let isTransplanted = false;
        let transplantStatus = 'Persemaian (HSS)';

        if (transplantDate && String(transplantDate).trim() !== '') {
            const tParts = parseDateParts(transplantDate);
            if (tParts) {
                const utcT = Date.UTC(tParts.year, tParts.month, tParts.day);
                const diffDays = Math.floor((utcToday - utcT) / 86400000);
                if (diffDays >= 0) {
                    hst = diffDays;
                    isTransplanted = true;
                    transplantStatus = 'Fase Lahan (HST)';
                } else {
                    hst = null;
                    isTransplanted = false;
                    transplantStatus = 'Persemaian (Menunggu Pindah Tanam)';
                }
            }
        }

        return {
            hss,
            hst,
            isTransplanted,
            isDirect: false,
            transplantStatus,
            todayParts,
            todayDateStr: `${todayParts.year}-${String(todayParts.month + 1).padStart(2, '0')}-${String(todayParts.day).padStart(2, '0')}`
        };
    }

    getFieldPhases(commConfig) {
        if (window.SmartCropEngine && commConfig) {
            const comm = matchMasterCommodity(commConfig.name || 'Cabai Rawit');
            const stages = window.SmartCropEngine.getStagesForCommodity(comm);
            if (stages && stages.length > 0) {
                return stages.map(s => ({
                    code: s.code,
                    name: s.name,
                    shortName: s.shortName,
                    start: s.min_hst,
                    end: s.max_hst,
                    label: `${s.min_hst}–${s.max_hst} HST`,
                    description: s.description,
                    stage_group: s.stage_group
                }));
            }
        }
        if (commConfig.fieldPhases && commConfig.fieldPhases.length > 0) {
            return commConfig.fieldPhases;
        }
        const maxHarvest = commConfig.harvest?.end || commConfig.harvest?.targetDays || 120;
        return [
            { name: 'Fase Vegetatif Awal', shortName: 'Vegetatif Awal', start: 0, end: 25, label: '0–25 HST', description: 'Pemulihan akar pasca pindah tanam, pengairan teratur, dan pemupukan NPK awal.' },
            { name: 'Fase Vegetatif Aktif', shortName: 'Vegetatif Aktif', start: 26, end: 40, label: '26–40 HST', description: 'Pertumbuhan percabangan dan daun aktif, aplikasi pupuk NPK seimbang.' },
            { name: 'Transisi Generatif', shortName: 'Transisi Generatif', start: 41, end: 50, label: '41–50 HST', description: 'Inisiasi kuncup bunga pertama, persiapan nutrisi fosfat dan kalium.' },
            { name: 'Pembungaan & Fruit Set', shortName: 'Bunga & Buah', start: 51, end: 70, label: '51–70 HST', description: 'Bunga mekar serempak dan pembentukan pentil buah.' },
            { name: 'Pembentukan Buah', shortName: 'Pembesaran Buah', start: 71, end: 90, label: '71–90 HST', description: 'Pembesaran buah dan pematangan.' },
            { name: 'Produksi & Panen', shortName: 'Produksi', start: 91, end: maxHarvest, label: `91–${maxHarvest} HST`, description: 'Panen berkala dan pemeliharaan lanjutan.' }
        ];
    }

    getNurseryPhases(commConfig) {
        if (commConfig.nurseryPhases && commConfig.nurseryPhases.length > 0) {
            return commConfig.nurseryPhases;
        }
        return [
            { name: 'Fase Semai Awal', shortName: 'Semai Awal', start: 0, end: 7, label: '0–7 HSS', description: 'Persemaian benih, menjaga kelembaban media semai, dan pencegahan rebah kecambah.' },
            { name: 'Fase Semai Lanjut', shortName: 'Semai Lanjut', start: 8, end: 18, label: '8–18 HSS', description: 'Pertumbuhan daun sejati, pemupukan hayati/organik perakaran dosis rendah.' },
            { name: 'Aklimatisasi / Siap Tanam', shortName: 'Siap Tanam', start: 19, end: 25, label: '19–25 HSS', description: 'Pengenalan sinar matahari penuh (hardening) sebelum dipindah tanam ke lahan.' }
        ];
    }

    // Normalisasi Entitas Supabase ke Model Aplikasi
    normalizeCrop(c) {
        if (!c) return null;
        const comm = matchMasterCommodity(c.commodity || 'Cabai Rawit');
        const extracted = extractAgroDatesFromNotes(c.notes);

        const defaultMethod = window.SmartCropEngine ? window.SmartCropEngine.getDefaultPlantingMethod(comm) : 'nursery_transplant';
        const plantingMethod = c.planting_method || c.plantingMethod || extracted.plantingMethod || defaultMethod;
        const isDirect = (plantingMethod === 'direct_sowing' || plantingMethod === 'direct_planting');

        let seedingDate = isDirect ? null : (c.seeding_date || c.seedingDate || extracted.seedingDate || null);
        let transplantDate = isDirect ? null : (c.transplant_date !== undefined ? c.transplant_date : (c.transplantDate !== undefined ? c.transplantDate : extracted.transplantDate));
        if (transplantDate === '' || transplantDate === undefined) transplantDate = null;

        const plantDate = isDirect
            ? (c.plant_date || c.planting_date || extracted.transplantDate || extracted.seedingDate || new Date().toISOString().slice(0, 10))
            : (transplantDate || c.plant_date || c.planting_date || seedingDate || new Date().toISOString().slice(0, 10));
        const harvestDate = c.est_harvest_date || c.harvest_date || null;
        const actualHarvestDate = c.actual_first_harvest_date || c.actualFirstHarvestDate || null;

        return {
            id: String(c.id),
            tenant_id: c.tenant_id || this.currentTenantId,
            plot_id: c.plot_id || c.plotId || 'plot-1',
            plotId: c.plot_id || c.plotId || 'plot-1',
            legacy_id: c.legacy_id || null,
            cycle_code: c.cycle_code || c.cycleCode || `Siklus #${c.id}`,
            cycleCode: c.cycle_code || c.cycleCode || `Siklus #${c.id}`,
            petak_id: c.petak_id || c.plot_id || 'plot-1',
            petak_name: c.petak_name || c.petakName || 'Blok A',
            petakName: c.petak_name || c.petakName || 'Blok A',
            commodity: comm,
            variety: c.variety || '',
            planting_method: plantingMethod,
            plantingMethod: plantingMethod,
            isDirectMethod: isDirect,
            actual_first_harvest_date: actualHarvestDate,
            actualFirstHarvestDate: actualHarvestDate,
            seeding_date: seedingDate ? (typeof seedingDate === 'string' ? seedingDate.slice(0, 10) : seedingDate) : null,
            seedingDate: seedingDate ? (typeof seedingDate === 'string' ? seedingDate.slice(0, 10) : seedingDate) : null,
            transplant_date: transplantDate ? (typeof transplantDate === 'string' ? transplantDate.slice(0, 10) : transplantDate) : null,
            transplantDate: transplantDate ? (typeof transplantDate === 'string' ? transplantDate.slice(0, 10) : transplantDate) : null,
            plant_date: typeof plantDate === 'string' ? plantDate.slice(0, 10) : plantDate,
            plantDate: typeof plantDate === 'string' ? plantDate.slice(0, 10) : plantDate,
            est_harvest_date: harvestDate,
            estHarvestDate: typeof harvestDate === 'string' ? harvestDate.slice(0, 10) : harvestDate,
            luas_lahan: Number(c.luas_lahan || c.luasLahan || c.area || 0),
            luasLahan: Number(c.luas_lahan || c.luasLahan || c.area || 0),
            jumlah_tanaman: Number(c.jumlah_tanaman || c.jumlahTanaman || c.plant_count || 0),
            jumlahTanaman: Number(c.jumlah_tanaman || c.jumlahTanaman || c.plant_count || 0),
            umur_tanaman: c.umur_tanaman !== undefined && c.umur_tanaman !== null ? Number(c.umur_tanaman) : undefined,
            target_yield: Number(c.target_yield || c.targetYield || 0),
            targetYield: Number(c.target_yield || c.targetYield || 0),
            photo_url: c.photo_url || c.photoUrl || c.photo || c.imageUrl || c.image || c.foto || null,
            photoUrl: c.photo_url || c.photoUrl || c.photo || c.imageUrl || c.image || c.foto || null,
            stage: c.stage || (transplantDate || isDirect ? 'Fase Vegetatif' : 'Semai'),
            progress: Number(c.progress || 1),
            status: c.status || 'growing',
            notes: c.notes || '',
            created_at: c.created_at || new Date().toISOString(),
            updated_at: c.updated_at || new Date().toISOString()
        };
    }

    normalizePlot(p) {
        if (!p) return null;
        return {
            id: String(p.id),
            tenant_id: p.tenant_id || this.currentTenantId,
            legacy_id: p.legacy_id || null,
            name: p.name || 'Blok Lahan',
            area: Number(p.area || 0),
            soil_type: p.soil_type || p.soilType || 'Lempung Aluvial',
            soilType: p.soil_type || p.soilType || 'Lempung Aluvial',
            irrigation_type: p.irrigation_type || p.irrigationType || 'Irigasi Teknis',
            irrigationType: p.irrigation_type || p.irrigationType || 'Irigasi Teknis',
            status: p.status || 'active',
            location: p.location || '',
            notes: p.notes || '',
            created_at: p.created_at || new Date().toISOString(),
            updated_at: p.updated_at || new Date().toISOString()
        };
    }

    normalizeActivity(a) {
        if (!a) return null;
        const actDate = a.activity_date || a.date || new Date().toISOString().slice(0, 10);
        return {
            id: String(a.id),
            tenant_id: a.tenant_id || this.currentTenantId,
            crop_id: a.crop_id || a.cropId || a.batch_id || '',
            cropId: a.crop_id || a.cropId || a.batch_id || '',
            batch_id: a.crop_id || a.cropId || a.batch_id || '',
            legacy_id: a.legacy_id || null,
            activity_date: actDate,
            date: typeof actDate === 'string' ? actDate.slice(0, 10) : actDate,
            type: a.type || a.activity_type || 'Perawatan',
            title: a.title || 'Aktivitas Perawatan',
            description: a.description || a.content || '',
            cost: Number(a.cost || 0),
            worker_count: Number(a.worker_count || a.workerCount || 1),
            workerCount: Number(a.worker_count || a.workerCount || 1),
            status: a.status || 'completed',
            created_at: a.created_at || new Date().toISOString(),
            updated_at: a.updated_at || new Date().toISOString()
        };
    }

    normalizeInventory(i) {
        if (!i) return null;
        return {
            id: String(i.id),
            tenant_id: i.tenant_id || this.currentTenantId,
            legacy_id: i.legacy_id || null,
            name: i.name || 'Barang Saprotan',
            category: i.category || 'Saprotan',
            stock: Number(i.stock || 0),
            unit: i.unit || 'unit',
            min_stock: Number(i.min_stock || i.minStock || 0),
            minStock: Number(i.min_stock || i.minStock || 0),
            unit_price: Number(i.unit_price || i.unitPrice || 0),
            unitPrice: Number(i.unit_price || i.unitPrice || 0),
            location: i.location || '',
            notes: i.notes || '',
            created_at: i.created_at || new Date().toISOString(),
            updated_at: i.updated_at || new Date().toISOString()
        };
    }

    normalizeFinance(f) {
        if (!f) return null;
        const transDate = f.transaction_date || f.date || new Date().toISOString().slice(0, 10);
        const plotId = (f.plot_id || f.plotId) && String(f.plot_id || f.plotId).trim() !== '' ? String(f.plot_id || f.plotId) : null;
        const cropId = (f.crop_id || f.cropId) && String(f.crop_id || f.cropId).trim() !== '' ? String(f.crop_id || f.cropId) : null;
        return {
            id: String(f.id),
            tenant_id: f.tenant_id || this.currentTenantId,
            plot_id: plotId,
            plotId: plotId,
            crop_id: cropId,
            cropId: cropId,
            legacy_id: f.legacy_id || null,
            transaction_date: transDate,
            date: typeof transDate === 'string' ? transDate.slice(0, 10) : transDate,
            type: f.type || 'expense',
            category: f.category || 'Operasional',
            title: f.title || 'Transaksi Kas',
            amount: Number(f.amount || 0),
            notes: f.notes || '',
            created_at: f.created_at || new Date().toISOString(),
            updated_at: f.updated_at || new Date().toISOString()
        };
    }

    // ====================================================
    // PEMUATAN DATA LENGKAP DARI SUPABASE POSTGRESQL
    // ====================================================
    async loadAllData(tenantId) {
        if (tenantId) this.currentTenantId = tenantId;
        const s = this.getService();
        if (!s) {
            console.warn('[Database] Supabase service belum tersedia di window');
            return;
        }

        try {
            const [plotsRes, cropsRes, actRes, invRes, finRes, obsRes, fbRes] = await Promise.all([
                s.getPlots(this.currentTenantId),
                s.getCrops(this.currentTenantId),
                s.getActivities(this.currentTenantId),
                s.getInventory(this.currentTenantId),
                s.getFinance(this.currentTenantId),
                (s.getBatchObservations ? s.getBatchObservations(null, this.currentTenantId) : Promise.resolve([])),
                (s.getBatchFeedbacks ? s.getBatchFeedbacks(null, this.currentTenantId) : Promise.resolve([]))
            ]);

            this.plots = (plotsRes || []).map(p => this.normalizePlot(p));
            this.crops = (cropsRes || []).map(c => this.normalizeCrop(c));
            this.activities = (actRes || []).map(a => this.normalizeActivity(a));
            this.inventory = (invRes || []).map(i => this.normalizeInventory(i));
            this.finance = (finRes || []).map(f => this.normalizeFinance(f));
            this.observations = obsRes || [];
            this.feedbacks = fbRes || [];
            this.isLoaded = true;

            // Jika plots di Supabase masih kosong, inisialisasi minimal 1 petak lahan utama ke Supabase
            if (this.plots.length === 0) {
                try {
                    const defaultPlot = await s.createPlot({
                        tenant_id: this.currentTenantId,
                        name: 'Blok A (Utama)',
                        area: 10000,
                        soil_type: 'Lempung Aluvial Subur',
                        irrigation_type: 'Irigasi Teknis',
                        status: 'active',
                        location: 'Kawasan Inti Pertanian',
                        notes: 'Lahan utama budidaya'
                    });
                    if (defaultPlot) {
                        this.plots.push(this.normalizePlot(defaultPlot));
                    }
                } catch (initErr) {
                    console.warn('[Supabase] Inisialisasi blok lahan awal:', initErr);
                }
            }

            return {
                plots: this.plots,
                crops: this.crops,
                activities: this.activities,
                inventory: this.inventory,
                finance: this.finance,
                observations: this.observations,
                feedbacks: this.feedbacks
            };
        } catch (err) {
            console.error('[Supabase loadAllData Error]:', err);
            throw err;
        }
    }

    async loadUserBatches() {
        return this.loadAllData(this.currentTenantId);
    }

    // ====================================================
    // OBSERVASI LAPANGAN & FEEDBACK (Multi-Tenant)
    // ====================================================
    // 0. BATCH GROWTH OBSERVATIONS & FEEDBACKS
    // ====================================================
    getObservations(batchId = null) {
        if (!batchId) return this.observations || [];
        const strId = String(batchId).trim();
        const crop = this.getCropById(strId);
        const validIds = new Set([strId]);
        if (crop) {
            if (crop.id) validIds.add(String(crop.id).trim());
            if (crop.legacy_id) validIds.add(String(crop.legacy_id).trim());
            if (crop.cycle_code) validIds.add(String(crop.cycle_code).trim());
            if (crop.cycleCode) validIds.add(String(crop.cycleCode).trim());
        }
        return (this.observations || []).filter(o => {
            const bId = String(o.batch_id || o.crop_id || '').trim();
            return validIds.has(bId);
        });
    }

    async saveObservation(obsData) {
        const s = this.getService();
        if (!s) throw new Error('Koneksi Supabase belum siap');
        const payload = {
            ...obsData,
            tenant_id: this.currentTenantId
        };
        const result = s.createBatchObservation ? await s.createBatchObservation(payload) : payload;
        const fresh = s.getBatchObservations ? await s.getBatchObservations(null, this.currentTenantId) : [];
        this.observations = fresh || [];
        if (result && !this.observations.some(o => String(o.id) === String(result.id))) {
            this.observations.unshift(result);
        }
        return result;
    }

    async deleteObservation(id) {
        const s = this.getService();
        if (!s) throw new Error('Koneksi Supabase belum siap');
        if (s.deleteBatchObservation) {
            await s.deleteBatchObservation(id, this.currentTenantId);
        }
        const fresh = s.getBatchObservations ? await s.getBatchObservations(null, this.currentTenantId) : [];
        this.observations = (fresh || []).filter(o => String(o.id) !== String(id));
        return true;
    }

    getFeedbacks(batchId = null) {
        if (!batchId) return this.feedbacks || [];
        const strId = String(batchId).trim();
        const crop = this.getCropById(strId);
        const validIds = new Set([strId]);
        if (crop) {
            if (crop.id) validIds.add(String(crop.id).trim());
            if (crop.legacy_id) validIds.add(String(crop.legacy_id).trim());
            if (crop.cycle_code) validIds.add(String(crop.cycle_code).trim());
            if (crop.cycleCode) validIds.add(String(crop.cycleCode).trim());
        }
        return (this.feedbacks || []).filter(f => {
            const bId = String(f.batch_id || f.crop_id || '').trim();
            return validIds.has(bId);
        });
    }

    async saveFeedback(fbData) {
        const s = this.getService();
        if (!s) throw new Error('Koneksi Supabase belum siap');
        const payload = {
            ...fbData,
            tenant_id: this.currentTenantId
        };
        const result = s.createBatchFeedback ? await s.createBatchFeedback(payload) : payload;
        const fresh = s.getBatchFeedbacks ? await s.getBatchFeedbacks(null, this.currentTenantId) : [];
        this.feedbacks = fresh || [];
        if (result && !this.feedbacks.some(f => String(f.id) === String(result.id))) {
            this.feedbacks.unshift(result);
        }
        return result;
    }

    // ====================================================
    // 1. CROPS / TANAMAN (Supabase CRUD)
    // ====================================================
    getCrops() {
        return this.crops || [];
    }

    getCropById(idOrCode) {
        if (!idOrCode) return null;
        const search = String(idOrCode).trim().toLowerCase();
        let found = this.crops.find(c => c.id && c.id.toLowerCase() === search);
        if (found) return found;
        found = this.crops.find(c => c.cycle_code && c.cycle_code.toLowerCase() === search);
        if (found) return found;
        found = this.crops.find(c => c.cycleCode && c.cycleCode.toLowerCase() === search);
        return found || null;
    }

    async saveCrop(cropData) {
        const s = this.getService();
        if (!s) throw new Error('Koneksi Supabase belum siap');

        const comm = matchMasterCommodity(cropData.commodity);
        const defaultMethod = window.SmartCropEngine ? window.SmartCropEngine.getDefaultPlantingMethod(comm) : 'nursery_transplant';
        const plantingMethod = cropData.plantingMethod || cropData.planting_method || defaultMethod;
        const isDirect = (plantingMethod === 'direct_sowing' || plantingMethod === 'direct_planting');

        let seedingDate = isDirect ? null : (cropData.seedingDate || cropData.seeding_date || null);
        let transplantDate = isDirect ? null : (cropData.transplantDate || cropData.transplant_date || null);
        if (transplantDate === '' || transplantDate === undefined) transplantDate = null;
        let plantDate = isDirect ? (cropData.plantDate || cropData.plant_date || new Date().toISOString().slice(0, 10)) : (transplantDate || seedingDate || new Date().toISOString().slice(0, 10));

        const payload = {
            tenant_id: this.currentTenantId,
            plot_id: cropData.plotId || cropData.plot_id || 'plot-1',
            legacy_id: cropData.legacy_id || null,
            cycle_code: cropData.cycleCode || cropData.cycle_code || `Siklus #${String(this.crops.length + 1).padStart(3, '0')}`,
            petak_id: cropData.petakId || cropData.plotId || cropData.plot_id || 'plot-1',
            petak_name: cropData.petakName || cropData.petak_name || 'Blok A',
            commodity: comm,
            variety: cropData.variety || '',
            planting_method: plantingMethod,
            seeding_date: seedingDate,
            transplant_date: transplantDate,
            plant_date: plantDate,
            est_harvest_date: cropData.estHarvestDate || cropData.est_harvest_date || null,
            actual_first_harvest_date: cropData.actualFirstHarvestDate || cropData.actual_first_harvest_date || null,
            luas_lahan: Number(cropData.luasLahan || cropData.luas_lahan || 0),
            jumlah_tanaman: Number(cropData.jumlahTanaman || cropData.jumlah_tanaman || 0),
            umur_tanaman: cropData.umur_tanaman !== undefined ? Number(cropData.umur_tanaman) : undefined,
            target_yield: Number(cropData.targetYield || cropData.target_yield || 0),
            stage: cropData.stage || (transplantDate || isDirect ? 'Fase Vegetatif' : 'Semai'),
            progress: Number(cropData.progress || 1),
            status: cropData.status || (cropData.progress >= 100 ? 'harvested' : 'growing'),
            notes: embedAgroDatesInNotes(cropData.notes, seedingDate, transplantDate, plantingMethod)
        };

        let result = null;
        if (cropData.id && !String(cropData.id).startsWith('crop-temp')) {
            // UPDATE ke Supabase
            result = await s.updateCrop(cropData.id, payload);
        } else {
            // INSERT ke Supabase
            result = await s.createCrop(payload);
        }

        // Muat ulang dari Supabase untuk menjamin konsistensi
        const fresh = await s.getCrops(this.currentTenantId);
        this.crops = fresh.map(c => this.normalizeCrop(c));
        return this.normalizeCrop(result);
    }

    async deleteCrop(id) {
        const s = this.getService();
        if (!s) throw new Error('Koneksi Supabase belum siap');

        await s.deleteCrop(id);
        const fresh = await s.getCrops(this.currentTenantId);
        this.crops = fresh.map(c => this.normalizeCrop(c));
        return true;
    }

    // ====================================================
    // 2. PLOTS / LAHAN (Supabase CRUD)
    // ====================================================
    getPlots() {
        return this.plots || [];
    }

    getPlotById(id) {
        if (!id) return null;
        return this.plots.find(p => p.id === String(id)) || null;
    }

    async savePlot(plotData) {
        const s = this.getService();
        if (!s) throw new Error('Koneksi Supabase belum siap');

        const payload = {
            tenant_id: this.currentTenantId,
            name: plotData.name,
            area: Number(plotData.area || 0),
            soil_type: plotData.soilType || plotData.soil_type || 'Lempung Aluvial',
            irrigation_type: plotData.irrigationType || plotData.irrigation_type || 'Irigasi Teknis',
            status: plotData.status || 'active',
            location: plotData.location || '',
            notes: plotData.notes || ''
        };

        let result = null;
        if (plotData.id && !String(plotData.id).startsWith('plot-temp')) {
            // UPDATE ke Supabase
            result = await s.updatePlot(plotData.id, payload);
        } else {
            // INSERT ke Supabase
            result = await s.createPlot(payload);
        }

        // Refresh dari Supabase
        const fresh = await s.getPlots(this.currentTenantId);
        this.plots = fresh.map(p => this.normalizePlot(p));
        return this.normalizePlot(result);
    }

    async deletePlot(id) {
        const s = this.getService();
        if (!s) throw new Error('Koneksi Supabase belum siap');

        await s.deletePlot(id);
        const fresh = await s.getPlots(this.currentTenantId);
        this.plots = fresh.map(p => this.normalizePlot(p));
        return true;
    }

    // ====================================================
    // 3. ACTIVITIES / AKTIVITAS PERAWATAN (Supabase CRUD)
    // ====================================================
    getActivities() {
        return this.activities || [];
    }

    async saveActivity(actData) {
        const s = this.getService();
        if (!s) throw new Error('Koneksi Supabase belum siap');

        const payload = {
            tenant_id: this.currentTenantId,
            crop_id: String(actData.cropId || actData.crop_id || actData.batch_id || ''),
            activity_date: actData.date || actData.activity_date || new Date().toISOString().slice(0, 10),
            type: actData.type || 'Perawatan',
            title: actData.title,
            description: actData.description || actData.content || '',
            cost: Number(actData.cost || 0),
            worker_count: Number(actData.workerCount || actData.worker_count || 1),
            status: actData.status || 'completed'
        };

        let result = null;
        if (actData.id && !String(actData.id).startsWith('act-temp')) {
            // UPDATE ke Supabase
            result = await s.updateActivity(actData.id, payload);
        } else {
            // INSERT ke Supabase
            result = await s.createActivity(payload);
        }

        // Refresh dari Supabase
        const fresh = await s.getActivities(this.currentTenantId);
        this.activities = fresh.map(a => this.normalizeActivity(a));
        return this.normalizeActivity(result);
    }

    async deleteActivity(id) {
        const s = this.getService();
        if (!s) throw new Error('Koneksi Supabase belum siap');

        await s.deleteActivity(id);
        const fresh = await s.getActivities(this.currentTenantId);
        this.activities = fresh.map(a => this.normalizeActivity(a));
        return true;
    }

    // ====================================================
    // 4. INVENTORY / STOK & SAPROTAN (Supabase CRUD)
    // ====================================================
    getInventory() {
        return this.inventory || [];
    }

    async saveInventoryItem(itemData) {
        const s = this.getService();
        if (!s) throw new Error('Koneksi Supabase belum siap');

        const payload = {
            tenant_id: this.currentTenantId,
            name: itemData.name,
            category: itemData.category || 'Saprotan',
            stock: Number(itemData.stock || 0),
            unit: itemData.unit || 'unit',
            min_stock: Number(itemData.minStock || itemData.min_stock || 0),
            unit_price: Number(itemData.unitPrice || itemData.unit_price || 0),
            location: itemData.location || '',
            notes: itemData.notes || ''
        };

        let result = null;
        if (itemData.id && !String(itemData.id).startsWith('inv-temp')) {
            // UPDATE ke Supabase
            result = await s.updateInventory(itemData.id, payload);
        } else {
            // INSERT ke Supabase
            result = await s.createInventory(payload);
        }

        // Refresh dari Supabase
        const fresh = await s.getInventory(this.currentTenantId);
        this.inventory = fresh.map(i => this.normalizeInventory(i));
        return this.normalizeInventory(result);
    }

    async deleteInventoryItem(id) {
        const s = this.getService();
        if (!s) throw new Error('Koneksi Supabase belum siap');

        await s.deleteInventory(id);
        const fresh = await s.getInventory(this.currentTenantId);
        this.inventory = fresh.map(i => this.normalizeInventory(i));
        return true;
    }

    async adjustStock(id, delta) {
        const s = this.getService();
        if (!s) throw new Error('Koneksi Supabase belum siap');

        const item = this.inventory.find(i => i.id === String(id));
        if (!item) throw new Error('Barang tidak ditemukan di inventaris');

        const newStock = Math.max(0, Number(item.stock || 0) + Number(delta));
        const updated = await s.updateInventory(id, { stock: newStock });

        const fresh = await s.getInventory(this.currentTenantId);
        this.inventory = fresh.map(i => this.normalizeInventory(i));
        return this.normalizeInventory(updated);
    }

    // ====================================================
    // 5. FINANCE / KEUANGAN KAS (Supabase CRUD)
    // ====================================================
    getFinance(filters = null) {
        if (!this.finance) return [];
        if (!filters) return this.finance;
        return this.finance.filter(f => {
            if (filters.type && filters.type !== 'all' && f.type !== filters.type) return false;
            if (filters.plotId && filters.plotId !== 'all') {
                if (filters.plotId === 'general') {
                    if (f.plot_id || f.crop_id) return false;
                } else if (String(f.plot_id) !== String(filters.plotId)) {
                    return false;
                }
            }
            if (filters.cropId && filters.cropId !== 'all') {
                if (filters.cropId === 'general') {
                    if (f.crop_id) return false;
                } else if (String(f.crop_id) !== String(filters.cropId)) {
                    return false;
                }
            }
            return true;
        });
    }

    getCropFinanceSummary(cropId) {
        if (!cropId || !this.finance) {
            return { totalIncome: 0, totalExpense: 0, netProfit: 0, transactions: [] };
        }
        const cId = String(cropId);
        const list = this.finance.filter(f => String(f.crop_id || f.cropId) === cId);
        const totalIncome = list.filter(f => f.type === 'income').reduce((acc, f) => acc + Number(f.amount || 0), 0);
        const totalExpense = list.filter(f => f.type === 'expense').reduce((acc, f) => acc + Number(f.amount || 0), 0);
        return {
            totalIncome,
            totalExpense,
            netProfit: totalIncome - totalExpense,
            transactions: list
        };
    }

    async saveFinanceTransaction(transData) {
        const s = this.getService();
        if (!s) throw new Error('Koneksi Supabase belum siap');

        let rawPlotId = transData.plotId || transData.plot_id;
        let rawCropId = transData.cropId || transData.crop_id;

        // Jika crop_id dipilih, pastikan plot_id konsisten dengan plot milik crop
        if (rawCropId && String(rawCropId).trim() !== '' && rawCropId !== 'all' && rawCropId !== 'general') {
            const matchedCrop = this.getCropById(rawCropId);
            if (matchedCrop) {
                if (!rawPlotId || rawPlotId === 'all' || rawPlotId === 'general') {
                    rawPlotId = matchedCrop.plotId;
                } else if (String(rawPlotId) !== String(matchedCrop.plotId)) {
                    // Pastikan crop_id selalu konsisten dengan plot_id (Requirement 7 & 18)
                    throw new Error('Siklus tanaman yang dipilih tidak berada di blok lahan yang dipilih!');
                }
            }
        }

        const cleanPlotId = (rawPlotId && String(rawPlotId).trim() !== '' && rawPlotId !== 'all' && rawPlotId !== 'general') ? String(rawPlotId) : null;
        const cleanCropId = (rawCropId && String(rawCropId).trim() !== '' && rawCropId !== 'all' && rawCropId !== 'general') ? String(rawCropId) : null;

        const payload = {
            tenant_id: this.currentTenantId,
            plot_id: cleanPlotId,
            crop_id: cleanCropId,
            transaction_date: transData.date || transData.transaction_date || new Date().toISOString().slice(0, 10),
            type: transData.type || 'expense',
            category: transData.category || 'Operasional',
            title: transData.title,
            amount: Number(transData.amount || 0),
            notes: transData.notes || ''
        };

        let result = null;
        if (transData.id && !String(transData.id).startsWith('fin-temp')) {
            // UPDATE ke Supabase
            result = await s.updateFinance(transData.id, payload);
        } else {
            // INSERT ke Supabase
            result = await s.createFinance(payload);
        }

        // Refresh dari Supabase
        const fresh = await s.getFinance(this.currentTenantId);
        this.finance = fresh.map(f => this.normalizeFinance(f));
        return this.normalizeFinance(result);
    }

    async deleteFinanceTransaction(id) {
        const s = this.getService();
        if (!s) throw new Error('Koneksi Supabase belum siap');

        await s.deleteFinance(id);
        const fresh = await s.getFinance(this.currentTenantId);
        this.finance = fresh.map(f => this.normalizeFinance(f));
        return true;
    }

    // ====================================================
    // RESET & CACHE MANAGEMENT
    // ====================================================
    async resetBatch(batchId) {
        if (!batchId) throw new Error('ID siklus tanaman tidak boleh kosong.');
        const s = this.getService();
        if (!s || !s.supabase) throw new Error('Koneksi Supabase belum siap.');

        const crop = this.crops.find(c => String(c.id) === String(batchId));
        const todayStr = new Date().toISOString().slice(0, 10);

        let updatePayload = {
            updated_at: new Date().toISOString()
        };

        const isDirect = crop && (crop.plantingMethod === 'direct_sowing' || crop.plantingMethod === 'direct_planting');

        if (isDirect) {
            // Tanam langsung: perbarui tanggal tanam ke hari ini (0 HST), tanpa tanggal semai
            updatePayload.plant_date = todayStr;
            updatePayload.stage = 'Fase Vegetatif Awal';
            updatePayload.progress = 1;
            updatePayload.status = 'growing';
            updatePayload.notes = embedAgroDatesInNotes(crop.notes, null, null, crop.plantingMethod);
        } else if (crop && (crop.transplantDate || crop.transplant_date)) {
            // Fase Lahan: perbarui tanggal pindah tanam ke hari ini (0 HST), pertahankan tanggal semai!
            updatePayload.transplant_date = todayStr;
            updatePayload.plant_date = todayStr;
            updatePayload.stage = 'Fase Vegetatif Awal';
            updatePayload.progress = 1;
            updatePayload.status = 'growing';
            updatePayload.notes = embedAgroDatesInNotes(crop.notes, crop.seedingDate, todayStr, crop.plantingMethod || 'nursery_transplant');
        } else {
            // Fase Persemaian: perbarui tanggal semai ke hari ini (0 HSS)
            updatePayload.seeding_date = todayStr;
            updatePayload.plant_date = todayStr;
            updatePayload.stage = 'Fase Semai';
            updatePayload.progress = 1;
            updatePayload.status = 'growing';
            updatePayload.notes = embedAgroDatesInNotes(crop ? crop.notes : '', todayStr, null, 'nursery_transplant');
        }

        const { error: updateError } = await s.supabase
            .from('crops')
            .update(updatePayload)
            .eq('id', batchId)
            .eq('tenant_id', this.currentTenantId);

        if (updateError) {
            delete updatePayload.transplant_date;
            delete updatePayload.seeding_date;
            await s.supabase
                .from('crops')
                .update(updatePayload)
                .eq('id', batchId)
                .eq('tenant_id', this.currentTenantId);
        }

        // Hapus aktivitas batch ini
        await s.supabase
            .from('activities')
            .delete()
            .eq('crop_id', String(batchId))
            .eq('tenant_id', this.currentTenantId)
            .catch(() => {});

        // Hapus observasi & feedback batch ini
        await s.supabase
            .from('batch_growth_observations')
            .delete()
            .eq('batch_id', String(batchId))
            .eq('tenant_id', this.currentTenantId)
            .catch(() => {});

        await s.supabase
            .from('batch_growth_feedback')
            .delete()
            .eq('batch_id', String(batchId))
            .eq('tenant_id', this.currentTenantId)
            .catch(() => {});

        this.observations = (this.observations || []).filter(o => String(o.batch_id || o.crop_id) !== String(batchId));
        this.feedbacks = (this.feedbacks || []).filter(f => String(f.batch_id || f.crop_id) !== String(batchId));

        await this.loadAllData(this.currentTenantId);
        return true;
    }

    async resetAllData() {
        const s = this.getService();
        if (!s || !s.supabase) throw new Error('Koneksi Supabase belum siap.');
        const tenant = this.currentTenantId;

        await s.supabase.from('activities').delete().eq('tenant_id', tenant).catch(() => {});
        await s.supabase.from('crops').delete().eq('tenant_id', tenant).catch(() => {});
        await s.supabase.from('batch_growth_observations').delete().eq('tenant_id', tenant).catch(() => {});
        await s.supabase.from('batch_growth_feedback').delete().eq('tenant_id', tenant).catch(() => {});

        this.observations = [];
        this.feedbacks = [];

        await this.loadAllData(tenant);
        return true;
    }

    applyBatchResetLocal(batchId) {
        const crop = this.crops.find(c => String(c.id) === String(batchId));
        const todayStr = new Date().toISOString().slice(0, 10);
        if (crop) {
            const isDirect = (crop.plantingMethod === 'direct_sowing' || crop.plantingMethod === 'direct_planting');
            if (isDirect) {
                crop.plantDate = todayStr;
                crop.plant_date = todayStr;
                crop.stage = 'Fase Vegetatif Awal';
                crop.progress = 1;
                crop.status = 'growing';
                crop.notes = embedAgroDatesInNotes(crop.notes, null, null, crop.plantingMethod);
            } else if (crop.transplantDate || crop.transplant_date) {
                crop.transplantDate = todayStr;
                crop.transplant_date = todayStr;
                crop.plantDate = todayStr;
                crop.plant_date = todayStr;
                crop.stage = 'Fase Vegetatif Awal';
                crop.progress = 1;
                crop.status = 'growing';
                crop.notes = embedAgroDatesInNotes(crop.notes, crop.seedingDate, todayStr, crop.plantingMethod || 'nursery_transplant');
            } else {
                crop.seedingDate = todayStr;
                crop.seeding_date = todayStr;
                crop.plantDate = todayStr;
                crop.plant_date = todayStr;
                crop.stage = 'Fase Semai';
                crop.progress = 1;
                crop.status = 'growing';
                crop.notes = embedAgroDatesInNotes(crop.notes, todayStr, null, 'nursery_transplant');
            }
        }
        this.activities = (this.activities || []).filter(a => String(a.cropId || a.crop_id) !== String(batchId));
        this.observations = (this.observations || []).filter(o => String(o.batch_id || o.crop_id) !== String(batchId));
        this.feedbacks = (this.feedbacks || []).filter(f => String(f.batch_id || f.crop_id) !== String(batchId));
    }

    applyResetAllLocal() {
        this.crops = [];
        this.activities = [];
        this.observations = [];
        this.feedbacks = [];
    }

    // ====================================================
    // PENGHITUNGAN UMUR TANAMAN & SMART CROP ENGINE
    // ====================================================
    calculateCropAge(crop, refDate = null) {
        const commName = matchMasterCommodity(crop ? crop.commodity : 'Cabai Rawit');
        const commConfig = MASTER_COMMODITIES[commName] || MASTER_COMMODITIES['Cabai Rawit'];

        const defaultMethod = window.SmartCropEngine ? window.SmartCropEngine.getDefaultPlantingMethod(commName) : 'nursery_transplant';
        const plantingMethod = crop ? (crop.plantingMethod || crop.planting_method || defaultMethod) : defaultMethod;
        const isDirect = (plantingMethod === 'direct_sowing' || plantingMethod === 'direct_planting');

        const seedingDate = crop ? (crop.seedingDate || crop.seeding_date) : null;
        const transplantDate = crop ? (crop.transplantDate || crop.transplant_date) : null;
        const plantDate = crop ? (crop.plantDate || crop.plant_date) : (transplantDate || seedingDate);

        const breakdown = this.calculateAgeBreakdown(seedingDate, transplantDate, refDate, plantingMethod, plantDate);

        const isTransplanted = breakdown.isTransplanted;
        const activeAge = isDirect ? (breakdown.hst ?? 0) : (isTransplanted ? (breakdown.hst ?? 0) : (breakdown.hss ?? 0));
        const activeUnit = isDirect ? 'HST' : (isTransplanted ? 'HST' : 'HSS');
        const days = activeAge;

        const weeks = Math.floor(activeAge / 7) || 0;
        const extraDays = (activeAge % 7) || 0;
        const teksMasaTanam = isDirect
            ? `${weeks} minggu ${extraDays} hari masa tanam langsung (HST)`
            : (isTransplanted
                ? `${weeks} minggu ${extraDays} hari masa tanam di lahan (HST)`
                : `${weeks} minggu ${extraDays} hari masa semai (HSS)`);

        // Dapatkan observasi batch jika ada
        const batchObservations = crop && crop.id ? this.getObservations(crop.id) : [];
        const batchFeedbacks = crop && crop.id ? this.getFeedbacks(crop.id) : [];

        // Evaluasi dengan SmartCropEngine (Rule-Based Agronomic Intelligence)
        let smartResult = null;
        if (window.SmartCropEngine) {
            smartResult = window.SmartCropEngine.evaluate({
                commodity: commName,
                variety: crop ? crop.variety : '',
                planting_method: plantingMethod,
                seeding_date: seedingDate,
                transplanting_date: transplantDate,
                planting_date: plantDate,
                current_date: breakdown.todayDateStr,
                HSS: breakdown.hss,
                HST: breakdown.hst,
                observations: batchObservations,
                notes: crop ? crop.notes : '',
                expected_harvest_days: commConfig.harvest?.targetDays || 105
            });
        }

        // Timeline stages dari Smart Crop Engine
        const timelinePhases = (smartResult && smartResult.all_stages)
            ? smartResult.all_stages.map(s => ({
                code: s.code,
                name: s.name,
                shortName: s.shortName,
                start: s.min_hst,
                end: s.max_hst,
                label: `${s.min_hst}–${s.max_hst} ${activeUnit}`,
                description: s.description,
                status: s.status,
                isCurrent: s.isCurrent,
                stageStatusLabel: s.stageStatusLabel,
                stage_group: s.stage_group,
                focusToday: s.focusToday,
                currentRecommendation: s.currentRecommendation,
                nextRecommendation: s.nextRecommendation,
                observationsNeeded: s.observationsNeeded
            }))
            : (isTransplanted ? this.getFieldPhases(commConfig) : this.getNurseryPhases(commConfig));

        let currentPhase = (smartResult && smartResult.current_stage)
            ? {
                code: smartResult.current_stage.code,
                name: smartResult.current_stage.name,
                shortName: smartResult.current_stage.shortName,
                start: smartResult.current_stage.min_hst,
                end: smartResult.current_stage.max_hst,
                label: `${smartResult.current_stage.min_hst}–${smartResult.current_stage.max_hst} ${activeUnit}`,
                description: smartResult.current_stage.description,
                focusToday: smartResult.current_stage.focusToday,
                currentRecommendation: smartResult.current_stage.currentRecommendation,
                nextRecommendation: smartResult.current_stage.nextRecommendation,
                observationsNeeded: smartResult.current_stage.observationsNeeded
            }
            : timelinePhases[0];

        const maxHarvestDays = commConfig.harvest?.end || commConfig.harvest?.targetDays || 120;
        const minHarvestDays = commConfig.harvest?.start || 85;
        const progressPercent = (isTransplanted || isDirect)
            ? Math.min(100, Math.max(1, Math.round((activeAge / maxHarvestDays) * 100)))
            : Math.min(100, Math.max(1, Math.round((activeAge / 25) * 100)));

        let estimasiPanenRange = '-';
        let minHarvestDate = null;
        let maxHarvestDate = null;

        // Cek apakah ada observasi FIRST_HARVEST atau actual_first_harvest_date
        const hasActualHarvest = batchObservations.some(o => (o.indicator_code || o.indicator_id) === 'FIRST_HARVEST') || (crop && crop.actualFirstHarvestDate);

        const baseHarvestDateStr = isDirect ? plantDate : (isTransplanted ? transplantDate : seedingDate);
        if (baseHarvestDateStr) {
            const baseParts = parseDateParts(baseHarvestDateStr);
            if (baseParts) {
                const baseUtc = Date.UTC(baseParts.year, baseParts.month, baseParts.day);
                const extraNursery = (isTransplanted || isDirect) ? 0 : 25;
                minHarvestDate = new Date(baseUtc + (extraNursery + minHarvestDays) * 86400000);
                maxHarvestDate = new Date(baseUtc + (extraNursery + maxHarvestDays) * 86400000);
                estimasiPanenRange = `${this.formatDateLong(minHarvestDate)} – ${this.formatDateLong(maxHarvestDate)}`;
            }
        }

        const isHarvestReady = hasActualHarvest || ((isTransplanted || isDirect) && (activeAge >= minHarvestDays || progressPercent >= 100 || (crop && crop.status === 'harvested')));

        const stageShortDisplay = (currentPhase.shortName || currentPhase.name || 'Vegetatif').replace(/^Fase\s+/i, '').trim();
        const phaseBadgeText = `${activeAge} ${activeUnit} • ${stageShortDisplay}`;
        const phaseRangeText = `${currentPhase.start}–${currentPhase.end} ${activeUnit} ${stageShortDisplay}`;

        const plot = crop && crop.plotId ? this.getPlotById(crop.plotId) : null;
        const blockName = (plot ? plot.name : (crop ? crop.petakName : 'Blok Lahan')) || 'Blok Lahan';

        const infoText = isDirect
            ? `Tanaman ${commName} (${blockName}) ditanam langsung di lahan berumur ${activeAge} HST (${currentPhase.name}).`
            : (isTransplanted
                ? `Tanaman ${commName} (${blockName}) Anda saat ini berumur ${breakdown.hst} HST (${currentPhase.name}).`
                : `Tanaman ${commName} (${blockName}) saat ini dalam fase persemaian berumur ${breakdown.hss} HSS.`);

        const primaryAgeText = `${activeAge} ${activeUnit}`;
        const secondaryAgeText = isDirect
            ? `Tanam Biji / Bibit Langsung di Lahan (Tanpa persemaian)`
            : (isTransplanted
                ? `${breakdown.hss} HSS sejak semai`
                : `Tanaman masih dalam persemaian (Belum pindah tanam ke lahan)`);

        const daysToHarvest = (isDirect || isTransplanted) ? Math.max(0, minHarvestDays - activeAge) : (minHarvestDays + 25 - activeAge);
        const countdownPanen = hasActualHarvest ? 'Sedang Masa Panen' : (isHarvestReady ? 'Siap Panen' : `${daysToHarvest} hari lagi panen`);

        return {
            hss: breakdown.hss,
            hst: breakdown.hst,
            isTransplanted,
            isDirect,
            plantingMethod,
            methodConfig: window.SmartCropEngine ? window.SmartCropEngine.getMethodConfig(plantingMethod) : null,
            transplantStatus: breakdown.transplantStatus,
            activeAge,
            activeUnit,
            days,
            weeks,
            extraDays,
            commodityName: commName,
            commConfig,
            phases: timelinePhases,
            activePhase: currentPhase,
            infoText,
            primaryAgeText,
            secondaryAgeText,
            teksMasaTanam,
            teks_masa_tanam: teksMasaTanam,
            phase: currentPhase.name,
            phaseShort: currentPhase.shortName,
            phaseKey: currentPhase.shortName.toLowerCase(),
            phaseBadgeText,
            phaseRangeText,
            progressPercent,
            isHarvestReady,
            careInstruction: smartResult ? smartResult.current_recommendations : currentPhase.description,
            careType: smartResult ? smartResult.focus_today : currentPhase.shortName,
            totalTargetDays: maxHarvestDays,
            estimasiPanenRange,
            minHarvestDate,
            maxHarvestDate,
            countdownPanen,
            seedingDateFormatted: seedingDate ? this.formatDateLong(seedingDate) : 'Tidak Ada (Tanam Langsung)',
            transplantDateFormatted: isDirect ? this.formatDateLong(plantDate) : (transplantDate ? this.formatDateLong(transplantDate) : 'Belum Pindah Tanam (Persemaian)'),
            todayFormatted: this.formatDateLong(breakdown.todayDateStr),
            scheduledCareDateFormatted: this.formatDateLong(breakdown.todayDateStr),
            // Smart Crop Engine Outputs
            smartEngine: smartResult,
            stageStatus: smartResult ? smartResult.stage_status : 'FASE ESTIMASI',
            stageConfidence: smartResult ? smartResult.stage_confidence : 75,
            growthStatus: smartResult ? smartResult.growth_status : 'Normal berdasarkan umur kalender',
            confirmedBy: smartResult ? smartResult.confirmed_by : null,
            focusToday: smartResult ? smartResult.focus_today : currentPhase.shortName,
            currentRecommendations: smartResult ? smartResult.current_recommendations : currentPhase.description,
            nextRecommendations: smartResult ? smartResult.next_recommendations : 'Pemeliharaan rutin sesuai SOP',
            observationsNeeded: smartResult ? smartResult.observations_needed : 'Monitor vigor tanaman di lapangan',
            estimatedNextStage: smartResult ? smartResult.estimated_next_stage : 'Tahap lanjutan',
            alerts: smartResult ? smartResult.alerts : [],
            dailySummary: smartResult ? smartResult.daily_summary : null,
            observations: batchObservations,
            feedbacks: batchFeedbacks,
            lastObservationSummary: smartResult ? smartResult.last_observation_summary : 'Belum ada observasi'
        };
    }

    formatDateLong(dateInput) {
        if (!dateInput) return '-';
        const d = (dateInput instanceof Date) ? dateInput : this.parseDate(dateInput);
        if (!d || isNaN(d.getTime())) return String(dateInput);
        const months = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    }

    parseDate(dateStr) {
        if (!dateStr) return null;
        if (dateStr instanceof Date) return dateStr;
        const parts = String(dateStr).split('-');
        if (parts.length === 3) {
            return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        }
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? null : d;
    }

    exportAllData() {
        return JSON.stringify({
            version: '2.0.0',
            app: 'Jaya Agrofarm Nusantara',
            tenantId: this.currentTenantId,
            exportedAt: new Date().toISOString(),
            plots: this.getPlots(),
            crops: this.getCrops(),
            activities: this.getActivities(),
            inventory: this.getInventory(),
            finance: this.getFinance()
        }, null, 2);
    }
}

// Inisialisasi Singleton Database Service
window.db = new FarmDatabaseService();
