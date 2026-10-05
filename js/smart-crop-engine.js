/**
 * Smart Crop Engine - Jaya Agrofarm Nusantara
 * Pusat logika agronomi cerdas (Rule-Based Agronomic Intelligence).
 * Memahami kondisi setiap batch tanaman berdasarkan:
 * Komoditas + Varietas + Metode Tanam + Umur (HST/HSS) + Fase Pertumbuhan + Observasi Lapangan.
 */

(function (root, factory) {
    const instance = factory();
    if (typeof define === 'function' && define.amd) {
        define([], () => instance);
    }
    if (typeof module === 'object' && module && module.exports) {
        module.exports = instance;
    }
    if (typeof root === 'object') {
        root.SmartCropEngine = instance;
    }
    if (typeof window !== 'undefined') {
        window.SmartCropEngine = instance;
    }
    if (typeof globalThis !== 'undefined') {
        globalThis.SmartCropEngine = instance;
    }
}(typeof self !== 'undefined' ? self : this, function () {

    // ====================================================
    // 1. DEFAULT METODE TANAM PER KOMODITAS
    // ====================================================
    const COMMODITY_DEFAULT_METHODS = {
        'Cabai Rawit': 'nursery_transplant',
        'Cabai Merah': 'nursery_transplant',
        'Tomat': 'nursery_transplant',
        'Terong': 'nursery_transplant',
        'Mentimun': 'direct_sowing',
        'Kacang Panjang': 'direct_sowing',
        'Sawi': 'nursery_transplant',
        'Kangkung': 'direct_sowing',
        'Bayam': 'direct_sowing',
        'Bawang Merah': 'direct_planting',
        'Bawang Putih': 'direct_planting',
        'Jagung': 'direct_sowing',
        'Padi': 'nursery_transplant',
        'Padi Ketan': 'nursery_transplant',
        'Kedelai': 'direct_sowing',
        'Kacang Tanah': 'direct_sowing',
        'Semangka': 'nursery_transplant',
        'Melon': 'nursery_transplant'
    };

    const PLANTING_METHOD_LABELS = {
        'nursery_transplant': {
            label: 'Semai lalu Pindah Tanam (Nursery & Transplant)',
            badge: 'Semai → Pindah Tanam',
            description: 'Benih disemai di tray/polybag semai (dihitung HSS), kemudian dipindah ke bedengan lahan (dihitung HST).'
        },
        'direct_sowing': {
            label: 'Tanam Biji Langsung / Tugalan (Direct Sowing)',
            badge: 'Tanam Biji Langsung',
            description: 'Biji ditanam langsung di lahan. Umur langsung berbasis HST sejak hari tanam tanpa fase persemaian.'
        },
        'direct_planting': {
            label: 'Tanam Umbi / Stek Langsung (Direct Planting)',
            badge: 'Tanam Umbi/Bibit Langsung',
            description: 'Umbi/siung/stek ditanam langsung di bedengan. Umur langsung berbasis HST sejak hari tanam tanpa persemaian.'
        }
    };

    // ====================================================
    // 2. MASTER INDIKATOR FENOLOGI (crop_growth_indicators)
    // ====================================================
    const MASTER_PHENOLOGY_INDICATORS = [
        {
            code: 'GERMINATION',
            name: 'Perkecambahan Serempak',
            category: 'SEEDLING_VEGETATIVE',
            description: 'Kecambah telah muncul serempak di atas permukaan media tanah/semai.',
            promotesGroup: 'VEGETATIVE',
            appliesToAll: true
        },
        {
            code: 'FIRST_TRUE_LEAF',
            name: 'Muncul Daun Sejati',
            category: 'VEGETATIVE',
            description: 'Daun sejati ke-3 atau ke-4 mulai berkembang sempurna.',
            promotesGroup: 'VEGETATIVE',
            appliesToAll: true
        },
        {
            code: 'ACTIVE_VEGETATIVE_GROWTH',
            name: 'Pertumbuhan Vegetatif Pesat',
            category: 'VEGETATIVE',
            description: 'Batang meninggi aktif, kanopi daun melebar, perakaran mencengkeram kuat.',
            promotesGroup: 'VEGETATIVE',
            appliesToAll: true
        },
        {
            code: 'BRANCHING',
            name: 'Percabangan V / Anakan Aktif',
            category: 'VEGETATIVE',
            description: 'Muncul cabang V pertama (cabai/terong), anakan rumpun (padi/bawang), atau sulur aktif.',
            promotesGroup: 'TRANSITION',
            appliesToAll: true
        },
        {
            code: 'BUD_FORMATION',
            name: 'Kuncup Bunga Pertama',
            category: 'TRANSITION',
            description: 'Kuncup bunga pertama mulai teridentifikasi pada pucuk atau ketiak daun.',
            promotesGroup: 'TRANSITION',
            appliesToAll: false,
            commodities: ['Cabai Rawit', 'Cabai Merah', 'Tomat', 'Terong', 'Mentimun', 'Melon', 'Semangka', 'Kacang Panjang', 'Kedelai', 'Kacang Tanah', 'Jagung', 'Padi', 'Padi Ketan']
        },
        {
            code: 'FIRST_FLOWER',
            name: 'Bunga Pertama Mekar',
            category: 'GENERATIVE',
            description: 'Bunga pertama telah mekar sempurna (tanda masuk fase generatif aktif).',
            promotesGroup: 'GENERATIVE',
            appliesToAll: false,
            commodities: ['Cabai Rawit', 'Cabai Merah', 'Tomat', 'Terong', 'Mentimun', 'Melon', 'Semangka', 'Kacang Panjang', 'Kedelai', 'Kacang Tanah', 'Jagung', 'Padi', 'Padi Ketan']
        },
        {
            code: 'FULL_FLOWERING',
            name: 'Pembungaan Serempak / Penuh',
            category: 'GENERATIVE',
            description: 'Lebih dari 50% populasi tanaman berbunga serentak (tasseling/silking/malai keluar).',
            promotesGroup: 'GENERATIVE',
            appliesToAll: false,
            commodities: ['Cabai Rawit', 'Cabai Merah', 'Tomat', 'Terong', 'Mentimun', 'Melon', 'Semangka', 'Kacang Panjang', 'Kedelai', 'Kacang Tanah', 'Jagung', 'Padi', 'Padi Ketan']
        },
        {
            code: 'FRUIT_SET',
            name: 'Pembentukan Buah / Fruit Set',
            category: 'FRUIT_DEVELOPMENT',
            description: 'Kelopak bunga gugur, terbentuk calon buah (pentil cabai/tomat/melon, polong muda, bulir susu).',
            promotesGroup: 'FRUIT_DEVELOPMENT',
            appliesToAll: false,
            commodities: ['Cabai Rawit', 'Cabai Merah', 'Tomat', 'Terong', 'Mentimun', 'Melon', 'Semangka', 'Kacang Panjang', 'Kedelai', 'Kacang Tanah', 'Jagung', 'Padi', 'Padi Ketan', 'Bawang Merah', 'Bawang Putih']
        },
        {
            code: 'FRUIT_DEVELOPMENT',
            name: 'Pembesaran Buah / Umbi / Bulir',
            category: 'FRUIT_DEVELOPMENT',
            description: 'Buah atau umbi membesar optimal, pengisian bulir padi/jagung mengeras.',
            promotesGroup: 'FRUIT_DEVELOPMENT',
            appliesToAll: true
        },
        {
            code: 'FRUIT_COLOR_CHANGE',
            name: 'Perubahan Warna / Semburat Kematangan',
            category: 'MATURATION',
            description: 'Buah mulai memerah/menguning, bulir padi menguning keemasan, atau daun bawang mulai rebah.',
            promotesGroup: 'MATURATION',
            appliesToAll: true
        },
        {
            code: 'FIRST_HARVEST',
            name: 'Panen Pertama Terlaksana',
            category: 'HARVEST',
            description: 'Petikan atau pemanenan perdana telah dilakukan di lapangan.',
            promotesGroup: 'PRODUCTION',
            appliesToAll: true
        },
        {
            code: 'PEAK_PRODUCTION',
            name: 'Puncak Produksi / Panen Raya',
            category: 'HARVEST',
            description: 'Volume panen mencapai puncak tertinggi siklus budidaya.',
            promotesGroup: 'PRODUCTION',
            appliesToAll: true
        },
        {
            code: 'NORMAL_GROWTH',
            name: 'Pertumbuhan Normal Seragam',
            category: 'CONDITION',
            description: 'Visual tanaman sehat, daun hijau segar, vigor seragam tanpa kendala berarti.',
            promotesGroup: null,
            appliesToAll: true
        },
        {
            code: 'SLOW_GROWTH',
            name: 'Pertumbuhan Terhambat / Lambat',
            category: 'CONDITION',
            description: 'Tinggi tanaman atau percabangan tertinggal dibanding target umur kalender.',
            promotesGroup: null,
            appliesToAll: true
        },
        {
            code: 'YELLOWING_LEAVES',
            name: 'Daun Menguning / Klorosis',
            category: 'CONDITION',
            description: 'Terlihat helai daun bawah atau pucuk menguning (indikasi kelembaban, drainase, atau hara).',
            promotesGroup: null,
            appliesToAll: true
        },
        {
            code: 'NEW_SHOOTS',
            name: 'Pucuk & Trubus Baru Subur',
            category: 'CONDITION',
            description: 'Muncul daun pupus muda segar di ujung cabang tajuk.',
            promotesGroup: null,
            appliesToAll: true
        },
        {
            code: 'PEST_DISEASE_SIGNS',
            name: 'Gejala Serangan Hama / Penyakit (OPT)',
            category: 'CONDITION',
            description: 'Tampak gejala serangan serangga pengisap, ulat, kutu, bercak daun, atau layu.',
            promotesGroup: null,
            appliesToAll: true
        },
        {
            code: 'STAGE_CONFIRMED',
            name: 'Konfirmasi Kesesuaian Fase Tanaman',
            category: 'CONDITION',
            description: 'Kondisi tajuk, percabangan, vigor, dan fase tanaman di lapangan dikonfirmasi sesuai dengan estimasi rekomendasi budidaya.',
            promotesGroup: null,
            appliesToAll: true
        },
        {
            code: 'STAGE_MISMATCH',
            name: 'Koreksi Ketidaksesuaian Fase Tanaman',
            category: 'CONDITION',
            description: 'Petani mencatat perbedaan antara estimasi fase sistem dan kondisi tanaman aktual di lapangan.',
            promotesGroup: null,
            appliesToAll: true
        }
    ];

    // ====================================================
    // 3. MASTER FASE PER KOMODITAS (crop_growth_stages)
    // ====================================================
    const MASTER_GROWTH_STAGES = {
        'Cabai Rawit': [
            {
                code: 'CR-01',
                name: 'Fase Vegetatif Awal & Pengakaran',
                shortName: 'Vegetatif Awal',
                stage_group: 'VEGETATIVE',
                min_hst: 0,
                max_hst: 25,
                priority: 1,
                description: 'Fase pemulihan akar pasca pindah tanam, adaptasi cuaca terbuka, dan pembentukan perakaran adventif yang kokoh.',
                focusToday: 'Adaptasi bibit di lahan dan pengakaran serabut aktif.',
                currentRecommendation: 'Pastikan kelembaban bedengan terjaga, aplikasi kocor pupuk starter kaya Fosfat (P) dan asam humat. Monitor keutuhan bibit.',
                nextRecommendation: 'Siapkan pengikatan ajir tegak dan pupuk NPK seimbang untuk memacu percabangan.',
                observationsNeeded: 'Cek kekakuan batang dan kemunculan helai daun sejati baru di lahan.'
            },
            {
                code: 'CR-02',
                name: 'Fase Vegetatif Aktif & Percabangan V',
                shortName: 'Vegetatif Aktif',
                stage_group: 'VEGETATIVE',
                min_hst: 26,
                max_hst: 40,
                priority: 2,
                description: 'Pertumbuhan tunas samping pesat, pembentukan cabang utama V, dan pengokohan kanopi daun produktif.',
                focusToday: 'Penguatan cabang utama V dan pembesaran batang.',
                currentRecommendation: 'Aplikasi pupuk NPK seimbang 16-16-16 secara berkala. Lakukan pewiwilan tunas air di bawah cabang V utama.',
                nextRecommendation: 'Persiapkan transisi nutrisi menuju kalium dan fosfat saat cabang V mulai membentuk bakal kuncup.',
                observationsNeeded: 'Amati terbentuknya cabang V dan monitor potensi hama kutu daun (thrips/aphids).'
            },
            {
                code: 'CR-03',
                name: 'Transisi Generatif & Inisiasi Kuncup',
                shortName: 'Transisi Generatif',
                stage_group: 'TRANSITION',
                min_hst: 41,
                max_hst: 50,
                priority: 3,
                description: 'Perubahan titik tumbuh vegetatif menjadi inisiasi primordia kuncup bunga di setiap ketiak percabangan.',
                focusToday: 'Inisiasi kuncup bunga pertama dan pencegahan rontok calon bunga.',
                currentRecommendation: 'Tingkatkan rasio unsur P dan K (MKP atau kalsium nitrat). Kurangi aplikasi nitrogen berlebih agar tanaman tidak rebah atau gugur bunga.',
                nextRecommendation: 'Siapkan tali penahan cabang agar percabangan yang sarat bunga tidak patah tertiup angin.',
                observationsNeeded: 'Periksa kuncup bunga pertama di ketiak cabang V di lapangan.'
            },
            {
                code: 'CR-04',
                name: 'Pembungaan & Fruit Set (Pentil Buah)',
                shortName: 'Pembungaan & Fruit Set',
                stage_group: 'GENERATIVE',
                min_hst: 51,
                max_hst: 70,
                priority: 4,
                description: 'Bunga mekar serentak dan penyerbukan aktif menghasilkan pentil buah cabai pertama.',
                focusToday: 'Maksimalkan penyerbukan dan pembentukan pentil buah cabai.',
                currentRecommendation: 'Suplai kalsium dan boron untuk mencegah bunga rontok dan busuk ujung buah (blossom end rot). Jaga kelembaban stabil.',
                nextRecommendation: 'Persiapkan pupuk pengisi bobot buah untuk mendukung pembesaran cabai.',
                observationsNeeded: 'Periksa persentase bunga mekar dan terbentuknya calon pentil buah di cabang atas.'
            },
            {
                code: 'CR-05',
                name: 'Pembesaran Buah & Pengisian Bobot',
                shortName: 'Pembesaran Buah',
                stage_group: 'FRUIT_DEVELOPMENT',
                min_hst: 71,
                max_hst: 90,
                priority: 5,
                description: 'Cabai memanjang dan membesar, dinding buah menebal, penumpukan senyawa capsaicin.',
                focusToday: 'Pembesaran buah maksimal dan menjaga kesehatan daun bendera.',
                currentRecommendation: 'Berikan pupuk Kalium sulfat (KNO3 putih / SOP) untuk mengoptimalkan bobot dan ketebalan kulit cabai.',
                nextRecommendation: 'Siapkan keranjang petik dan jadwal panen perdana.',
                observationsNeeded: 'Cek ukuran panjang cabai dan amati potensi serangan lalat buah.'
            },
            {
                code: 'CR-06',
                name: 'Pematangan Buah & Panen Berkala',
                shortName: 'Produksi / Panen',
                stage_group: 'PRODUCTION',
                min_hst: 91,
                max_hst: 130,
                priority: 6,
                description: 'Cabai matang sempurna (merah menyala atau hijau petik tua), pemanenan berkala 4-7 hari sekali.',
                focusToday: 'Pemanenan buah tua dan pemeliharaan bunga susulan.',
                currentRecommendation: 'Petik buah beserta tangkainya pada pagi hari saat embun kering. Lakukan pemupukan susulan ringan pasca petik.',
                nextRecommendation: 'Evaluasi total tonase petikan dan kontinuitas siklus hidup tanaman.',
                observationsNeeded: 'Pantau buah yang sudah 80-90% merah untuk jadwal petik harian.'
            }
        ],
        'Cabai Merah': [
            {
                code: 'CM-01',
                name: 'Fase Vegetatif Awal',
                shortName: 'Vegetatif Awal',
                stage_group: 'VEGETATIVE',
                min_hst: 0,
                max_hst: 25,
                priority: 1,
                description: 'Pengakaran bibit cabai merah besar di bedengan dan adaptasi lingkungan.',
                focusToday: 'Pengakaran dalam dan pembentukan batang utama tegap.',
                currentRecommendation: 'Siram rutin pagi hari, kocor NPK awal plus bio-stimulan perakaran.',
                nextRecommendation: 'Siapkan tali gawar dan ajir bambu kokoh.',
                observationsNeeded: 'Periksa ketegakan bibit dan tidak ada gejala layu bakteri.'
            },
            {
                code: 'CM-02',
                name: 'Fase Vegetatif Aktif & Percabangan',
                shortName: 'Vegetatif Aktif',
                stage_group: 'VEGETATIVE',
                min_hst: 26,
                max_hst: 40,
                priority: 2,
                description: 'Pembentukan cabang lateral dan penguatan batang utama cabai merah.',
                focusToday: 'Pemeliharaan tajuk rimbun dan sanitasi gulma.',
                currentRecommendation: 'Aplikasi pemupukan susulan ke-2, ikat batang pada ajir.',
                nextRecommendation: 'Persiapkan nutrisi kalsium dan kalium pra-bunga.',
                observationsNeeded: 'Periksa percabangan V dan ketiak daun.'
            },
            {
                code: 'CM-03',
                name: 'Transisi Generatif & Kuncup Bunga',
                shortName: 'Transisi Generatif',
                stage_group: 'TRANSITION',
                min_hst: 41,
                max_hst: 50,
                priority: 3,
                description: 'Inisiasi pembungaan cabai merah besar di ujung cabang.',
                focusToday: 'Inisiasi kuncup bunga pertama serempak.',
                currentRecommendation: 'Semprot kalsium borat dan kocor kalium fosfat dosis terukur.',
                nextRecommendation: 'Persiapan penjagaan pentil buah pertama dari lalat buah.',
                observationsNeeded: 'Amati munculnya kuncup putih di cabang V.'
            },
            {
                code: 'CM-04',
                name: 'Pembungaan & Pembentukan Buah',
                shortName: 'Bunga & Fruit Set',
                stage_group: 'GENERATIVE',
                min_hst: 51,
                max_hst: 70,
                priority: 4,
                description: 'Bunga cabai merah mekar dan terbentuk pentil buah panjang.',
                focusToday: 'Penyerbukan optimal dan pencegahan kerontokan.',
                currentRecommendation: 'Jaga air irigasi tetap stabil (tidak tergenang, tidak kekeringan).',
                nextRecommendation: 'Maksimalkan pengisian buah lurus dan mulus.',
                observationsNeeded: 'Cek pentil buah cabai merah apakah lurus dan sehat.'
            },
            {
                code: 'CM-05',
                name: 'Pembesaran Buah & Pengisian Panjang',
                shortName: 'Pembesaran Buah',
                stage_group: 'FRUIT_DEVELOPMENT',
                min_hst: 71,
                max_hst: 90,
                priority: 5,
                description: 'Buah cabai merah memanjang maksimal dan mengkilap padat.',
                focusToday: 'Pengisian bobot buah dan pencegahan antraknosa.',
                currentRecommendation: 'Suplai kalium nitrat tinggi, jaga kebersihan drainase bedengan.',
                nextRecommendation: 'Siapkan jadwal petik merah dan sortasi grade A.',
                observationsNeeded: 'Pantau kemunculan semburat merah pada buah bawah.'
            },
            {
                code: 'CM-06',
                name: 'Pematangan Merah & Panen Berkala',
                shortName: 'Panen Produksi',
                stage_group: 'PRODUCTION',
                min_hst: 91,
                max_hst: 125,
                priority: 6,
                description: 'Buah matang merah merata siap panen petikan 5 hari sekali.',
                focusToday: 'Pemanenan cabai merah segar dan pemupukan pemulihan.',
                currentRecommendation: 'Petik dengan gunting atau pisau bersih bila diperlukan, hindari melukai cabang.',
                nextRecommendation: 'Simpan hasil panen di tempat sejuk dan teduh sebelum pengiriman.',
                observationsNeeded: 'Cek tingkat kematangan 90% merah untuk pasar segar.'
            }
        ],
        'Tomat': [
            {
                code: 'TM-01',
                name: 'Vegetatif Awal & Pengakaran',
                shortName: 'Vegetatif Awal',
                stage_group: 'VEGETATIVE',
                min_hst: 0,
                max_hst: 20,
                priority: 1,
                description: 'Pemulihan bibit tomat di bedengan, perakaran menjalar kuat ke mulsa.',
                focusToday: 'Adaptasi iklim bedengan dan percepatan perakaran.',
                currentRecommendation: 'Siram secukupnya di pangkal batang, kocor pupuk awal berunsur fosfat tinggi.',
                nextRecommendation: 'Pemasangan lanjaran/ajir setinggi 1,5–2 meter.',
                observationsNeeded: 'Periksa bibit tidak rebah dan daun tidak menggulung.'
            },
            {
                code: 'TM-02',
                name: 'Vegetatif Aktif & Pewiwilan Cabang',
                shortName: 'Vegetatif Aktif',
                stage_group: 'VEGETATIVE',
                min_hst: 21,
                max_hst: 35,
                priority: 2,
                description: 'Pertumbuhan batang primer sangat cepat, pewiwilan tunas air (pruning).',
                focusToday: 'Pewiwilan tunas air dan pengikatan ke ajir bambu.',
                currentRecommendation: 'Pangkas tunas air yang tumbuh di ketiak daun agar nutrisi fokus ke batang utama.',
                nextRecommendation: 'Siapkan nutrisi pembungaan tandan pertama.',
                observationsNeeded: 'Periksa kerapian pengikatan batang ke ajir.'
            },
            {
                code: 'TM-03',
                name: 'Pembungaan Tandan Pertama & Fruit Set',
                shortName: 'Bunga Tandan',
                stage_group: 'GENERATIVE',
                min_hst: 36,
                max_hst: 48,
                priority: 3,
                description: 'Tandan bunga pertama mekar dan terjadi penyerbukan membentuk bola buah kecil.',
                focusToday: 'Keberhasilan fruit set tandan ke-1 dan ke-2.',
                currentRecommendation: 'Aplikasi pupuk kalsium borat untuk mencegah blossom end rot (pantat buah hitam).',
                nextRecommendation: 'Tingkatkan kalium untuk pembesaran buah tomat.',
                observationsNeeded: 'Cek bunga mekar pada tandan pertama dan pembentukan pentil tomat.'
            },
            {
                code: 'TM-04',
                name: 'Pembesaran Buah & Pembentukan Tandan Lanjutan',
                shortName: 'Pembesaran Buah',
                stage_group: 'FRUIT_DEVELOPMENT',
                min_hst: 49,
                max_hst: 70,
                priority: 4,
                description: 'Buah tomat membesar bulat/lonjong, tandan ke-3 dan ke-4 terus menyusul.',
                focusToday: 'Pembesaran daging buah dan kestabilan kadar air tanah.',
                currentRecommendation: 'Jaga kelembaban tanah konstan untuk mencegah buah pecah (cracking). Berikan Kalium tinggi.',
                nextRecommendation: 'Siapkan panen saat buah mulai berpindah dari hijau ke semburat jingga.',
                observationsNeeded: 'Periksa apakah ada buah yang pecah atau busuk pantat.'
            },
            {
                code: 'TM-05',
                name: 'Pematangan Buah & Panen Berkala',
                shortName: 'Panen Produksi',
                stage_group: 'PRODUCTION',
                min_hst: 71,
                max_hst: 100,
                priority: 5,
                description: 'Tomat mulai mengkal (breaker stage) hingga matang merah, panen 3 hari sekali.',
                focusToday: 'Pemanenan pada tingkat kematangan yang tepat sesuai tujuan pasar.',
                currentRecommendation: 'Petik saat semburat kuning-merah 30-50% untuk pengiriman luar kota.',
                nextRecommendation: 'Pemangkasan daun tua di bagian bawah untuk sirkulasi udara optimal.',
                observationsNeeded: 'Cek warna buah pada tandan bawah yang siap dipetik.'
            }
        ],
        'Terong': [
            {
                code: 'TR-01',
                name: 'Fase Vegetatif Awal',
                shortName: 'Vegetatif Awal',
                stage_group: 'VEGETATIVE',
                min_hst: 0,
                max_hst: 20,
                priority: 1,
                description: 'Adaptasi perakaran terong dan pembentukan daun sejati lebar.',
                focusToday: 'Pengakaran bibit dan pengokohan batang berkayu.',
                currentRecommendation: 'Kocor pupuk NPK awal dan asam amino untuk mengurangi stres pindah tanam.',
                nextRecommendation: 'Persiapkan pemasangan ajir penyangga.',
                observationsNeeded: 'Periksa keutuhan daun dari serangan ulat tanah.'
            },
            {
                code: 'TR-02',
                name: 'Vegetatif Aktif & Percabangan V',
                shortName: 'Vegetatif Aktif',
                stage_group: 'VEGETATIVE',
                min_hst: 21,
                max_hst: 40,
                priority: 2,
                description: 'Pertumbuhan daun lebar terong dan pembentukan percabangan produktif.',
                focusToday: 'Pertumbuhan tajuk kokoh dan pengikatan ajir.',
                currentRecommendation: 'Pupuk susulan NPK seimbang, wiwil daun tua terbawah yang menyentuh tanah.',
                nextRecommendation: 'Siapkan nutrisi pembungaan bunga ungu terong.',
                observationsNeeded: 'Amati terbentuknya percabangan primer terong.'
            },
            {
                code: 'TR-03',
                name: 'Inisiasi Bunga Ungu & Fruit Set',
                shortName: 'Bunga & Pentil',
                stage_group: 'GENERATIVE',
                min_hst: 41,
                max_hst: 55,
                priority: 3,
                description: 'Bunga ungu mekar dan penyerbukan menghasilkan pentil buah terong panjang.',
                focusToday: 'Penyerbukan bunga ungu dan pencegahan rontok calon buah.',
                currentRecommendation: 'Aplikasi kalium dan boron. Cek kelancaran air.',
                nextRecommendation: 'Pemupukan pengisi daging buah terong mulus.',
                observationsNeeded: 'Periksa keberhasilan mekar bunga ungu di cabang utama.'
            },
            {
                code: 'TR-04',
                name: 'Pembesaran Buah Terong',
                shortName: 'Pembesaran Buah',
                stage_group: 'FRUIT_DEVELOPMENT',
                min_hst: 56,
                max_hst: 75,
                priority: 4,
                description: 'Buah terong memanjang, kulit mengkilap ungu/hijau, daging buah empuk padat.',
                focusToday: 'Pembesaran buah cepat dan menjaga kulit buah tetap mulus.',
                currentRecommendation: 'Suplai nutrisi kalium seimbang dan kontrol lalat buah/penggerek batang.',
                nextRecommendation: 'Persiapan panen perdana.',
                observationsNeeded: 'Cek kekenyalan dan kilau kulit buah terong.'
            },
            {
                code: 'TR-05',
                name: 'Panen Berkala & Produksi',
                shortName: 'Panen Produksi',
                stage_group: 'PRODUCTION',
                min_hst: 76,
                max_hst: 110,
                priority: 5,
                description: 'Pemanenan rutin 4-5 hari sekali, terong dipetik sebelum biji mengeras.',
                focusToday: 'Panen berkala terong segar dengan tangkai utuh.',
                currentRecommendation: 'Gunakan gunting panen bersih, potong tangkai buah 2 cm dari pangkal.',
                nextRecommendation: 'Berikan pupuk kocor susulan pasca petik.',
                observationsNeeded: 'Cek buah yang sudah berukuran standar pasar sebelum biji menguning.'
            }
        ],
        'Jagung': [
            {
                code: 'JG-01',
                name: 'Fase Perkembangan Vegetatif Awal (V1–V6)',
                shortName: 'Vegetatif Awal V1-V6',
                stage_group: 'VEGETATIVE',
                min_hst: 0,
                max_hst: 20,
                priority: 1,
                description: 'Tanam langsung (direct sowing). Perkambahan dan kemunculan daun ke-1 hingga helai ke-6 dengan titik tumbuh masih di bawah tanah.',
                focusToday: 'Pertumbuhan kecambah serempak dan pembentukan daun awal.',
                currentRecommendation: 'Aplikasi pupuk dasar/starter berimbang (Urea + SP-36 + KCl). Lakukan penjarangan bila tanaman terlalu rapat.',
                nextRecommendation: 'Persiapan bumbun dan aplikasi pemupukan susulan pertama (V6-V8).',
                observationsNeeded: 'Cek keseragaman tumbuh kecambah jagung dan potensi ulat grayak (FAW).'
            },
            {
                code: 'JG-02',
                name: 'Fase Vegetatif Pesat & Pembentukan Ruas (V7–VT)',
                shortName: 'Vegetatif Pesat V7-VT',
                stage_group: 'VEGETATIVE',
                min_hst: 21,
                max_hst: 45,
                priority: 2,
                description: 'Pertumbuhan tinggi batang sangat cepat, penyerapan nitrogen tinggi, inisiasi bakal tongkol di ketiak batang.',
                focusToday: 'Penebalan batang utama dan penyerapan hara maksimal.',
                currentRecommendation: 'Pemupukan susulan kedua kaya Nitrogen dan Kalium. Lakukan pembumbunan tanah ke pangkal batang.',
                nextRecommendation: 'Persiapan fase tasseling (keluar bunga jantan di pucuk).',
                observationsNeeded: 'Amati kesehatan daun bendera dan kekokohan batang dari rebah angin.'
            },
            {
                code: 'JG-03',
                name: 'Fase Pembungaan (Tasseling & Silking)',
                shortName: 'Tasseling & Silking',
                stage_group: 'GENERATIVE',
                min_hst: 46,
                max_hst: 60,
                priority: 3,
                description: 'Bunga jantan (tassel) mekar di puncak pohon dan rambut tongkol (silk) keluar di ketiak daun untuk penyerbukan.',
                focusToday: 'Keberhasilan penyerbukan serbuk sari ke rambut tongkol.',
                currentRecommendation: 'Hindari kekeringan tanah pada fase kritis ini. Jangan melakukan penyemprotan kimia keras saat serbuk sari berterbangan.',
                nextRecommendation: 'Persiapan pengisian nutrisi bulir jagung manis / pipil.',
                observationsNeeded: 'Periksa keluarnya rambut tongkol segar berwarna hijau kemerahan.'
            },
            {
                code: 'JG-04',
                name: 'Fase Pengisian Bulir (Milky & Dough Stage)',
                shortName: 'Pengisian Bulir R1-R4',
                stage_group: 'FRUIT_DEVELOPMENT',
                min_hst: 61,
                max_hst: 80,
                priority: 4,
                description: 'Biji jagung terisi cairan putih susu (milky) lalu mengental padat (dough). Tongkol membesar rapat.',
                focusToday: 'Pengisian bulir jagung penuh sampai ujung tongkol (tip fill).',
                currentRecommendation: 'Jaga kelembaban tanah tercukupi. Berikan kalium bila memprogram jagung manis berkadar brix tinggi.',
                nextRecommendation: 'Persiapan panen jagung manis (HST 70-75) atau pengeringan jagung pipil (HST 95-105).',
                observationsNeeded: 'Cek kekenyalan bulir jagung dan kekeringan rambut tongkol (mulai cokelat tua).'
            },
            {
                code: 'JG-05',
                name: 'Pematangan Fisiologis & Panen Tongkol',
                shortName: 'Pematangan & Panen',
                stage_group: 'HARVEST',
                min_hst: 81,
                max_hst: 105,
                priority: 5,
                description: 'Kelobot jagung mengering kecokelatan, terbentuk lapisan hitam (black layer) pada pangkal biji tanda siap panen.',
                focusToday: 'Pemanenan jagung pada kadar air optimal.',
                currentRecommendation: 'Panen jagung manis pada pagi hari saat masih renyah. Panen jagung pipil saat kelobot 90% mengering.',
                nextRecommendation: 'Penjemuran tongkol dan pembersihan sisa brangkasan jagung.',
                observationsNeeded: 'Cek kelobot tongkol yang telah mengering dan kelonggaran rambut jagung.'
            }
        ],
        'Padi': [
            {
                code: 'PD-01',
                name: 'Fase Vegetatif Awal & Anakan Aktif',
                shortName: 'Vegetatif & Anakan Aktif',
                stage_group: 'VEGETATIVE',
                min_hst: 0,
                max_hst: 25,
                priority: 1,
                description: 'Pasca pindah tanam (tandur). Bibit beradaptasi, perakaran menembus lumpur, mulai membentuk tunas anakan pertama.',
                focusToday: 'Adaptasi perakaran dan pemacuan jumlah anakan produktif.',
                currentRecommendation: 'Pertahankan macak-macak air (1-2 cm). Berikan pupuk susulan I (Urea + SP36/NPK) pada 7–14 HST.',
                nextRecommendation: 'Persiapkan pemupukan susulan II untuk memaksimalkan jumlah anakan rumpun.',
                observationsNeeded: 'Hitung rata-rata jumlah anakan per rumpun (target 15-20 anakan).'
            },
            {
                code: 'PD-02',
                name: 'Fase Anakan Maksimum & Pembentukan Rumpun',
                shortName: 'Anakan Maksimum',
                stage_group: 'VEGETATIVE',
                min_hst: 26,
                max_hst: 45,
                priority: 2,
                description: 'Jumlah anakan mencapai puncak. Tanaman mulai mengurangi pembentukan anakan baru dan mematangkan batang.',
                focusToday: 'Seleksi anakan produktif dan penguatan dinding batang.',
                currentRecommendation: 'Lakukan pengeringan berselang (intermittent irrigation) untuk membatasi anakan steril dan menguatkan akar.',
                nextRecommendation: 'Persiapan masuk fase bunting padi (panicle initiation).',
                observationsNeeded: 'Amati kerapatan rumpun dan monitor potensi penggerek batang (sundep).'
            },
            {
                code: 'PD-03',
                name: 'Fase Inisiasi Malai & Bunting (Booting)',
                shortName: 'Bunting (Booting)',
                stage_group: 'TRANSITION',
                min_hst: 46,
                max_hst: 65,
                priority: 3,
                description: 'Bakal malai terbentuk di dasar pelepah, pelepah daun bendera menggembung tanda bunting siap keluar malai.',
                focusToday: 'Dukungan nutrisi untuk pembentukan malai panjang dan lebat.',
                currentRecommendation: 'Genangi air dangkal (3-5 cm). Berikan pupuk Kalium (KCl) untuk memperkuat tangkai malai.',
                nextRecommendation: 'Siapkan pengamatan saat malai mulai keluar serempak (heading).',
                observationsNeeded: 'Cek apakah pelepah daun bendera sudah membulat bunting.'
            },
            {
                code: 'PD-04',
                name: 'Fase Keluar Malai & Pembungaan (Heading & Flowering)',
                shortName: 'Heading & Antesis',
                stage_group: 'GENERATIVE',
                min_hst: 66,
                max_hst: 75,
                priority: 4,
                description: 'Malai padi keluar serempak dari pelepah dan terjadi penyerbukan (antesis) pada pagi hari.',
                focusToday: 'Keberhasilan penyerbukan bunga padi tanpa gangguan stres air atau angin kencang.',
                currentRecommendation: 'Jaga air sawah stabil. Hindari aplikasi semprotan kimia di pagi hari saat bunga padi membuka.',
                nextRecommendation: 'Persiapan nutrisi pengisian bulir padi bernas.',
                observationsNeeded: 'Amati keluarnya malai serempak dan mekarnya sekam gabah.'
            },
            {
                code: 'PD-05',
                name: 'Fase Pengisian Bulir (Masak Susu & Adonan)',
                shortName: 'Pengisian Bulir Susu/Adonan',
                stage_group: 'FRUIT_DEVELOPMENT',
                min_hst: 76,
                max_hst: 95,
                priority: 5,
                description: 'Bulir padi terisi pati cair (masak susu), lalu memadat (masak adonan), malai mulai merunduk anggun.',
                focusToday: 'Pengisian bulir padi padat tanpa ada gabah hampa.',
                currentRecommendation: 'Pengairan berselang (kering-basah). Jaga tanaman dari serangan walang sangit dan burung.',
                nextRecommendation: 'Persiapan pengeringan sawah 10 hari sebelum panen raya.',
                observationsNeeded: 'Pencet bulir padi bagian pangkal malai untuk cek kekerasan cairan pati.'
            },
            {
                code: 'PD-06',
                name: 'Fase Pematangan Bulir & Panen Raya',
                shortName: 'Masak Kuning & Panen',
                stage_group: 'HARVEST',
                min_hst: 96,
                max_hst: 120,
                priority: 6,
                description: '85–90% gabah pada malai telah menguning keemasan, kadar air turun, siap dipanen.',
                focusToday: 'Pemanenan padi pada tingkat kematangan malai optimal.',
                currentRecommendation: 'Keringkan petak sawah agar mempermudah pemotongan malai dan mesin combine/tresher.',
                nextRecommendation: 'Perontokan segera dan penjemuran gabah ke kadar air 14%.',
                observationsNeeded: 'Periksa persentase kuning pada malai (minimal 90% menguning).'
            }
        ],
        'Padi Ketan': [
            {
                code: 'PK-01',
                name: 'Fase Vegetatif & Anakan Ketan',
                shortName: 'Vegetatif & Anakan',
                stage_group: 'VEGETATIVE',
                min_hst: 0,
                max_hst: 25,
                priority: 1,
                description: 'Pengakaran dan pembentukan rumpun anakan padi ketan.',
                focusToday: 'Perbanyakan anakan rumpun padi ketan.',
                currentRecommendation: 'Pupuk starter seimbang, jaga air macak-macak.',
                nextRecommendation: 'Pupuk susulan kedua untuk kekokohan batang.',
                observationsNeeded: 'Cek kerapatan anakan per rumpun.'
            },
            {
                code: 'PK-02',
                name: 'Fase Bunting Padi Ketan',
                shortName: 'Bunting Ketan',
                stage_group: 'TRANSITION',
                min_hst: 46,
                max_hst: 65,
                priority: 2,
                description: 'Inisiasi malai dan pelepah daun bendera menggembung.',
                focusToday: 'Penguatan calon malai ketan berbulir rapat.',
                currentRecommendation: 'Suplai Kalium dan jaga air tergenang dangkal.',
                nextRecommendation: 'Persiapan heading serempak.',
                observationsNeeded: 'Cek kebuntingan pelepah daun.'
            },
            {
                code: 'PK-03',
                name: 'Heading & Pengisian Bulir Amilopektin',
                shortName: 'Heading & Pengisian',
                stage_group: 'GENERATIVE',
                min_hst: 66,
                max_hst: 95,
                priority: 3,
                description: 'Malai keluar dan pengisian bulir beras ketan putih susu pekat khas amilopektin.',
                focusToday: 'Pengisian bulir ketan padat merata.',
                currentRecommendation: 'Kawal dari hama burung dan walang sangit.',
                nextRecommendation: 'Persiapan pengeringan sawah pra-panen.',
                observationsNeeded: 'Cek warna putih susu bulir ketan.'
            },
            {
                code: 'PK-04',
                name: 'Pematangan & Panen Padi Ketan',
                shortName: 'Panen Ketan',
                stage_group: 'HARVEST',
                min_hst: 96,
                max_hst: 120,
                priority: 4,
                description: 'Malai kuning keemasan, bulir ketan bernas siap panen.',
                focusToday: 'Panen malai ketan matang merata.',
                currentRecommendation: 'Keringkan lahan, potong malai dan rontokkan segera.',
                nextRecommendation: 'Penjemuran gabah ketan higienis.',
                observationsNeeded: 'Cek 90% malai menguning keemasan.'
            }
        ],
        'Bawang Merah': [
            {
                code: 'BM-01',
                name: 'Fase Pertunasan & Anakan Awal',
                shortName: 'Pertunasan Awal',
                stage_group: 'VEGETATIVE',
                min_hst: 0,
                max_hst: 15,
                priority: 1,
                description: 'Tanam umbi langsung (direct planting). Pertunasan pucuk daun silindris hijau dan perakaran serabut basal.',
                focusToday: 'Keseragaman tumbuhnya tunas dari umbi bibit.',
                currentRecommendation: 'Penyiraman rutin 2x sehari (pagi dan sore) untuk menjaga kelembaban dan membersihkan daun dari embun asam.',
                nextRecommendation: 'Aplikasi pemupukan susulan pertama (10-15 HST) dengan NPK seimbang.',
                observationsNeeded: 'Cek persentase umbi yang bertunas dan bebas dari ulat daun (Spodoptera exigua).'
            },
            {
                code: 'BM-02',
                name: 'Fase Vegetatif Maksimum & Pembentukan Rumpun',
                shortName: 'Vegetatif Rumpun',
                stage_group: 'VEGETATIVE',
                min_hst: 16,
                max_hst: 35,
                priority: 2,
                description: 'Pertumbuhan anakan daun silindris sangat lebat, pembentukan rumpun 6-12 daun per umbi.',
                focusToday: 'Memperbanyak jumlah anakan produktif dan kesehatan daun silindris.',
                currentRecommendation: 'Pemupukan susulan kedua (NPK + KNO3 putih). Bersihkan gulma di sela-sela umbi secara hati-hati.',
                nextRecommendation: 'Persiapan transisi menuju pembesaran umbi (diferensiasi siung).',
                observationsNeeded: 'Amati ketegakan daun bawang dan monitor gejala trotol/bercak ungu (Alternaria porri).'
            },
            {
                code: 'BM-03',
                name: 'Fase Inisiasi & Pembesaran Umbi Lapis',
                shortName: 'Pembesaran Umbi',
                stage_group: 'FRUIT_DEVELOPMENT',
                min_hst: 36,
                max_hst: 55,
                priority: 3,
                description: 'Pangkal batang mulai membengkak membentuk umbi lapis merah keunguan, penimbunan karbohidrat padat.',
                focusToday: 'Pembesaran diameter umbi bawang dan penguatan warna merah.',
                currentRecommendation: 'Tingkatkan pupuk Kalium (ZK/SOP atau Kalium sulfat). Kurangi penyiraman agar tanah tidak becek/busuk umbi.',
                nextRecommendation: 'Persiapan fase pelayuan daun pra-panen.',
                observationsNeeded: 'Periksa diameter umbi di pangkal tanah (apakah sudah menyembul padat).'
            },
            {
                code: 'BM-04',
                name: 'Pematangan Umbi & Panen Cabut',
                shortName: 'Pematangan & Panen',
                stage_group: 'HARVEST',
                min_hst: 56,
                max_hst: 70,
                priority: 4,
                description: '60–70% daun telah rebah alami, leher umbi lunak, kulit umbi merah mengkilap, siap panen cabut.',
                focusToday: 'Pemanenan cabut pada hari cerah dan pelayuan daun di bedengan.',
                currentRecommendation: 'Cabut umbi perlahan, jemur di atas bedengan (daun menutupi umbi) selama 2-3 hari sebelum diikat.',
                nextRecommendation: 'Penjemuran lanjutan di para-para gantung.',
                observationsNeeded: 'Cek apakah 60% lebih daun sudah rebah alami di bedengan.'
            }
        ],
        'Bawang Putih': [
            {
                code: 'BP-01',
                name: 'Fase Pertunasan Siung & Pengakaran',
                shortName: 'Pertunasan Siung',
                stage_group: 'VEGETATIVE',
                min_hst: 0,
                max_hst: 20,
                priority: 1,
                description: 'Tanam siung langsung pada dataran tinggi berhawa sejuk. Kemunculan daun pipih hijau tegap.',
                focusToday: 'Pertunasan siung serentak dan pengakaran dalam.',
                currentRecommendation: 'Jaga kelembaban tanah gembur, kocor NPK awal.',
                nextRecommendation: 'Pemupukan susulan pertama untuk tajuk vegetatif.',
                observationsNeeded: 'Cek tunas daun pipih dari setiap siung.'
            },
            {
                code: 'BP-02',
                name: 'Fase Pembentukan Tajuk Vegetatif',
                shortName: 'Vegetatif Tajuk',
                stage_group: 'VEGETATIVE',
                min_hst: 21,
                max_hst: 45,
                priority: 2,
                description: 'Daun bawang putih melebar memanjang, batang semu mengeras tegap.',
                focusToday: 'Pengembangan daun hijau pekat untuk fotosintesis optimal.',
                currentRecommendation: 'Pemupukan NPK berimbang dan penyiangan gulma.',
                nextRecommendation: 'Persiapan nutrisi pembentukan umbi siung.',
                observationsNeeded: 'Cek ketebalan batang semu bawang putih.'
            },
            {
                code: 'BP-03',
                name: 'Fase Diferensiasi Siung & Pembesaran Umbi',
                shortName: 'Pembesaran Umbi',
                stage_group: 'FRUIT_DEVELOPMENT',
                min_hst: 46,
                max_hst: 85,
                priority: 3,
                description: 'Pembagian siung di dalam tanah dan pembesaran bonggol umbi.',
                focusToday: 'Pembesaran siung dan pemadatan lapisan kulit umbi.',
                currentRecommendation: 'Aplikasi Kalium sulfat tinggi dan kurangi frekuensi siram.',
                nextRecommendation: 'Persiapan panen saat daun mulai menguning.',
                observationsNeeded: 'Cek pembengkakan pangkal umbi di dalam tanah.'
            },
            {
                code: 'BP-04',
                name: 'Pematangan Siung & Panen Cabut',
                shortName: 'Panen Bawang Putih',
                stage_group: 'HARVEST',
                min_hst: 86,
                max_hst: 120,
                priority: 4,
                description: 'Daun bawah menguning kering, umbi padat dengan kulit terbungkus sempurna.',
                focusToday: 'Panen cabut umbi bawang putih dan pengeringan para-para.',
                currentRecommendation: 'Cabut hati-hati jangan sampai siung terlepas, jemur bertahap.',
                nextRecommendation: 'Penyimpanan gantung di tempat berventilasi baik.',
                observationsNeeded: 'Cek 70% daun telah menguning kering.'
            }
        ],
        'Kacang Panjang': [
            {
                code: 'KP-01',
                name: 'Fase Vegetatif Awal & Perambatan Ajir',
                shortName: 'Vegetatif & Sulur',
                stage_group: 'VEGETATIVE',
                min_hst: 0,
                max_hst: 15,
                priority: 1,
                description: 'Tanam biji langsung. Perkecambahan cepat dan sulur mulai melilit lanjaran bambu.',
                focusToday: 'Bimbing sulur melilit ajir dan pengakaran bibit.',
                currentRecommendation: 'Bantu arahkan sulur muda memutar searah jarum jam pada lanjaran. Kocor NPK awal.',
                nextRecommendation: 'Pemupukan susulan pemacuan daun majemuk rimbun.',
                observationsNeeded: 'Cek sulur telah melilit kokoh pada ajir bambu.'
            },
            {
                code: 'KP-02',
                name: 'Fase Vegetatif Rimbun & Pembentukan Kuncup',
                shortName: 'Vegetatif Rimbun',
                stage_group: 'TRANSITION',
                min_hst: 16,
                max_hst: 25,
                priority: 2,
                description: 'Sulur mencapai puncak ajir, daun majemuk lebat, kuncup bunga kupu-kupu mulai muncul.',
                focusToday: 'Keseimbangan tajuk dan persiapan pembungaan.',
                currentRecommendation: 'Pupuk dengan rasio P dan K tinggi. Bersihkan rumput bawah.',
                nextRecommendation: 'Persiapan pembungaan mekar serentak.',
                observationsNeeded: 'Periksa kuncup bunga di ketiak tangkai daun.'
            },
            {
                code: 'KP-03',
                name: 'Pembungaan & Pembentukan Polong Muda',
                shortName: 'Bunga & Polong Muda',
                stage_group: 'GENERATIVE',
                min_hst: 26,
                max_hst: 38,
                priority: 3,
                description: 'Bunga ungu kupu-kupu mekar dan langsung membentuk calon polong panjang menggantung.',
                focusToday: 'Pencegahan rontok bunga dan pemanjangan polong.',
                currentRecommendation: 'Suplai kalsium dan kalium. Monitor hama ulat penggerek polong (Maruca testulalis).',
                nextRecommendation: 'Persiapan jadwal petik harian.',
                observationsNeeded: 'Cek polong muda yang mulai memanjang lurus ke bawah.'
            },
            {
                code: 'KP-04',
                name: 'Pemanenan Polong Segar Berkala',
                shortName: 'Panen Produksi',
                stage_group: 'PRODUCTION',
                min_hst: 39,
                max_hst: 65,
                priority: 4,
                description: 'Polong kacang panjang memanjang lentur, panen setiap 2 hari sekali secara kontinu.',
                focusToday: 'Petik polong segar sebelum biji menonjol keras.',
                currentRecommendation: 'Petik pagi hari dengan memutar tangkai polong, jangan merusak tandan bunga berikutnya.',
                nextRecommendation: 'Kocor pupuk susulan berkala agar panen bertahan lama.',
                observationsNeeded: 'Cek polong yang padat berisi tetapi masih renyah halus.'
            }
        ],
        'Mentimun': [
            {
                code: 'MT-01',
                name: 'Vegetatif & Perambatan Sulur Mentimun',
                shortName: 'Vegetatif & Sulur',
                stage_group: 'VEGETATIVE',
                min_hst: 0,
                max_hst: 15,
                priority: 1,
                description: 'Tanam langsung. Pertumbuhan sulur mentimun sangat cepat merayap di ajir/tali gawar.',
                focusToday: 'Pengarahan sulur dan pemacuan pertumbuhan daun lebar.',
                currentRecommendation: 'Siram rutin, kocor NPK pertumbuhan seimbang. Ikat sulur utama.',
                nextRecommendation: 'Persiapan pembungaan kuning di ruas daun ke-5 ke atas.',
                observationsNeeded: 'Cek sulur menempel kuat di tali rambat.'
            },
            {
                code: 'MT-02',
                name: 'Pembungaan & Inisiasi Buah Mentimun',
                shortName: 'Bunga & Fruit Set',
                stage_group: 'GENERATIVE',
                min_hst: 16,
                max_hst: 28,
                priority: 2,
                description: 'Bunga jantan dan betina kuning mekar serentak, penyerbukan cepat membentuk mentimun muda.',
                focusToday: 'Penyerbukan optimal dan suplai air teratur.',
                currentRecommendation: 'Jaga suplai air konstan agar mentimun tidak terasa pahit. Berikan kalium kalsium.',
                nextRecommendation: 'Persiapan pembesaran buah silindris mulus.',
                observationsNeeded: 'Periksa calon buah mentimun dengan bunga betina di ujungnya.'
            },
            {
                code: 'MT-03',
                name: 'Pembesaran Buah & Panen Cepat',
                shortName: 'Panen Harian',
                stage_group: 'PRODUCTION',
                min_hst: 29,
                max_hst: 60,
                priority: 3,
                description: 'Buah mentimun membesar sangat cepat (3-4 hari dari mekar bunga), panen harian.',
                focusToday: 'Pemanenan harian buah mentimun segar berukuran proporsional.',
                currentRecommendation: 'Petik mentimun pagi hari dengan pisau/gunting bersih saat buah masih berlilin segar.',
                nextRecommendation: 'Pupuk kocor setelah setiap 2 kali petik.',
                observationsNeeded: 'Cek buah yang berdiameter 3-4 cm lurus tanpa melengkung.'
            }
        ],
        'Melon': [
            {
                code: 'ML-01',
                name: 'Vegetatif Awal & Perambatan Tali',
                shortName: 'Vegetatif Tali',
                stage_group: 'VEGETATIVE',
                min_hst: 0,
                max_hst: 20,
                priority: 1,
                description: 'Pengakaran bibit melon di polybag/bedengan, sulur diarahkan merambat vertikal ke tali rafia.',
                focusToday: 'Pengarahan batang tunggal melon ke tali ajir.',
                currentRecommendation: 'Wiwil tunas samping daun ke-1 sampai ke-8. Kocor NPK awal.',
                nextRecommendation: 'Persiapan pemeliharaan cabang produktif daun ke-9 hingga ke-12.',
                observationsNeeded: 'Periksa kebersihan tunas air bawah dan ketegakan tanaman.'
            },
            {
                code: 'ML-02',
                name: 'Pembungaan & Polinasi Buatan',
                shortName: 'Polinasi / Bunga',
                stage_group: 'GENERATIVE',
                min_hst: 21,
                max_hst: 35,
                priority: 2,
                description: 'Muncul bunga betina di cabang daun ke-9–12, dilakukan penyerbukan buatan (polinasi) pagi hari.',
                focusToday: 'Pelaksanaan polinasi bunga betina jam 06.00 - 09.00 pagi.',
                currentRecommendation: 'Oleskan serbuk sari bunga jantan ke kepala putik bunga betina. Beri tanda tanggal polinasi.',
                nextRecommendation: 'Persiapan seleksi 1 buah terbaik per pohon.',
                observationsNeeded: 'Amati bunga betina yang telah mekar sempurna di ruas produktif.'
            },
            {
                code: 'ML-03',
                name: 'Seleksi Buah & Pembentukan Jaring (Netting)',
                shortName: 'Seleksi & Netting',
                stage_group: 'FRUIT_DEVELOPMENT',
                min_hst: 36,
                max_hst: 55,
                priority: 3,
                description: 'Seleksi 1 buah tercantik (bentuk lonjong oval mulus), gantung buah dengan tali, pembentukan net kulit.',
                focusToday: 'Pengikatan tali gantung buah dan pembentukan pola jaring (net) seragam.',
                currentRecommendation: 'Jaga kelembaban tanah tidak fluktuatif ekstrem agar kulit tidak retak dalam. Suplai kalsium.',
                nextRecommendation: 'Persiapan pematangan aroma dan penghentian air pra-panen.',
                observationsNeeded: 'Cek kerapatan retakan net putih di permukaan kulit melon.'
            },
            {
                code: 'ML-04',
                name: 'Pematangan Brix & Panen Melon Premium',
                shortName: 'Pematangan & Panen',
                stage_group: 'HARVEST',
                min_hst: 56,
                max_hst: 75,
                priority: 4,
                description: 'Kadar gula (Brix) naik di atas 12–14%, aroma harum manis keluar, terbentuk cincin retak di tangkai buah.',
                focusToday: 'Pemanenan buah melon bertangkai T sempurna.',
                currentRecommendation: 'Kurangi siraman 5 hari sebelum panen untuk memekatkan rasa manis. Potong tangkai bentuk T.',
                nextRecommendation: 'Pengemasan busa jaring (foam net) dan uji brix sampel.',
                observationsNeeded: 'Cek retakan melingkar pada tangkai buah dan aroma harum manis.'
            }
        ],
        'Semangka': [
            {
                code: 'SM-01',
                name: 'Vegetatif & Pembentukan Cabang Utama',
                shortName: 'Vegetatif Cabang',
                stage_group: 'VEGETATIVE',
                min_hst: 0,
                max_hst: 20,
                priority: 1,
                description: 'Pertumbuhan sulur semangka mendatar di mulsa, seleksi 2-3 cabang produktif.',
                focusToday: 'Pengaturan arah sulur semangka agar tidak saling tumpang tindih.',
                currentRecommendation: 'Pangkas pucuk titik tumbuh untuk merangsang 3 cabang sekunder seragam.',
                nextRecommendation: 'Persiapan pembungaan dan penyerbukan.',
                observationsNeeded: 'Cek arah sulur di atas bedengan.'
            },
            {
                code: 'SM-02',
                name: 'Pembungaan & Polinasi Buah Semangka',
                shortName: 'Bunga & Polinasi',
                stage_group: 'GENERATIVE',
                min_hst: 21,
                max_hst: 35,
                priority: 2,
                description: 'Penyerbukan bunga betina pada daun ke-12 ke atas untuk buah berkualitas tinggi.',
                focusToday: 'Penyerbukan bunga betina semangka.',
                currentRecommendation: 'Lakukan penyerbukan pagi hari. Tandai bunga yang berhasil terbuahi.',
                nextRecommendation: 'Persiapan pembesaran buah semangka berbobot.',
                observationsNeeded: 'Cek pentil semangka yang mulai membesar seukuran telur.'
            },
            {
                code: 'SM-03',
                name: 'Pembesaran Buah & Pembalikan Posisi',
                shortName: 'Pembesaran Buah',
                stage_group: 'FRUIT_DEVELOPMENT',
                min_hst: 36,
                max_hst: 55,
                priority: 3,
                description: 'Buah semangka membesar cepat hingga 4–8 kg, lapisi alas jerami/bambu dan balik posisi buah.',
                focusToday: 'Pemberian tatakan buah semangka dan pembalikan berkala.',
                currentRecommendation: 'Beri alas agar buah tidak lembab terkena tanah. Suplai Kalium tinggi.',
                nextRecommendation: 'Persiapan panen saat sulur spiral di pangkal mengering.',
                observationsNeeded: 'Cek kebulatan buah dan warna belang kulit.'
            },
            {
                code: 'SM-04',
                name: 'Pematangan Manis & Panen Semangka',
                shortName: 'Panen Semangka',
                stage_group: 'HARVEST',
                min_hst: 56,
                max_hst: 75,
                priority: 4,
                description: 'Sulur spiral di dekat tangkai mengering cokelat, suara petikan terdengar menggema berat, siap panen.',
                focusToday: 'Pemanenan buah semangka segar berbobot maksimal.',
                currentRecommendation: 'Petik dengan tangkai utuh, hindari benturan saat pengangkutan.',
                nextRecommendation: 'Sortasi kelas berat (Super, A, B).',
                observationsNeeded: 'Cek sulur tangkai yang mengering dan bunyi ketukan nyaring.'
            }
        ],
        'Sawi': [
            {
                code: 'SW-01',
                name: 'Vegetatif Awal & Roset Daun',
                shortName: 'Vegetatif Awal',
                stage_group: 'VEGETATIVE',
                min_hst: 0,
                max_hst: 10,
                priority: 1,
                description: 'Adaptasi bibit sawi dan pembentukan daun muda roset.',
                focusToday: 'Penyiraman lembut dan pencegahan sengatan matahari berlebih.',
                currentRecommendation: 'Siram kabut halus 2x sehari, berikan pupuk cair nitrogen dosis ringan.',
                nextRecommendation: 'Pemacuan pembesaran helai daun pelepah.',
                observationsNeeded: 'Cek daun tidak terbakar dan perakaran tegak.'
            },
            {
                code: 'SW-02',
                name: 'Pertumbuhan Cepat & Penebalan Pelepah',
                shortName: 'Vegetatif Pesat',
                stage_group: 'VEGETATIVE',
                min_hst: 11,
                max_hst: 22,
                priority: 2,
                description: 'Pelepah daun menebal renyah, helai daun hijau segar melebar.',
                focusToday: 'Maksimalkan biomassa daun hijau sawi.',
                currentRecommendation: 'Pupuk kocor NPK seimbang, kontrol ulat grayak dengan bio-pestisida.',
                nextRecommendation: 'Persiapan panen cabut segar sebelum berbunga.',
                observationsNeeded: 'Cek daun lebar mulus bebas lubang ulat.'
            },
            {
                code: 'SW-03',
                name: 'Panen Cabut Daun Segar',
                shortName: 'Panen Sawi',
                stage_group: 'HARVEST',
                min_hst: 23,
                max_hst: 35,
                priority: 3,
                description: 'Sawi telah mencapai bobot komersial optimal sebelum muncul kuncup bunga.',
                focusToday: 'Pemanenan cabut seluruh tanaman atau potong pangkal.',
                currentRecommendation: 'Panen pagi hari, cuci akar dari tanah dengan air bersih mengalir.',
                nextRecommendation: 'Packing ikatan segar berlubang ventilasi.',
                observationsNeeded: 'Cek jangan sampai muncul kuncup bunga (bikin daun pahit).'
            }
        ],
        'Kangkung': [
            {
                code: 'KK-01',
                name: 'Vegetatif Perkecambahan & Batang Berongga',
                shortName: 'Vegetatif Awal',
                stage_group: 'VEGETATIVE',
                min_hst: 0,
                max_hst: 12,
                priority: 1,
                description: 'Tanam biji langsung. Kecambah cepat tumbuh memanjang dengan batang berongga khas kangkung.',
                focusToday: 'Pertumbuhan daun sempit memanjang dan batang sukulen.',
                currentRecommendation: 'Siram melimpah setiap hari, berikan pupuk starter kaya Nitrogen.',
                nextRecommendation: 'Pemacuan tinggi tanaman 25-30 cm.',
                observationsNeeded: 'Cek kerapatan populasi batang kangkung.'
            },
            {
                code: 'KK-02',
                name: 'Penebalan Daun & Batang Rebung',
                shortName: 'Vegetatif Aktif',
                stage_group: 'VEGETATIVE',
                min_hst: 13,
                max_hst: 22,
                priority: 2,
                description: 'Kangkung mencapai tinggi 20-25 cm, batang renyah sukulen hijau muda.',
                focusToday: 'Penyiraman intensif dan menjaga kebersihan daun.',
                currentRecommendation: 'Aplikasi pupuk daun organik cair, kontrol bercak putih daun.',
                nextRecommendation: 'Persiapan panen cabut atau potong pangkal.',
                observationsNeeded: 'Cek tinggi batang dan kebersihan helai daun.'
            },
            {
                code: 'KK-03',
                name: 'Panen Cabut Kangkung Segar',
                shortName: 'Panen Kangkung',
                stage_group: 'HARVEST',
                min_hst: 23,
                max_hst: 30,
                priority: 3,
                description: 'Kangkung dipanen pada puncak kerenyahan batang (tinggi 30 cm) sebelum berserat alot.',
                focusToday: 'Panen cabut bersama akar atau potong 3 cm dari tanah.',
                currentRecommendation: 'Ikat rapi per 250 gram, bilas akar bersih.',
                nextRecommendation: 'Distribusi cepat ke pasar pagi.',
                observationsNeeded: 'Cek batang masih sangat renyah bila dipatahkan.'
            }
        ],
        'Bayam': [
            {
                code: 'BY-01',
                name: 'Perkecambahan & Helai Daun Bulat',
                shortName: 'Perkecambahan',
                stage_group: 'VEGETATIVE',
                min_hst: 0,
                max_hst: 10,
                priority: 1,
                description: 'Tanam tebar langsung. Biji halus berkecambah serempak membentuk karpet hijau daun bulat.',
                focusToday: 'Penyiraman spray halus agar bibit tidak rebah tertimpa air.',
                currentRecommendation: 'Gunakan sprinkler halus, pupuk daun encer kaya nitrogen.',
                nextRecommendation: 'Penjarangan bila terlalu rapat.',
                observationsNeeded: 'Cek keseragaman kerapatan benih bayam.'
            },
            {
                code: 'BY-02',
                name: 'Vegetatif Pembesaran Daun Sukulen',
                shortName: 'Vegetatif Daun',
                stage_group: 'VEGETATIVE',
                min_hst: 11,
                max_hst: 20,
                priority: 2,
                description: 'Daun melebar hijau pekat atau merah, batang sukulen lembut.',
                focusToday: 'Pemeliharaan kelembaban dan pemacuan bobot daun.',
                currentRecommendation: 'Siram rutin pagi sore, monitor ulat daun.',
                nextRecommendation: 'Persiapan panen cabut cepat.',
                observationsNeeded: 'Cek kelembutan helai daun bayam.'
            },
            {
                code: 'BY-03',
                name: 'Panen Cabut Bayam Hijau/Merah',
                shortName: 'Panen Bayam',
                stage_group: 'HARVEST',
                min_hst: 21,
                max_hst: 30,
                priority: 3,
                description: 'Panen cabut pada umur optimal sebelum keluar tandan bunga di pucuk.',
                focusToday: 'Panen cabut bersama akar utuh.',
                currentRecommendation: 'Cuci bersih akar dari tanah, ikat per ikat 200–250 gram.',
                nextRecommendation: 'Kirim dalam kondisi lembab segar.',
                observationsNeeded: 'Cek tidak boleh ada kuncup bunga di pucuk bayam.'
            }
        ],
        'Kedelai': [
            {
                code: 'KD-01',
                name: 'Vegetatif & Pembentukan Bintil Akar (Rhizobium)',
                shortName: 'Vegetatif & Nodulasi',
                stage_group: 'VEGETATIVE',
                min_hst: 0,
                max_hst: 25,
                priority: 1,
                description: 'Tanam langsung. Perkecambahan dan simbiosis bintil akar penambat nitrogen aktif.',
                focusToday: 'Pengakaran dalam dan nodulasi akar sehat.',
                currentRecommendation: 'Kocor pupuk dasar berimbang, jaga tanah tetap remah tidak padat.',
                nextRecommendation: 'Persiapan pembungaan di ketiak daun.',
                observationsNeeded: 'Cek vigor daun trifoliat dan bintil akar merah muda.'
            },
            {
                code: 'KD-02',
                name: 'Pembungaan & Pembentukan Polong (R1–R4)',
                shortName: 'Bunga & Polong R1-R4',
                stage_group: 'GENERATIVE',
                min_hst: 26,
                max_hst: 50,
                priority: 2,
                description: 'Bunga kecil ungu/putih mekar di ketiak daun, terbentuk polong pipih berbulu.',
                focusToday: 'Penyerbukan dan pengisian polong muda.',
                currentRecommendation: 'Aplikasi pupuk fosfat dan kalium. Monitor hama ulat penggulung daun.',
                nextRecommendation: 'Persiapan pengisian biji kedelai bernas.',
                observationsNeeded: 'Cek jumlah polong terbentuk per ketiak daun.'
            },
            {
                code: 'KD-03',
                name: 'Pengisian Biji & Pematangan Polong Cokelat',
                shortName: 'Pengisian & Panen',
                stage_group: 'HARVEST',
                min_hst: 51,
                max_hst: 95,
                priority: 3,
                description: 'Biji dalam polong membesar padat, daun mulai gugur menguning, polong berubah warna cokelat tua.',
                focusToday: 'Pematangan biji kering dan pemanenan.',
                currentRecommendation: 'Panen saat 95% daun gugur dan polong berderak saat diguncang.',
                nextRecommendation: 'Perontokan biji dan penjemuran ke kadar air 12%.',
                observationsNeeded: 'Cek polong yang telah cokelat kering sempurna.'
            }
        ],
        'Kacang Tanah': [
            {
                code: 'KT-01',
                name: 'Vegetatif & Tajuk Tetrafoliat',
                shortName: 'Vegetatif Awal',
                stage_group: 'VEGETATIVE',
                min_hst: 0,
                max_hst: 25,
                priority: 1,
                description: 'Tanam biji langsung di tanah berpasir gembur. Daun majemuk 4 helai membuka subur.',
                focusToday: 'Penggemburan tanah di sekitar pangkal tanaman.',
                currentRecommendation: 'Gemburkan tanah bedengan agar memudahkan bakal polong masuk ke tanah nantinya.',
                nextRecommendation: 'Persiapan kemunculan bunga kuning dan ginofor.',
                observationsNeeded: 'Cek kegemburan tanah di sekitar pangkal batang.'
            },
            {
                code: 'KT-02',
                name: 'Pembungaan & Penusukan Ginofor (Calon Polong)',
                shortName: 'Bunga & Ginofor',
                stage_group: 'GENERATIVE',
                min_hst: 26,
                max_hst: 50,
                priority: 2,
                description: 'Bunga kuning mekar dan menghasilkan ginofor (tangkai jarum) yang menembus masuk ke dalam tanah gembur.',
                focusToday: 'Kemudahan penusukan ginofor ke tanah tanpa terhalang tanah keras.',
                currentRecommendation: 'Lakukan pembumbunan tanah halus ke sekitar batang. Aplikasi Kalsium (Gypsum) untuk isi polong.',
                nextRecommendation: 'Pengisian biji di dalam polong bawah tanah.',
                observationsNeeded: 'Amati ginofor yang berhasil menembus ke dalam tanah.'
            },
            {
                code: 'KT-03',
                name: 'Pembesaran Polong dalam Tanah & Panen Cabut',
                shortName: 'Polong & Panen Cabut',
                stage_group: 'HARVEST',
                min_hst: 51,
                max_hst: 105,
                priority: 3,
                description: 'Polong membesar di dalam tanah, kulit polong berserat jaring, biji padat berisi, siap panen cabut.',
                focusToday: 'Pemanenan cabut seluruh rumpun tanaman kacang tanah.',
                currentRecommendation: 'Cabut saat tanah agak lembab agar polong tidak tertinggal di tanah. Rontokkan polong dan jemur.',
                nextRecommendation: 'Sortasi polong bernas dan penjemuran.',
                observationsNeeded: 'Cek sampel 3 polong cabut apakah daging biji sudah penuh dan kulit ari bernoda hitam tanda tua.'
            }
        ]
    };

    // ====================================================
    // 4. KELAS SMART CROP ENGINE
    // ====================================================
    class SmartCropEngineCore {
        constructor() {
            this.stages = MASTER_GROWTH_STAGES;
            this.indicators = MASTER_PHENOLOGY_INDICATORS;
            this.defaultMethods = COMMODITY_DEFAULT_METHODS;
            this.methodLabels = PLANTING_METHOD_LABELS;
        }

        getDefaultPlantingMethod(commodity) {
            return this.defaultMethods[commodity] || 'nursery_transplant';
        }

        getMethodConfig(methodCode) {
            return this.methodLabels[methodCode] || this.methodLabels['nursery_transplant'];
        }

        getStagesForCommodity(commodity) {
            return this.stages[commodity] || this.stages['Cabai Rawit'];
        }

        getIndicatorsForCommodity(commodity) {
            return this.indicators.filter(ind => {
                if (ind.appliesToAll) return true;
                if (ind.commodities && Array.isArray(ind.commodities)) {
                    return ind.commodities.includes(commodity);
                }
                return false;
            });
        }

        getCommodityIndicators(commodity) {
            return this.getIndicatorsForCommodity(commodity);
        }

        /**
         * Pusat Evaluasi Cerdas Setiap Batch Tanaman (Rule-Based Agronomic Intelligence)
         */
        evaluate(params) {
            const commodity = params.commodity || 'Cabai Rawit';
            const variety = params.variety || '';
            const plantingMethod = params.planting_method || params.plantingMethod || this.getDefaultPlantingMethod(commodity);
            
            const isDirectMethod = (plantingMethod === 'direct_sowing' || plantingMethod === 'direct_planting');
            
            const hst = typeof params.HST === 'number' ? params.HST : (params.hst !== undefined ? params.hst : null);
            const hss = typeof params.HSS === 'number' ? params.HSS : (params.hss !== undefined ? params.hss : 0);
            const isTransplanted = isDirectMethod ? true : (hst !== null && hst >= 0);
            
            const activeAge = isDirectMethod ? (hst !== null ? hst : 0) : (isTransplanted ? hst : hss);
            const activeUnit = isDirectMethod ? 'HST' : (isTransplanted ? 'HST' : 'HSS');

            const observations = Array.isArray(params.observations) ? params.observations : [];
            const sortedObs = [...observations].sort((a, b) => new Date(b.observed_date || b.created_at) - new Date(a.observed_date || a.created_at));
            
            const obsMap = {};
            sortedObs.forEach(o => {
                const code = o.indicator_code || o.indicator_id || o.indicator;
                if (code && !obsMap[code]) {
                    obsMap[code] = o;
                }
            });

            // Master stages untuk komoditas ini
            const allStages = this.getStagesForCommodity(commodity);

            // 1. Tentukan Fase Baseline berdasarkan HST / HSS
            let baselineIndex = 0;
            for (let i = 0; i < allStages.length; i++) {
                const st = allStages[i];
                if (activeAge >= st.min_hst && activeAge <= st.max_hst) {
                    baselineIndex = i;
                    break;
                }
                if (activeAge > st.max_hst) {
                    baselineIndex = i;
                }
            }
            let selectedStage = allStages[baselineIndex];

            // 2. Evaluasi Observasi Lapangan (Phenology Inference)
            let stageStatus = 'FASE ESTIMASI';
            let stageConfidence = 75;
            let growthStatus = 'Normal berdasarkan umur kalender';
            let alerts = [];
            let confirmedByObservation = null;

            // Indikator observasi penting (Point 8, 9, 10)
            const isTruthyObs = (obs) => {
                if (!obs) return false;
                const v = String(obs.value ?? '').trim().toLowerCase();
                if (v === 'false' || v === 'tidak' || v === 'belum' || v === 'no' || v === '0') return false;
                return true;
            };

            const hasFirstFlower = isTruthyObs(obsMap['FIRST_FLOWER']);
            const hasFullFlowering = isTruthyObs(obsMap['FULL_FLOWERING']);
            const hasFruitSet = isTruthyObs(obsMap['FRUIT_SET']) || isTruthyObs(obsMap['FIRST_FRUIT']);
            const hasFruitDev = isTruthyObs(obsMap['FRUIT_DEVELOPMENT']) || isTruthyObs(obsMap['FRUIT_COLOR_CHANGE']);
            const hasFirstHarvest = isTruthyObs(obsMap['FIRST_HARVEST']);
            const hasSlowGrowth = isTruthyObs(obsMap['SLOW_GROWTH']);
            const hasYellowing = isTruthyObs(obsMap['YELLOWING_LEAVES']) || isTruthyObs(obsMap['LEAF_YELLOWING']);
            const hasPestSigns = isTruthyObs(obsMap['PEST_DISEASE_SIGNS']) || isTruthyObs(obsMap['PEST_SYMPTOM']);
            const hasNewShoots = isTruthyObs(obsMap['NEW_SHOOTS']);
            const hasStageConfirmed = isTruthyObs(obsMap['STAGE_CONFIRMED']);
            const hasStageMismatch = isTruthyObs(obsMap['STAGE_MISMATCH']);

            // Penerapan Aturan Agronomi Cerdas (Rule-Based Agronomic Intelligence)
            // Kasus A: FIRST_HARVEST tercatat
            if (hasFirstHarvest) {
                const harvestStage = allStages.find(s => s.stage_group === 'PRODUCTION' || s.stage_group === 'HARVEST') || allStages[allStages.length - 1];
                selectedStage = harvestStage;
                stageStatus = 'FASE TERKONFIRMASI';
                stageConfidence = 98;
                confirmedByObservation = 'Observasi Panen Perdana Tercatat';
                growthStatus = 'Fase panen / produksi aktif di lapangan';
            }
            // Kasus B: FRUIT_SET tercatat
            else if (hasFruitSet || hasFruitDev) {
                const fruitStage = allStages.find(s => s.stage_group === 'FRUIT_DEVELOPMENT' || (s.shortName && s.shortName.toLowerCase().includes('buah'))) || selectedStage;
                if (fruitStage) {
                    selectedStage = fruitStage;
                    stageStatus = 'FASE TERKONFIRMASI';
                    stageConfidence = 95;
                    confirmedByObservation = hasFruitDev ? 'Observasi Pembesaran Buah Tercatat' : 'Observasi Pembentukan Buah (Fruit Set) Tercatat';
                    growthStatus = 'Fase pembentukan & pembesaran buah terkonfirmasi';
                }
            }
            // Kasus C: FIRST_FLOWER tercatat
            else if (hasFirstFlower || hasFullFlowering) {
                const genStage = allStages.find(s => s.stage_group === 'GENERATIVE' || (s.shortName && s.shortName.toLowerCase().includes('bunga'))) || selectedStage;
                if (genStage) {
                    const wasEarlier = activeAge < genStage.min_hst;
                    selectedStage = genStage;
                    stageStatus = 'FASE TERKONFIRMASI';
                    stageConfidence = 95;
                    confirmedByObservation = hasFullFlowering ? 'Observasi Bunga Serentak' : 'Observasi Bunga Pertama Mekar';
                    if (wasEarlier) {
                        growthStatus = 'Perkembangan lebih cepat (Bunga mekar lebih awal)';
                        alerts.push({
                            type: 'info',
                            title: 'Pembungaan Lebih Awal Terkonfirmasi',
                            message: `Tanaman telah berbunga pada ${activeAge} ${activeUnit}, lebih cepat dari rata-rata estimasi (${genStage.min_hst} HST). Tingkatkan suplai Kalium dan Fosfat untuk memperkuat tangkai bunga.`
                        });
                    } else {
                        growthStatus = 'Fase generatif terkonfirmasi aktif di lapangan';
                    }
                }
            }
            // Kasus D: Umur kalender sudah masuk generatif, tapi bunga belum tercatat
            else if (selectedStage.stage_group === 'GENERATIVE' || selectedStage.stage_group === 'TRANSITION') {
                stageStatus = 'FASE ESTIMASI';
                stageConfidence = 70;
                growthStatus = 'Perkembangan generatif belum terkonfirmasi di lapangan';
                alerts.push({
                    type: 'warning',
                    title: 'Perlu Pemeriksaan Lapangan',
                    message: `Tanaman telah memasuki rentang estimasi pembungaan (${activeAge} ${activeUnit}). Periksa kuncup dan bunga pertama di lapangan untuk mengonfirmasi fase aktual.`
                });
            }

            // Pengecekan Keterlambatan Tumbuh Berdasarkan Umur Lanjut
            const maxExpectedGenerativeStart = allStages.find(s => s.stage_group === 'GENERATIVE')?.min_hst || 50;
            if (activeAge > (maxExpectedGenerativeStart + 12) && !hasFirstFlower && !hasFruitSet && !hasFirstHarvest) {
                growthStatus = 'Perlu pemeriksaan kondisi pertumbuhan tanaman';
                alerts.push({
                    type: 'alert',
                    title: 'Perkembangan Generatif Belum Terlihat',
                    message: `Umur tanaman (${activeAge} ${activeUnit}) telah melampaui rata-rata periode inisiasi bunga. Periksa kondisi tajuk, kecukupan sinar matahari, drainase perakaran, dan keseimbangan hara Fosfat di lapangan.`
                });
            }

            // Pengecekan Observasi Gejala Lapangan
            if (hasSlowGrowth) {
                alerts.push({
                    type: 'warning',
                    title: 'Observasi: Pertumbuhan Lambat Tercatat',
                    message: 'Observasi lapangan mencatat indikasi perlambatan vigor tanaman. Periksa kelembaban media tanah, aerasi akar, dan kecukupan nutrisi starter.'
                });
            }
            if (hasYellowing) {
                alerts.push({
                    type: 'warning',
                    title: 'Observasi: Daun Menguning Tercatat',
                    message: 'Gejala daun menguning tercatat di lapangan. Periksa sistem drainase bedengan agar akar tidak tergenang, serta evaluasi kebutuhan pupuk nitrogen/magnesium.'
                });
            }
            if (hasPestSigns) {
                alerts.push({
                    type: 'danger',
                    title: 'Observasi: Gejala Serangan OPT Tercatat',
                    message: 'Tanda serangan hama atau penyakit terdeteksi di lapangan. Lakukan identifikasi jenis OPT secara saksama dan terapkan langkah pengendalian sesuai petunjuk resmi label produk.'
                });
            }
            if (hasNewShoots) {
                growthStatus = growthStatus === 'Normal berdasarkan umur kalender' ? 'Pertumbuhan pucuk baru subur aktif' : growthStatus;
            }

            // Pengecekan Konfirmasi / Evaluasi Lapangan
            if (hasStageConfirmed && stageStatus !== 'FASE TERKONFIRMASI') {
                stageStatus = 'FASE TERKONFIRMASI';
                stageConfidence = Math.max(stageConfidence, 96);
                confirmedByObservation = 'Konfirmasi Lapangan Petani (Fase Sesuai)';
                growthStatus = 'Fase budidaya terkonfirmasi sesuai kondisi aktual di lahan';
            } else if (hasStageMismatch) {
                stageStatus = 'PERLU EVALUASI LAPANGAN';
                stageConfidence = 65;
                growthStatus = 'Terdapat masukan ketidaksesuaian fase dari pengamatan lapangan';
            }

            // 3. Tentukan Tahap Berikutnya & Estimasi Hari
            const currentIndex = allStages.findIndex(s => s.code === selectedStage.code);
            const nextStage = currentIndex >= 0 && currentIndex < allStages.length - 1 ? allStages[currentIndex + 1] : null;
            let estimatedNextStageDays = null;
            let estimatedNextStageText = 'Tahap akhir siklus';
            if (nextStage) {
                const daysToNext = Math.max(1, nextStage.min_hst - activeAge);
                estimatedNextStageDays = daysToNext;
                estimatedNextStageText = `${nextStage.name} (est. ${daysToNext} hari lagi / ${nextStage.min_hst} HST)`;
            }

            // 4. Timeline Stages dengan Status Past, Current, Upcoming
            const timelineStages = allStages.map((st, idx) => {
                let status = 'UPCOMING';
                let isCurrent = (st.code === selectedStage.code);
                if (isCurrent) {
                    status = 'CURRENT';
                } else if (idx < currentIndex) {
                    status = 'PAST';
                } else {
                    status = 'UPCOMING';
                }
                return {
                    ...st,
                    status,
                    isCurrent,
                    stageStatusLabel: isCurrent ? (stageStatus === 'FASE TERKONFIRMASI' ? 'Terkonfirmasi' : 'Estimasi') : ''
                };
            });

            // 5. Ringkasan Observasi Terakhir
            const lastObs = sortedObs.length > 0 ? sortedObs[0] : null;
            let lastObsText = 'Belum ada observasi lapangan tercatat.';
            if (lastObs) {
                const indObj = this.indicators.find(i => i.code === (lastObs.indicator_code || lastObs.indicator_id));
                const indName = indObj ? indObj.name : (lastObs.indicator_name || lastObs.indicator_code || 'Observasi Lapangan');
                const valText = (lastObs.value && lastObs.value !== 'true' && lastObs.value !== 'Terlihat jelas di lapangan') ? ` [${lastObs.value}]` : '';
                const noteText = lastObs.notes ? `: ${lastObs.notes}` : '';
                lastObsText = `${indName} (${lastObs.observed_date || 'terbaru'})${valText}${noteText}`;
            }

            // 6. Ringkasan Harian (Smart Daily Summary)
            const dailySummary = {
                commodity,
                variety: variety || 'Standar',
                plantingMethod,
                methodLabel: this.getMethodConfig(plantingMethod).badge,
                ageDisplay: `${activeAge} ${activeUnit}`,
                primaryAge: activeAge,
                primaryUnit: activeUnit,
                stageName: selectedStage.name,
                stageShort: selectedStage.shortName,
                stageStatus,
                stageConfidence: `${stageConfidence}%`,
                growthCondition: growthStatus,
                confirmedBy: confirmedByObservation,
                focusToday: selectedStage.focusToday,
                currentRecommendation: selectedStage.currentRecommendation,
                nextRecommendation: selectedStage.nextRecommendation,
                observationsNeeded: selectedStage.observationsNeeded,
                nextStageText: estimatedNextStageText,
                lastObservationSummary: lastObsText,
                hasAlerts: alerts.length > 0,
                alerts
            };

            return {
                commodity,
                variety,
                plantingMethod,
                methodConfig: this.getMethodConfig(plantingMethod),
                activeAge,
                activeUnit,
                isDirectMethod,
                isTransplanted,
                current_stage: selectedStage,
                stage_status: stageStatus,
                stage_confidence: stageConfidence,
                growth_status: growthStatus,
                confirmed_by: confirmedByObservation,
                current_recommendations: selectedStage.currentRecommendation,
                next_recommendations: selectedStage.nextRecommendation,
                observations_needed: selectedStage.observationsNeeded,
                focus_today: selectedStage.focusToday,
                estimated_next_stage: estimatedNextStageText,
                estimated_next_days: estimatedNextStageDays,
                alerts,
                daily_summary: dailySummary,
                all_stages: timelineStages,
                applicable_indicators: this.getIndicatorsForCommodity(commodity),
                observations_count: sortedObs.length,
                last_observation: lastObs,
                last_observation_summary: lastObsText
            };
        }
    }

    return new SmartCropEngineCore();
}));
