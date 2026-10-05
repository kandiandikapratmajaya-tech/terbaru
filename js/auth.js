/**
 * Sistem Autentikasi Supabase Auth & RBAC Multi-Tenant
 * Jaya Agrofarm Nusantara
 * 
 * Prinsip Sinkronisasi Profil:
 * 1. SUPABASE AUTH USER ID (auth.users.id) adalah identitas utama akun.
 * 2. Database Supabase (public.app_users & auth.users metadata) adalah SUMBER KEBENARAN TUNGGAL (Single Source of Truth) untuk profil pengguna.
 * 3. localStorage/sessionStorage HANYA berupa cache sekunder berbasis user.id (userProfile_{user.id}) dan TIDAK PERNAH menjadi penentu utama nama.
 * 4. Saat login dan pembukaan aplikasi (checkSession), data nama SELALU diambil segar dari Supabase.
 * 5. Perubahan nama langsung disimpan ke Supabase, disiarkan ke Realtime Channel, dan disinkronkan ke seluruh UI aplikasi.
 * 6. 1 Akun = 1 Profil = 1 Nama yang konsisten di semua perangkat (Device A & Device B).
 */

// Super Administrator: akun bawaan dengan hak akses penuh
const MASTER_ADMIN = {
    id: 'admin-master',
    email: 'pratamajayapreneur@gmail.com',
    name: 'Jaya Agrofarm Administrator',
    role: 'OWNER_ADMIN',
    status: 'active'
};
const SUPER_ADMIN_EMAILS = [
    'pratamajayapreneur@gmail.com',
    'kandiapj23@gmail.com'
];
// Catatan: SUPER_ADMIN_PROFILES hanya digunakan sebagai default inisial jika akun baru belum pernah menyimpan profil di Supabase.
const SUPER_ADMIN_PROFILES = {
    'pratamajayapreneur@gmail.com': { name: 'Jaya Agrofarm Administrator' },
    'kandiapj23@gmail.com': { name: 'Kandi Andika Pratama Jaya' }
};
const isSuperAdminEmail = (email) => SUPER_ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase());
window.MASTER_ADMIN = MASTER_ADMIN;
window.SUPER_ADMIN_EMAILS = SUPER_ADMIN_EMAILS;
window.isSuperAdminEmail = isSuperAdminEmail;

// Daftar Organisasi / Tenant Bawaan
const TENANTS = {
    'tenant-nusantara': {
        id: 'tenant-nusantara',
        slug: 'agro-nusantara',
        code: 'AGRO-01',
        name: 'Jaya Agrofarm Nusantara',
        sector: 'Tanaman Pangan & Hortikultura',
        plan: 'Premium Member'
    },
    'tenant-user-pratamajayapreneur-gmail-com': {
        id: 'tenant-user-pratamajayapreneur-gmail-com',
        slug: 'agro-nusantara',
        code: 'AGRO-01',
        name: 'Jaya Agrofarm Nusantara',
        sector: 'Tanaman Pangan & Hortikultura',
        plan: 'Premium Member'
    },
    'tenant-lembang': {
        id: 'tenant-lembang',
        slug: 'agro-lembang',
        code: 'AGRO-02',
        name: 'Kebun Dataran Tinggi Lestari Lembang',
        sector: 'Hortikultura Sayur & Buah',
        plan: 'Premium Member'
    },
    'tenant-user-petani-sukses-gmail-com': {
        id: 'tenant-user-petani-sukses-gmail-com',
        slug: 'agro-lembang',
        code: 'AGRO-02',
        name: 'Kebun Dataran Tinggi Lestari Lembang (Hendra)',
        sector: 'Hortikultura Sayur & Buah',
        plan: 'Premium Member'
    },
    'tenant-makmur': {
        id: 'tenant-makmur',
        slug: 'tani-makmur',
        code: 'AGRO-03',
        name: 'Koperasi Tani Makmur Subang',
        sector: 'Sentra Padi & Jagung',
        plan: 'Premium Member'
    },
    'tenant-user-agrobisnis-subang-gmail-com': {
        id: 'tenant-user-agrobisnis-subang-gmail-com',
        slug: 'tani-makmur',
        code: 'AGRO-03',
        name: 'Koperasi Tani Makmur Subang',
        sector: 'Sentra Padi & Jagung',
        plan: 'Premium Member'
    },
    'tenant-user-kandiapj23-gmail-com': {
        id: 'tenant-user-kandiapj23-gmail-com',
        slug: 'agro-nusantara',
        code: 'AGRO-01',
        name: 'Jaya Agrofarm Nusantara',
        sector: 'Tanaman Pangan & Hortikultura',
        plan: 'Premium Member'
    },
    'tenant-user-kandiandika23-gmail-com': {
        id: 'tenant-user-kandiandika23-gmail-com',
        slug: 'agro-nusantara',
        code: 'AGRO-01',
        name: 'Jaya Agrofarm Nusantara',
        sector: 'Tanaman Pangan & Hortikultura',
        plan: 'Premium Member'
    }
};
window.TENANTS = TENANTS;

