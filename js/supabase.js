/**
 * Jaya Agrofarm Nusantara - Centralized Supabase Client & Database Service
 * Project URL: https://ubyloojnmqmhhrdqzryt.supabase.co
 * 
 * Provides centralized Supabase PostgreSQL database operations for:
 * - crops (Tanaman)
 * - plots (Lahan)
 * - activities (Aktivitas Perawatan)
 * - inventory (Stok & Saprotan)
 * - finance (Keuangan Kas)
 * - whitelist & app_users & tenant_users (Multi-Tenant Access Control)
 * - Supabase Auth (signInWithPassword, signOut, getSession)
 * 
 * Production data is read/written through Supabase. Local storage is retained
 * only for non-business UI/preferences and legacy development helpers; STRICT_SUPABASE=true
 * prevents it from becoming a production database fallback.
 */

(function (root, factory) {
    const exports = factory();
    if (typeof root !== 'undefined') {
        root.databaseService = exports;
        root.supabaseClient = exports.supabase;
    }
    if (typeof window !== 'undefined') {
        window.databaseService = exports;
        window.supabaseClient = exports.supabase;
    }
    if (typeof module === 'object' && module.exports) {
        module.exports = exports;
    } else if (typeof define === 'function' && define.amd) {
        define([], () => exports);
    }
}(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : this), function () {

    // 1. Inisialisasi Supabase Client
    function resolveSupabaseFactory() {
        if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
            return window.supabase.createClient;
        }
        return null;
    }

    // Konfigurasi frontend: env Netlify/Vite dapat meng-override nilai default.
    // Publishable key memang aman untuk dibundel ke browser; keamanan data tetap
    // ditentukan oleh RLS Supabase, bukan dengan menyembunyikan publishable key.
    function cleanSupabaseUrl(raw) {
        if (!raw || typeof raw !== 'string') return 'https://ubyloojnmqmhhrdqzryt.supabase.co';
        const str = raw.trim();
        try {
            const parsed = new URL(str);
            return parsed.origin;
        } catch (e) {
            return str.replace(/\/rest\/v1\/?$/i, '').replace(/\/auth\/v1\/?$/i, '').replace(/\/+$/, '');
        }
    }

    const runtimeConfig = (typeof window !== 'undefined' && window.__SUPABASE_CONFIG__) || {};
    const rawSupabaseUrl = runtimeConfig.url
        || runtimeConfig.SUPABASE_URL
        || (typeof window !== 'undefined' && (window.__VITE_SUPABASE_URL || window.VITE_SUPABASE_URL || window.SUPABASE_URL))
        || (typeof process !== 'undefined' && process.env && (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL))
        || 'https://ubyloojnmqmhhrdqzryt.supabase.co';

    const SUPABASE_URL = cleanSupabaseUrl(rawSupabaseUrl);

    const SUPABASE_ANON_KEY = runtimeConfig.key
        || runtimeConfig.publishableKey
        || runtimeConfig.SUPABASE_ANON_KEY
        || (typeof window !== 'undefined' && (window.__VITE_SUPABASE_ANON_KEY || window.VITE_SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY || window.SUPABASE_KEY))
        || (typeof process !== 'undefined' && process.env && (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY))
        || 'sb_publishable_ODZg6NtJgUIErxs5gNXX1A_rTIiB0qA';

    const isDummyKey = !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('anon_placeholder') || SUPABASE_ANON_KEY.includes('.dummy');

    // Produksi: data bisnis dan autentikasi wajib melalui Supabase.
    // localStorage hanya boleh dipakai untuk preferensi/UI, bukan sebagai database pengganti.
    const STRICT_SUPABASE = true;

    function supabaseUnavailable(action = 'operasi') {
        throw new Error(`Supabase tidak tersedia untuk ${action}. Data belum disimpan.`);
    }

    function supabaseOperationFailed(action, error) {
        const message = error?.message || String(error || 'Kesalahan tidak diketahui');
        throw new Error(`Supabase gagal ${action}: ${message}`);
    }

    const createClientFn = resolveSupabaseFactory();
    const supabase = createClientFn
        ? createClientFn(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        })
        : null;

    // Helper logging error
    function handleSupabaseError(action, error) {
        if (!error) return;
        const message = error.message || String(error);
        console.warn(`[Supabase ${action} Notice]`, message);
    }

    function requireSupabase() {
        return supabase;
    }

    // ====================================================
    // LOCAL STORAGE STORE & SEED DATA (OFFLINE / DEV MODE)
    // ====================================================
    const STORAGE_KEY_PREFIX = 'jaya_agro_';

    const TENANT_LEGACY_MAP = {
        'tenant-nusantara': 'tenant-user-pratamajayapreneur-gmail-com',
        'tenant-lembang': 'tenant-user-petani-sukses-gmail-com',
        'tenant-makmur': 'tenant-user-agrobisnis-subang-gmail-com',
        'tenant-user-kandiandika23-gmail-com': 'tenant-user-pratamajayapreneur-gmail-com',
        'tenant-user-kandiapj23-gmail-com': 'tenant-user-pratamajayapreneur-gmail-com'
    };

    const TENANT_REVERSE_MAP = {
        'tenant-user-pratamajayapreneur-gmail-com': 'tenant-nusantara',
        'tenant-user-kandiandika23-gmail-com': 'tenant-nusantara',
        'tenant-user-kandiapj23-gmail-com': 'tenant-nusantara',
        'tenant-user-petani-sukses-gmail-com': 'tenant-lembang',
        'tenant-user-agrobisnis-subang-gmail-com': 'tenant-makmur'
    };

    function isTenantMatch(itemTenant, targetTenant) {
        if (!itemTenant || !targetTenant) return false;
        if (itemTenant === targetTenant) return true;
        return TENANT_LEGACY_MAP[itemTenant] === targetTenant ||
               TENANT_REVERSE_MAP[itemTenant] === targetTenant ||
               TENANT_LEGACY_MAP[targetTenant] === itemTenant ||
               TENANT_REVERSE_MAP[targetTenant] === itemTenant;
    }

    const SEED_PLOTS = [
        {
            id: 'plot-1',
            tenant_id: 'tenant-user-pratamajayapreneur-gmail-com',
            name: 'Blok A (Utama)',
            area: 10000,
            soil_type: 'Lempung Aluvial Subur',
            irrigation_type: 'Irigasi Teknis',
            status: 'active',
            location: 'Kawasan Inti Pertanian Barat',
            notes: 'Lahan utama budidaya komoditas pangan & hortikultura',
            created_at: new Date('2026-01-01').toISOString(),
            updated_at: new Date().toISOString()
        },
        {
            id: 'plot-2',
            tenant_id: 'tenant-user-pratamajayapreneur-gmail-com',
            name: 'Blok B (Hortikultura)',
            area: 5000,
            soil_type: 'Tanah Humus Vulkanik',
            irrigation_type: 'Drip Irrigation / Tetes',
            status: 'active',
            location: 'Zona Budidaya Sayuran & Cabai',
            notes: 'Bedengan dengan mulsa plastik hitam perak',
            created_at: new Date('2026-01-10').toISOString(),
            updated_at: new Date().toISOString()
        },
        {
            id: 'plot-lembang-1',
            tenant_id: 'tenant-user-petani-sukses-gmail-com',
            name: 'Blok Sayur Dataran Tinggi',
            area: 8000,
            soil_type: 'Andosol Vulkanik Sejuk',
            irrigation_type: 'Sprinkler System',
            status: 'active',
            location: 'Lembang Lereng Utara',
            notes: 'Optimal untuk tanaman sayur daun & buah dataran tinggi',
            created_at: new Date('2026-01-01').toISOString(),
            updated_at: new Date().toISOString()
        },
        {
            id: 'plot-makmur-1',
            tenant_id: 'tenant-user-agrobisnis-subang-gmail-com',
            name: 'Hamparan Sawah Subang A',
            area: 25000,
            soil_type: 'Aluvial Sawah Produktif',
            irrigation_type: 'Saluran Irigasi Primer',
            status: 'active',
            location: 'Sentra Pangan Pantura Subang',
            notes: 'Hamparan petak padi beririgasi teratur',
            created_at: new Date('2026-01-01').toISOString(),
            updated_at: new Date().toISOString()
        }
    ];

    const SEED_CROPS = [
        {
            id: 'crop-1',
            tenant_id: 'tenant-user-pratamajayapreneur-gmail-com',
            plot_id: 'plot-2',
            petak_id: 'plot-2',
            petak_name: 'Blok Wetan Cigayun (Atas)',
            cycle_code: 'Siklus #001',
            commodity: 'Cabai Rawit',
            variety: 'Ori 212',
            seeding_date: '2026-08-05',
            transplant_date: '2026-08-25',
            plant_date: '2026-08-25',
            est_harvest_date: '2026-12-15',
            luas_lahan: 2500,
            jumlah_tanaman: 3500,
            target_yield: 4200,
            stage: 'Fase Vegetatif',
            progress: 33,
            status: 'growing',
            notes: 'Blok Atas cabai rawit unggul Cigayun.\n[AGRO_DATES:seeding=2026-08-05,transplant=2026-08-25]',
            created_at: new Date('2026-08-05').toISOString(),
            updated_at: new Date().toISOString()
        },
        {
            id: 'crop-2',
            tenant_id: 'tenant-user-pratamajayapreneur-gmail-com',
            plot_id: 'plot-2',
            petak_id: 'plot-2',
            petak_name: 'Blok Tengah',
            cycle_code: 'Siklus #002',
            commodity: 'Cabai Rawit',
            variety: 'Ori 212',
            seeding_date: '2026-08-10',
            transplant_date: '2026-08-30',
            plant_date: '2026-08-30',
            est_harvest_date: '2026-12-20',
            luas_lahan: 2500,
            jumlah_tanaman: 3500,
            target_yield: 4200,
            stage: 'Fase Vegetatif',
            progress: 28,
            status: 'growing',
            notes: 'Blok Tengah sentra cabai rawit.\n[AGRO_DATES:seeding=2026-08-10,transplant=2026-08-30]',
            created_at: new Date('2026-08-10').toISOString(),
            updated_at: new Date().toISOString()
        },
        {
            id: 'crop-3',
            tenant_id: 'tenant-user-pratamajayapreneur-gmail-com',
            plot_id: 'plot-1',
            petak_id: 'plot-1',
            petak_name: 'Blok Bawah',
            cycle_code: 'Siklus #003',
            commodity: 'Cabai Rawit',
            variety: 'Ori 212',
            seeding_date: '2026-08-15',
            transplant_date: '2026-09-10',
            plant_date: '2026-09-10',
            est_harvest_date: '2026-12-30',
            luas_lahan: 3000,
            jumlah_tanaman: 4000,
            target_yield: 4800,
            stage: 'Fase Vegetatif',
            progress: 19,
            status: 'growing',
            notes: 'Blok Bawah cabai rawit.\n[AGRO_DATES:seeding=2026-08-15,transplant=2026-09-10]',
            created_at: new Date('2026-08-15').toISOString(),
            updated_at: new Date().toISOString()
        },
        {
            id: 'crop-4',
            tenant_id: 'tenant-user-pratamajayapreneur-gmail-com',
            plot_id: 'plot-2',
            petak_id: 'plot-2',
            petak_name: 'Greenhouse Semai 1',
            cycle_code: 'Siklus #004',
            commodity: 'Tomat',
            variety: 'Servo F1',
            seeding_date: '2026-09-20',
            transplant_date: null,
            plant_date: '2026-09-20',
            est_harvest_date: '2026-12-25',
            luas_lahan: 500,
            jumlah_tanaman: 2000,
            target_yield: 5000,
            stage: 'Fase Semai',
            progress: 15,
            status: 'growing',
            notes: 'Persemaian bibit tomat tray 128 lubang.\n[AGRO_DATES:seeding=2026-09-20,transplant=]',
            created_at: new Date('2026-09-20').toISOString(),
            updated_at: new Date().toISOString()
        },
        {
            id: 'crop-lembang-1',
            tenant_id: 'tenant-user-petani-sukses-gmail-com',
            plot_id: 'plot-lembang-1',
            petak_id: 'plot-lembang-1',
            petak_name: 'Blok Sayur Dataran Tinggi',
            cycle_code: 'Siklus #001',
            commodity: 'Tomat',
            variety: 'Servo F1',
            seeding_date: '2026-08-15',
            transplant_date: '2026-09-01',
            plant_date: '2026-09-01',
            est_harvest_date: '2026-11-25',
            luas_lahan: 3000,
            jumlah_tanaman: 4000,
            target_yield: 8000,
            stage: 'Fase Vegetatif',
            progress: 35,
            status: 'growing',
            notes: 'Bibit telah pindah tanam ke guludan permanen.\n[AGRO_DATES:seeding=2026-08-15,transplant=2026-09-01]',
            created_at: new Date('2026-08-15').toISOString(),
            updated_at: new Date().toISOString()
        },
        {
            id: 'crop-makmur-1',
            tenant_id: 'tenant-user-agrobisnis-subang-gmail-com',
            plot_id: 'plot-makmur-1',
            petak_id: 'plot-makmur-1',
            petak_name: 'Hamparan Sawah Subang A',
            cycle_code: 'Siklus #001',
            commodity: 'Padi',
            variety: 'Inpari 32 HDB',
            seeding_date: '2026-08-01',
            transplant_date: '2026-08-22',
            plant_date: '2026-08-22',
            est_harvest_date: '2026-11-20',
            luas_lahan: 25000,
            jumlah_tanaman: 40000,
            target_yield: 18000,
            stage: 'Fase Vegetatif',
            progress: 42,
            status: 'growing',
            notes: 'Hamparan sawah padi Inpari 32 produktivitas tinggi Pantura.\n[AGRO_DATES:seeding=2026-08-01,transplant=2026-08-22]',
            created_at: new Date('2026-08-01').toISOString(),
            updated_at: new Date().toISOString()
        }
    ];

    const SEED_ACTIVITIES = [
        {
            id: 'act-1',
            tenant_id: 'tenant-user-pratamajayapreneur-gmail-com',
            crop_id: 'crop-1',
            activity_date: '2026-09-28',
            type: 'Pemupukan',
            title: 'Pemupukan Susulan NPK Mutiara',
            description: 'Kocor NPK 16-16-16 dosis 5 gram/tanaman untuk memacu percabangan generatif.',
            cost: 350000,
            worker_count: 2,
            status: 'completed',
            created_at: new Date('2026-09-28').toISOString(),
            updated_at: new Date().toISOString()
        },
        {
            id: 'act-2',
            tenant_id: 'tenant-user-pratamajayapreneur-gmail-com',
            crop_id: 'crop-1',
            activity_date: '2026-09-25',
            type: 'Proteksi Hama',
            title: 'Aplikasi Agen Hayati Trichoderma',
            description: 'Pencegahan layu fusarium dan busuk batang saat kelembapan udara tinggi.',
            cost: 220000,
            worker_count: 1,
            status: 'completed',
            created_at: new Date('2026-09-25').toISOString(),
            updated_at: new Date().toISOString()
        },
        {
            id: 'act-3',
            tenant_id: 'tenant-user-pratamajayapreneur-gmail-com',
            crop_id: 'crop-2',
            activity_date: '2026-09-22',
            type: 'Pengairan',
            title: 'Pengaturan Macak-Macak Lahan Sawah',
            description: 'Pengeringan intermiten untuk memperdalam cengkeraman perakaran rumpun padi.',
            cost: 150000,
            worker_count: 1,
            status: 'completed',
            created_at: new Date('2026-09-22').toISOString(),
            updated_at: new Date().toISOString()
        },
        {
            id: 'act-lembang-1',
            tenant_id: 'tenant-user-petani-sukses-gmail-com',
            crop_id: 'crop-lembang-1',
            activity_date: '2026-09-26',
            type: 'Pemupukan',
            title: 'Aplikasi Kalsium Boron Daun',
            description: 'Pencegahan busuk ujung buah (blossom end rot) tanaman tomat Lembang.',
            cost: 180000,
            worker_count: 1,
            status: 'completed',
            created_at: new Date('2026-09-26').toISOString(),
            updated_at: new Date().toISOString()
        },
        {
            id: 'act-makmur-1',
            tenant_id: 'tenant-user-agrobisnis-subang-gmail-com',
            crop_id: 'crop-makmur-1',
            activity_date: '2026-09-20',
            type: 'Pengairan',
            title: 'Manajemen Air Irigasi Primer',
            description: 'Penggenangan dangkal 2-3 cm untuk mendukung pembentukan anakan produktif padi.',
            cost: 250000,
            worker_count: 2,
            status: 'completed',
            created_at: new Date('2026-09-20').toISOString(),
            updated_at: new Date().toISOString()
        }
    ];

    const SEED_INVENTORY = [
        {
            id: 'inv-1',
            tenant_id: 'tenant-user-pratamajayapreneur-gmail-com',
            name: 'Pupuk NPK Mutiara 16-16-16',
            category: 'Pupuk Kimia',
            stock: 250,
            unit: 'kg',
            min_stock: 50,
            unit_price: 18000,
            location: 'Gudang Utama A',
            notes: 'Stok pupuk dasar & susulan',
            created_at: new Date('2026-08-01').toISOString(),
            updated_at: new Date().toISOString()
        },
        {
            id: 'inv-2',
            tenant_id: 'tenant-user-pratamajayapreneur-gmail-com',
            name: 'Benih Cabai Rawit Ori 212',
            category: 'Benih & Bibit',
            stock: 12,
            unit: 'sachet (10gr)',
            min_stock: 3,
            unit_price: 95000,
            location: 'Lemari Benih',
            notes: 'Benih bersertifikat daya kecambah 90%',
            created_at: new Date('2026-08-01').toISOString(),
            updated_at: new Date().toISOString()
        },
        {
            id: 'inv-3',
            tenant_id: 'tenant-user-pratamajayapreneur-gmail-com',
            name: 'Agen Hayati Trichoderma Harzianum',
            category: 'Pestisida Nabati / Hayati',
            stock: 15,
            unit: 'botol (500ml)',
            min_stock: 4,
            unit_price: 65000,
            location: 'Gudang Obat Pertanian',
            notes: 'Bio-fungisida perlindungan akar',
            created_at: new Date('2026-08-01').toISOString(),
            updated_at: new Date().toISOString()
        },
        {
            id: 'inv-lembang-1',
            tenant_id: 'tenant-user-petani-sukses-gmail-com',
            name: 'Benih Tomat Servo F1',
            category: 'Benih & Bibit',
            stock: 8,
            unit: 'sachet (10gr)',
            min_stock: 2,
            unit_price: 110000,
            location: 'Ruang Sejuk Lembang',
            notes: 'Benih hibrida toleran gemini virus',
            created_at: new Date('2026-08-01').toISOString(),
            updated_at: new Date().toISOString()
        },
        {
            id: 'inv-makmur-1',
            tenant_id: 'tenant-user-agrobisnis-subang-gmail-com',
            name: 'Benih Padi Inpari 32 Bersertifikat',
            category: 'Benih & Bibit',
            stock: 120,
            unit: 'kg',
            min_stock: 30,
            unit_price: 15000,
            location: 'Gudang Benih Pantura',
            notes: 'Benih padi unggul bersertifikat BPSB',
            created_at: new Date('2026-08-01').toISOString(),
            updated_at: new Date().toISOString()
        }
    ];

    const SEED_FINANCE = [
        {
            id: 'fin-1',
            tenant_id: 'tenant-user-pratamajayapreneur-gmail-com',
            plot_id: 'plot-1',
            crop_id: 'crop-2',
            transaction_date: '2026-09-20',
            type: 'income',
            category: 'Penjualan Hasil Panen',
            title: 'Penjualan Gabah Kering Panen Siklus Lalu',
            amount: 14500000,
            notes: 'Pembayaran tunai dari mitra pengolahan beras',
            created_at: new Date('2026-09-20').toISOString(),
            updated_at: new Date().toISOString()
        },
        {
            id: 'fin-2',
            tenant_id: 'tenant-user-pratamajayapreneur-gmail-com',
            plot_id: 'plot-2',
            crop_id: 'crop-1',
            transaction_date: '2026-09-15',
            type: 'expense',
            category: 'Pembelian Saprotan',
            title: 'Pengadaan Pupuk NPK & Nutrisi Mikro',
            amount: 2250000,
            notes: 'Faktur toko tani Agro Jaya',
            created_at: new Date('2026-09-15').toISOString(),
            updated_at: new Date().toISOString()
        },
        {
            id: 'fin-3',
            tenant_id: 'tenant-user-pratamajayapreneur-gmail-com',
            plot_id: 'plot-1',
            crop_id: 'crop-2',
            transaction_date: '2026-09-10',
            type: 'expense',
            category: 'Upah Tenaga Kerja',
            title: 'Upah Penyiangan & Pemeliharaan Gulma',
            amount: 800000,
            notes: 'Upah 4 orang pekerja harian',
            created_at: new Date('2026-09-10').toISOString(),
            updated_at: new Date().toISOString()
        },
        {
            id: 'fin-lembang-1',
            tenant_id: 'tenant-user-petani-sukses-gmail-com',
            plot_id: 'plot-lembang-1',
            crop_id: 'crop-lembang-1',
            transaction_date: '2026-09-18',
            type: 'expense',
            category: 'Pembelian Saprotan',
            title: 'Pengadaan Mulsa & Nutrisi Hortikultura',
            amount: 1450000,
            notes: 'Toko Pertanian Lembang Sejahtera',
            created_at: new Date('2026-09-18').toISOString(),
            updated_at: new Date().toISOString()
        },
        {
            id: 'fin-makmur-1',
            tenant_id: 'tenant-user-agrobisnis-subang-gmail-com',
            plot_id: 'plot-makmur-1',
            crop_id: 'crop-makmur-1',
            transaction_date: '2026-09-12',
            type: 'income',
            category: 'Penjualan Hasil Panen',
            title: 'Penjualan Gabah Kering Giling Petak A',
            amount: 28500000,
            notes: 'Kemitraan pabrik beras Subang',
            created_at: new Date('2026-09-12').toISOString(),
            updated_at: new Date().toISOString()
        }
    ];

    const SEED_WHITELIST = [
        {
            id: 'wl-1',
            tenant_id: 'tenant-user-petani-sukses-gmail-com',
            email: 'petani.sukses@gmail.com',
            name: 'Hendra Saputra',
            notes: 'Premium Member - Petani Lembang',
            status: 'active',
            created_at: '2026-01-15T08:00:00Z'
        },
        {
            id: 'wl-2',
            tenant_id: 'tenant-user-bambang-agrofarm-id',
            email: 'bambang@agrofarm.id',
            name: 'Ir. Bambang Wijaya',
            notes: 'Premium Member - Agro Nusantara',
            status: 'active',
            created_at: '2026-02-01T09:30:00Z'
        },
        {
            id: 'wl-3',
            tenant_id: 'tenant-user-agrobisnis-subang-gmail-com',
            email: 'agrobisnis.subang@gmail.com',
            name: 'Koperasi Tani Makmur Subang',
            notes: 'Premium Member - Koperasi Subang',
            status: 'active',
            created_at: '2026-02-10T11:00:00Z'
        },
        {
            id: 'wl-kandi',
            tenant_id: 'tenant-user-kandiandika23-gmail-com',
            email: 'kandiandika23@gmail.com',
            name: 'Kandi Andika Pratama Jaya',
            notes: 'Premium Member',
            status: 'active',
            created_at: '2026-01-01T00:00:00Z'
        },
        {
            id: 'wl-kandi-super-admin',
            tenant_id: 'tenant-user-kandiapj23-gmail-com',
            email: 'kandiapj23@gmail.com',
            name: 'Kandi Andika Pratama Jaya',
            notes: 'Super Administrator',
            status: 'active',
            created_at: '2026-01-01T00:00:00Z'
        },
        {
            id: 'wl-admin',
            tenant_id: 'tenant-user-pratamajayapreneur-gmail-com',
            email: 'pratamajayapreneur@gmail.com',
            name: 'Jaya Agrofarm Administrator',
            notes: 'Super Administrator',
            status: 'active',
            created_at: '2026-01-01T00:00:00Z'
        }
    ];

    const memoryStore = new Map();

    function getLocalStore(key, seedData = []) {
        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                const raw = window.localStorage.getItem(STORAGE_KEY_PREFIX + key);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
                }
                window.localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(seedData));
                return seedData;
            } catch (e) {
                console.warn('[LocalStorage] Gagal membaca:', e);
            }
        }
        if (!memoryStore.has(key)) {
            memoryStore.set(key, JSON.parse(JSON.stringify(seedData)));
        }
        return memoryStore.get(key);
    }

    function setLocalStore(key, data) {
        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                window.localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(data));
            } catch (e) {
                console.warn('[LocalStorage] Gagal menyimpan:', e);
            }
        }
        memoryStore.set(key, data);
    }

    function normalizeInsertId(payload) {
        const clean = { ...payload };
        if (clean.id) {
            const id = String(clean.id);
            const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuid.test(id)) {
                clean.legacy_id = clean.legacy_id || id;
                delete clean.id;
            }
        }
        return clean;
    }

    // ====================================================
    // 1. CROPS / TANAMAN CRUD (Supabase PostgreSQL)
    // ====================================================
    async function getCrops(tenantId) {
        const tId = tenantId;
        if (supabase) {
            try {
                const targetReverse = TENANT_REVERSE_MAP[tId];
                let query = supabase.from('crops').select('*');
                if (targetReverse) {
                    query = query.in('tenant_id', [tId, targetReverse]);
                } else {
                    query = query.eq('tenant_id', tId);
                }
                const { data, error } = await query.order('created_at', { ascending: false });

                if (!error && Array.isArray(data)) return data;
                if (error) supabaseOperationFailed('memuat tanaman', error);
            } catch (err) {
                if (STRICT_SUPABASE) supabaseOperationFailed('memuat tanaman', err);
            }
        }
        if (STRICT_SUPABASE) supabaseUnavailable('memuat tanaman');
        const local = getLocalStore('crops', SEED_CROPS);
        return local.filter(c => isTenantMatch(c.tenant_id, tenantId));
    }

    async function createCrop(payload) {
        requireSupabase();
        const cleanPayload = normalizeInsertId({
            ...payload,
            created_at: payload.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        });

        if (supabase) {
            try {
                let { data, error } = await supabase
                    .from('crops')
                    .insert(cleanPayload)
                    .select()
                    .single();

                if (error && (String(error.message).includes('column') || String(error.message).includes('schema cache'))) {
                    const fallbackPayload = { ...cleanPayload };
                    delete fallbackPayload.seeding_date;
                    delete fallbackPayload.transplant_date;
                    const retry = await supabase
                        .from('crops')
                        .insert(fallbackPayload)
                        .select()
                        .single();
                    if (!retry.error && retry.data) {
                        data = { ...retry.data, seeding_date: cleanPayload.seeding_date, transplant_date: cleanPayload.transplant_date };
                        error = null;
                    }
                }

                if (!error && data) {
                    return data;
                }
                if (error) handleSupabaseError('createCrop', error);
            } catch (err) {
                handleSupabaseError('createCrop', err);
            }
        }
        if (STRICT_SUPABASE) supabaseUnavailable('menyimpan tanaman');
        const local = getLocalStore('crops', SEED_CROPS);
        local.unshift(cleanPayload);
        setLocalStore('crops', local);
        return cleanPayload;
    }

    async function updateCrop(id, payload) {
        requireSupabase();
        const cleanPayload = {
            ...payload,
            updated_at: new Date().toISOString()
        };
        delete cleanPayload.id;

        if (supabase) {
            try {
                let { data, error } = await supabase
                    .from('crops')
                    .update(cleanPayload)
                    .eq('id', id)
                    .select()
                    .single();

                if (error && (String(error.message).includes('column') || String(error.message).includes('schema cache'))) {
                    const fallbackPayload = { ...cleanPayload };
                    delete fallbackPayload.seeding_date;
                    delete fallbackPayload.transplant_date;
                    const retry = await supabase
                        .from('crops')
                        .update(fallbackPayload)
                        .eq('id', id)
                        .select()
                        .single();
                    if (!retry.error && retry.data) {
                        data = { ...retry.data, seeding_date: cleanPayload.seeding_date, transplant_date: cleanPayload.transplant_date };
                        error = null;
                    }
                }

                if (!error && data) {
                    return data;
                }
                if (error) handleSupabaseError('updateCrop', error);
            } catch (err) {
                handleSupabaseError('updateCrop', err);
            }
        }

        if (STRICT_SUPABASE) supabaseUnavailable('memperbarui tanaman');
        const local = getLocalStore('crops', SEED_CROPS);
        const idx = local.findIndex(c => String(c.id) === String(id));
        if (idx !== -1) { local[idx] = { ...local[idx], ...cleanPayload }; setLocalStore('crops', local); return local[idx]; }
        return { id, ...cleanPayload };
    }

    async function deleteCrop(id) {
        requireSupabase();
        if (supabase) {
            try {
                await supabase.from('activities').delete().eq('crop_id', String(id)).catch(() => {});
                const { error } = await supabase.from('crops').delete().eq('id', id);
                if (error) supabaseOperationFailed('menghapus tanaman', error);
            } catch (err) {
                if (STRICT_SUPABASE) supabaseOperationFailed('menghapus tanaman', err);
            }
        }
        if (STRICT_SUPABASE) return true;
        const local = getLocalStore('crops', SEED_CROPS);
        const filtered = local.filter(c => String(c.id) !== String(id));
        setLocalStore('crops', filtered);
        const localAct = getLocalStore('activities', SEED_ACTIVITIES);
        setLocalStore('activities', localAct.filter(a => String(a.crop_id) !== String(id)));
        return true;
    }

    // ====================================================
    // 2. PLOTS / LAHAN CRUD (Supabase PostgreSQL)
    // ====================================================
    async function getPlots(tenantId) {
        if (!supabase) supabaseUnavailable('memuat lahan');
        try {
            const targetReverse = TENANT_REVERSE_MAP[tenantId];
            let query = supabase.from('plots').select('*');
            query = targetReverse ? query.in('tenant_id', [tenantId, targetReverse]) : query.eq('tenant_id', tenantId);
            const { data, error } = await query.order('created_at', { ascending: true });
            if (error) supabaseOperationFailed('memuat lahan', error);
            return Array.isArray(data) ? data : [];
        } catch (err) { supabaseOperationFailed('memuat lahan', err); }
    }

    async function createPlot(payload) {
        if (!supabase) supabaseUnavailable('menyimpan lahan');
        const cleanPayload = normalizeInsertId({ ...payload, created_at: payload.created_at || new Date().toISOString(), updated_at: new Date().toISOString() });
        const { data, error } = await supabase.from('plots').insert(cleanPayload).select().single();
        if (error || !data) supabaseOperationFailed('menyimpan lahan', error || new Error('Tidak ada data hasil insert'));
        return data;
    }

    async function updatePlot(id, payload) {
        if (!supabase) supabaseUnavailable('memperbarui lahan');
        const cleanPayload = { ...payload, updated_at: new Date().toISOString() }; delete cleanPayload.id;
        const { data, error } = await supabase.from('plots').update(cleanPayload).eq('id', id).select().single();
        if (error || !data) supabaseOperationFailed('memperbarui lahan', error || new Error('Data tidak ditemukan'));
        return data;
    }

    async function deletePlot(id) {
        if (!supabase) supabaseUnavailable('menghapus lahan');
        const { error } = await supabase.from('plots').delete().eq('id', id);
        if (error) supabaseOperationFailed('menghapus lahan', error);
        return true;
    }

    async function getActivities(tenantId) {
        if (!supabase) supabaseUnavailable('memuat aktivitas');
        const { data, error } = await supabase.from('activities').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
        if (error) supabaseOperationFailed('memuat aktivitas', error);
        return Array.isArray(data) ? data : [];
    }

    async function createActivity(payload) {
        if (!supabase) supabaseUnavailable('menyimpan aktivitas');
        const cleanPayload = normalizeInsertId({ ...payload, created_at: payload.created_at || new Date().toISOString() });
        const { data, error } = await supabase.from('activities').insert(cleanPayload).select().single();
        if (error || !data) supabaseOperationFailed('menyimpan aktivitas', error || new Error('Tidak ada data hasil insert'));
        return data;
    }

    async function updateActivity(id, payload) {
        if (!supabase) supabaseUnavailable('memperbarui aktivitas');
        const cleanPayload = { ...payload, updated_at: new Date().toISOString() }; delete cleanPayload.id;
        const { data, error } = await supabase.from('activities').update(cleanPayload).eq('id', id).select().single();
        if (error || !data) supabaseOperationFailed('memperbarui aktivitas', error || new Error('Data tidak ditemukan'));
        return data;
    }

    async function deleteActivity(id) {
        if (!supabase) supabaseUnavailable('menghapus aktivitas');
        const { error } = await supabase.from('activities').delete().eq('id', id);
        if (error) supabaseOperationFailed('menghapus aktivitas', error);
        return true;
    }

    async function getInventory(tenantId) {
        if (!supabase) supabaseUnavailable('memuat inventory');
        const { data, error } = await supabase.from('inventory').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
        if (error) supabaseOperationFailed('memuat inventory', error);
        return Array.isArray(data) ? data : [];
    }

    async function createInventory(payload) {
        if (!supabase) supabaseUnavailable('menyimpan inventory');
        const cleanPayload = normalizeInsertId({ ...payload, created_at: payload.created_at || new Date().toISOString(), updated_at: new Date().toISOString() });
        const { data, error } = await supabase.from('inventory').insert(cleanPayload).select().single();
        if (error || !data) supabaseOperationFailed('menyimpan inventory', error || new Error('Tidak ada data hasil insert'));
        return data;
    }

    async function updateInventory(id, payload) {
        if (!supabase) supabaseUnavailable('memperbarui inventory');
        const cleanPayload = { ...payload, updated_at: new Date().toISOString() }; delete cleanPayload.id;
        const { data, error } = await supabase.from('inventory').update(cleanPayload).eq('id', id).select().single();
        if (error || !data) supabaseOperationFailed('memperbarui inventory', error || new Error('Data tidak ditemukan'));
        return data;
    }

    async function deleteInventory(id) {
        if (!supabase) supabaseUnavailable('menghapus inventory');
        const { error } = await supabase.from('inventory').delete().eq('id', id);
        if (error) supabaseOperationFailed('menghapus inventory', error);
        return true;
    }

    async function getFinance(tenantId) {
        if (!supabase) supabaseUnavailable('memuat keuangan');
        const { data, error } = await supabase.from('finance').select('*').eq('tenant_id', tenantId).order('transaction_date', { ascending: false });
        if (error) supabaseOperationFailed('memuat keuangan', error);
        return Array.isArray(data) ? data : [];
    }

    async function createFinance(payload) {
        if (!supabase) supabaseUnavailable('menyimpan keuangan');
        const cleanPayload = normalizeInsertId({ ...payload, created_at: payload.created_at || new Date().toISOString(), updated_at: new Date().toISOString() });
        const { data, error } = await supabase.from('finance').insert(cleanPayload).select().single();
        if (error || !data) supabaseOperationFailed('menyimpan keuangan', error || new Error('Tidak ada data hasil insert'));
        return data;
    }

    async function updateFinance(id, payload) {
        if (!supabase) supabaseUnavailable('memperbarui keuangan');
        const cleanPayload = { ...payload, updated_at: new Date().toISOString() }; delete cleanPayload.id;
        const { data, error } = await supabase.from('finance').update(cleanPayload).eq('id', id).select().single();
        if (error || !data) supabaseOperationFailed('memperbarui keuangan', error || new Error('Data tidak ditemukan'));
        return data;
    }

    async function deleteFinance(id) {
        if (!supabase) supabaseUnavailable('menghapus keuangan');
        const { error } = await supabase.from('finance').delete().eq('id', id);
        if (error) supabaseOperationFailed('menghapus keuangan', error);
        return true;
    }

    async function getBatchObservations(batchId, tenantId) {
        if (!supabase) supabaseUnavailable('memuat observasi Smart Farm');
        let query = supabase.from('batch_growth_observations').select('*').order('observed_date', { ascending: false });
        if (batchId) query = query.eq('batch_id', String(batchId));
        if (tenantId) query = query.eq('tenant_id', tenantId);
        const { data, error } = await query;
        if (error) supabaseOperationFailed('memuat observasi Smart Farm', error);
        return Array.isArray(data) ? data : [];
    }

    async function createBatchObservation(payload) {
        if (!supabase) supabaseUnavailable('menyimpan observasi Smart Farm');
        const cleanPayload = normalizeInsertId({ ...payload, batch_id: String(payload.batch_id || payload.crop_id || ''), observed_date: payload.observed_date || new Date().toISOString().slice(0, 10), created_at: payload.created_at || new Date().toISOString() });
        const { data, error } = await supabase.from('batch_growth_observations').insert(cleanPayload).select().single();
        if (error || !data) supabaseOperationFailed('menyimpan observasi Smart Farm', error || new Error('Tidak ada data hasil insert'));
        return data;
    }

    async function deleteBatchObservation(id, tenantId) {
        if (!supabase) supabaseUnavailable('menghapus observasi Smart Farm');
        let query = supabase.from('batch_growth_observations').delete().eq('id', id);
        if (tenantId) query = query.eq('tenant_id', tenantId);
        const { error } = await query;
        if (error) supabaseOperationFailed('menghapus observasi Smart Farm', error);
        return true;
    }

    async function getBatchFeedbacks(batchId, tenantId) {
        if (!supabase) supabaseUnavailable('memuat feedback Smart Farm');
        let query = supabase.from('batch_growth_feedback').select('*').order('created_at', { ascending: false });
        if (batchId) query = query.eq('batch_id', String(batchId));
        if (tenantId) query = query.eq('tenant_id', tenantId);
        const { data, error } = await query;
        if (error) supabaseOperationFailed('memuat feedback Smart Farm', error);
        return Array.isArray(data) ? data : [];
    }

    async function createBatchFeedback(payload) {
        if (!supabase) supabaseUnavailable('menyimpan feedback Smart Farm');
        const cleanPayload = normalizeInsertId({ ...payload, batch_id: String(payload.batch_id || payload.crop_id || ''), created_at: payload.created_at || new Date().toISOString() });
        const { data, error } = await supabase.from('batch_growth_feedback').insert(cleanPayload).select().single();
        if (error || !data) supabaseOperationFailed('menyimpan feedback Smart Farm', error || new Error('Tidak ada data hasil insert'));
        return data;
    }

    // ====================================================
    // 6. WHITELIST & MULTI-TENANT ACCESS CONTROL
    // ====================================================
    async function getWhitelist(tenantId) {
        if (!supabase || isDummyKey) supabaseUnavailable('memuat whitelist');
        let query = supabase.from('whitelist').select('*');
        if (tenantId) query = query.eq('tenant_id', tenantId);
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) supabaseOperationFailed('memuat whitelist', error);
        return Array.isArray(data) ? data : [];
    }

    async function addToWhitelist(payload) {
        const cleanPayload = {
            tenant_id: payload.tenant_id || 'tenant-nusantara',
            email: String(payload.email || '').trim().toLowerCase(),
            name: payload.name || String(payload.email || '').split('@')[0],
            notes: payload.notes || 'Akses Terdaftar',
            status: payload.status || 'active'
        };
        if (!cleanPayload.email || !cleanPayload.email.includes('@')) throw new Error('Alamat email tidak valid.');
        if (!supabase || isDummyKey) supabaseUnavailable('menambah whitelist');
        const { data, error } = await supabase.from('whitelist').insert(cleanPayload).select('*').single();
        if (error || !data) supabaseOperationFailed('menambah whitelist', error || new Error('Tidak ada data hasil insert'));
        return data;
    }

    async function removeFromWhitelist(idOrEmail) {
        if (!supabase || isDummyKey) supabaseUnavailable('menghapus whitelist');
        const column = String(idOrEmail).includes('@') ? 'email' : 'id';
        const { error } = await supabase.from('whitelist').delete().eq(column, idOrEmail);
        if (error) supabaseOperationFailed('menghapus whitelist', error);
        return true;
    }

    // ====================================================
    // 7. SUPABASE AUTH WRAPPER
    // ====================================================
    async function authCheckAccess(email) {
        const cleanEmail = email.trim().toLowerCase();
        if (!supabase || isDummyKey) supabaseUnavailable('memeriksa akses login');
        if (window.isSuperAdminEmail && window.isSuperAdminEmail(cleanEmail)) return true;
        try {
            const { data, error } = await supabase.rpc('check_login_access', { p_email: cleanEmail });
            if (!error && data === true) return true;
        } catch (_) {}
        try {
            const { data: wl, error: wlErr } = await supabase.from('whitelist').select('email, status').eq('email', cleanEmail).maybeSingle();
            if (wlErr) supabaseOperationFailed('memeriksa whitelist', wlErr);
            return !!wl && ['active', 'approved', 'paid'].includes(String(wl.status || '').toLowerCase());
        } catch (err) { supabaseOperationFailed('memeriksa akses login', err); }
    }

    async function authSignUp(email, password, metadata = {}) {
        const cleanEmail = email.trim().toLowerCase();
        const allowed = await authCheckAccess(cleanEmail);
        if (!allowed) throw new Error('Email belum disetujui admin atau pembayaran belum aktif.');
        if (!supabase || isDummyKey) supabaseUnavailable('pendaftaran');
        const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password, options: { data: metadata } });
        if (error) supabaseOperationFailed('mendaftarkan akun', error);
        if (!data?.user) throw new Error('Supabase tidak mengembalikan user.');
        return data;
    }

    async function authSignIn(email, password) {
        const cleanEmail = email.trim().toLowerCase();
        const allowed = await authCheckAccess(cleanEmail);
        if (!allowed) throw new Error('Akses ditolak. Email ini belum disetujui admin atau pembayaran belum aktif.');
        if (!supabase || isDummyKey) supabaseUnavailable('login');
        const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) supabaseOperationFailed('login', error);
        if (!data?.user || !data?.session) throw new Error('Supabase tidak mengembalikan session login.');
        return data;
    }

    async function authSignOut() {
        if (!supabase || isDummyKey) return;
        const { error } = await supabase.auth.signOut();
        if (error) supabaseOperationFailed('logout', error);
    }

    async function authGetSession() {
        if (!supabase || isDummyKey) return null;
        const { data, error } = await supabase.auth.getSession();
        if (error) supabaseOperationFailed('memuat session', error);
        return data?.session || null;
    }

    async function authGetUser() {
        if (!supabase || isDummyKey) return null;
        try {
            const { data, error } = await supabase.auth.getUser();
            if (error) {
                console.warn('[Supabase authGetUser]', error?.message || error);
                return null;
            }
            return data?.user || null;
        } catch (e) {
            console.warn('[Supabase authGetUser exception]', e?.message || e);
            return null;
        }
    }

    return {
        supabase,
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        isDummyKey,
        STRICT_SUPABASE,
        getCrops, createCrop, updateCrop, deleteCrop,
        getPlots, createPlot, updatePlot, deletePlot,
        getActivities, createActivity, updateActivity, deleteActivity,
        getInventory, createInventory, updateInventory, deleteInventory,
        getFinance, createFinance, updateFinance, deleteFinance,
        getBatchObservations, createBatchObservation, deleteBatchObservation,
        getBatchFeedbacks, createBatchFeedback,
        getWhitelist, addToWhitelist, removeFromWhitelist,
        authCheckAccess, authSignUp, authSignIn, authSignOut, authGetSession, authGetUser
    };
}));