// Setiap akun pembeli mendapatkan workspace/tenant unik.
// Dua email berbeda tidak pernah berbagi tenant_id.
function tenantIdForEmail(email) {
    const clean = String(email || '').trim().toLowerCase();
    const slug = clean
        .replace(/@/g, '-')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
    return `tenant-user-${slug || 'unknown'}`;
}
window.tenantIdForEmail = tenantIdForEmail;

class WhitelistAuthService {
    constructor() {
        this.currentUser = null;
        this.currentSession = null;
        this.whitelistCache = [];
        this.realtimeChannel = null;
    }

    getService() {
        return window.databaseService || null;
    }

    getSupabase() {
        return (window.databaseService && window.databaseService.supabase) || window.supabaseClient || null;
    }

    // ----------------------------------------------------
    // PEMERIKSAAN SESI SAAT APLIKASI DIBUKA (checkSession)
    // SELALU MEMUAT PROFIL TERBARU LANGSUNG DARI SUPABASE
    // ----------------------------------------------------
    async checkSession() {
        const s = this.getService();
        if (!s) return null;

        try {
            const supabase = this.getSupabase();
            let authUser = null;

            // Prioritaskan supabase.auth.getUser() untuk validasi sesi aktif di server
            if (supabase?.auth?.getUser) {
                try {
                    const { data: userData, error: userError } = await supabase.auth.getUser();
                    if (!userError && userData?.user) {
                        authUser = userData.user;
                    }
                } catch (userErr) {
                    console.warn('[checkSession getUser]', userErr?.message || userErr);
                }
            }

            // Fallback ke getSession jika getUser belum mengembalikan user
            let session = null;
            if (s.authGetSession) {
                session = await s.authGetSession();
            }
            if (!authUser && session?.user) {
                authUser = session.user;
            }

            if (authUser) {
                this.currentSession = session || { user: authUser };
                const email = String(authUser.email || '').trim().toLowerCase();

                // Muat profil terbaru langsung dari Supabase database
                const appUser = await this.verifyUserWithDatabase(email, authUser.id);
                this.currentUser = appUser;

                // Sinkronkan record app_users (tanpa menimpa nama terbaru)
                const profileSync = await this.syncAppUserRecord();
                if (!profileSync.success) {
                    console.warn('[Supabase Auth] Profil app_users belum tersinkron:', profileSync.message);
                }

                // Pasang Realtime Listener untuk mendeteksi perubahan profil dari perangkat lain
                this.setupRealtimeProfileListener(authUser.id, email);

                if (window.db) {
                    window.db.setTenant(appUser.tenantId);
                }
                return appUser;
            }
        } catch (err) {
            console.error('[Supabase Auth] Gagal memuat sesi aktif:', err);
        }

        return null;
    }

    // ----------------------------------------------------
    // VERIFIKASI PENGGUNA TERHADAP SUPABASE
    // SUMBER KEBENARAN UTAMA PROFIL: public.app_users & auth.users
    // ----------------------------------------------------
    async verifyUserWithDatabase(email, authUserId = null) {
        const s = this.getService();
        const supabase = this.getSupabase();
        const cleanEmail = String(email || '').trim().toLowerCase();
        const isMaster = isSuperAdminEmail(cleanEmail);

        let tenantId = null;
        let role = isMaster ? 'OWNER_ADMIN' : 'BUYER';
        let userName = null;
        let farmName = null;

        // Pastikan authUserId tersedia dari Supabase Auth
        let resolvedUserId = authUserId;
        let metaName = null;

        if (supabase?.auth) {
            try {
                const { data: authData } = await supabase.auth.getUser();
                if (authData?.user) {
                    if (!resolvedUserId) resolvedUserId = authData.user.id;
                    if (authData.user.user_metadata) {
                        metaName = authData.user.user_metadata.full_name || 
                                   authData.user.user_metadata.name || 
                                   authData.user.user_metadata.displayName || null;
                    }
                }
            } catch (authErr) {
                console.warn('[verifyUserWithDatabase auth check]', authErr?.message || authErr);
            }
        }

        // 1. Cek dari service getWhitelist untuk hak akses dan mapping tenant
        let wlList = [];
        try {
            if (s && s.getWhitelist) {
                wlList = await s.getWhitelist(null);
            }
        } catch (e) {
            console.warn('[verifyUserWithDatabase getWhitelist]', e);
        }

        const matched = wlList.find(w => w.email && w.email.toLowerCase() === cleanEmail && w.status !== 'inactive');
        if (matched) {
            if (matched.tenant_id) tenantId = matched.tenant_id;
        } else if (!isMaster) {
            const isSeed = ['petani.sukses@gmail.com', 'bambang@agrofarm.id', 'agrobisnis.subang@gmail.com', 'kandiandika23@gmail.com', 'kandiapj23@gmail.com'].includes(cleanEmail);
            if (!isSeed) {
                const allowed = s && s.authCheckAccess ? await s.authCheckAccess(cleanEmail) : false;
                if (!allowed) {
                    throw new Error('Email Anda belum terdaftar dalam Whitelist atau aksesnya tidak aktif.');
                }
            }
        }

        // 2. QUERY PROFIL TERBARU LANGSUNG DARI SUPABASE (public.app_users)
        // Gunakan limit(1) dan urutkan updated_at desc untuk menghindari error jika ada histori multiple-row
        let userRow = null;
        if (supabase && !s?.isDummyKey) {
            // A. Cari berdasarkan Auth User ID (Prioritas Tertinggi)
            if (resolvedUserId) {
                try {
                    const { data: rowsById, error: errById } = await supabase
                        .from('app_users')
                        .select('*')
                        .eq('id', resolvedUserId)
                        .order('updated_at', { ascending: false })
                        .limit(1);

                    if (!errById && Array.isArray(rowsById) && rowsById.length > 0) {
                        userRow = rowsById[0];
                    }
                } catch (idErr) {
                    console.warn('[verifyUserWithDatabase app_users by id]', idErr?.message || idErr);
                }
            }

            // B. Jika belum ditemukan berdasarkan id, cari berdasarkan Email
            if (!userRow) {
                try {
                    const { data: rowsByEmail, error: errByEmail } = await supabase
                        .from('app_users')
                        .select('*')
                        .eq('email', cleanEmail)
                        .order('updated_at', { ascending: false })
                        .limit(1);

                    if (!errByEmail && Array.isArray(rowsByEmail) && rowsByEmail.length > 0) {
                        userRow = rowsByEmail[0];
                    }
                } catch (emailErr) {
                    console.warn('[verifyUserWithDatabase app_users by email]', emailErr?.message || emailErr);
                }
            }

            // C. Cek tabel profiles sebagai kompatibilitas jika skema alternatif digunakan
            if (!userRow && resolvedUserId) {
                try {
                    const { data: profileRow } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', resolvedUserId)
                        .order('updated_at', { ascending: false })
                        .limit(1);

                    if (Array.isArray(profileRow) && profileRow.length > 0) {
                        userRow = profileRow[0];
                    }
                } catch (_) {}
            }

            if (userRow) {
                if (userRow.tenant_id) tenantId = userRow.tenant_id;
                if (userRow.role) role = userRow.role;
                if (userRow.name && String(userRow.name).trim()) {
                    userName = String(userRow.name).trim();
                }
                if (userRow.farm_name && String(userRow.farm_name).trim()) {
                    farmName = String(userRow.farm_name).trim();
                }
            }

            try {
                const { data: tu } = await supabase
                    .from('tenant_users')
                    .select('*')
                    .eq('email', cleanEmail)
                    .maybeSingle();
                if (tu?.tenant_id) tenantId = tu.tenant_id;
            } catch (tenantErr) {
                console.warn('[verifyUserWithDatabase tenant_users]', tenantErr?.message || tenantErr);
            }
        }

        // 3. RESOLUSI NAMA PENGGUNA TERPUSAT DARI SUPABASE
        // Hierarki:
        // 1) Nama dari tabel app_users di Supabase (Profil yang disimpan pengguna)
        // 2) Nama dari metadata akun Supabase Auth (user_metadata)
        // 3) Nama dari tabel whitelist di Supabase
        // 4) Default inisial (SUPER_ADMIN_PROFILES atau nama sebelum @)
        // PENTING: Jangan menimpa userName jika sudah didapat dari database!
        if (!userName) {
            if (metaName && String(metaName).trim()) {
                userName = String(metaName).trim();
            } else if (matched && matched.name && String(matched.name).trim()) {
                userName = String(matched.name).trim();
            } else if (SUPER_ADMIN_PROFILES[cleanEmail]?.name) {
                userName = SUPER_ADMIN_PROFILES[cleanEmail].name;
            } else {
                userName = cleanEmail.split('@')[0];
            }
        }

        // Resolusi Tenant ID unik per akun
        if (!tenantId) {
            tenantId = tenantIdForEmail(cleanEmail);
        }

        // Resolusi Nama Farm / Kebun
        if (!farmName) {
            if (isSuperAdminEmail(cleanEmail)) {
                farmName = 'Jaya Agrofarm Nusantara';
            } else if (cleanEmail.includes('lembang') || cleanEmail.includes('petani.sukses')) {
                farmName = 'Kebun Dataran Tinggi Lembang';
            } else if (cleanEmail.includes('subang') || cleanEmail.includes('agrobisnis')) {
                farmName = 'Sentra Tani Makmur Subang';
            } else if (cleanEmail.includes('bambang')) {
                farmName = 'Agro Nusantara Sentra';
            } else {
                farmName = `Kebun ${userName || 'Jaya Agrofarm'}`;
            }
        }

        const userObj = {
            id: resolvedUserId || (userRow && userRow.id) || ('usr-' + Date.now()),
            email: cleanEmail,
            name: userName,
            farm_name: farmName,
            role: isMaster ? 'OWNER_ADMIN' : role,
            tenantId: tenantId,
            loginAt: new Date().toISOString()
        };

        // Simpan ke cache scoped per userId (bukan sumber utama, hanya cache bantu)
        if (typeof window !== 'undefined' && window.localStorage && userObj.id) {
            try {
                window.localStorage.setItem(`userProfile_${userObj.id}`, JSON.stringify(userObj));
            } catch (_) {}
        }

        return userObj;
    }

    // ----------------------------------------------------
    // SINKRONISASI PROFIL AUTH -> public.app_users
    // ----------------------------------------------------
    async syncAppUserRecord() {
        if (!this.currentUser || !this.currentSession?.user) {
            return { success: false, message: 'Sesi pengguna belum tersedia.' };
        }

        const supabase = this.getSupabase();
        if (!supabase) {
            return { success: false, message: 'Koneksi Supabase belum tersedia.' };
        }

        const authUser = this.currentSession.user;
        const email = String(this.currentUser.email || authUser.email || '').trim().toLowerCase();
        const tenantId = this.currentUser.tenantId;

        if (!email || !tenantId) {
            return { success: false, message: 'Identitas akun atau tenant belum lengkap.' };
        }

        const payload = {
            id: authUser.id,
            email,
            name: String(this.currentUser.name || email.split('@')[0]).trim(),
            role: this.currentUser.role === 'OWNER_ADMIN' ? 'OWNER_ADMIN' : 'farmer',
            tenant_id: tenantId,
            farm_name: String(this.currentUser.farm_name || '').trim() || null,
            updated_at: new Date().toISOString()
        };

        try {
            // Cek apakah ada record di app_users berdasarkan id atau email
            const { data: rows, error: selectError } = await supabase
                .from('app_users')
                .select('*')
                .or(`id.eq.${authUser.id},email.eq.${email}`)
                .order('updated_at', { ascending: false })
                .limit(1);

            if (selectError) throw selectError;

            if (rows && rows.length > 0) {
                const existing = rows[0];
                // PENTING: Selalu adopsi nama terbaru dari database Supabase
                if (existing.name && String(existing.name).trim()) {
                    this.currentUser.name = String(existing.name).trim();
                }
                if (existing.farm_name && String(existing.farm_name).trim()) {
                    this.currentUser.farm_name = String(existing.farm_name).trim();
                }
                // Pastikan id di tabel app_users terhubung ke authUser.id
                if (!existing.id || existing.id !== authUser.id) {
                    await supabase
                        .from('app_users')
                        .update({ id: authUser.id, updated_at: new Date().toISOString() })
                        .eq('email', email);
                }
                return { success: true, existing: true, message: 'Profil app_users terhubung dan tersinkronisasi.' };
            } else {
                const { error: insertError } = await supabase
                    .from('app_users')
                    .insert(payload);

                if (insertError) throw insertError;
            }

            return { success: true };
        } catch (err) {
            console.error('[syncAppUserRecord]', err);
            return {
                success: false,
                message: err?.message || 'Gagal menyinkronkan profil akun ke Supabase.'
            };
        }
    }

    // ----------------------------------------------------
    // REALTIME LISTENER UNTUK SINKRONISASI LINTAS PERANGKAT
    // ----------------------------------------------------
    setupRealtimeProfileListener(userId, email) {
        const supabase = this.getSupabase();
        if (!supabase || !userId) return;

        if (this.realtimeChannel) {
            try {
                supabase.removeChannel(this.realtimeChannel);
            } catch (_) {}
            this.realtimeChannel = null;
        }

        try {
            const cleanEmail = String(email || (this.currentUser && this.currentUser.email) || '').trim().toLowerCase();
            this.realtimeChannel = supabase
                .channel(`profile-sync-${userId}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'app_users'
                    },
                    (payload) => {
                        const updated = payload.new;
                        if (!updated || !this.currentUser) return;

                        // Periksa apakah update ini milik akun yang sedang aktif
                        const isMatch = (updated.id && updated.id === userId) ||
                                        (updated.email && updated.email.toLowerCase() === cleanEmail);

                        if (isMatch && updated.name) {
                            const newName = String(updated.name).trim();
                            if (newName && newName !== this.currentUser.name) {
                                console.log('[Supabase Realtime] Nama profil disinkronkan dari perangkat lain:', newName);
                                this.currentUser.name = newName;
                                if (updated.farm_name) {
                                    this.currentUser.farm_name = String(updated.farm_name).trim();
                                }

                                // Update cache scoped
                                try {
                                    window.localStorage.setItem(`userProfile_${userId}`, JSON.stringify(this.currentUser));
                                } catch (_) {}

                                // Update seluruh UI aplikasi
                                if (typeof updateHeaderAndSidebarAuthUI === 'function') {
                                    updateHeaderAndSidebarAuthUI();
                                }
                                window.dispatchEvent(new CustomEvent('user-profile-updated', {
                                    detail: { user: this.currentUser, name: newName }
                                }));
                            }
                        }
                    }
                )
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        console.log(`[Supabase Realtime] Mendengarkan pembaruan profil untuk user ${userId}`);
                    }
                });
        } catch (err) {
            console.warn('[setupRealtimeProfileListener]', err);
        }
    }

    // ----------------------------------------------------
    // REFRESH PROFIL DARI SUPABASE (misal saat window focus)
    // ----------------------------------------------------
    async refreshUserProfile() {
        const supabase = this.getSupabase();
        if (!supabase || !this.currentUser) return null;

        try {
            let authUser = null;
            if (supabase?.auth?.getUser) {
                const { data: authData, error: authErr } = await supabase.auth.getUser();
                if (!authErr && authData?.user) {
                    authUser = authData.user;
                }
            }

            const email = String(authUser?.email || this.currentUser.email || '').trim().toLowerCase();
            const userId = authUser?.id || this.currentUser.id;

            if (!email) return null;

            const freshUser = await this.verifyUserWithDatabase(email, userId);
            if (freshUser) {
                const nameChanged = freshUser.name !== this.currentUser.name;
                const farmChanged = freshUser.farm_name !== this.currentUser.farm_name;

                this.currentUser = freshUser;

                if (nameChanged || farmChanged) {
                    if (typeof updateHeaderAndSidebarAuthUI === 'function') {
                        updateHeaderAndSidebarAuthUI();
                    }
                    window.dispatchEvent(new CustomEvent('user-profile-updated', {
                        detail: { user: freshUser, name: freshUser.name }
                    }));
                }
                return freshUser;
            }
        } catch (e) {
            console.warn('[refreshUserProfile]', e);
        }
        return null;
    }

    // ----------------------------------------------------
    // PENDAFTARAN & LOGIN PENGGUNA
    // ----------------------------------------------------
    async registerApprovedUser(email, password, name = '') {
        if (!email || !password) {
            return { success: false, message: 'Email dan password wajib diisi.' };
        }
        if (password.length < 8) {
            return { success: false, message: 'Password minimal 8 karakter.' };
        }
        const cleanEmail = email.trim().toLowerCase();
        const s = this.getService();
        if (!s || !s.authSignUp) {
            return { success: false, message: 'Layanan autentikasi belum siap.' };
        }
        try {
            const allowed = await s.authCheckAccess(cleanEmail);
            if (!allowed) {
                return { success: false, message: 'Email belum disetujui admin atau pembayaran belum aktif. Hubungi administrator.' };
            }
            const data = await s.authSignUp(cleanEmail, password, { full_name: name || cleanEmail.split('@')[0] });
            if (data?.session && data?.user) {
                this.currentSession = data.session;
                this.currentUser = await this.verifyUserWithDatabase(cleanEmail, data.user.id);

                // Pastikan identitas Auth tersimpan di public.app_users
                const profileSync = await this.syncAppUserRecord();
                if (!profileSync.success) {
                    console.warn('[Sync user tables notice]:', profileSync.message);
                }

                this.setupRealtimeProfileListener(data.user.id, cleanEmail);

                if (window.db) {
                    window.db.setTenant(this.currentUser.tenantId);
                    await window.db.loadAllData(this.currentUser.tenantId);
                }
                return { success: true, user: this.currentUser, confirmed: true };
            }
            return { success: true, confirmed: false, message: 'Akun berhasil dibuat. Jika konfirmasi email aktif di Supabase, silakan konfirmasi email lalu login.' };
        } catch (err) {
            console.error('[Supabase Register Error]:', err);
            return { success: false, message: err?.message || 'Gagal membuat akun.' };
        }
    }

    async login(email, password) {
        if (!email || !password) {
            return { success: false, message: 'Alamat email dan kata sandi wajib diisi.' };
        }

        const cleanEmail = email.trim().toLowerCase();
        const s = this.getService();
        if (!s) {
            return { success: false, message: 'Layanan autentikasi belum siap.' };
        }

        try {
            const allowed = s.authCheckAccess ? await s.authCheckAccess(cleanEmail) : false;
            if (!allowed && !isSuperAdminEmail(cleanEmail)) {
                return { success: false, message: 'Akses ditolak. Email Anda belum disetujui admin atau pembayaran belum aktif.' };
            }

            const authData = await s.authSignIn(cleanEmail, password);
            this.currentSession = authData.session;

            // Muat profil terbaru dari database Supabase (bukan dari cache lama)
            const appUser = await this.verifyUserWithDatabase(cleanEmail, authData.user.id);
            this.currentUser = appUser;

            const profileSync = await this.syncAppUserRecord();
            if (!profileSync.success) {
                console.warn('[Supabase Auth] Profil app_users belum tersinkron:', profileSync.message);
            }

            // Aktifkan realtime profile listener
            this.setupRealtimeProfileListener(authData.user.id, cleanEmail);

            if (window.db) {
                window.db.setTenant(appUser.tenantId);
                await window.db.loadAllData(appUser.tenantId);
            }

            return { success: true, user: appUser };
        } catch (err) {
            console.error('[Supabase Login Error]:', err);
            return {
                success: false,
                message: err?.message || 'Gagal masuk. Periksa email, password, dan akun Supabase Auth Anda.'
            };
        }
    }

    // Login khusus Administrator
    async loginAdmin(email, password) {
        if (!email || !password) {
            return { success: false, message: 'Masukkan email dan password Administrator.' };
        }

        const cleanEmail = email.trim().toLowerCase();
        if (!isSuperAdminEmail(cleanEmail)) {
            return { success: false, message: 'Akun administrator tidak dikenali. Gunakan salah satu akun Super Admin yang terdaftar.' };
        }

        const result = await this.login(cleanEmail, password);
        if (!result.success) return result;
        if (!this.isAdmin()) {
            await this.logout();
            return { success: false, message: 'Akun Supabase ini tidak memiliki role administrator.' };
        }
        return result;
    }

    // ----------------------------------------------------
    // LOGOUT (SUPABASE AUTH signOut)
    // ----------------------------------------------------
    async logout() {
        if (this.realtimeChannel) {
            const supabase = this.getSupabase();
            if (supabase) {
                try {
                    supabase.removeChannel(this.realtimeChannel);
                } catch (_) {}
            }
            this.realtimeChannel = null;
        }

        const s = this.getService();
        if (s && s.authSignOut) {
            try {
                await s.authSignOut();
            } catch (err) {
                console.error('[Supabase Auth SignOut Error]:', err);
            }
        }
        this.currentUser = null;
        this.currentSession = null;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    isAuthenticated() {
        return !!this.currentUser;
    }

    isAdmin() {
        if (!this.currentUser) return false;
        return this.currentUser.role === 'OWNER_ADMIN' || isSuperAdminEmail(this.currentUser.email);
    }

    getCurrentTenantId() {
        return (this.currentUser && this.currentUser.tenantId) || null;
    }

    getCurrentTenant() {
        const tenantId = this.getCurrentTenantId();
        if (TENANTS[tenantId]) return TENANTS[tenantId];

        const user = this.currentUser || {};
        return {
            id: tenantId,
            slug: tenantId,
            code: 'USER-WORKSPACE',
            name: user.farm_name || (user.name ? `Workspace ${user.name}` : 'Workspace Pribadi'),
            sector: 'Manajemen Pertanian',
            plan: 'Premium Member'
        };
    }

    // ----------------------------------------------------
    // UPDATE NAMA PENGGUNA TERPUSAT KE SUPABASE
    // Disimpan ke app_users, whitelist, & auth.users metadata
    // ----------------------------------------------------
    async updateUserName(newUserName) {
        if (!this.currentUser) return { success: false, message: 'User belum login' };
        const cleanName = String(newUserName || '').trim().replace(/\s+/g, ' ');
        if (!cleanName) return { success: false, message: 'Nama pengguna tidak boleh kosong' };
        if (cleanName.length < 2) return { success: false, message: 'Nama pengguna minimal 2 karakter' };
        if (cleanName.length > 80) return { success: false, message: 'Nama pengguna maksimal 80 karakter' };

        const supabase = this.getSupabase();
        if (!supabase) {
            return { success: false, message: 'Koneksi Supabase belum tersedia.' };
        }

        // Ambil User ID Supabase Auth terkini
        let authUser = null;
        try {
            const { data: authData, error: authError } = await supabase.auth.getUser();
            if (!authError && authData?.user) {
                authUser = authData.user;
            }
        } catch (e) {
            console.warn('[updateUserName getUser]', e);
        }

        const userId = authUser?.id || this.currentUser.id;
        const email = String(this.currentUser.email || authUser?.email || '').trim().toLowerCase();
        const tenantId = this.currentUser.tenantId || tenantIdForEmail(email);
        const nowIso = new Date().toISOString();

        let saveSuccess = false;
        let lastError = null;

        // 1. Simpan ke tabel public.app_users di Supabase
        try {
            const { data: existingRows } = await supabase
                .from('app_users')
                .select('id, email')
                .or(`id.eq.${userId},email.eq.${email}`)
                .order('updated_at', { ascending: false })
                .limit(1);

            const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;

            if (existing) {
                const { error: updateErr } = await supabase
                    .from('app_users')
                    .update({
                        name: cleanName,
                        updated_at: nowIso
                    })
                    .or(`id.eq.${userId},email.eq.${email}`);

                if (updateErr) throw updateErr;
            } else {
                const { error: insertErr } = await supabase
                    .from('app_users')
                    .insert({
                        id: userId,
                        email: email,
                        name: cleanName,
                        role: this.currentUser.role === 'OWNER_ADMIN' ? 'OWNER_ADMIN' : 'farmer',
                        tenant_id: tenantId,
                        farm_name: this.currentUser.farm_name || null,
                        updated_at: nowIso
                    });

                if (insertErr) throw insertErr;
            }
            saveSuccess = true;
        } catch (err) {
            console.error('[updateUserName Supabase app_users]', err);
            lastError = err;
        }

        // 2. Sinkronkan ke tabel whitelist jika baris untuk email ini ada
        try {
            await supabase
                .from('whitelist')
                .update({ name: cleanName })
                .eq('email', email);
        } catch (wlErr) {
            console.warn('[updateUserName whitelist sync]', wlErr?.message || wlErr);
        }

        // 3. Sinkronkan ke Supabase Auth user_metadata
        try {
            if (supabase?.auth?.updateUser) {
                await supabase.auth.updateUser({
                    data: {
                        full_name: cleanName,
                        name: cleanName,
                        displayName: cleanName
                    }
                });
            }
        } catch (metaErr) {
            console.warn('[updateUserName Supabase Auth metadata]', metaErr);
        }

        // 4. Update tabel profiles jika ada skema alternatif
        try {
            await supabase
                .from('profiles')
                .update({ name: cleanName, updated_at: nowIso })
                .eq('id', userId);
        } catch (_) {}

        if (!saveSuccess && lastError) {
            return { success: false, message: lastError?.message || 'Nama gagal disimpan ke Supabase.' };
        }

        // 5. Update state aplikasi in-memory
        this.currentUser.name = cleanName;

        // 6. Update cache scoped per userId
        if (typeof window !== 'undefined' && window.localStorage && userId) {
            try {
                window.localStorage.setItem(`userProfile_${userId}`, JSON.stringify(this.currentUser));
            } catch (_) {}
        }

        // 7. Update UI aplikasi
        if (typeof updateHeaderAndSidebarAuthUI === 'function') {
            updateHeaderAndSidebarAuthUI();
        }

        // 8. Kirim broadcast event ke window
        window.dispatchEvent(new CustomEvent('user-profile-updated', {
            detail: { user: this.currentUser, name: cleanName }
        }));

        return { success: true, name: cleanName };
    }

    // ----------------------------------------------------
    // UPDATE NAMA FARM TERPUSAT KE SUPABASE
    // ----------------------------------------------------
    async updateFarmName(newFarmName) {
        if (!this.currentUser) return { success: false, message: 'User belum login' };
        const cleanName = String(newFarmName || '').trim();
        if (!cleanName) return { success: false, message: 'Nama farm tidak boleh kosong' };

        const tenantId = this.currentUser.tenantId;
        const email = String(this.currentUser.email || '').trim().toLowerCase();
        const supabase = this.getSupabase();

        if (!supabase || !email || !tenantId) {
            return { success: false, message: 'Koneksi Supabase atau identitas akun belum tersedia.' };
        }

        let authUser = null;
        try {
            const { data: authData } = await supabase.auth.getUser();
            if (authData?.user) authUser = authData.user;
        } catch (_) {}

        const userId = authUser?.id || this.currentUser.id;
        const nowIso = new Date().toISOString();

        try {
            const { data: existingRows } = await supabase
                .from('app_users')
                .select('id, email')
                .or(`id.eq.${userId},email.eq.${email}`)
                .order('updated_at', { ascending: false })
                .limit(1);

            const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;

            let dbError = null;
            if (existing) {
                const result = await supabase
                    .from('app_users')
                    .update({ farm_name: cleanName, updated_at: nowIso })
                    .or(`id.eq.${userId},email.eq.${email}`);
                dbError = result.error;
            } else {
                const result = await supabase
                    .from('app_users')
                    .insert({
                        id: userId,
                        email,
                        name: this.currentUser.name || email.split('@')[0],
                        role: this.currentUser.role === 'OWNER_ADMIN' ? 'OWNER_ADMIN' : 'farmer',
                        tenant_id: tenantId,
                        farm_name: cleanName,
                        updated_at: nowIso
                    });
                dbError = result.error;
            }

            if (dbError) throw dbError;
        } catch (err) {
            console.error('[updateFarmName Supabase app_users]', err);
            return { success: false, message: err?.message || 'Nama farm gagal disimpan ke Supabase.' };
        }

        this.currentUser.farm_name = cleanName;

        if (typeof window !== 'undefined' && window.localStorage && userId) {
            try {
                window.localStorage.setItem(`userProfile_${userId}`, JSON.stringify(this.currentUser));
            } catch (_) {}
        }

        if (typeof updateHeaderAndSidebarAuthUI === 'function') {
            updateHeaderAndSidebarAuthUI();
        }

        window.dispatchEvent(new CustomEvent('user-profile-updated', {
            detail: { user: this.currentUser, farm_name: cleanName }
        }));

        return { success: true, farm_name: cleanName };
    }

    getAuthToken() {
        if (this.currentSession?.access_token) return this.currentSession.access_token;
        if (this.currentUser?.token) return this.currentUser.token;
        return this.currentUser ? `sb-token-${this.currentUser.id}` : '';
    }

    resolveTenantIdForEmail(email) {
        return tenantIdForEmail(email);
    }

    // ----------------------------------------------------
    // WHITELIST MANAGEMENT (SUPABASE POSTGRESQL)
    // ----------------------------------------------------
    async loadWhitelist() {
        const s = this.getService();
        if (!s) return [];
        try {
            const list = await s.getWhitelist(null);
            this.whitelistCache = list || [];
        } catch (e) {
            console.warn('[loadWhitelist notice]', e);
        }
        return this.whitelistCache || [];
    }

    getWhitelist() {
        return this.whitelistCache || [];
    }

    async addToWhitelist(email, name, notes, tenantId = null) {
        const s = this.getService();
        if (!s) {
            return { success: false, message: 'Layanan database belum siap.' };
        }

        const cleanEmail = email.trim().toLowerCase();
        const payload = {
            tenant_id: tenantId || tenantIdForEmail(cleanEmail),
            email: cleanEmail,
            name: name || cleanEmail.split('@')[0],
            notes: notes || 'Premium Member',
            status: 'active'
        };

        try {
            const result = await s.addToWhitelist(payload);
            await this.loadWhitelist();
            return {
                success: true,
                item: result,
                message: `Email ${cleanEmail} berhasil disetujui & ditambahkan ke Whitelist!`
            };
        } catch (err) {
            return {
                success: false,
                message: err.message || 'Gagal menambahkan ke whitelist.'
            };
        }
    }

    async removeFromWhitelist(idOrEmail) {
        const s = this.getService();
        if (!s) {
            return { success: false, message: 'Layanan database belum siap.' };
        }

        try {
            await s.removeFromWhitelist(idOrEmail);
            await this.loadWhitelist();
            return {
                success: true,
                message: 'Izin akses berhasil dicabut.'
            };
        } catch (err) {
            return {
                success: false,
                message: err.message || 'Gagal mencabut akses.'
            };
        }
    }
}

// Inisialisasi Singleton Auth Service
window.auth = new WhitelistAuthService();

// Listener window focus & tab visibility change untuk memastikan perangkat selalu menyinkronkan profil terbaru
if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && window.auth && window.auth.isAuthenticated()) {
            window.auth.refreshUserProfile();
        }
    });
}
if (typeof window !== 'undefined') {
    window.addEventListener('focus', () => {
        if (window.auth && window.auth.isAuthenticated()) {
            window.auth.refreshUserProfile();
        }
    });
}
