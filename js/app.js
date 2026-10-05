/**
 * Logika Utama Aplikasi Manajemen Pertanian (Jaya Agrofarm Nusantara)
 * Mengelola interaksi UI, rendering komponen, modal, charting, dan integrasi data.
 */

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

let currentActiveTab = 'dashboard';
let financialChartInstance = null;
let commodityChartInstance = null;

async function initApp() {
    setupNavigation();
    setupModals();

    const user = window.auth ? await window.auth.checkSession() : null;
    if (user && window.auth.isAuthenticated()) {
        // Semua pengguna, termasuk Super Admin, masuk langsung ke Dashboard saat aplikasi dibuka.
        // Halaman Admin Whitelist tetap dapat dibuka secara manual melalui menu Admin.
        await showAppScreen();
        switchTab('dashboard');
    } else {
        showAuthScreen();
    }
}

function showAuthScreen() {
    const authScreen = document.getElementById('auth-screen');
    const appLayout = document.getElementById('app-layout');
    const adminScreen = document.getElementById('admin-screen');
    if (authScreen) authScreen.classList.remove('hidden');
    if (appLayout) appLayout.classList.add('hidden');
    if (adminScreen) adminScreen.classList.add('hidden');

    // Kosongkan input admin agar kredensial tidak terekspos
    const adminEmail = document.getElementById('admin-login-email');
    const adminPass = document.getElementById('admin-login-password');
    if (adminEmail) adminEmail.value = '';
    if (adminPass) adminPass.value = '';

    switchLoginView('buyer');
    setTimeout(() => lucide.createIcons(), 50);
}

async function showAppScreen() {
    if (!window.auth || !window.auth.isAuthenticated()) {
        showAuthScreen();
        return;
    }
    const authScreen = document.getElementById('auth-screen');
    const appLayout = document.getElementById('app-layout');
    const adminScreen = document.getElementById('admin-screen');
    if (authScreen) authScreen.classList.add('hidden');
    if (adminScreen) adminScreen.classList.add('hidden');
    if (appLayout) appLayout.classList.remove('hidden');

    if (window.db) {
        const tenantId = window.auth.getCurrentTenantId();
        window.db.setTenant(tenantId);
        try {
            await window.db.loadAllData(tenantId);
        } catch (e) {
            console.error('Gagal memuat data dari Supabase:', e);
            showToast('Gagal memuat data dari database Supabase: ' + (e.message || ''), 'error');
        }
    }

    updateHeaderAndSidebarAuthUI();
    applyRolePermissions();
    renderAllViews();
    fetchLiveWeather();
    populateAiInputs();
    runCoreAiEngine();
    setTimeout(() => {
        lucide.createIcons();
        if (typeof checkUrlRoute === 'function') checkUrlRoute();
    }, 100);
}

// ----------------------------------------------------
// UI Switcher: Login Pembeli (Whitelist) vs Login Admin
// ----------------------------------------------------
function switchLoginView(mode) {
    const tabBuyer = document.getElementById('tab-btn-buyer');
    const tabAdmin = document.getElementById('tab-btn-admin');
    const viewBuyer = document.getElementById('login-view-buyer');
    const viewAdmin = document.getElementById('login-view-admin');
    const buyerError = document.getElementById('buyer-login-error');
    const adminError = document.getElementById('admin-login-error');

    if (buyerError) buyerError.classList.add('hidden');
    if (adminError) adminError.classList.add('hidden');

    if (mode === 'admin') {
        if (tabBuyer) {
            tabBuyer.classList.remove('text-emerald-400', 'border-emerald-400');
            tabBuyer.classList.add('text-slate-400', 'border-transparent');
        }
        if (tabAdmin) {
            tabAdmin.classList.add('text-amber-400', 'border-amber-400');
            tabAdmin.classList.remove('text-slate-400', 'border-transparent');
        }
        if (viewBuyer) viewBuyer.classList.add('hidden');
        if (viewAdmin) viewAdmin.classList.remove('hidden');
    } else {
        if (tabAdmin) {
            tabAdmin.classList.remove('text-amber-400', 'border-amber-400');
            tabAdmin.classList.add('text-slate-400', 'border-transparent');
        }
        if (tabBuyer) {
            tabBuyer.classList.add('text-emerald-400', 'border-emerald-400');
            tabBuyer.classList.remove('text-slate-400', 'border-transparent');
        }
        if (viewBuyer) viewBuyer.classList.remove('hidden');
        if (viewAdmin) viewAdmin.classList.add('hidden');
    }
    setTimeout(() => lucide.createIcons(), 50);
}

function fillBuyerEmail(email, password = 'password123') {
    const input = document.getElementById('buyer-email-input');
    const passInput = document.getElementById('buyer-password-input');
    const errorBox = document.getElementById('buyer-login-error');
    if (input) {
        input.value = email;
        input.focus();
    }
    if (passInput) {
        passInput.value = password;
    }
    if (errorBox) errorBox.classList.add('hidden');
}
window.fillBuyerEmail = fillBuyerEmail;

// ----------------------------------------------------
// Handler Login Pembeli & Registrasi (Supabase & Whitelist)
// ----------------------------------------------------
// Handler Login Pengguna (Supabase Auth signInWithPassword)
// ----------------------------------------------------
async function handleBuyerLogin(e) {
    e.preventDefault();
    const errorBox = document.getElementById('buyer-login-error');
    const errorMsg = document.getElementById('buyer-login-error-msg');
    const emailInput = document.getElementById('buyer-email-input');
    const passInput = document.getElementById('buyer-password-input');
    const submitBtn = document.getElementById('btn-submit-buyer');

    if (!emailInput) return;

    const email = emailInput.value.trim();
    const password = passInput ? passInput.value : '';

    if (!email || !password) {
        if (errorBox && errorMsg) {
            errorMsg.textContent = 'Silakan masukkan alamat email dan kata sandi Anda.';
            errorBox.classList.remove('hidden');
        } else {
            showToast('Email dan kata sandi wajib diisi.', 'error');
        }
        return;
    }

    if (errorBox) errorBox.classList.add('hidden');

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="animate-spin mr-2">⏳</span><span>Menghubungkan ke sistem...</span>`;
    }

    try {
        const res = await window.auth.login(email, password);
        if (!res.success) {
            if (errorBox && errorMsg) {
                errorMsg.textContent = res.message;
                errorBox.classList.remove('hidden');
            } else {
                showToast(res.message, 'error');
            }
            return;
        }

        showToast(`Akses Disetujui! Selamat datang di Jaya Agrofarm Nusantara.`);
        await showAppScreen();
    } catch (err) {
        console.error('Error saat login:', err);
        if (errorBox && errorMsg) {
            errorMsg.textContent = err.message || 'Gagal terhubung ke sistem.';
            errorBox.classList.remove('hidden');
        } else {
            showToast(err.message || 'Gagal masuk', 'error');
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>Masuk ke Aplikasi Pertanian</span><i data-lucide="arrow-right" class="w-4 h-4"></i>`;
            if (window.lucide) lucide.createIcons();
        }
    }
}
window.handleBuyerLogin = handleBuyerLogin;

// ----------------------------------------------------
// Handler Login Khusus Administrator
// ----------------------------------------------------
async function handleApprovedRegistration(e) {
    e.preventDefault();
    const email = document.getElementById('register-email-input')?.value || '';
    const name = document.getElementById('register-name-input')?.value || '';
    const password = document.getElementById('register-password-input')?.value || '';
    const confirm = document.getElementById('register-password-confirm')?.value || '';
    const errorBox = document.getElementById('register-error');
    const errorMsg = document.getElementById('register-error-msg');
    const successBox = document.getElementById('register-success');
    const successMsg = document.getElementById('register-success-msg');
    const showError = (msg) => { if (successBox) successBox.classList.add('hidden'); if (errorMsg) errorMsg.textContent = msg; if (errorBox) errorBox.classList.remove('hidden'); };
    if (password !== confirm) return showError('Konfirmasi password tidak sama.');
    if (password.length < 8) return showError('Password minimal 8 karakter.');
    if (!window.auth) return showError('Layanan autentikasi belum siap.');
    const result = await window.auth.registerApprovedUser(email, password, name);
    if (!result.success) return showError(result.message);
    if (result.confirmed) {
        if (successMsg) successMsg.textContent = 'Akun berhasil dibuat dan Anda sudah masuk ke sistem.';
        if (successBox) successBox.classList.remove('hidden');
        setTimeout(() => { if (typeof showAppScreen === 'function') showAppScreen(); }, 500);
    } else {
        if (successMsg) successMsg.textContent = result.message;
        if (successBox) successBox.classList.remove('hidden');
        document.getElementById('form-register-approved')?.reset();
    }
}
window.handleApprovedRegistration = handleApprovedRegistration;

async function handleAdminLogin(e) {
    e.preventDefault();
    const errorBox = document.getElementById('admin-login-error');
    const errorMsg = document.getElementById('admin-login-error-msg');
    const emailInput = document.getElementById('admin-login-email');
    const passInput = document.getElementById('admin-login-password');

    const email = emailInput ? emailInput.value.trim() : '';
    const password = passInput ? passInput.value : '';

    if (errorBox) errorBox.classList.add('hidden');

    const res = await window.auth.loginAdmin(email, password);
    if (!res.success) {
        if (errorBox && errorMsg) {
            errorMsg.textContent = res.message;
            errorBox.classList.remove('hidden');
        } else {
            showToast(res.message, 'error');
        }
        return;
    }

    showToast('Login Admin Berhasil! Membuka Dashboard...');
    await showAppScreen();
    switchTab('dashboard');
}

function toggleBuyerPasswordVisibility() {
    const passInput = document.getElementById('buyer-password-input');
    const icon = document.getElementById('buyer-toggle-pwd-icon');
    if (!passInput) return;

    const show = passInput.type === 'password';
    passInput.type = show ? 'text' : 'password';
    if (icon) icon.setAttribute('data-lucide', show ? 'eye-off' : 'eye');
    if (window.lucide) lucide.createIcons();
}

function toggleRegisterPasswordVisibility(inputId, iconId) {
    const passInput = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (!passInput) return;

    const show = passInput.type === 'password';
    passInput.type = show ? 'text' : 'password';
    if (icon) icon.setAttribute('data-lucide', show ? 'eye-off' : 'eye');
    if (window.lucide) lucide.createIcons();
}

function toggleAdminPasswordVisibility() {
    const passInput = document.getElementById('admin-login-password');
    const icon = document.getElementById('toggle-pwd-icon');
    if (!passInput) return;

    if (passInput.type === 'password') {
        passInput.type = 'text';
        if (icon) icon.setAttribute('data-lucide', 'eye-off');
    } else {
        passInput.type = 'password';
        if (icon) icon.setAttribute('data-lucide', 'eye');
    }
    if (window.lucide) {
        lucide.createIcons();
    }
}

// ----------------------------------------------------
// HALAMAN ADMIN (ADMIN DASHBOARD) - PENGELOLAAN WHITELIST
// ----------------------------------------------------
async function showAdminDashboard() {
    // ROUTE GUARD KEAMANAN: Halaman terkunci hanya untuk Super Admin
    if (!window.auth || !window.auth.isAdmin()) {
        showToast('Akses Ditolak! Halaman Admin ini terkunci dan hanya dapat diakses oleh Super Admin (pratamajayapreneur@gmail.com atau kandiapj23@gmail.com).', 'error');
        if (window.auth && window.auth.isAuthenticated()) {
            await showAppScreen();
        } else {
            showAuthScreen();
        }
        return;
    }

    const authScreen = document.getElementById('auth-screen');
    const appLayout = document.getElementById('app-layout');
    const adminScreen = document.getElementById('admin-screen');

    if (authScreen) authScreen.classList.add('hidden');
    if (appLayout) appLayout.classList.add('hidden');
    if (adminScreen) adminScreen.classList.remove('hidden');

    if (window.auth && window.auth.loadWhitelist) {
        await window.auth.loadWhitelist();
    }

    renderAdminWhitelistTable();
    setTimeout(() => lucide.createIcons(), 50);
}

function openAppFromAdmin() {
    if (!window.auth || !window.auth.isAuthenticated()) {
        showAuthScreen();
        return;
    }
    const adminScreen = document.getElementById('admin-screen');
    if (adminScreen) adminScreen.classList.add('hidden');
    showAppScreen();
}

function renderAdminWhitelistTable() {
    const list = (window.auth && window.auth.getWhitelist()) || [];
    const tbody = document.getElementById('admin-whitelist-tbody');
    const emptyState = document.getElementById('admin-whitelist-empty');
    const statTotal = document.getElementById('admin-stat-total');
    const searchInput = document.getElementById('admin-search-whitelist');

    // Update KPI Total Whitelist Pembeli
    if (statTotal) {
        statTotal.textContent = list.filter(item => ['active', 'approved', 'paid'].includes(String(item.status || '').toLowerCase())).length;
    }

    if (!tbody) return;

    const searchTerm = (searchInput ? searchInput.value : '').toLowerCase().trim();
    const filteredList = list.filter(item => {
        if (!searchTerm) return true;
        return (item.email && item.email.toLowerCase().includes(searchTerm)) ||
               (item.name && item.name.toLowerCase().includes(searchTerm)) ||
               (item.notes && item.notes.toLowerCase().includes(searchTerm));
    });

    if (filteredList.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    tbody.innerHTML = filteredList.map((item, idx) => {
        const isMaster = window.isSuperAdminEmail ? window.isSuperAdminEmail(item.email) : item.email.toLowerCase() === MASTER_ADMIN.email.toLowerCase();
        let formattedDate = '-';
        if (item.created_at) {
            try {
                formattedDate = new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
            } catch (e) {
                formattedDate = String(item.created_at).slice(0, 10);
            }
        } else if (item.addedAt) {
            formattedDate = item.addedAt;
        }

        return `
            <tr class="hover:bg-slate-800/40 transition">
                <td class="p-3.5 text-center text-slate-500 font-mono text-[11px]">${idx + 1}</td>
                <td class="p-3.5">
                    <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-xl ${isMaster ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'} flex items-center justify-center font-bold text-xs flex-shrink-0">
                            <i data-lucide="${isMaster ? 'shield-check' : 'mail'}" class="w-4 h-4"></i>
                        </div>
                        <div>
                            <div class="font-bold text-white text-xs">${escapeHtml(item.email)}</div>
                            ${isMaster ? '<span class="text-[10px] text-amber-400 font-semibold">Master Administrator</span>' : '<span class="text-[10px] text-emerald-400">Pembeli Terdaftar</span>'}
                        </div>
                    </div>
                </td>
                <td class="p-3.5">
                    <div class="font-semibold text-slate-200">${escapeHtml(item.name || '-')}</div>
                    <div class="text-[11px] text-slate-400 mt-0.5">${escapeHtml(item.notes || '-')}</div>
                </td>
                <td class="p-3.5 text-slate-400 text-[11px] font-mono">
                    ${formattedDate}
                </td>
                <td class="p-3.5 text-center">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${isMaster ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'}">
                        <span class="w-1.5 h-1.5 rounded-full ${isMaster ? 'bg-amber-400' : 'bg-emerald-400'} animate-pulse"></span>
                        ${isMaster ? 'Super Admin' : '● Premium Member'}
                    </span>
                </td>
                <td class="p-3.5 text-right">
                    ${isMaster ? `
                        <span class="text-[11px] text-slate-500 italic">Terkunci</span>
                    ` : `
                        <button type="button" onclick="handleAdminDeleteEmail('${item.id}', '${item.email}')" class="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 hover:border-rose-700 text-rose-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 ml-auto transition shadow-xs" title="Cabut Izin Akses">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            <span>Hapus</span>
                        </button>
                    `}
                </td>
            </tr>
        `;
    }).join('');

    setTimeout(() => lucide.createIcons(), 50);
}

async function handleAdminAddEmail(e) {
    e.preventDefault();
    const feedback = document.getElementById('admin-add-feedback');
    const emailInput = document.getElementById('admin-input-email');
    const nameInput = document.getElementById('admin-input-name');
    const notesInput = document.getElementById('admin-input-notes');
    const submitBtn = e.target ? e.target.querySelector('button[type="submit"]') : null;

    const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
    const name = nameInput ? nameInput.value.trim() : '';
    const notes = notesInput ? notesInput.value.trim() : '';

    if (!email) {
        if (feedback) {
            feedback.className = 'p-3 rounded-xl text-xs bg-rose-950/80 border border-rose-800 text-rose-300 flex items-center gap-2';
            feedback.innerHTML = `<i data-lucide="alert-circle" class="w-4 h-4 text-rose-400 flex-shrink-0"></i><span>Alamat email wajib diisi.</span>`;
            feedback.classList.remove('hidden');
            if (window.lucide) lucide.createIcons();
        }
        return;
    }

    if (feedback) feedback.classList.add('hidden');
    if (submitBtn) submitBtn.disabled = true;

    try {
        const res = await window.auth.addToWhitelist(email, name, notes);
        if (!res || !res.success) {
            const errMsg = res?.message || 'Gagal menambahkan email ke whitelist.';
            if (feedback) {
                feedback.className = 'p-3 rounded-xl text-xs bg-rose-950/80 border border-rose-800 text-rose-300 flex items-center gap-2';
                feedback.innerHTML = `<i data-lucide="alert-circle" class="w-4 h-4 text-rose-400 flex-shrink-0"></i><span>${errMsg}</span>`;
                feedback.classList.remove('hidden');
                if (window.lucide) lucide.createIcons();
            } else {
                showToast(errMsg, 'error');
            }
            return;
        }

        // Berhasil menambahkan
        const successMsg = res.message || `Email ${email} berhasil disetujui & ditambahkan ke Whitelist!`;
        if (feedback) {
            feedback.className = 'p-3 rounded-xl text-xs bg-emerald-950/80 border border-emerald-800 text-emerald-300 flex items-center gap-2';
            feedback.innerHTML = `<i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-400 flex-shrink-0"></i><span>${successMsg}</span>`;
            feedback.classList.remove('hidden');
            if (window.lucide) lucide.createIcons();
        }

        if (emailInput) emailInput.value = '';
        if (nameInput) nameInput.value = '';
        if (notesInput) notesInput.value = '';

        renderAdminWhitelistTable();
        showToast(successMsg);
    } catch (err) {
        console.error('Error saat menambah whitelist:', err);
        const errMsg = err?.message || 'Terjadi kesalahan saat menambahkan email.';
        if (feedback) {
            feedback.className = 'p-3 rounded-xl text-xs bg-rose-950/80 border border-rose-800 text-rose-300 flex items-center gap-2';
            feedback.innerHTML = `<i data-lucide="alert-circle" class="w-4 h-4 text-rose-400 flex-shrink-0"></i><span>${errMsg}</span>`;
            feedback.classList.remove('hidden');
            if (window.lucide) lucide.createIcons();
        } else {
            showToast(errMsg, 'error');
        }
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

function handleAdminDeleteEmail(id, email) {
    showConfirmDialog(
        'Cabut Izin Akses',
        `Apakah Anda yakin ingin mencabut izin akses untuk email "${email}"? Pengguna tidak akan dapat login lagi ke aplikasi.`,
        async () => {
            try {
                const res = await window.auth.removeFromWhitelist(id);
                if (res && res.success) {
                    renderAdminWhitelistTable();
                    showToast(`Akses untuk ${email} berhasil dicabut.`, 'info');
                } else {
                    showToast(res?.message || 'Gagal mencabut akses', 'error');
                }
            } catch (err) {
                showToast(err?.message || 'Gagal mencabut akses', 'error');
            }
        },
        'Cabut Izin',
        'trash-2',
        true
    );
}

// Helper Ekstraksi Nama Depan Ramah Pengguna
function getFirstName(fullName) {
    if (!fullName || typeof fullName !== 'string') return 'Petani';
    // Hapus gelar / sebutan kehormatan jika ada
    let clean = fullName.replace(/^(Ir\.|Bpk\.|Ibu|Dr\.|Drs\.|H\.|Hj\.)\s+/i, '').trim();
    // Hapus teks peran dalam kurung seperti (Super Admin)
    clean = clean.replace(/\s*\([^)]*\)/g, '').trim();
    const parts = clean.split(/[\s,]+/);
    let firstName = parts[0] || '';
    if (!firstName && parts.length > 1) firstName = parts[1];
    if (!firstName) firstName = clean;
    if (firstName.includes('@')) {
        firstName = firstName.split('@')[0];
    }
    return firstName.charAt(0).toUpperCase() + firstName.slice(1);
}
window.getFirstName = getFirstName;

function updateHeaderAndSidebarAuthUI() {
    const user = window.auth ? window.auth.getCurrentUser() : null;
    if (!user) return;

    const isAdmin = window.auth.isAdmin();
    const firstName = getFirstName(user.name);
    const fullName = user.name || 'Pengguna';
    const farmName = user.farm_name || 'Jaya Agrofarm Nusantara';

    // 1. Sidebar Updates
    const sName = document.getElementById('sidebar-buyer-name');
    const sBadge = document.getElementById('sidebar-buyer-badge');
    const sFarm = document.getElementById('sidebar-farm-name');
    const btnSidebarAdmin = document.getElementById('btn-sidebar-admin');

    if (sName) {
        sName.textContent = fullName;
        sName.title = fullName;
    }
    if (sBadge) {
        sBadge.textContent = isAdmin ? 'Super Administrator' : 'Premium Member';
    }
    if (sFarm) {
        sFarm.textContent = farmName;
        sFarm.title = farmName;
    }

    if (btnSidebarAdmin) {
        if (isAdmin) {
            btnSidebarAdmin.classList.remove('hidden');
        } else {
            btnSidebarAdmin.classList.add('hidden');
        }
    }

    // 2. Topbar Header Updates (Hai, [Nama Depan] 👋)
    const topbarGreetingName = document.getElementById('topbar-greeting-name');
    if (topbarGreetingName) {
        topbarGreetingName.textContent = firstName;
    }

    const btnHeaderAdmin = document.getElementById('btn-header-admin');
    if (btnHeaderAdmin) {
        if (isAdmin) {
            btnHeaderAdmin.classList.remove('hidden');
        } else {
            btnHeaderAdmin.classList.add('hidden');
        }
    }

    const btnHeaderAdminMobile = document.getElementById('btn-header-admin-mobile');
    if (btnHeaderAdminMobile) {
        if (isAdmin) {
            btnHeaderAdminMobile.classList.remove('hidden');
        } else {
            btnHeaderAdminMobile.classList.add('hidden');
        }
    }

    // Avatar & Topbar User Info (Inisial & Sapaan)
    const uAvatar = document.getElementById('header-user-avatar');
    const uName = document.getElementById('header-user-name');
    const uRole = document.getElementById('header-user-role');
    let initial = 'KA';
    if (fullName) {
        const words = fullName.trim().split(/\s+/);
        if (words.length >= 2) {
            initial = (words[0][0] + words[1][0]).toUpperCase();
        } else {
            initial = fullName.slice(0, 2).toUpperCase();
        }
    }

    if (uAvatar) {
        uAvatar.textContent = initial;
    }
    if (uName) {
        uName.textContent = firstName;
        uName.title = fullName;
    }
    if (uRole) {
        uRole.textContent = isAdmin ? 'Super Administrator' : 'Premium Member';
    }

    // 3. Dropdown Menu Elements
    const dAvatar = document.getElementById('dropdown-user-avatar');
    const dName = document.getElementById('dropdown-user-name');
    const dEmail = document.getElementById('dropdown-user-email');
    const dBadge = document.getElementById('dropdown-user-badge');
    const dFarm = document.getElementById('dropdown-user-farm');
    const dAdminBtn = document.getElementById('dropdown-admin-btn');

    if (dAvatar) dAvatar.textContent = initial;
    if (dName) dName.textContent = fullName;
    if (dEmail) dEmail.textContent = user.email || 'Akun Terdaftar';
    if (dBadge) dBadge.textContent = isAdmin ? 'Super Administrator' : 'Premium Member';
    if (dFarm) dFarm.textContent = farmName;
    if (dAdminBtn) {
        if (isAdmin) dAdminBtn.classList.remove('hidden');
        else dAdminBtn.classList.add('hidden');
    }

    // 4. User Profile Modal Elements
    const mAvatar = document.getElementById('modal-profile-avatar');
    const mName = document.getElementById('modal-profile-name');
    const mNameInline = document.getElementById('modal-profile-name-inline');
    const mEmail = document.getElementById('modal-profile-email');
    const mBadge = document.getElementById('modal-profile-badge');
    const mFarm = document.getElementById('modal-profile-farm');

    if (mAvatar) mAvatar.textContent = initial;
    if (mName) mName.textContent = fullName;
    if (mNameInline) mNameInline.textContent = fullName;
    if (mEmail) mEmail.textContent = user.email || '-';
    if (mBadge) mBadge.textContent = isAdmin ? 'Super Administrator' : 'Premium Member';
    if (mFarm) mFarm.textContent = farmName;

    if (window.lucide) {
        lucide.createIcons();
    }
}
window.updateHeaderAndSidebarAuthUI = updateHeaderAndSidebarAuthUI;

// Sinkronkan UI setiap kali profil pengguna diperbarui (lokal maupun Realtime)
window.addEventListener('user-profile-updated', () => {
    updateHeaderAndSidebarAuthUI();
});

// ----------------------------------------------------
// Handler Menu Dropdown Pengguna di Topbar
// ----------------------------------------------------
function toggleUserDropdown(e) {
    if (e) {
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
        if (typeof e.preventDefault === 'function') e.preventDefault();
    }
    const menu = document.getElementById('header-user-dropdown');
    const chevron = document.getElementById('header-user-chevron');
    const btn = document.getElementById('btn-header-user');
    if (!menu) return;

    const isHidden = menu.classList.contains('hidden');
    if (isHidden) {
        menu.classList.remove('hidden');
        if (chevron) chevron.classList.add('rotate-180');
        if (btn) btn.setAttribute('aria-expanded', 'true');
    } else {
        menu.classList.add('hidden');
        if (chevron) chevron.classList.remove('rotate-180');
        if (btn) btn.setAttribute('aria-expanded', 'false');
    }
    if (window.lucide) {
        lucide.createIcons();
    }
}
window.toggleUserDropdown = toggleUserDropdown;

function closeUserDropdown() {
    const menu = document.getElementById('header-user-dropdown');
    const chevron = document.getElementById('header-user-chevron');
    const btn = document.getElementById('btn-header-user');
    if (menu) menu.classList.add('hidden');
    if (chevron) chevron.classList.remove('rotate-180');
    if (btn) btn.setAttribute('aria-expanded', 'false');
}
window.closeUserDropdown = closeUserDropdown;

function openUserProfileModal() {
    closeUserDropdown();
    updateHeaderAndSidebarAuthUI();
    openModal('modal-user-profile');
}
window.openUserProfileModal = openUserProfileModal;

// Close dropdown on click outside & Escape key
document.addEventListener('click', (event) => {
    const dropdown = document.getElementById('header-user-dropdown');
    const btn = document.getElementById('btn-header-user');
    if (!dropdown || dropdown.classList.contains('hidden')) return;
    if (!dropdown.contains(event.target) && (!btn || !btn.contains(event.target))) {
        closeUserDropdown();
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeUserDropdown();
    }
});

// ----------------------------------------------------
// Handler Edit Nama Pengguna
// ----------------------------------------------------
function openEditUserNameModal() {
    const user = window.auth ? window.auth.getCurrentUser() : null;
    const input = document.getElementById('input-edit-user-name');
    if (input) {
        input.value = (user && user.name) || '';
    }
    openModal('modal-edit-user-name');
    setTimeout(() => {
        if (input) {
            input.focus();
            input.select();
        }
    }, 150);
}
window.openEditUserNameModal = openEditUserNameModal;

async function handleSaveUserName(e) {
    if (e && e.preventDefault) e.preventDefault();
    const input = document.getElementById('input-edit-user-name');
    const submitBtn = document.getElementById('btn-save-user-name');
    const newName = input ? input.value.trim().replace(/\s+/g, ' ') : '';

    if (!newName) {
        showToast('Nama pengguna tidak boleh kosong.', 'error');
        return;
    }
    if (newName.length < 2) {
        showToast('Nama pengguna minimal 2 karakter.', 'error');
        return;
    }
    if (newName.length > 80) {
        showToast('Nama pengguna maksimal 80 karakter.', 'error');
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="animate-spin mr-1.5">⏳</span><span>Menyimpan...</span>`;
    }

    try {
        if (window.auth && window.auth.updateUserName) {
            const result = await window.auth.updateUserName(newName);
            if (!result || result.success === false) {
                throw new Error(result?.message || 'Gagal menyimpan nama pengguna.');
            }
        } else {
            throw new Error('Layanan profil pengguna tidak tersedia.');
        }

        updateHeaderAndSidebarAuthUI();
        closeModal('modal-edit-user-name');
        closeModal('modal-user-profile');
        showToast(`Nama pengguna berhasil diperbarui menjadi "${newName}"`);
    } catch (err) {
        console.error('[handleSaveUserName error]', err);
        showToast('Gagal menyimpan nama pengguna: ' + (err.message || ''), 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i data-lucide="save" class="w-3.5 h-3.5"></i><span>Simpan</span>`;
            if (window.lucide) lucide.createIcons();
        }
    }
}
window.handleSaveUserName = handleSaveUserName;

// ----------------------------------------------------
// Handler Modal Edit Nama Farm / Kebun
// ----------------------------------------------------
function openEditFarmModal() {
    const user = window.auth ? window.auth.getCurrentUser() : null;
    const input = document.getElementById('input-edit-farm-name');
    if (input) {
        input.value = (user && user.farm_name) || 'Jaya Agrofarm Nusantara';
    }
    openModal('modal-edit-farm');
    setTimeout(() => {
        if (input) input.focus();
    }, 150);
}
window.openEditFarmModal = openEditFarmModal;

async function handleSaveFarmName(e) {
    if (e && e.preventDefault) e.preventDefault();
    const input = document.getElementById('input-edit-farm-name');
    const submitBtn = document.getElementById('btn-save-farm-name');
    const newName = input ? input.value.trim() : '';

    if (!newName) {
        showToast('Nama Farm / Kebun tidak boleh kosong.', 'error');
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="animate-spin mr-1.5">⏳</span><span>Menyimpan...</span>`;
    }

    try {
        if (window.auth && window.auth.updateFarmName) {
            await window.auth.updateFarmName(newName);
        }
        updateHeaderAndSidebarAuthUI();
        closeModal('modal-edit-farm');
        showToast(`Nama farm berhasil diperbarui: "${newName}"`);
    } catch (err) {
        console.error('[handleSaveFarmName error]', err);
        showToast('Gagal menyimpan nama farm: ' + (err.message || ''), 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i data-lucide="save" class="w-3.5 h-3.5"></i><span>Simpan</span>`;
            if (window.lucide) lucide.createIcons();
        }
    }
}
window.handleSaveFarmName = handleSaveFarmName;

let confirmModalCallback = null;

function showConfirmDialog(title, message, onConfirm, okText = 'Lanjutkan', icon = 'alert-triangle', isDanger = true) {
    const modal = document.getElementById('modal-generic-confirm');
    if (!modal) {
        if (typeof onConfirm === 'function') onConfirm();
        return;
    }

    const titleEl = document.getElementById('confirm-modal-title');
    const msgEl = document.getElementById('confirm-modal-message');
    const okBtn = document.getElementById('confirm-modal-btn-ok');
    const iconEl = document.getElementById('confirm-modal-icon');

    if (titleEl) titleEl.textContent = title || 'Konfirmasi Aksi';
    if (msgEl) msgEl.textContent = message || 'Apakah Anda yakin ingin melanjutkan?';
    if (iconEl && icon) iconEl.setAttribute('data-lucide', icon);

    if (okBtn) {
        okBtn.textContent = okText;
        if (isDanger) {
            okBtn.className = 'flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition';
        } else {
            okBtn.className = 'flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition';
        }
    }

    confirmModalCallback = onConfirm;
    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    if (window.lucide) {
        lucide.createIcons();
    }
}

function closeConfirmModal(accepted) {
    const modal = document.getElementById('modal-generic-confirm');
    if (modal) {
        modal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    }
    if (accepted && typeof confirmModalCallback === 'function') {
        const cb = confirmModalCallback;
        confirmModalCallback = null;
        cb();
    } else {
        confirmModalCallback = null;
    }
}

function handleLogout() {
    showConfirmDialog(
        'Keluar dari Aplikasi',
        'Apakah Anda yakin ingin keluar dari sistem? Sesi login Anda akan diakhiri dan dialihkan ke halaman login.',
        performLogout,
        'Ya, Keluar',
        'log-out',
        true
    );
}

function performLogout() {
    if (window.auth) {
        window.auth.logout();
    }
    showAuthScreen();
    showToast('Anda telah keluar. Sesi login telah berakhir.', 'info');
}

function applyRolePermissions() {
    // Semua hak akses terbuka penuh untuk pembeli sekali bayar
    const btnFinance = document.getElementById('btn-quick-finance');
    const navKeuangan = document.getElementById('nav-item-keuangan');
    if (btnFinance) btnFinance.classList.remove('hidden');
    if (navKeuangan) {
        navKeuangan.removeAttribute('title');
        navKeuangan.classList.remove('opacity-70');
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ----------------------------------------------------
// Navigasi Antar Tab & Drawer Responsif HP
// ----------------------------------------------------
function toggleMobileSidebar(open) {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar) return;

    const isOpen = !sidebar.classList.contains('-translate-x-full');
    const targetState = open !== undefined ? open : !isOpen;

    if (targetState) {
        sidebar.classList.remove('-translate-x-full');
        sidebar.classList.add('translate-x-0');
        if (backdrop) backdrop.classList.remove('hidden');
        document.body.classList.add('overflow-hidden', 'md:overflow-auto');
    } else {
        sidebar.classList.add('-translate-x-full');
        sidebar.classList.remove('translate-x-0');
        if (backdrop) backdrop.classList.add('hidden');
        document.body.classList.remove('overflow-hidden', 'md:overflow-auto');
    }
}

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = link.getAttribute('data-tab');
            switchTab(tabId);
            toggleMobileSidebar(false);
        });
    });

    // Mobile menu toggle
    const mobileMenuBtn = document.getElementById('btn-mobile-menu');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMobileSidebar(true);
        });
    }

    // Close button inside sidebar (mobile)
    const btnCloseSidebar = document.getElementById('btn-close-sidebar');
    if (btnCloseSidebar) {
        btnCloseSidebar.addEventListener('click', () => {
            toggleMobileSidebar(false);
        });
    }

    // Backdrop click
    const backdrop = document.getElementById('sidebar-backdrop');
    if (backdrop) {
        backdrop.addEventListener('click', () => {
            toggleMobileSidebar(false);
        });
    }
}

function switchTab(tabId) {
    currentActiveTab = tabId;
    
    // Update active class on links
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('data-tab') === tabId) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // Update active class on mobile bottom nav
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
        const tab = item.getAttribute('data-mobile-tab');
        if (tab === tabId) {
            item.classList.add('text-emerald-600', 'font-bold');
            item.classList.remove('text-slate-500', 'font-medium');
        } else {
            item.classList.remove('text-emerald-600', 'font-bold');
            item.classList.add('text-slate-500', 'font-medium');
        }
    });

    // Show/hide sections
    document.querySelectorAll('.tab-section').forEach(section => {
        if (section.id === `section-${tabId}`) {
            section.classList.remove('hidden');
        } else {
            section.classList.add('hidden');
        }
    });

    // Tutup mobile drawer jika sedang terbuka
    toggleMobileSidebar(false);

    // Scroll otomatis ke atas halaman saat pindah tab
    const mainEl = document.getElementById('main-content');
    if (mainEl) {
        mainEl.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Refresh views if needed
    if (tabId === 'dashboard') {
        renderDashboard();
    } else if (tabId === 'lahan') {
        renderPlots();
    } else if (tabId === 'tanam') {
        renderCropsAndActivities();
        populateAiInputs();
        runCoreAiEngine();
    } else if (tabId === 'inventaris') {
        renderInventory();
    } else if (tabId === 'keuangan') {
        populateFinanceFilters();
        renderFinance();
    } else if (tabId === 'laporan') {
        renderReports();
    }

    // Refresh icons
    setTimeout(() => lucide.createIcons(), 50);
}

function renderAllViews() {
    renderDashboard();
    renderPlots();
    renderCropsAndActivities();
    renderInventory();
    populateFinanceFilters();
    renderFinance();
    renderReports();
}

// ----------------------------------------------------
// Formatters & Utilities
// ----------------------------------------------------
function formatRupiah(number) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
    }).format(number || 0);
}

const MONTH_NAMES_LONG_ID = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function formatDateLongIndo(dateStr) {
    if (!dateStr) return '-';
    const date = window.db.parseDate ? window.db.parseDate(dateStr) : new Date(dateStr);
    if (!date || isNaN(date.getTime())) return String(dateStr);
    return `${date.getDate()} ${MONTH_NAMES_LONG_ID[date.getMonth()]} ${date.getFullYear()}`;
}
window.formatDateLongIndo = formatDateLongIndo;

function formatDateIndo(dateStr) {
    if (!dateStr) return '-';
    const date = window.db.parseDate ? window.db.parseDate(dateStr) : new Date(dateStr);
    if (!date || isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');

    if (!toast) return;

    toastMsg.textContent = message;
    if (type === 'success') {
        toast.className = 'fixed bottom-5 right-5 z-50 flex items-center gap-3 bg-emerald-800 text-white px-5 py-3 rounded-xl shadow-2xl transition-all duration-300';
        toastIcon.innerHTML = `<i data-lucide="check-circle-2" class="w-5 h-5 text-emerald-300"></i>`;
    } else if (type === 'error') {
        toast.className = 'fixed bottom-5 right-5 z-50 flex items-center gap-3 bg-rose-800 text-white px-5 py-3 rounded-xl shadow-2xl transition-all duration-300';
        toastIcon.innerHTML = `<i data-lucide="alert-triangle" class="w-5 h-5 text-rose-300"></i>`;
    } else {
        toast.className = 'fixed bottom-5 right-5 z-50 flex items-center gap-3 bg-blue-800 text-white px-5 py-3 rounded-xl shadow-2xl transition-all duration-300';
        toastIcon.innerHTML = `<i data-lucide="info" class="w-5 h-5 text-blue-300"></i>`;
    }

    lucide.createIcons();
    toast.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-4');
    
    setTimeout(() => {
        toast.classList.add('opacity-0', 'pointer-events-none', 'translate-y-4');
    }, 3200);
}

// ----------------------------------------------------
// 1. DASHBOARD VIEW
// ----------------------------------------------------
function renderDashboard() {
    const plots = window.db.getPlots();
    const crops = window.db.getCrops();
    const inventory = window.db.getInventory();
    const finance = window.db.getFinance();
    const activities = window.db.getActivities();

    // Total Lahan
    const totalAreaM2 = plots.reduce((acc, p) => acc + Number(p.area || 0), 0);
    const totalAreaHa = (totalAreaM2 / 10000).toFixed(2);
    document.getElementById('stat-total-area').textContent = `${totalAreaM2.toLocaleString('id-ID')} m²`;
    document.getElementById('stat-total-ha').textContent = `(~${totalAreaHa} Ha dari ${plots.length} blok)`;

    // Update cuaca di dashboard
    updateWeatherUI();

    // Siklus Tanam Aktif
    const activeCrops = crops.filter(c => c.status === 'growing');
    document.getElementById('stat-active-crops').textContent = `${activeCrops.length} Siklus`;
    document.getElementById('stat-crops-detail').textContent = `${crops.length} total siklus tanam tercatat`;

    // Nilai Aset Saprotan
    const totalAssetVal = inventory.reduce((acc, i) => acc + (Number(i.stock || 0) * Number(i.unitPrice || 0)), 0);
    document.getElementById('stat-inventory-val').textContent = formatRupiah(totalAssetVal);
    const lowStockCount = inventory.filter(i => Number(i.stock) <= Number(i.minStock)).length;
    document.getElementById('stat-low-stock-count').textContent = `${lowStockCount} barang perlu restock`;

    // Finansial
    const totalIncome = finance.filter(f => f.type === 'income').reduce((acc, f) => acc + Number(f.amount || 0), 0);
    const totalExpense = finance.filter(f => f.type === 'expense').reduce((acc, f) => acc + Number(f.amount || 0), 0);
    const netProfit = totalIncome - totalExpense;

    document.getElementById('stat-net-profit').textContent = formatRupiah(netProfit);
    document.getElementById('stat-income-expense').textContent = `Masuk: ${formatRupiah(totalIncome)} | Keluar: ${formatRupiah(totalExpense)}`;
    
    const profitCard = document.getElementById('card-profit');
    if (profitCard) {
        if (netProfit >= 0) {
            profitCard.classList.remove('border-rose-300');
            profitCard.classList.add('border-emerald-200');
        } else {
            profitCard.classList.remove('border-emerald-200');
            profitCard.classList.add('border-rose-300');
        }
    }

    // Render Aktivitas Terbaru di Dashboard
    const recentActContainer = document.getElementById('dashboard-recent-activities');
    if (recentActContainer) {
        const top5Acts = activities.slice(0, 5);
        if (top5Acts.length === 0) {
            recentActContainer.innerHTML = `<p class="text-slate-400 text-sm py-4">Belum ada riwayat aktivitas dicatat.</p>`;
        } else {
            recentActContainer.innerHTML = top5Acts.map(act => {
                const crop = crops.find(c => String(c.id) === String(act.crop_id || act.cropId));
                const plot = crop ? plots.find(p => String(p.id) === String(crop.plotId || crop.petak_id || crop.plot_id)) : null;
                const isScheduled = act.status === 'scheduled';
                return `
                    <div class="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition">
                        <div class="p-2 rounded-lg ${isScheduled ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'} shrink-0">
                            <i data-lucide="${isScheduled ? 'calendar-clock' : 'check-circle'}" class="w-4 h-4"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between gap-2">
                                <h5 class="text-sm font-semibold text-slate-800 truncate">${act.title}</h5>
                                <span class="text-xs px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${isScheduled ? 'bg-amber-50 text-amber-600 font-medium' : 'bg-emerald-50 text-emerald-600 font-medium'}">
                                    ${act.type}
                                </span>
                            </div>
                            <p class="text-xs text-slate-500 mt-0.5 truncate">${act.description || '-'}</p>
                            <div class="flex items-center gap-3 text-[11px] text-slate-400 mt-1 flex-wrap">
                                <span class="whitespace-nowrap"><i data-lucide="calendar" class="w-3 h-3 inline mr-1"></i>${formatDateIndo(act.date)}</span>
                                ${crop ? `<span class="whitespace-nowrap"><i data-lucide="sprout" class="w-3 h-3 inline mr-1"></i>${crop.commodity} ${plot ? `(${plot.name})` : ''}</span>` : ''}
                                ${act.cost ? `<span class="whitespace-nowrap"><i data-lucide="banknote" class="w-3 h-3 inline mr-1"></i>${formatRupiah(act.cost)}</span>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // Render Peringatan Stok Kritis di Dashboard
    const criticalStockContainer = document.getElementById('dashboard-critical-stock');
    if (criticalStockContainer) {
        const lowStockItems = inventory.filter(i => Number(i.stock) <= Number(i.minStock));
        if (lowStockItems.length === 0) {
            criticalStockContainer.innerHTML = `
                <div class="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-sm flex items-center gap-3">
                    <i data-lucide="shield-check" class="w-5 h-5 text-emerald-600 flex-shrink-0"></i>
                    <span>Seluruh stok saprotan dan benih dalam kondisi aman mencukupi batas minimum.</span>
                </div>
            `;
        } else {
            criticalStockContainer.innerHTML = lowStockItems.map(item => `
                <div class="flex items-center justify-between p-3 rounded-xl bg-rose-50 border border-rose-200">
                    <div class="flex items-center gap-3">
                        <div class="p-2 rounded-lg bg-rose-100 text-rose-700">
                            <i data-lucide="alert-triangle" class="w-4 h-4"></i>
                        </div>
                        <div>
                            <div class="text-sm font-semibold text-rose-900">${item.name}</div>
                            <div class="text-xs text-rose-600">Sisa: <strong class="font-bold">${item.stock} ${item.unit}</strong> (Batas min: ${item.minStock} ${item.unit})</div>
                        </div>
                    </div>
                    <button onclick="quickRestock('${item.id}')" class="px-2.5 py-1 text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition shadow-sm">
                        + Tambah Stok
                    </button>
                </div>
            `).join('');
        }
    }

    // Render Kartu Siklus Tanam Berjalan (Batch Monitoring) di Dashboard
    renderDashboardCrops(crops, plots);

    // Hanya render chart jika tab dashboard sedang aktif
    if (currentActiveTab === 'dashboard') {
        renderCharts(finance, crops);
    }
}

function renderDashboardCrops(crops, plots) {
    const container = document.getElementById('dashboard-crops-container');
    if (!container) return;

    const activeCrops = crops.filter(c => c.status === 'growing');
    if (activeCrops.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <i data-lucide="sprout" class="w-8 h-8 text-slate-300 mx-auto mb-2"></i>
                <p class="text-xs font-semibold text-slate-600">Belum ada siklus penanaman aktif</p>
                <button onclick="openNewCropModal()" class="mt-2.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold">Mulai Siklus Baru</button>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    container.innerHTML = activeCrops.map(crop => {
        const plot = plots.find(p => p.id === crop.plotId);
        const ageInfo = window.db.calculateCropAge(crop);

        let phaseBadgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-300';
        if (ageInfo.phaseKey === 'semai') phaseBadgeColor = 'bg-blue-50 text-blue-800 border-blue-300';
        else if (ageInfo.phaseKey === 'generatif') phaseBadgeColor = 'bg-purple-50 text-purple-800 border-purple-300';
        else if (ageInfo.phaseKey === 'panen') phaseBadgeColor = 'bg-amber-50 text-amber-900 border-amber-300';

        const petakDisplay = crop.petakName || (plot ? plot.name : 'Petak Utama');
        const cycleCodeDisplay = crop.cycleCode || `Siklus #${crop.id}`;

        return `
            <div class="bg-slate-50/70 hover:bg-white rounded-xl sm:rounded-2xl border border-slate-200 p-4 transition-all duration-200 shadow-2xs hover:shadow-md flex flex-col justify-between stat-card">
                <div>
                    <!-- Header Kartu Dashboard -->
                    <div class="mb-3">
                        <!-- Baris 1: Siklus di kiri, Badge di kanan (Desktop); stacked di Mobile -->
                        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                            <span class="text-[10px] font-black tracking-wider text-emerald-800 uppercase">
                                ${cycleCodeDisplay}
                            </span>
                            <div class="self-start sm:self-auto shrink-0">
                                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${phaseBadgeColor} shadow-2xs">
                                    ${ageInfo.phaseBadgeText}
                                </span>
                            </div>
                        </div>

                        <!-- Baris 2: Nama Blok di bawahnya -->
                        <div class="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 mt-1.5">
                            <i data-lucide="map-pin" class="w-3 h-3 text-emerald-600 shrink-0"></i>
                            <span class="truncate">${petakDisplay}</span>
                        </div>

                        <!-- Baris 3: Nama Tanaman dan Varietas -->
                        <div class="mt-2">
                            <h4 class="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
                                ${crop.commodity}
                            </h4>
                            <p class="text-[11px] font-medium text-slate-500 mt-0.5">
                                ${crop.variety ? `Varietas ${crop.variety}` : 'Varietas Standar'}
                            </p>
                        </div>
                    </div>

                    <!-- Detail Tanggal Semai, Pindah Tanam & Estimasi Panen Per Siklus -->
                    <div class="my-3 p-2.5 rounded-xl bg-white border border-slate-200/90 text-xs space-y-1.5 shadow-2xs">
                        <div class="flex items-center justify-between text-slate-600">
                            <span class="text-[11px] text-slate-500 font-medium">Tanggal Semai:</span>
                            <strong class="font-bold text-slate-800">${formatDateLongIndo(crop.seedingDate || crop.plantDate)}</strong>
                        </div>
                        ${ageInfo.isTransplanted ? `
                        <div class="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-100">
                            <span class="text-[11px] text-slate-500 font-medium">Pindah Tanam:</span>
                            <strong class="font-bold text-emerald-800">${formatDateLongIndo(crop.transplantDate)}</strong>
                        </div>
                        <div class="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-100">
                            <span class="text-[11px] text-slate-500 font-medium">Histori:</span>
                            <span class="text-[11px] font-semibold text-slate-600">${ageInfo.hss} HSS sejak semai</span>
                        </div>
                        ` : `
                        <div class="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-100">
                            <span class="text-[11px] text-slate-500 font-medium">Pindah Tanam:</span>
                            <strong class="font-bold text-blue-700">Belum Pindah Tanam</strong>
                        </div>
                        `}
                        <div class="flex items-start justify-between text-slate-600 gap-1 pt-1 border-t border-slate-100">
                            <span class="text-[11px] text-slate-500 font-medium shrink-0">Estimasi Panen:</span>
                            <strong class="font-bold text-emerald-700 text-right text-[11px] leading-snug">${ageInfo.estimasiPanenRange}</strong>
                        </div>
                    </div>

                    <!-- Progress Bar Umur Siklus -->
                    <div class="space-y-1 mb-2">
                        <div class="flex items-center justify-between text-[10px]">
                            <span class="font-semibold text-slate-500">${ageInfo.phaseRangeText}</span>
                            <span class="font-extrabold text-emerald-700">${ageInfo.progressPercent}% Siklus</span>
                        </div>
                        <div class="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden">
                            <div class="bg-gradient-to-r from-emerald-500 to-teal-600 h-full rounded-full transition-all duration-500" style="width: ${ageInfo.progressPercent}%"></div>
                        </div>
                    </div>
                </div>

                <!-- Footer Kartu -->
                <div class="pt-2.5 mt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                    <span class="text-[10px] text-slate-500 font-medium truncate">${ageInfo.countdownPanen}</span>
                    <button type="button" onclick="openCropDetailModal('${crop.id}')" class="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300/80 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-2xs whitespace-nowrap shrink-0">
                        <i data-lucide="calendar" class="w-3.5 h-3.5 text-emerald-700 shrink-0"></i>
                        <span>Detail & Lini Masa</span>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    lucide.createIcons();
}

function renderCharts(finance, crops) {
    const ctxFin = document.getElementById('chart-finance');
    if (ctxFin && ctxFin.offsetParent !== null) {
        const monthKeys = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
        const months = ['Mei 26', 'Jun 26', 'Jul 26', 'Agu 26', 'Sep 26', 'Okt 26'];
        const incomeData = [0, 0, 0, 0, 0, 0];
        const expenseData = [0, 0, 0, 0, 0, 0];

        if (Array.isArray(finance)) {
            finance.forEach(item => {
                if (!item.date) return;
                const ym = item.date.substring(0, 7);
                const idx = monthKeys.indexOf(ym);
                if (idx !== -1) {
                    const amt = Number(item.amount) || 0;
                    if (item.type === 'income') {
                        incomeData[idx] += amt;
                    } else if (item.type === 'expense') {
                        expenseData[idx] += amt;
                    }
                }
            });
        }

        if (financialChartInstance) {
            financialChartInstance.destroy();
        }

        financialChartInstance = new Chart(ctxFin, {
            type: 'bar',
            data: {
                labels: months,
                datasets: [
                    {
                        label: 'Pendapatan Panen (Rp)',
                        data: incomeData,
                        backgroundColor: '#10b981',
                        borderRadius: 6
                    },
                    {
                        label: 'Biaya Operasional (Rp)',
                        data: expenseData,
                        backgroundColor: '#f43f5e',
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + formatRupiah(context.raw);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(val) {
                                return 'Rp ' + (val / 1000000).toFixed(1) + ' jt';
                            }
                        }
                    }
                }
            }
        });
    }

    const ctxCrop = document.getElementById('chart-commodities');
    if (ctxCrop && ctxCrop.offsetParent !== null) {
        const commodityCounts = {};
        crops.forEach(c => {
            const name = c.commodity || 'Lainnya';
            commodityCounts[name] = (commodityCounts[name] || 0) + 1;
        });

        const labels = Object.keys(commodityCounts);
        const dataValues = Object.values(commodityCounts);

        if (commodityChartInstance) {
            commodityChartInstance.destroy();
        }

        commodityChartInstance = new Chart(ctxCrop, {
            type: 'doughnut',
            data: {
                labels: labels.length > 0 ? labels : ['Belum Ada'],
                datasets: [{
                    data: dataValues.length > 0 ? dataValues : [1],
                    backgroundColor: ['#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899', '#84cc16'],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                },
                cutout: '70%'
            }
        });
    }
}

// ----------------------------------------------------
// 2. MODUL LAHAN / PLOT
// ----------------------------------------------------
function renderPlots() {
    const plots = window.db.getPlots();
    const crops = window.db.getCrops();
    const container = document.getElementById('plots-container');
    const selectFilter = document.getElementById('filter-plot-status');
    const searchInput = document.getElementById('search-plot');

    if (!container) return;

    const filterVal = selectFilter ? selectFilter.value : 'all';
    const query = searchInput ? (searchInput.value || '').toLowerCase().trim() : '';

    const filtered = plots.filter(plot => {
        const matchStatus = filterVal === 'all' || plot.status === filterVal;
        const matchSearch = (plot.name || '').toLowerCase().includes(query) ||
                            (plot.soilType || '').toLowerCase().includes(query) ||
                            (plot.location || '').toLowerCase().includes(query);
        return matchStatus && matchSearch;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-200 p-8">
                <i data-lucide="map-pin-off" class="w-12 h-12 text-slate-300 mx-auto mb-3"></i>
                <h4 class="text-base font-semibold text-slate-700">Tidak ada lahan ditemukan</h4>
                <p class="text-sm text-slate-400 mt-1">Coba sesuaikan filter atau tambahkan blok lahan baru.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    container.innerHTML = filtered.map(plot => {
        const activeCrop = crops.find(c => c.plotId === plot.id && c.status === 'growing');
        
        let statusBadge = '';
        if (plot.status === 'active') {
            statusBadge = `<span class="badge-status-active text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>Ditanami Aktif</span>`;
        } else if (plot.status === 'preparation') {
            statusBadge = `<span class="badge-status-prep text-xs font-semibold px-2.5 py-1 rounded-full">Persiapan Lahan</span>`;
        } else {
            statusBadge = `<span class="badge-status-rest text-xs font-semibold px-2.5 py-1 rounded-full">Istirahat / Bera</span>`;
        }

        const areaHa = (plot.area / 10000).toFixed(2);

        return `
            <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between stat-card">
                <div class="p-5">
                    <div class="flex items-start justify-between gap-3 mb-3">
                        <div>
                            <h3 class="text-base font-bold text-slate-800 leading-snug">${plot.name}</h3>
                            <p class="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                <i data-lucide="map-pin" class="w-3.5 h-3.5 text-slate-400"></i> ${plot.location || 'Lokasi tidak diset'}
                            </p>
                        </div>
                        ${statusBadge}
                    </div>

                    <div class="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl my-3 border border-slate-100">
                        <div>
                            <span class="text-[11px] text-slate-400 block">Luas Area</span>
                            <strong class="text-sm text-slate-800 font-bold">${Number(plot.area).toLocaleString('id-ID')} m²</strong>
                            <span class="text-[10px] text-slate-500 block">(${areaHa} Hektar)</span>
                        </div>
                        <div>
                            <span class="text-[11px] text-slate-400 block">Jenis Tanah</span>
                            <span class="text-xs text-slate-800 font-semibold block truncate">${plot.soilType || '-'}</span>
                            <span class="text-[10px] text-slate-500 block truncate">${plot.irrigationType || '-'}</span>
                        </div>
                    </div>

                    ${activeCrop ? `
                        <div class="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl mb-3">
                            <div class="flex items-center justify-between text-xs font-semibold text-emerald-900 mb-1">
                                <span class="flex items-center gap-1.5"><i data-lucide="sprout" class="w-4 h-4 text-emerald-600"></i> ${activeCrop.commodity} (${activeCrop.variety || '-'})</span>
                                <span class="text-emerald-700">${activeCrop.progress}%</span>
                            </div>
                            <div class="w-full bg-emerald-200 h-1.5 rounded-full overflow-hidden mb-1.5">
                                <div class="bg-emerald-600 h-full rounded-full" style="width: ${activeCrop.progress}%"></div>
                            </div>
                            <div class="text-[11px] text-emerald-700 flex justify-between">
                                <span>Fase: ${activeCrop.stage || '-'}</span>
                                <span>Est Panen: ${formatDateIndo(activeCrop.estHarvestDate)}</span>
                            </div>
                        </div>
                    ` : `
                        <div class="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl mb-3 text-center">
                            <span class="text-xs text-slate-400 flex items-center justify-center gap-1">
                                <i data-lucide="sun" class="w-3.5 h-3.5"></i> Tidak ada komoditas aktif
                            </span>
                        </div>
                    `}

                    <p class="text-xs text-slate-500 italic line-clamp-2">${plot.notes || 'Tidak ada catatan tambahan.'}</p>
                </div>

                <div class="border-t border-slate-100 bg-slate-50/60 px-5 py-3 flex items-center justify-between">
                    <button onclick="openNewCropModal('${plot.id}')" class="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1">
                        <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i> Siklus Baru
                    </button>
                    <div class="flex items-center gap-2">
                        <button onclick="editPlot('${plot.id}')" class="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="Edit Lahan">
                            <i data-lucide="edit-3" class="w-4 h-4"></i>
                        </button>
                        <button onclick="deletePlot('${plot.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Hapus Lahan">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    lucide.createIcons();
}

// ----------------------------------------------------
// 3. SIKLUS TANAM & AKTIVITAS PERAWATAN
// ----------------------------------------------------
function renderCropsAndActivities() {
    const crops = window.db.getCrops();
    const plots = window.db.getPlots();
    const activities = window.db.getActivities();

    const cropsContainer = document.getElementById('crops-container');
    if (cropsContainer) {
        if (crops.length === 0) {
            cropsContainer.innerHTML = `
                <div class="col-span-full py-10 text-center bg-white rounded-2xl border border-slate-200">
                    <i data-lucide="sprout" class="w-10 h-10 text-slate-300 mx-auto mb-2"></i>
                    <p class="text-sm font-semibold text-slate-700">Belum ada siklus penanaman aktif</p>
                    <button onclick="openNewCropModal()" class="mt-3 px-4 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold">Mulai Siklus Tanam</button>
                </div>
            `;
        } else {
            cropsContainer.innerHTML = crops.map(crop => {
                const plot = plots.find(p => p.id === crop.plotId);
                const ageInfo = window.db.calculateCropAge(crop);
                const isGrowing = crop.status === 'growing';

                // Badge status fase & umur
                let phaseBadgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                if (ageInfo.phaseKey === 'semai') phaseBadgeColor = 'bg-blue-100 text-blue-800 border-blue-200';
                else if (ageInfo.phaseKey === 'generatif') phaseBadgeColor = 'bg-purple-100 text-purple-800 border-purple-200';
                else if (ageInfo.phaseKey === 'panen') phaseBadgeColor = 'bg-amber-100 text-amber-800 border-amber-200';

                return `
                    <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between">
                        <div>
                            <!-- Header Kartu Tanaman -->
                            <div class="mb-3.5">
                                <!-- Baris 1: SIKLUS di kiri, Badge di kanan (Desktop); stacked di Mobile -->
                                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-2">
                                    <span class="text-[11px] font-black tracking-wider text-emerald-800 uppercase">
                                        ${crop.cycleCode || ('Siklus #' + crop.id)}
                                    </span>
                                    <div class="self-start sm:self-auto shrink-0">
                                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${phaseBadgeColor} shadow-2xs">
                                            ${ageInfo.phaseBadgeText}
                                        </span>
                                    </div>
                                </div>

                                <!-- Baris 2: Nama Blok di bawahnya -->
                                <div class="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mt-2">
                                    <i data-lucide="map-pin" class="w-3.5 h-3.5 text-emerald-600 shrink-0"></i>
                                    <span class="truncate">${plot ? plot.name : (crop.petakName || 'Blok A')}</span>
                                </div>

                                <!-- Baris 3: Nama Tanaman dan Varietas di bawah nama blok -->
                                <div class="mt-2.5">
                                    <h3 class="text-base sm:text-lg font-black text-slate-900 leading-tight">
                                        ${crop.commodity}
                                    </h3>
                                    <p class="text-xs font-medium text-slate-500 mt-0.5">
                                        ${crop.variety ? `Varietas ${crop.variety}` : 'Varietas Standar'}
                                    </p>
                                </div>
                            </div>

                            <!-- 1. Teks Informasi Umur & Fase (Sesuai Permintaan User) -->
                            <div class="my-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 flex items-start gap-2.5">
                                <div class="p-1 rounded-lg bg-emerald-100 text-emerald-700 flex-shrink-0 mt-0.5">
                                    <i data-lucide="info" class="w-4 h-4"></i>
                                </div>
                                <div>
                                    <p class="font-bold text-slate-900 leading-snug">${ageInfo.infoText}</p>
                                    <span class="text-[11px] text-slate-500 block mt-0.5">${ageInfo.teksMasaTanam}</span>
                                </div>
                            </div>

                            <!-- 2. Lini Masa (Timeline) Fase & Progress Bar Umur -->
                            <div class="my-3 space-y-2">
                                <div class="flex items-center justify-between text-xs">
                                    <span class="font-bold text-slate-700">Lini Masa: ${ageInfo.phase}</span>
                                    <span class="font-extrabold text-emerald-700">${ageInfo.progressPercent}% Siklus</span>
                                </div>

                                <!-- Mini Timeline Marker Fase Sesuai Komoditas -->
                                <div class="grid grid-cols-${Math.min((ageInfo.phases || []).length, 3)} gap-1.5 text-center text-[10px]">
                                    ${(ageInfo.phases || []).map(p => {
                                        const isActive = ageInfo.activePhase && ageInfo.activePhase.name === p.name;
                                        return `
                                            <div class="py-1 px-1 rounded-lg border transition ${isActive ? 'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold ring-1 ring-emerald-300' : 'bg-slate-50 border-slate-200 text-slate-400'}">
                                                ${p.label}
                                            </div>
                                        `;
                                    }).join('')}
                                </div>

                                <!-- Progress Bar Umur -->
                                <div class="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                    <div class="bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 h-full rounded-full transition-all duration-500" style="width: ${ageInfo.progressPercent}%"></div>
                                </div>
                                <div class="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                                    <span>${ageInfo.isTransplanted ? `Pindah: ${formatDateIndo(crop.transplantDate)}` : `Semai: ${formatDateIndo(crop.seedingDate)}`}</span>
                                    <span class="font-bold text-slate-800">${ageInfo.isTransplanted ? `Hari ke-${ageInfo.hst} HST (${ageInfo.hss} HSS)` : `Hari ke-${ageInfo.hss} HSS (Semai)`}</span>
                                    <span>Est. Panen: ${formatDateIndo(crop.estHarvestDate)}</span>
                                </div>
                            </div>

                            <!-- 3. Jadwal & Instruksi Perawatan Berdasarkan Umur -->
                            <div class="my-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-950 text-xs space-y-1">
                                <div class="flex items-center justify-between font-bold text-amber-900">
                                    <span class="flex items-center gap-1.5">
                                        <i data-lucide="clipboard-check" class="w-3.5 h-3.5 text-amber-600"></i>
                                        <span>Instruksi Umur ${ageInfo.activeAge} ${ageInfo.activeUnit}:</span>
                                    </span>
                                    <span class="px-2 py-0.5 text-[9px] font-bold rounded-full bg-amber-200 text-amber-900">${ageInfo.careType}</span>
                                </div>
                                <p class="text-[11px] font-semibold text-slate-800 leading-snug">
                                    "${ageInfo.careInstruction}"
                                </p>
                            </div>
                        </div>

                        <!-- Tombol Aksi -->
                        <div class="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-100">
                            <button onclick="openCropDetailModal('${crop.id}')" class="flex-1 min-w-0 py-2 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap shadow-2xs">
                                <i data-lucide="calendar" class="w-4 h-4 shrink-0"></i>
                                <span class="truncate">Detail & Lini Masa</span>
                            </button>
                            <div class="flex items-center gap-1 shrink-0">
                                <button onclick="confirmResetBatch('${crop.id}')" class="p-2 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-xl transition flex items-center justify-center" title="Reset Siklus Tanam (Hari Ini)">
                                    <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
                                </button>
                                <button onclick="openNewActivityModal('${crop.id}')" class="p-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center justify-center" title="Catat Aktivitas Baru">
                                    <i data-lucide="plus" class="w-4 h-4"></i>
                                </button>
                                <button onclick="editCrop('${crop.id}')" class="p-2 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded-xl transition flex items-center justify-center" title="Edit Siklus">
                                    <i data-lucide="edit-3" class="w-4 h-4"></i>
                                </button>
                                <button onclick="deleteCrop('${crop.id}')" class="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition flex items-center justify-center" title="Hapus Siklus">
                                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // Render Tabel Log Aktivitas Perawatan
    const activitiesTableBody = document.getElementById('activities-table-body');
    if (activitiesTableBody) {
        if (activities.length === 0) {
            activitiesTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="py-8 text-center text-slate-400 text-sm">Belum ada riwayat aktivitas pemeliharaan atau perawatan lahan.</td>
                </tr>
            `;
        } else {
            activitiesTableBody.innerHTML = activities.map(act => {
                const crop = crops.find(c => String(c.id) === String(act.crop_id || act.cropId));
                const plot = crop ? plots.find(p => String(p.id) === String(crop.plotId || crop.petak_id || crop.plot_id)) : null;
                const ageInfo = crop ? window.db.calculateCropAge(crop) : null;
                const isScheduled = act.status === 'scheduled';

                return `
                    <tr class="border-b border-slate-100 hover:bg-slate-50/70 transition">
                        <td class="py-3 px-4 text-xs font-medium text-slate-700 whitespace-nowrap">${formatDateIndo(act.date)}</td>
                        <td class="py-3 px-4 text-xs font-bold text-slate-800">
                            <div class="leading-tight">${act.title}</div>
                            <div class="text-[11px] font-normal text-slate-500 truncate max-w-xs mt-0.5">${act.description || '-'}</div>
                        </td>
                        <td class="py-3 px-4 text-xs whitespace-nowrap">
                            <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap leading-none ${isScheduled ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">
                                ${act.type}
                            </span>
                        </td>
                        <td class="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                            ${crop ? `
                                <div>
                                    <strong class="font-semibold text-slate-800">${crop.commodity}</strong> ${plot ? `<span class="text-slate-500 font-normal">(${plot.name})</span>` : ''}
                                    <div class="text-[10px] text-emerald-700 font-semibold mt-0.5">${ageInfo ? `Umur: ${ageInfo.activeAge} ${ageInfo.activeUnit} (${ageInfo.phaseShort})` : ''}</div>
                                </div>
                            ` : '<span class="text-slate-400">-</span>'}
                        </td>
                        <td class="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">${act.workerCount ? `${act.workerCount} orang` : '-'}</td>
                        <td class="py-3 px-4 text-xs font-semibold text-slate-800 whitespace-nowrap">${act.cost ? formatRupiah(act.cost) : 'Rp 0'}</td>
                        <td class="py-3 px-4 text-xs text-right whitespace-nowrap">
                            <button onclick="toggleActivityStatus('${act.id}')" class="px-2.5 py-1 rounded-lg text-xs font-semibold ${isScheduled ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'} transition mr-1.5 shadow-2xs">
                                ${isScheduled ? 'Selesaikan' : 'Selesai ✓'}
                            </button>
                            <button onclick="deleteActivity('${act.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition inline-flex items-center" title="Hapus Aktivitas">
                                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    lucide.createIcons();
}

// ----------------------------------------------------
// CONTROLLER: MODAL DETAIL SIKLUS & UMUR TANAMAN
// ----------------------------------------------------
let currentDetailCropId = null;

function openCropDetailModal(cropId, preserveFeedbackMsg = false) {
    const crop = window.db.getCropById(cropId);
    if (!crop) {
        showToast('Siklus tanam tidak ditemukan!', 'error');
        return;
    }

    currentDetailCropId = crop.id;
    window.selectedAiCycleId = crop.id;

    // Update URL Hash Route /tanaman/detail/:id
    try {
        const cycleNum = crop.cycleCode ? crop.cycleCode.replace(/[^0-9]/g, '') : '';
        const routeParam = cycleNum || crop.id;
        window.history.replaceState(null, '', `#/tanaman/detail/${routeParam}`);
    } catch (e) {}

    // Sinkronkan ke input AI Engine panel & 4 kartu informasi
    const cycleSelect = document.getElementById('ai-input-crop-cycle');
    if (cycleSelect) cycleSelect.value = crop.id;
    const commSelect = document.getElementById('ai-input-commodity');
    if (commSelect) commSelect.value = crop.commodity;
    const plantDateInput = document.getElementById('ai-input-plant-date');
    if (plantDateInput) plantDateInput.value = crop.transplantDate || crop.plantDate || crop.seedingDate;
    if (typeof updateActiveAiCycleBadge === 'function') updateActiveAiCycleBadge(crop);

    // Hitung output deterministic AI Engine
    const aiOutput = calculateClientDeterministicOutput({
        planting_cycle_id: crop.id,
        komoditas: crop.commodity,
        tanggal_tanam: crop.transplantDate || crop.plantDate
    });
    renderAiEngineOutput(aiOutput);

    const plots = window.db.getPlots();
    const plot = plots.find(p => p.id === crop.plotId);
    const ageInfo = window.db.calculateCropAge(crop);
    const smartEngine = ageInfo.smartEngine;

    // Header modal
    const titleEl = document.getElementById('crop-detail-title');
    const subtitleEl = document.getElementById('crop-detail-subtitle');
    const cycleCodeDisplay = crop.cycleCode || `Siklus #${crop.id}`;
    const blockName = (plot ? plot.name : crop.petakName) || 'Blok Lahan';

    if (titleEl) titleEl.textContent = `Detail ${cycleCodeDisplay}: ${crop.commodity}`;
    if (subtitleEl) subtitleEl.textContent = `${blockName} • Varietas: ${crop.variety || '-'} • Target: ${Number(crop.targetYield || 0).toLocaleString('id-ID')} kg`;

    // 1. Teks Informasi Utama (Point 19: Smart Daily Summary)
    const titleBlockEl = document.getElementById('crop-detail-title-block');
    if (titleBlockEl) {
        titleBlockEl.textContent = `${crop.commodity} — ${blockName}`;
    }

    // Metode Tanam Badge
    const methodBadge = document.getElementById('crop-smart-method-badge');
    if (methodBadge) {
        if (ageInfo.isDirect) {
            methodBadge.textContent = ageInfo.plantingMethod === 'direct_planting'
                ? 'Tanam Bibit/Stek/Umbi Langsung'
                : 'Tanam Biji Langsung (Direct Sowing)';
            methodBadge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-900 border border-teal-200 shadow-2xs';
        } else {
            methodBadge.textContent = 'Semai → Pindah Tanam (Nursery & Transplant)';
            methodBadge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200 shadow-2xs';
        }
    }

    // Kondisi Pertumbuhan (Point 19)
    const condLabel = document.getElementById('crop-smart-condition-label');
    if (condLabel) {
        condLabel.textContent = `Kondisi: ${ageInfo.growthStatus || 'Normal berdasarkan umur kalender'}`;
    }

    // Status Lahan Pill
    const statusPill = document.getElementById('crop-detail-status-pill');
    if (statusPill) {
        statusPill.textContent = ageInfo.transplantStatus;
        if (ageInfo.isDirect) {
            statusPill.className = 'px-3 py-1 rounded-full text-[11px] font-black border bg-teal-600 text-white shadow-2xs';
        } else if (ageInfo.isTransplanted) {
            statusPill.className = 'px-3 py-1 rounded-full text-[11px] font-black border bg-emerald-600 text-white shadow-2xs';
        } else {
            statusPill.className = 'px-3 py-1 rounded-full text-[11px] font-black border bg-blue-600 text-white shadow-2xs';
        }
    }

    // Smart Stage Status Badge (Point 10 & 12: FASE ESTIMASI vs FASE TERKONFIRMASI)
    const smartStatusBadge = document.getElementById('crop-smart-status-badge');
    if (smartStatusBadge) {
        smartStatusBadge.textContent = ageInfo.stageStatus || 'FASE ESTIMASI';
        if (ageInfo.stageStatus === 'FASE TERKONFIRMASI') {
            smartStatusBadge.className = 'px-3 py-1 rounded-full text-[11px] font-black border bg-emerald-600 text-white shadow-2xs animate-pulse';
        } else {
            smartStatusBadge.className = 'px-3 py-1 rounded-full text-[11px] font-black border bg-amber-500 text-white shadow-2xs';
        }
    }

    // Confidence Score Badge (Point 10)
    const confBadge = document.getElementById('crop-smart-confidence-badge');
    if (confBadge) {
        confBadge.textContent = `Tingkat Keyakinan: ${ageInfo.stageConfidence || 75}%`;
    }

    // Highlight Umur Utama & Fase
    const primaryAgeEl = document.getElementById('crop-detail-primary-age');
    const phaseBadgeEl = document.getElementById('crop-detail-phase-badge');
    const secTextEl = document.getElementById('crop-detail-secondary-text');
    const convTextEl = document.getElementById('crop-detail-conversion-text');
    const confirmedNoteEl = document.getElementById('crop-detail-confirmed-note');

    if (primaryAgeEl) primaryAgeEl.textContent = ageInfo.primaryAgeText;
    if (phaseBadgeEl) phaseBadgeEl.textContent = ageInfo.phase;
    if (secTextEl) secTextEl.textContent = ageInfo.secondaryAgeText;
    if (convTextEl) convTextEl.textContent = ageInfo.teksMasaTanam;
    if (confirmedNoteEl) {
        if (ageInfo.confirmedBy) {
            confirmedNoteEl.textContent = `✓ Dikonfirmasi observasi: ${ageInfo.confirmedBy}`;
            confirmedNoteEl.classList.remove('hidden');
        } else {
            confirmedNoteEl.textContent = '';
            confirmedNoteEl.classList.add('hidden');
        }
    }

    // Smart Alert Container (Point 15 & 16: Deteksi Keterlambatan / Perlu Diperiksa di Lapangan)
    const alertContainer = document.getElementById('crop-smart-alert-container');
    if (alertContainer) {
        const alerts = ageInfo.alerts || [];
        if (alerts.length > 0) {
            alertContainer.innerHTML = alerts.map(a => `
                <div class="p-3 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 flex items-start gap-2.5 shadow-2xs">
                    <div class="w-6 h-6 rounded-lg bg-amber-200 text-amber-900 flex items-center justify-center shrink-0 mt-0.5">
                        <i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i>
                    </div>
                    <div class="text-xs leading-snug">
                        <strong class="font-extrabold text-amber-900 block">${a.title || 'PERINGATAN CERDAS'}</strong>
                        <p class="text-slate-800 mt-0.5">${a.message}</p>
                        ${a.action ? `<span class="inline-block mt-1 text-[11px] font-bold text-amber-900 underline">Tindakan: ${a.action}</span>` : ''}
                    </div>
                </div>
            `).join('');
            alertContainer.classList.remove('hidden');
        } else {
            alertContainer.innerHTML = '';
            alertContainer.classList.add('hidden');
        }
    }

    // 4 Kotak Agronomic Intelligence (Point 14 & 19: FOKUS, SEKARANG, BERIKUTNYA, PERLU DIAMATI)
    const focusTodayEl = document.getElementById('crop-smart-focus-today');
    const recNowEl = document.getElementById('crop-smart-rec-now');
    const recNextEl = document.getElementById('crop-smart-rec-next');
    const obsNeededEl = document.getElementById('crop-smart-obs-needed');

    if (focusTodayEl) focusTodayEl.textContent = ageInfo.focusToday || 'Pengakaran dan pertumbuhan vegetatif seragam.';
    if (recNowEl) recNowEl.textContent = ageInfo.currentRecommendations || 'Pemeliharaan rutin sesuai SOP fase tanaman.';
    if (recNextEl) recNextEl.textContent = ageInfo.nextRecommendations || 'Siapkan pemupukan susulan dan monitoring hama.';
    if (obsNeededEl) obsNeededEl.textContent = ageInfo.observationsNeeded || 'Amati vigor pucuk, warna daun, dan ada/tidaknya gejala OPT.';

    // Tahap Berikutnya & Estimasi Panen
    const nextStageEl = document.getElementById('crop-smart-next-stage');
    const estHarvestEl = document.getElementById('crop-smart-est-harvest');
    if (nextStageEl) nextStageEl.textContent = ageInfo.estimatedNextStage || '-';
    if (estHarvestEl) estHarvestEl.textContent = ageInfo.estimasiPanenRange || '-';

    // Observasi Lapangan Section
    const lastObsEl = document.getElementById('crop-smart-last-obs');
    const chipsContainer = document.getElementById('crop-smart-obs-chips');
    const obsList = ageInfo.observations || [];

    if (lastObsEl) {
        lastObsEl.textContent = ageInfo.lastObservationSummary || 'Belum ada observasi lapangan tercatat.';
    }

    if (chipsContainer) {
        if (obsList.length === 0) {
            chipsContainer.innerHTML = `
                <span class="text-slate-400 italic text-[11px]">Belum ada observasi tercatat untuk siklus ini. Klik "+ Catat Observasi Lapangan" untuk konfirmasi kondisi tanaman.</span>
            `;
        } else {
            chipsContainer.innerHTML = obsList.map(obs => {
                const indName = obs.indicator_name || obs.indicator_id || 'Observasi Lapangan';
                const obsDate = obs.observed_date || obs.created_at?.slice(0, 10) || '';
                return `
                    <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 transition">
                        <i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-emerald-600"></i>
                        <span class="font-bold text-[11px]">${indName}</span>
                        <span class="text-slate-500 text-[10px]">(${obsDate})</span>
                        ${obs.value ? `<span class="text-slate-600 text-[10px]">— ${obs.value}</span>` : ''}
                        <button type="button" onclick="deleteGrowthObservation('${obs.id}')" class="p-0.5 text-slate-400 hover:text-rose-600 rounded transition ml-1" title="Hapus Observasi">
                            <i data-lucide="x" class="w-3 h-3"></i>
                        </button>
                    </div>
                `;
            }).join('');
        }
    }

    // 3 Kotak Ringkasan Tanggal (Semai, Pindah Tanam / Tanam Langsung, Hari Ini)
    const seedingDateEl = document.getElementById('crop-detail-seeding-date');
    const transplantDateEl = document.getElementById('crop-detail-transplant-date');
    const transplantTitleBox = document.getElementById('crop-detail-transplant-title-box');
    const transplantSubEl = document.getElementById('crop-detail-transplant-sub');
    const todayDateEl = document.getElementById('crop-detail-today-date');
    const seedingBox = document.getElementById('crop-box-seeding-summary');

    if (seedingDateEl) seedingDateEl.textContent = ageInfo.seedingDateFormatted;
    if (transplantDateEl) transplantDateEl.textContent = ageInfo.transplantDateFormatted;
    if (todayDateEl) todayDateEl.textContent = ageInfo.todayFormatted;

    if (ageInfo.isDirect) {
        if (seedingBox) seedingBox.classList.add('hidden');
        if (transplantTitleBox) transplantTitleBox.textContent = 'Tanggal Tanam Langsung:';
        if (transplantSubEl) transplantSubEl.textContent = '0 HST dimulai dari tanggal tanam langsung';
    } else {
        if (seedingBox) seedingBox.classList.remove('hidden');
        if (transplantTitleBox) transplantTitleBox.textContent = 'Tanggal Pindah Tanam:';
        if (transplantSubEl) {
            transplantSubEl.textContent = ageInfo.isTransplanted
                ? '0 HST dimulai dari tanggal ini'
                : 'Belum pindah tanam ke lahan';
        }
    }

    // 2. Lini Masa (Timeline UI - Point 11 & 12: Past, Current, Upcoming, Terkonfirmasi vs Estimasi)
    const timelineTitleEl = document.getElementById('crop-detail-timeline-title');
    if (timelineTitleEl) {
        timelineTitleEl.innerHTML = `
            <i data-lucide="git-commit" class="w-4 h-4 text-emerald-600"></i>
            <span>Timeline utama (${ageInfo.isDirect ? 'Berbasis HST - Tanam Langsung' : (ageInfo.isTransplanted ? 'Berbasis HST' : 'Berbasis HSS - Persemaian')}):</span>
        `;
    }

    const phasesContainer = document.getElementById('crop-detail-phases-container');
    if (phasesContainer && ageInfo.phases) {
        phasesContainer.innerHTML = ageInfo.phases.map(p => {
            const isCurrent = p.isCurrent || (ageInfo.activePhase && ageInfo.activePhase.code === p.code) || (ageInfo.activePhase && ageInfo.activePhase.name === p.name);
            const statusLabel = p.stageStatusLabel || (isCurrent ? (ageInfo.stageStatus === 'FASE TERKONFIRMASI' ? 'Terkonfirmasi' : 'Estimasi') : (p.status === 'PAST' ? 'Selesai' : 'Akan Datang'));
            
            let cardClasses = 'border-slate-200 bg-white text-slate-600';
            let badgeClasses = 'text-slate-400 bg-slate-100';
            
            if (isCurrent) {
                cardClasses = 'border-emerald-500 bg-gradient-to-b from-emerald-50 to-teal-50/40 text-emerald-950 font-bold ring-2 ring-emerald-400 shadow-xs';
                badgeClasses = ageInfo.stageStatus === 'FASE TERKONFIRMASI' ? 'text-white bg-emerald-600 font-black' : 'text-amber-900 bg-amber-200 font-extrabold';
            } else if (p.status === 'PAST') {
                cardClasses = 'border-slate-200 bg-slate-50/70 text-slate-500';
                badgeClasses = 'text-emerald-700 bg-emerald-50 font-bold';
            }

            return `
                <div class="p-2.5 rounded-xl border transition ${cardClasses} flex flex-col justify-between text-left">
                    <div>
                        <div class="flex items-center justify-between gap-1">
                            <span class="block text-[10px] font-extrabold ${isCurrent ? 'text-emerald-700' : 'text-slate-400'}">${p.start}–${p.end} ${ageInfo.activeUnit}</span>
                            <span class="px-1.5 py-0.5 rounded text-[9px] ${badgeClasses}">${statusLabel}</span>
                        </div>
                        <strong class="text-slate-900 font-black block mt-1 text-xs leading-tight">${p.name}</strong>
                    </div>
                    <span class="text-[10px] text-slate-500 block truncate mt-1" title="${p.description || p.shortName}">${p.shortName || p.description}</span>
                </div>
            `;
        }).join('');
    }

    // Progress Bar Umur
    const percentEl = document.getElementById('crop-detail-percent');
    const progressBar = document.getElementById('crop-detail-progress-bar');
    const dayInd = document.getElementById('crop-detail-day-indicator');
    const plantLabel = document.getElementById('crop-detail-plant-date-label');
    const harvestLabel = document.getElementById('crop-detail-harvest-date-label');

    if (percentEl) percentEl.textContent = `${ageInfo.progressPercent}% Siklus`;
    if (progressBar) progressBar.style.width = `${ageInfo.progressPercent}%`;
    if (dayInd) dayInd.textContent = `Hari ke-${ageInfo.activeAge} ${ageInfo.activeUnit}`;
    if (plantLabel) {
        plantLabel.textContent = ageInfo.isDirect
            ? `Tanam: ${ageInfo.transplantDateFormatted}`
            : (ageInfo.isTransplanted ? `Pindah: ${ageInfo.transplantDateFormatted}` : `Semai: ${ageInfo.seedingDateFormatted}`);
    }
    if (harvestLabel) harvestLabel.textContent = `Est. Panen: ${ageInfo.estimasiPanenRange}`;

    // 3. Instruksi Perawatan Berdasarkan Umur Aktif & Rekomendasi Cerdas
    const instEl = document.getElementById('crop-detail-instruction');
    const recBadge = document.getElementById('crop-detail-rec-badge');
    if (instEl) instEl.textContent = `"${ageInfo.currentRecommendations || ageInfo.careInstruction}"`;
    if (recBadge) recBadge.textContent = `Instruksi ${ageInfo.activeAge} ${ageInfo.activeUnit} (${ageInfo.careType})`;

    // 4. Standar Prosedur Perawatan (SOP Table)
    const sopBody = document.getElementById('crop-detail-sop-tbody');
    if (sopBody && ageInfo.phases) {
        const baseDateStr = ageInfo.isDirect
            ? (crop.plantDate || crop.plant_date)
            : (ageInfo.isTransplanted ? (crop.transplantDate || crop.transplant_date) : (crop.seedingDate || crop.seeding_date));
        const baseParts = window.parseDateParts(baseDateStr);

        sopBody.innerHTML = ageInfo.phases.map(p => {
            const isCurrent = p.isCurrent || (ageInfo.activePhase && ageInfo.activePhase.code === p.code) || (ageInfo.activePhase && ageInfo.activePhase.name === p.name);
            let dateRangeStr = '-';
            if (baseParts) {
                const baseUtc = Date.UTC(baseParts.year, baseParts.month, baseParts.day);
                const sDate = new Date(baseUtc + p.start * 86400000);
                const eDate = new Date(baseUtc + p.end * 86400000);
                dateRangeStr = `${window.db.formatDateLong(sDate)} – ${window.db.formatDateLong(eDate)}`;
            }

            return `
                <tr class="${isCurrent ? 'bg-emerald-50/80 font-bold text-emerald-950' : 'hover:bg-slate-50/60'} transition">
                    <td class="p-2.5 font-bold whitespace-nowrap">
                        <span class="px-2 py-0.5 rounded-md ${isCurrent ? 'bg-emerald-200 text-emerald-900 font-extrabold' : 'bg-slate-100 text-slate-700'}">
                            ${p.start}–${p.end} ${ageInfo.activeUnit}
                        </span>
                    </td>
                    <td class="p-2.5 whitespace-nowrap">
                        <span class="${isCurrent ? 'text-emerald-900 font-black' : 'text-slate-900 font-semibold'}">${p.name}</span>
                        ${isCurrent ? `<span class="ml-1.5 px-1.5 py-0.5 rounded text-[9px] ${ageInfo.stageStatus === 'FASE TERKONFIRMASI' ? 'bg-emerald-600' : 'bg-amber-500'} text-white font-extrabold">${ageInfo.stageStatus === 'FASE TERKONFIRMASI' ? 'Terkonfirmasi' : 'Aktif (Estimasi)'}</span>` : ''}
                    </td>
                    <td class="p-2.5 text-slate-600 whitespace-nowrap text-[10px]">
                        ${dateRangeStr}
                    </td>
                    <td class="p-2.5 text-slate-700">
                        ${p.description}
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Tombol Edit di Modal Detail
    const btnEdit = document.getElementById('btn-detail-edit-crop');
    if (btnEdit) {
        btnEdit.onclick = function() {
            closeModal('modal-crop-detail');
            editCrop(crop.id);
        };
    }

    // Tombol Reset Batch di Modal Detail
    const btnReset = document.getElementById('btn-detail-reset-batch');
    if (btnReset) {
        btnReset.onclick = function() {
            confirmResetBatch(crop.id);
        };
    }

    // Tombol Download Gambar di Modal Detail
    const btnDownload = document.getElementById('btn-detail-download-image');
    if (btnDownload) {
        btnDownload.onclick = function() {
            downloadCropDetailImage();
        };
    }

    // Reset status feedback msg
    const fbMsg = document.getElementById('crop-feedback-status-msg');
    if (fbMsg && !preserveFeedbackMsg) {
        fbMsg.textContent = '';
        fbMsg.classList.add('hidden');
    }

    // Render Ringkasan Finansial Siklus Tanam Ini
    renderCropDetailFinanceSummary(crop.id);

    openModal('modal-crop-detail');
    setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 50);
}

// ====================================================
// FITUR DOWNLOAD FOTO DETAIL SIKLUS (SERI PORTRAIT WHATSAPP)
// Membagi Detail Siklus menjadi 3–4 foto portrait (1080×1350 px)
// ====================================================
let cachedLogoDataUrl = null;

async function getLogoDataUrl() {
    if (cachedLogoDataUrl) return cachedLogoDataUrl;
    try {
        const response = await fetch('logo.png');
        if (response.ok) {
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    cachedLogoDataUrl = reader.result;
                    resolve(cachedLogoDataUrl);
                };
                reader.readAsDataURL(blob);
            });
        }
    } catch (e) {
        console.warn('Fallback fetch logo:', e);
    }
    return 'logo.png';
}

function getDownloadCropData(cropId) {
    const id = cropId || currentDetailCropId;
    if (!id) return null;
    const crop = window.db.getCropById(id);
    if (!crop) return null;

    const plots = window.db.getPlots();
    const plot = plots.find(p => p.id === crop.plotId);
    const ageInfo = window.db.calculateCropAge(crop);

    let batchNum = '001';
    if (crop.cycleCode) {
        const numMatch = String(crop.cycleCode).match(/\d+/);
        if (numMatch) {
            batchNum = numMatch[0].padStart(3, '0');
        } else {
            batchNum = String(crop.cycleCode).replace(/[^a-zA-Z0-9]/g, '') || '001';
        }
    } else if (crop.id) {
        batchNum = String(crop.id).replace(/[^0-9]/g, '').padStart(3, '0') || '001';
    }

    // Format WhatsApp-Ready: Selalu 4 Foto terpisah lengkap
    const includePhoto4 = true;
    const totalPhotos = 4;

    return {
        crop,
        plot,
        ageInfo,
        batchNum,
        includePhoto4,
        totalPhotos,
        todayFormatted: ageInfo.todayFormatted || formatDateLongIndo(new Date())
    };
}

// Buka Modal Pilihan Download Foto
function downloadCropDetailImage() {
    openDownloadPhotosModal(currentDetailCropId);
}

function openDownloadPhotosModal(cropId) {
    const data = getDownloadCropData(cropId);
    if (!data) {
        showToast('Pilih siklus tanaman terlebih dahulu!', 'error');
        return;
    }

    const { crop, plot, ageInfo, batchNum } = data;
    const blockName = (plot ? plot.name : crop.petakName) || 'Blok Lahan';

    // Update Subtitle & Badges di Modal (Format Portrait WhatsApp-Ready 4 Foto)
    const subtitleEl = document.getElementById('download-modal-subtitle');
    if (subtitleEl) {
        subtitleEl.textContent = `${crop.cycleCode || ('Siklus #' + batchNum)}: ${crop.commodity} (${blockName}) • Format 4:5 Portrait WhatsApp-Ready`;
    }

    const countBadge = document.getElementById('download-modal-count-badge');
    if (countBadge) {
        countBadge.textContent = `4 Foto`;
    }

    const batchBadge = document.getElementById('download-batch-badge');
    if (batchBadge) {
        batchBadge.textContent = crop.cycleCode || `Batch #${batchNum}`;
    }

    const btnAllLabel = document.getElementById('btn-download-all-label');
    if (btnAllLabel) {
        btnAllLabel.textContent = `Download Semua Foto (4 Foto)`;
    }

    // Sembunyikan progress bar jika sebelumnya aktif
    const progressContainer = document.getElementById('download-progress-container');
    if (progressContainer) progressContainer.classList.add('hidden');

    // Render Preview List Foto (Tetap pertahankan 4 Foto terpisah)
    const listContainer = document.getElementById('download-photos-cards-list');
    if (listContainer) {
        const photoSpecs = [
            {
                index: 1,
                title: 'Foto 1 — Ringkasan & Status Tanaman',
                desc: `Identitas, Foto Tanaman, ${ageInfo.primaryAgeText}, Fase ${ageInfo.phase}, Jadwal Semai & Tanam`,
                badge: 'Ringkasan Utama'
            },
            {
                index: 2,
                title: 'Foto 2 — Kondisi & Rekomendasi Hari Ini',
                desc: 'Fokus Hari Ini, Rekomendasi Sekarang & Berikutnya, serta Hal Perlu Diamati',
                badge: 'Agronomi Cerdas'
            },
            {
                index: 3,
                title: 'Foto 3 — Timeline Pertumbuhan & Panen',
                desc: `Lini Masa Fase Berbasis HST/HSS, Progress ${ageInfo.progressPercent}%, Estimasi Rentang Panen`,
                badge: 'Lini Masa Siklus'
            },
            {
                index: 4,
                title: 'Foto 4 — Perawatan / Catatan / Informasi Penting',
                desc: 'Instruksi Tindakan Lapangan Aktif, Observasi Terakhir, dan Catatan Siklus Lahan',
                badge: 'Tindakan Lapangan'
            }
        ];

        listContainer.innerHTML = photoSpecs.map(p => `
            <div class="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 transition flex items-center justify-between gap-3 shadow-2xs">
                <div class="flex items-start gap-3 min-w-0">
                    <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                        0${p.index}
                    </div>
                    <div class="min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <h4 class="font-extrabold text-slate-900 text-xs truncate">${p.title}</h4>
                            <span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">${p.badge}</span>
                        </div>
                        <p class="text-[11px] text-slate-500 mt-0.5 leading-snug">${p.desc}</p>
                    </div>
                </div>
                <button type="button" id="btn-download-photo-${p.index}" onclick="downloadSinglePhoto(${p.index})" class="px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 rounded-xl text-[11px] font-bold transition shrink-0 flex items-center gap-1.5 shadow-2xs" title="Unduh Hanya Foto Ini">
                    <i data-lucide="download" class="w-3 h-3 text-emerald-600"></i>
                    <span>Unduh</span>
                </button>
            </div>
        `).join('');
    }

    openModal('modal-download-crop-photos');
    setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 50);
}

// Render HTML Template untuk setiap foto (1080×1350 px pada scale 2)
function getPhotoHTML(photoIndex, data, logoDataUrl) {
    const { crop, plot, ageInfo, batchNum, totalPhotos, todayFormatted } = data;
    const blockName = (plot ? plot.name : crop.petakName) || 'Blok Lahan';
    const targetYieldText = Number(crop.targetYield || 0).toLocaleString('id-ID');
    const totalPagesStr = String(totalPhotos).padStart(2, '0');
    const pageIndexStr = String(photoIndex).padStart(2, '0');

    // Template Header Bersama
    const headerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #ecfdf5; padding-bottom: 12px; margin-bottom: 14px;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <img src="${logoDataUrl}" onerror="this.onerror=null; this.src='assets/logo.png'" style="width: 44px; height: 44px; border-radius: 12px; object-fit: cover; border: 1.5px solid #10b981;" />
                <div>
                    <div style="font-size: 13px; font-weight: 900; letter-spacing: 0.05em; color: #064e3b; text-transform: uppercase;">JAYA AGROFARM NUSANTARA</div>
                    <div style="font-size: 10px; font-weight: 700; color: #059669;">Smart Crop Engine • Laporan Siklus Tanam</div>
                </div>
            </div>
            <div style="background: #064e3b; color: #ffffff; font-size: 11px; font-weight: 900; padding: 4px 10px; border-radius: 9999px; letter-spacing: 0.05em;">
                ${pageIndexStr} / ${totalPagesStr}
            </div>
        </div>
    `;

    // Template Footer Bersama
    const footerHTML = `
        <div style="border-top: 1.5px solid #f1f5f9; padding-top: 10px; display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: #64748b;">
            <div style="font-weight: 800; color: #047857;">Jaya Agrofarm Nusantara • Laporan Resmi Petak</div>
            <div style="font-weight: 700;">Hal. ${pageIndexStr} dari ${totalPagesStr} • ${todayFormatted}</div>
        </div>
    `;

    // ==========================================
    // FOTO 1 — RINGKASAN TANAMAN
    // ==========================================
    if (photoIndex === 1) {
        const methodText = ageInfo.isDirect
            ? (ageInfo.plantingMethod === 'direct_planting' ? 'Tanam Bibit/Stek Langsung' : 'Tanam Biji Langsung (Direct Sowing)')
            : 'Semai → Pindah Tanam (Nursery & Transplant)';
        const showHss = !ageInfo.isDirect && ageInfo.secondaryAgeText;

        return `
        <div style="width: 540px; min-height: 675px; background: #ffffff; padding: 22px; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; color: #0f172a; border-radius: 20px; border: 1px solid #e2e8f0;">
            <div>
                ${headerHTML}

                <!-- Identitas Siklus -->
                <div style="margin-bottom: 14px;">
                    <div style="font-size: 11px; font-weight: 900; color: #047857; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 3px;">
                        ${crop.cycleCode || ('DETAIL SIKLUS #' + batchNum)}
                    </div>
                    <div style="font-size: 26px; font-weight: 900; color: #0f172a; line-height: 1.15; margin-bottom: 3px;">
                        ${crop.commodity}
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #475569; font-weight: 700;">
                        <span>Varietas ${crop.variety || 'Standar'}</span>
                        <span>•</span>
                        <span style="color: #065f46;">Blok ${blockName}</span>
                        <span>•</span>
                        <span>Target: ${targetYieldText} kg</span>
                    </div>
                </div>

                <!-- Kartu Utama: Umur & Fase Aktif -->
                <div style="background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 50%, #f8fafc 100%); border: 1.5px solid #a7f3d0; border-radius: 18px; padding: 16px; margin-bottom: 14px;">
                    <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 10px;">
                        <div>
                            <div style="font-size: 10px; font-weight: 800; color: #059669; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 2px;">STATUS PERTUMBUHAN AKTIF</div>
                            <div style="font-size: 40px; font-weight: 900; color: #064e3b; line-height: 1; letter-spacing: -0.02em;">
                                ${ageInfo.primaryAgeText}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <span style="display: inline-block; background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; font-size: 12px; font-weight: 800; padding: 4px 10px; border-radius: 10px; margin-bottom: 4px;">
                                ${ageInfo.phase}
                            </span>
                            <div style="font-size: 10px; font-weight: 700; color: #64748b;">
                                ${ageInfo.stageStatus || 'FASE ESTIMASI'} • Keyakinan ${ageInfo.stageConfidence || 75}%
                            </div>
                        </div>
                    </div>

                    ${showHss ? `
                    <div style="font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
                        <span style="color: #059669;">⏱</span>
                        <span>${ageInfo.secondaryAgeText}</span>
                        <span style="color: #94a3b8;">•</span>
                        <span style="color: #64748b; font-weight: 600;">${ageInfo.teksMasaTanam}</span>
                    </div>
                    ` : `
                    <div style="font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
                        <span style="color: #059669;">⏱</span>
                        <span>Durasi Tanam: ${ageInfo.teksMasaTanam}</span>
                    </div>
                    `}

                    <div style="background: #ffffff; border: 1px solid #d1fae5; border-radius: 12px; padding: 9px 12px; display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="color: #10b981; font-size: 13px; font-weight: 900;">✓</span>
                            <span style="font-size: 11px; font-weight: 700; color: #065f46;">
                                Kondisi: ${ageInfo.growthStatus || 'Normal berdasarkan umur kalender'}
                            </span>
                        </div>
                        <span style="font-size: 10px; font-weight: 700; color: #047857; background: #ecfdf5; padding: 2px 8px; border-radius: 6px;">
                            ${methodText}
                        </span>
                    </div>
                </div>

                <!-- Kartu Jadwal Tanggal -->
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 12px 14px;">
                    <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">
                        JADWAL & KALENDER TANAM
                    </div>
                    <div style="display: grid; grid-template-columns: ${!ageInfo.isDirect ? '1fr 1fr 1fr' : '1fr 1fr'}; gap: 8px;">
                        ${!ageInfo.isDirect ? `
                        <div style="background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 10px; padding: 8px 10px;">
                            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Tanggal Semai</div>
                            <div style="font-size: 12px; font-weight: 900; color: #0f172a; margin-top: 2px;">${ageInfo.seedingDateFormatted || '-'}</div>
                        </div>
                        ` : ''}
                        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 8px 10px;">
                            <div style="font-size: 9px; font-weight: 800; color: #065f46; text-transform: uppercase;">${ageInfo.isDirect ? 'Tanam Langsung' : 'Pindah Tanam'}</div>
                            <div style="font-size: 12px; font-weight: 900; color: #064e3b; margin-top: 2px;">${ageInfo.transplantDateFormatted || '-'}</div>
                        </div>
                        <div style="background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 10px; padding: 8px 10px;">
                            <div style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase;">Tanggal Hari Ini</div>
                            <div style="font-size: 12px; font-weight: 900; color: #0f172a; margin-top: 2px;">${todayFormatted}</div>
                        </div>
                    </div>
                </div>
            </div>

            ${footerHTML}
        </div>
        `;
    }

    // ==========================================
    // FOTO 2 — KONDISI & REKOMENDASI HARI INI
    // ==========================================
    if (photoIndex === 2) {
        return `
        <div style="width: 540px; min-height: 675px; background: #ffffff; padding: 22px; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; color: #0f172a; border-radius: 20px; border: 1px solid #e2e8f0;">
            <div>
                ${headerHTML}

                <!-- Title Section -->
                <div style="margin-bottom: 12px;">
                    <div style="font-size: 11px; font-weight: 900; color: #047857; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px;">
                        ${crop.cycleCode || ('SIKLUS #' + batchNum)} • ${crop.commodity} (${blockName})
                    </div>
                    <div style="font-size: 22px; font-weight: 900; color: #0f172a; line-height: 1.2;">
                        Kondisi & Rekomendasi Hari Ini
                    </div>
                    <div style="font-size: 11px; color: #64748b; font-weight: 600; margin-top: 2px;">
                        Panduan fase ${ageInfo.phase} (${ageInfo.primaryAgeText})
                    </div>
                </div>

                <!-- 4 Kotak Agronomi Singkat & Terarah -->
                <div style="display: flex; flex-direction: column; gap: 9px;">
                    <!-- 1. FOKUS HARI INI -->
                    <div style="background: #f0fdfa; border: 1.5px solid #99f6e4; border-radius: 14px; padding: 11px 13px;">
                        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                            <span style="background: #ccfbf1; color: #0f766e; font-size: 10px; font-weight: 900; padding: 2px 7px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.04em;">🎯 FOKUS HARI INI</span>
                        </div>
                        <div style="font-size: 12.5px; font-weight: 800; color: #134e4a; line-height: 1.35;">
                            ${ageInfo.focusToday || 'Pengakaran serabut aktif dan pembentukan tajuk tanaman seragam.'}
                        </div>
                    </div>

                    <!-- 2. REKOMENDASI SEKARANG -->
                    <div style="background: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: 14px; padding: 11px 13px;">
                        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                            <span style="background: #d1fae5; color: #065f46; font-size: 10px; font-weight: 900; padding: 2px 7px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.04em;">✅ REKOMENDASI SEKARANG</span>
                        </div>
                        <div style="font-size: 12px; font-weight: 700; color: #064e3b; line-height: 1.35;">
                            ${ageInfo.currentRecommendations || 'Pastikan kelembapan bedengan tetap stabil dan pantau perkembangan tunas baru.'}
                        </div>
                    </div>

                    <!-- 3. REKOMENDASI BERIKUTNYA -->
                    <div style="background: #eef2ff; border: 1.5px solid #c7d2fe; border-radius: 14px; padding: 11px 13px;">
                        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                            <span style="background: #e0e7ff; color: #3730a3; font-size: 10px; font-weight: 900; padding: 2px 7px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.04em;">➡️ REKOMENDASI BERIKUTNYA</span>
                        </div>
                        <div style="font-size: 12px; font-weight: 700; color: #1e1b4b; line-height: 1.35;">
                            ${ageInfo.nextRecommendations || 'Siapkan pemantauan pembentukan bunga dan aplikasi pupuk seimbang.'}
                        </div>
                    </div>

                    <!-- 4. PERLU DIAMATI -->
                    <div style="background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 14px; padding: 11px 13px;">
                        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                            <span style="background: #fef3c7; color: #92400e; font-size: 10px; font-weight: 900; padding: 2px 7px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.04em;">🔍 PERLU DIAMATI</span>
                        </div>
                        <div style="font-size: 12px; font-weight: 700; color: #78350f; line-height: 1.35;">
                            ${ageInfo.observationsNeeded || 'Kondisi daun, batang, tunas baru, serta ada/tidaknya gejala serangan hama atau penyakit.'}
                        </div>
                    </div>
                </div>

                <!-- Tahap Berikutnya Bar -->
                <div style="margin-top: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; font-size: 11px;">
                    <span style="font-weight: 700; color: #64748b;">Tahap Pertumbuhan Berikutnya:</span>
                    <span style="font-weight: 900; color: #0f172a;">${ageInfo.estimatedNextStage || 'Fase Pembungaan / Lanjut'}</span>
                </div>
            </div>

            ${footerHTML}
        </div>
        `;
    }

    // ==========================================
    // FOTO 3 — TIMELINE PERTUMBUHAN & PANEN
    // ==========================================
    if (photoIndex === 3) {
        const phases = ageInfo.phases || [];

        return `
        <div style="width: 540px; min-height: 675px; background: #ffffff; padding: 22px; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; color: #0f172a; border-radius: 20px; border: 1px solid #e2e8f0;">
            <div>
                ${headerHTML}

                <!-- Title & Progress Bar -->
                <div style="margin-bottom: 12px;">
                    <div style="font-size: 11px; font-weight: 900; color: #047857; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px;">
                        TIMELINE PERTUMBUHAN • ${crop.commodity}
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <div style="font-size: 22px; font-weight: 900; color: #0f172a;">
                            Lini Masa Fase Tanaman
                        </div>
                        <div style="font-size: 13px; font-weight: 900; color: #059669;">
                            Progress: ${ageInfo.progressPercent}%
                        </div>
                    </div>
                </div>

                <!-- Progress Bar -->
                <div style="background: #f1f5f9; height: 8px; border-radius: 9999px; overflow: hidden; margin-bottom: 12px;">
                    <div style="background: linear-gradient(90deg, #10b981, #059669); height: 100%; width: ${Math.min(ageInfo.progressPercent, 100)}%; border-radius: 9999px;"></div>
                </div>

                <!-- Daftar Fase Timeline (Vertical Steps) -->
                <div style="display: flex; flex-direction: column; gap: 7px; margin-bottom: 14px;">
                    ${phases.map((p, idx) => {
                        const isCurrent = p.isCurrent || (ageInfo.activePhase && ageInfo.activePhase.name === p.name);
                        const isPast = p.status === 'PAST' || (!isCurrent && ageInfo.activePhase && idx < phases.findIndex(x => x.name === ageInfo.activePhase.name));
                        
                        if (isCurrent) {
                            return `
                            <div style="background: #ecfdf5; border: 1.5px solid #10b981; border-radius: 12px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 1px 3px rgba(16,185,129,0.15);">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <div style="background: #10b981; color: #ffffff; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900;">
                                        ★
                                    </div>
                                    <div>
                                        <div style="font-size: 12px; font-weight: 900; color: #064e3b;">
                                            ${p.start}–${p.end} HST • ${p.label || p.name}
                                        </div>
                                        <div style="font-size: 10px; color: #047857; font-weight: 700;">
                                            Fase Aktif Saat Ini (${ageInfo.primaryAgeText})
                                        </div>
                                    </div>
                                </div>
                                <span style="background: #047857; color: #ffffff; font-size: 9px; font-weight: 900; padding: 3px 8px; border-radius: 6px; letter-spacing: 0.04em;">
                                    SAAT INI
                                </span>
                            </div>
                            `;
                        } else if (isPast) {
                            return `
                            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 7px 12px; display: flex; align-items: center; justify-content: space-between; opacity: 0.8;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <div style="background: #cbd5e1; color: #475569; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900;">
                                        ✓
                                    </div>
                                    <div style="font-size: 11.5px; font-weight: 700; color: #475569;">
                                        ${p.start}–${p.end} HST • ${p.label || p.name}
                                    </div>
                                </div>
                                <span style="font-size: 9px; font-weight: 700; color: #64748b;">Selesai</span>
                            </div>
                            `;
                        } else {
                            return `
                            <div style="background: #ffffff; border: 1px dashed #cbd5e1; border-radius: 10px; padding: 7px 12px; display: flex; align-items: center; justify-content: space-between;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <div style="background: #f1f5f9; color: #94a3b8; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700;">
                                        ${idx + 1}
                                    </div>
                                    <div style="font-size: 11.5px; font-weight: 600; color: #64748b;">
                                        ${p.start}–${p.end} HST • ${p.label || p.name}
                                    </div>
                                </div>
                                <span style="font-size: 9px; font-weight: 600; color: #94a3b8;">Mendatang</span>
                            </div>
                            `;
                        }
                    }).join('')}
                </div>

                <!-- Estimasi Panen Banner -->
                <div style="background: linear-gradient(135deg, #064e3b 0%, #065f46 100%); color: #ffffff; border-radius: 14px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <div style="font-size: 10px; font-weight: 700; color: #a7f3d0; text-transform: uppercase; letter-spacing: 0.05em;">ESTIMASI RENTANG PANEN</div>
                        <div style="font-size: 13.5px; font-weight: 900; color: #ffffff; margin-top: 2px;">
                            ${ageInfo.estimasiPanenRange || 'Sesuai Siklus Komoditas'}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 10px; font-weight: 700; color: #a7f3d0; text-transform: uppercase;">Target Panen</div>
                        <div style="font-size: 13.5px; font-weight: 900; color: #ffffff; margin-top: 2px;">
                            ${targetYieldText} kg
                        </div>
                    </div>
                </div>
            </div>

            ${footerHTML}
        </div>
        `;
    }

    // ==========================================
    // FOTO 4 — PERAWATAN & OBSERVASI LAPANGAN
    // ==========================================
    if (photoIndex === 4) {
        const obsList = ageInfo.observations || [];

        return `
        <div style="width: 540px; min-height: 675px; background: #ffffff; padding: 22px; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; color: #0f172a; border-radius: 20px; border: 1px solid #e2e8f0;">
            <div>
                ${headerHTML}

                <!-- Title -->
                <div style="margin-bottom: 12px;">
                    <div style="font-size: 11px; font-weight: 900; color: #047857; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px;">
                        ${crop.cycleCode || ('SIKLUS #' + batchNum)} • ${crop.commodity} (${blockName})
                    </div>
                    <div style="font-size: 22px; font-weight: 900; color: #0f172a; line-height: 1.2;">
                        Perawatan & Informasi Penting
                    </div>
                </div>

                <!-- 1. Instruksi Perawatan Umur Aktif -->
                <div style="background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 14px; padding: 13px; margin-bottom: 11px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px;">
                        <span style="font-size: 10px; font-weight: 900; color: #92400e; text-transform: uppercase; letter-spacing: 0.05em;">
                            📋 INSTRUKSI PERAWATAN HARI INI
                        </span>
                        <span style="font-size: 10px; font-weight: 700; color: #b45309; background: #fef3c7; padding: 2px 8px; border-radius: 6px;">
                            ${ageInfo.primaryAgeText}
                        </span>
                    </div>
                    <div style="font-size: 12.5px; font-weight: 800; color: #78350f; line-height: 1.4;">
                        "${ageInfo.currentInstruction || 'Lakukan penyiraman teratur 1-2 kali sehari dan berikan pupuk sesuai dosis fase aktif.'}"
                    </div>
                </div>

                <!-- 2. Observasi Lapangan Terakhir -->
                <div style="background: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: 14px; padding: 13px; margin-bottom: 11px;">
                    <div style="font-size: 10px; font-weight: 900; color: #065f46; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">
                        🔬 OBSERVASI LAPANGAN TERAKHIR
                    </div>
                    <div style="font-size: 12px; font-weight: 700; color: #064e3b; line-height: 1.35; margin-bottom: 8px;">
                        ${ageInfo.lastObservationSummary || 'Observasi kondisi tanaman terkonfirmasi sesuai target umur pertumbuhan.'}
                    </div>
                    ${obsList.length > 0 ? `
                    <div style="display: flex; flex-wrap: wrap; gap: 5px;">
                        ${obsList.slice(0, 3).map(o => `
                            <span style="background: #ffffff; border: 1px solid #6ee7b7; color: #065f46; font-size: 9.5px; font-weight: 700; padding: 3px 8px; border-radius: 7px;">
                                ✓ ${o.indicator_name || o.indicator_id} (${o.observed_date || 'Terkonfirmasi'})
                            </span>
                        `).join('')}
                    </div>
                    ` : ''}
                </div>

                <!-- 3. Catatan Khusus Siklus Lahan -->
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px 14px;">
                    <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">
                        📝 CATATAN SIKLUS LAHAN
                    </div>
                    <div style="font-size: 12px; font-weight: 600; color: #334155; line-height: 1.35;">
                        ${crop.notes && crop.notes.trim().length > 0 ? crop.notes : 'Selalu lakukan pengecekan saluran drainase dan sanitasi gulma di sekitar bedengan untuk menjaga produktivitas.'}
                    </div>
                </div>
            </div>

            ${footerHTML}
        </div>
        `;
    }

    return '';
}

// Render Card Photo ke Canvas resolusi tinggi (scale 2 = 1080×1350 px)
async function renderPhotoCardToCanvas(photoIndex, data) {
    if (window.CropPhotoExporter && window.CropPhotoExporter.renderCropPhotoToCanvas) {
        return await window.CropPhotoExporter.renderCropPhotoToCanvas(photoIndex, data);
    }
    throw new Error('Modul CropPhotoExporter belum dimuat');
}

// Download satu foto tertentu
async function downloadSinglePhoto(photoIndex) {
    const data = getDownloadCropData(currentDetailCropId);
    if (!data) return;

    const btn = document.getElementById(`btn-download-photo-${photoIndex}`);
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<svg class="animate-spin w-3 h-3 text-emerald-600 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>`;
    }

    try {
        showToast(`Menyiapkan Foto 0${photoIndex}...`, 'info');
        let canvas;
        try {
            canvas = await renderPhotoCardToCanvas(photoIndex, data);
        } catch (errRender) {
            console.warn(`[downloadSinglePhoto] Gagal render standar, beralih ke fallback:`, errRender);
            if (window.CropPhotoExporter && window.CropPhotoExporter.renderEmergencyFallbackCanvas) {
                canvas = window.CropPhotoExporter.renderEmergencyFallbackCanvas(photoIndex, data);
            } else {
                throw errRender;
            }
        }
        const fileName = `Jaya-Agrofarm-Detail-${data.batchNum}-0${photoIndex}.png`;
        await triggerCanvasDownload(canvas, fileName);
        showToast(`Foto 0${photoIndex} berhasil diunduh: ${fileName}`, 'success');
    } catch (err) {
        console.error('Error saat unduh single photo:', err);
        showToast(`Gagal mengunduh foto: ${err.message || ''}`, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
            if (window.lucide) lucide.createIcons();
        }
    }
}

// Download seluruh foto (Seri Foto Portrait - Selalu 4 Foto Lengkap)
async function startDownloadAllPhotos() {
    const data = getDownloadCropData(currentDetailCropId);
    if (!data) return;

    const btnAll = document.getElementById('btn-download-all-photos');
    const labelAll = document.getElementById('btn-download-all-label');
    const progressContainer = document.getElementById('download-progress-container');
    const progressLabel = document.getElementById('download-progress-label');
    const progressPercent = document.getElementById('download-progress-percent');
    const progressBar = document.getElementById('download-progress-bar');

    if (btnAll) btnAll.disabled = true;
    if (progressContainer) progressContainer.classList.remove('hidden');

    let successCount = 0;
    const total = 4; // Selalu 4 Foto terpisah

    try {
        for (let i = 1; i <= total; i++) {
            const pct = Math.round(((i - 1) / total) * 100);
            if (progressLabel) progressLabel.textContent = `Menyiapkan Foto 0${i} dari 0${total}...`;
            if (progressPercent) progressPercent.textContent = `${pct}%`;
            if (progressBar) progressBar.style.width = `${pct}%`;

            try {
                let canvas;
                try {
                    canvas = await renderPhotoCardToCanvas(i, data);
                } catch (errRender) {
                    console.warn(`[startDownloadAllPhotos] Foto 0${i} render standar gagal, beralih ke fallback darurat:`, errRender);
                    if (window.CropPhotoExporter && window.CropPhotoExporter.renderEmergencyFallbackCanvas) {
                        canvas = window.CropPhotoExporter.renderEmergencyFallbackCanvas(i, data);
                    } else {
                        throw errRender;
                    }
                }
                const fileName = `Jaya-Agrofarm-Detail-${data.batchNum}-0${i}.png`;
                await triggerCanvasDownload(canvas, fileName);
                successCount++;
            } catch (cardErr) {
                console.error(`[startDownloadAllPhotos] Error unduh Foto 0${i}:`, cardErr);
            }

            // Jeda singkat antar download agar browser tidak memblokir multi-unduhan otomatis
            await new Promise(r => setTimeout(r, 500));
        }

        if (progressLabel) progressLabel.textContent = `Selesai! Seluruh 4 foto telah diproses.`;
        if (progressPercent) progressPercent.textContent = `100%`;
        if (progressBar) progressBar.style.width = `100%`;

        if (successCount === 4) {
            showToast(`Semua 4 foto detail siklus berhasil diunduh! Format Portrait siap dibagikan ke WhatsApp.`, 'success');
        } else {
            showToast(`${successCount} dari 4 foto berhasil diunduh.`, 'info');
        }
    } catch (err) {
        console.error('Error saat download semua foto:', err);
        showToast(`Gagal mengunduh foto: ${err.message || ''}`, 'error');
    } finally {
        if (btnAll) btnAll.disabled = false;
        setTimeout(() => {
            if (progressContainer) progressContainer.classList.add('hidden');
        }, 2500);
    }
}

function triggerCanvasDownload(canvas, fileName) {
    return new Promise((resolve, reject) => {
        try {
            if (canvas && canvas.toBlob) {
                canvas.toBlob(blob => {
                    if (!blob) {
                        try {
                            fallbackDownloadDataUrl(canvas, fileName);
                            resolve();
                        } catch (err2) {
                            reject(err2);
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
                fallbackDownloadDataUrl(canvas, fileName);
                resolve();
            }
        } catch (err) {
            console.error('[triggerCanvasDownload] toBlob threw:', err);
            try {
                fallbackDownloadDataUrl(canvas, fileName);
                resolve();
            } catch (err3) {
                reject(err3);
            }
        }
    });
}

function fallbackDownloadDataUrl(canvas, fileName) {
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = dataUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        if (a.parentNode) a.parentNode.removeChild(a);
    }, 1000);
}

window.downloadCropDetailImage = downloadCropDetailImage;
window.openDownloadPhotosModal = openDownloadPhotosModal;
window.downloadSinglePhoto = downloadSinglePhoto;
window.startDownloadAllPhotos = startDownloadAllPhotos;

// ====================================================
// SMART CROP ENGINE: OBSERVASI LAPANGAN HANDLERS
// ====================================================
function openGrowthObservationModal(batchId) {
    if (!batchId) {
        batchId = currentDetailCropId;
    }
    const crop = window.db.getCropById(batchId);
    if (!crop) {
        showToast('Batch tanaman tidak ditemukan.', 'error');
        return;
    }

    const batchInput = document.getElementById('obs-batch-id');
    const dateInput = document.getElementById('obs-date');
    const subTitle = document.getElementById('obs-modal-subtitle');
    const indSelect = document.getElementById('obs-indicator');
    const form = document.getElementById('form-growth-observation');

    if (form) form.reset();
    if (batchInput) batchInput.value = crop.id;
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
    if (subTitle) subTitle.textContent = `${crop.commodity} (${crop.cycleCode || 'Batch #' + crop.id}) • Varietas: ${crop.variety || '-'}`;

    // Ambil indikator fenologi untuk komoditas ini
    const indicators = window.SmartCropEngine ? (window.SmartCropEngine.getCommodityIndicators?.(crop.commodity) || window.SmartCropEngine.getIndicatorsForCommodity?.(crop.commodity) || []) : [];
    if (indSelect) {
        if (indicators.length > 0) {
            indSelect.innerHTML = indicators.map(ind => `
                <option value="${ind.code}">${ind.name} (${ind.stage_target || 'Fenologi'})</option>
            `).join('');
        } else {
            indSelect.innerHTML = `
                <option value="FIRST_FLOWER">Bunga Pertama Muncul (FIRST_FLOWER)</option>
                <option value="FIRST_FRUIT">Pembentukan Buah / Fruit Set (FIRST_FRUIT)</option>
                <option value="FIRST_HARVEST">Panen Pertama Dimulai (FIRST_HARVEST)</option>
                <option value="NEW_SHOOTS">Pucuk & Cabang Baru Aktif (NEW_SHOOTS)</option>
                <option value="PEST_SYMPTOM">Gejala Serangan OPT / Hama Penyakit (PEST_SYMPTOM)</option>
                <option value="SLOW_GROWTH">Pertumbuhan Terlihat Lambat (SLOW_GROWTH)</option>
                <option value="LEAF_YELLOWING">Daun Mulai Menguning (LEAF_YELLOWING)</option>
            `;
        }
    }

    openModal('modal-growth-observation');
    setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 50);
}

async function saveGrowthObservation(e) {
    e.preventDefault();
    const batchId = document.getElementById('obs-batch-id').value;
    const obsDate = document.getElementById('obs-date').value;
    const indicatorCode = document.getElementById('obs-indicator').value;
    const indSelect = document.getElementById('obs-indicator');
    const indicatorName = indSelect ? indSelect.options[indSelect.selectedIndex]?.text?.split('(')[0]?.trim() : indicatorCode;
    const value = document.getElementById('obs-value').value;
    const notes = document.getElementById('obs-notes').value.trim();
    const submitBtn = document.getElementById('btn-save-observation');

    if (!batchId || !indicatorCode || !obsDate) {
        showToast('Lengkapi tanggal dan indikator observasi!', 'error');
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `Menyimpan...`;
    }

    try {
        await window.db.saveObservation({
            batch_id: batchId,
            indicator_id: indicatorCode,
            indicator_code: indicatorCode,
            indicator_name: indicatorName,
            observed_date: obsDate,
            value,
            notes,
            created_at: new Date().toISOString()
        });

        closeModal('modal-growth-observation');
        showToast(`Observasi "${indicatorName}" berhasil dicatat! Fase tanaman diperbarui.`);
        
        // Refresh modal detail dan dashboard
        if (currentDetailCropId === batchId) {
            openCropDetailModal(batchId);
        }
        renderCropsAndActivities();
        renderDashboard();
    } catch (err) {
        console.error('Error saat menyimpan observasi:', err);
        showToast('Gagal menyimpan observasi: ' + (err.message || ''), 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i><span>Simpan Observasi</span>`;
            if (window.lucide) lucide.createIcons();
        }
    }
}

async function deleteGrowthObservation(obsId) {
    if (!obsId) return;
    try {
        await window.db.deleteObservation(obsId);
        showToast('Observasi berhasil dihapus.');
        if (currentDetailCropId) {
            openCropDetailModal(currentDetailCropId);
        }
        renderCropsAndActivities();
    } catch (err) {
        console.error('Error deleteGrowthObservation:', err);
        showToast('Gagal menghapus observasi: ' + (err.message || ''), 'error');
    }
}

async function submitAccurateFeedback() {
    if (!currentDetailCropId) return;
    const crop = window.db.getCropById(currentDetailCropId);
    if (!crop) return;

    const btnAccurate = document.getElementById('btn-feedback-accurate');
    const originalBtnHtml = btnAccurate ? btnAccurate.innerHTML : '';
    if (btnAccurate) {
        btnAccurate.disabled = true;
        btnAccurate.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i><span>Menyimpan...</span>`;
        if (window.lucide) lucide.createIcons();
    }

    try {
        const ageInfo = window.db.calculateCropAge(crop);
        const stageName = ageInfo.activePhase ? ageInfo.activePhase.name : (crop.stage || 'Fase Berjalan');
        const ageDisplay = `${ageInfo.activeAge} ${ageInfo.activeUnit}`;
        const todayStr = new Date().toISOString().slice(0, 10);

        // 1. Simpan ke observasi pertumbuhan agar otomatis masuk ke rekap Observasi Lapangan & Perubahan Terakhir
        await window.db.saveObservation({
            batch_id: crop.id,
            crop_id: crop.id,
            indicator_id: 'STAGE_CONFIRMED',
            indicator_code: 'STAGE_CONFIRMED',
            indicator_name: 'Konfirmasi Kesesuaian Fase Tanaman',
            observed_date: todayStr,
            value: `Sesuai (${stageName} • ${ageDisplay})`,
            notes: `Petani mengonfirmasi kondisi tanaman di lahan sesuai dengan ${stageName} (${ageDisplay}).`,
            created_at: new Date().toISOString()
        });

        // 2. Simpan juga ke feedback
        await window.db.saveFeedback({
            batch_id: crop.id,
            crop_id: crop.id,
            issue_type: 'accurate',
            actual_stage: stageName,
            notes: `Petani mengonfirmasi fase dan kondisi tanaman sesuai rekomendasi budidaya pada ${ageDisplay}.`,
            created_at: new Date().toISOString()
        });

        // 3. Render ulang modal detail dengan mempertahankan status pesan
        openCropDetailModal(crop.id, true);

        // 4. Perbarui status pesan konfirmasi
        const fbMsg = document.getElementById('crop-feedback-status-msg');
        if (fbMsg) {
            fbMsg.textContent = '✓ Terima kasih! Konfirmasi lapangan berhasil direkap ke Observasi Lapangan & Perubahan Terakhir.';
            fbMsg.className = 'text-[10px] text-emerald-700 font-bold';
            fbMsg.classList.remove('hidden');
        }

        showToast('Kondisi tanaman berhasil dikonfirmasi dan direkap ke Observasi Lapangan!');
        renderCropsAndActivities();
        renderDashboard();
    } catch (err) {
        console.error('Error saat menyimpan konfirmasi kesesuaian:', err);
        showToast('Gagal mencatat konfirmasi: ' + (err.message || ''), 'error');
    } finally {
        if (btnAccurate) {
            btnAccurate.disabled = false;
            btnAccurate.innerHTML = originalBtnHtml || `<i data-lucide="check" class="w-3.5 h-3.5"></i><span>Sesuai kondisi tanaman</span>`;
            if (window.lucide) lucide.createIcons();
        }
    }
}

function openGrowthFeedbackModal() {
    if (!currentDetailCropId) return;
    const crop = window.db.getCropById(currentDetailCropId);
    if (!crop) return;

    const fbBatchInput = document.getElementById('fb-batch-id');
    const form = document.getElementById('form-growth-feedback');
    if (form) form.reset();
    if (fbBatchInput) fbBatchInput.value = crop.id;

    openModal('modal-growth-feedback');
    setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 50);
}

async function submitGrowthFeedback(e) {
    e.preventDefault();
    const batchId = document.getElementById('fb-batch-id').value;
    const issueType = document.getElementById('fb-issue-type').value;
    const actualStage = document.getElementById('fb-actual-stage').value.trim();
    const notes = document.getElementById('fb-notes').value.trim();
    const submitBtn = document.getElementById('btn-submit-feedback');

    if (!batchId) return;

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `Mengirim...`;
    }

    try {
        const crop = window.db.getCropById(batchId);
        const ageInfo = crop ? window.db.calculateCropAge(crop) : null;
        const ageText = ageInfo ? `${ageInfo.activeAge} ${ageInfo.activeUnit}` : '';
        const todayStr = new Date().toISOString().slice(0, 10);

        let indicatorCode = 'STAGE_MISMATCH';
        let indicatorName = 'Koreksi Ketidaksesuaian Fase Tanaman';
        if (issueType === 'growth_slower') {
            indicatorCode = 'SLOW_GROWTH';
            indicatorName = 'Pertumbuhan Terhambat / Lambat';
        } else if (issueType === 'pest_or_disease') {
            indicatorCode = 'PEST_DISEASE_SIGNS';
            indicatorName = 'Gejala Serangan Hama / Penyakit (OPT)';
        }

        // 1. Simpan observasi ketidaksesuaian ke Observasi Lapangan
        await window.db.saveObservation({
            batch_id: batchId,
            crop_id: batchId,
            indicator_id: indicatorCode,
            indicator_code: indicatorCode,
            indicator_name: indicatorName,
            observed_date: todayStr,
            value: actualStage || 'Koreksi Lapangan',
            notes: notes ? `${notes} (Fase aktual: ${actualStage || 'Berbeda'})` : `Petani mencatat fase aktual: ${actualStage || 'Kondisi berbeda dari estimasi'} (${ageText}).`,
            created_at: new Date().toISOString()
        });

        // 2. Simpan feedback
        await window.db.saveFeedback({
            batch_id: batchId,
            crop_id: batchId,
            issue_type: issueType,
            actual_stage: actualStage,
            notes,
            created_at: new Date().toISOString()
        });

        closeModal('modal-growth-feedback');
        showToast('Koreksi berhasil direkap ke Observasi Lapangan & Perubahan Terakhir.');

        if (currentDetailCropId === batchId) {
            openCropDetailModal(batchId, true);
        }
        
        const fbMsg = document.getElementById('crop-feedback-status-msg');
        if (fbMsg) {
            fbMsg.textContent = '✓ Catatan ketidaksesuaian berhasil direkap ke Observasi Lapangan.';
            fbMsg.className = 'text-[10px] text-amber-700 font-bold';
            fbMsg.classList.remove('hidden');
        }

        renderCropsAndActivities();
        renderDashboard();
    } catch (err) {
        console.error('Error submitGrowthFeedback:', err);
        showToast('Gagal mengirim masukan: ' + (err.message || ''), 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i data-lucide="send" class="w-4 h-4"></i><span>Kirim Masukan</span>`;
            if (window.lucide) lucide.createIcons();
        }
    }
}

window.openGrowthObservationModal = openGrowthObservationModal;
window.saveGrowthObservation = saveGrowthObservation;
window.deleteGrowthObservation = deleteGrowthObservation;
window.submitAccurateFeedback = submitAccurateFeedback;
window.openGrowthFeedbackModal = openGrowthFeedbackModal;
window.submitGrowthFeedback = submitGrowthFeedback;

function applyCareInstructionToActivity() {
    if (!currentDetailCropId) return;
    const crop = window.db.getCropById(currentDetailCropId);
    if (!crop) return;

    const ageInfo = window.db.calculateCropAge(crop);
    closeModal('modal-crop-detail');

    openNewActivityModal(crop.id);

    // Otomatis terapkan instruksi ke formulir aktivitas
    const typeSelect = document.getElementById('act-type');
    const titleInput = document.getElementById('act-title');
    const descInput = document.getElementById('act-desc');

    if (typeSelect && ageInfo.careType) {
        const opts = Array.from(typeSelect.options);
        const match = opts.find(o => o.value.toLowerCase().includes(ageInfo.careType.toLowerCase()));
        if (match) typeSelect.value = match.value;
    }

    if (titleInput) {
        titleInput.value = `Perawatan ${crop.commodity} Umur ${ageInfo.activeAge} ${ageInfo.activeUnit} (${ageInfo.phaseShort})`;
    }
    if (descInput) {
        descInput.value = `Instruksi terjadwal (${ageInfo.activeAge} ${ageInfo.activeUnit}): ${ageInfo.currentRecommendations || ageInfo.careInstruction}`;
    }

    showToast(`Instruksi perawatan umur ${ageInfo.activeAge} ${ageInfo.activeUnit} diterapkan ke formulir.`, 'info');
}

// ====================================================
// METODE TANAM CERDAS (Point 2: Nursery vs Direct)
// ====================================================
function onCropPlantingMethodChange(method) {
    const seedingBox = document.getElementById('crop-seeding-box');
    const transplantBox = document.getElementById('crop-transplant-box');
    const transplantTitle = document.getElementById('crop-transplant-title');
    const transplantHint = document.getElementById('crop-transplant-hint');
    const seedingInput = document.getElementById('crop-seeding-date');
    const transplantInput = document.getElementById('crop-transplant-date');
    const methodBadge = document.getElementById('crop-method-desc-badge');
    const methodHint = document.getElementById('crop-method-hint');

    const isDirect = (method === 'direct_sowing' || method === 'direct_planting');

    if (isDirect) {
        if (seedingBox) seedingBox.classList.add('hidden');
        if (seedingInput) {
            seedingInput.removeAttribute('required');
            seedingInput.value = '';
        }
        if (transplantBox) transplantBox.classList.remove('hidden');
        if (transplantTitle) {
            transplantTitle.textContent = method === 'direct_sowing'
                ? 'Tanggal Tanam Benih (Direct Sowing) *'
                : 'Tanggal Tanam Bibit/Stek (Direct Planting) *';
        }
        if (transplantHint) {
            transplantHint.textContent = 'Tanpa persemaian. Umur dihitung langsung sebagai HST sejak tanggal tanam ini.';
        }
        if (transplantInput) {
            transplantInput.setAttribute('required', 'true');
            if (!transplantInput.value) {
                transplantInput.value = new Date().toISOString().slice(0, 10);
            }
        }
        if (methodBadge) {
            methodBadge.textContent = method === 'direct_sowing' ? 'Tanam Biji Langsung (HST)' : 'Tanam Bibit/Stek Langsung (HST)';
            methodBadge.className = 'text-[10px] text-teal-800 font-bold bg-teal-100 px-2 py-0.5 rounded-full border border-teal-200';
        }
        if (methodHint) {
            methodHint.textContent = 'Tanaman tidak memiliki fase persemaian. Umur utama adalah HST sejak hari tanam.';
        }
    } else {
        // Nursery transplant
        if (seedingBox) seedingBox.classList.remove('hidden');
        if (seedingInput) {
            seedingInput.setAttribute('required', 'true');
            if (!seedingInput.value) {
                seedingInput.value = new Date().toISOString().slice(0, 10);
            }
        }
        if (transplantTitle) transplantTitle.textContent = 'Tanggal Pindah Tanam';
        if (transplantHint) {
            transplantHint.textContent = 'Kosongkan jika masih di persemaian. 0 HST dimulai saat bibit ditanam ke bedengan.';
        }
        if (transplantInput) transplantInput.removeAttribute('required');
        if (methodBadge) {
            methodBadge.textContent = 'Semai → Pindah Tanam (HSS & HST)';
            methodBadge.className = 'text-[10px] text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200';
        }
        if (methodHint) {
            methodHint.textContent = 'Bibit disemai terlebih dahulu (HSS), kemudian dipindahkan ke bedengan lahan (HST).';
        }
    }

    onCropDateOrAgeChange('method');
}
window.onCropPlantingMethodChange = onCropPlantingMethodChange;

function onCropCommodityFormChange(commodityName) {
    // Saran otomatis metode tanam cerdas sesuai komoditas
    if (window.SmartCropEngine) {
        const defMethod = window.SmartCropEngine.getDefaultPlantingMethod(commodityName);
        const methodSelect = document.getElementById('crop-planting-method');
        if (methodSelect && defMethod) {
            methodSelect.value = defMethod;
            onCropPlantingMethodChange(defMethod);
        }
    }
    onCropDateOrAgeChange('commodity');
}
window.onCropCommodityFormChange = onCropCommodityFormChange;

function onCropDateOrAgeChange(trigger) {
    const methodSelect = document.getElementById('crop-planting-method');
    const plantingMethod = methodSelect ? methodSelect.value : 'nursery_transplant';
    const isDirect = (plantingMethod === 'direct_sowing' || plantingMethod === 'direct_planting');

    const seedingDateInput = document.getElementById('crop-seeding-date');
    const transplantDateInput = document.getElementById('crop-transplant-date');
    const plantDateInput = document.getElementById('crop-plant-date');
    const ageInput = document.getElementById('crop-age-days');
    const stageSelect = document.getElementById('crop-stage');
    const phasePreview = document.getElementById('crop-form-detected-phase');
    const ageBadge = document.getElementById('crop-form-age-badge');
    const careHint = document.getElementById('crop-form-care-hint');
    const alertBox = document.getElementById('crop-form-validation-alert');
    const alertMsg = document.getElementById('crop-form-validation-msg');
    const hssBadge = document.getElementById('crop-hss-live-badge');
    const hstBadge = document.getElementById('crop-hst-live-badge');

    const seedingDate = isDirect ? '' : (seedingDateInput ? seedingDateInput.value : '');
    const transplantDate = transplantDateInput ? transplantDateInput.value.trim() : '';

    // Validasi Tanggal (jika nursery_transplant):
    // Tanggal pindah tanam tidak boleh lebih awal daripada tanggal semai.
    let isValid = true;
    if (!isDirect && seedingDate && transplantDate) {
        const diff = window.calculateDayDifference(seedingDate, transplantDate);
        if (diff < 0) {
            isValid = false;
            if (alertBox) alertBox.classList.remove('hidden');
            if (alertMsg) alertMsg.textContent = 'Tanggal pindah tanam tidak boleh lebih awal daripada tanggal semai!';
        } else {
            if (alertBox) alertBox.classList.add('hidden');
        }
    } else {
        if (alertBox) alertBox.classList.add('hidden');
    }

    const breakdown = window.db.calculateAgeBreakdown(seedingDate, transplantDate, null, plantingMethod, transplantDate || seedingDate);

    if (hssBadge) {
        if (isDirect) {
            hssBadge.textContent = 'Tidak Ada (Tanam Langsung)';
        } else {
            hssBadge.textContent = `${breakdown.hss} HSS`;
        }
    }
    if (hstBadge) {
        if (isDirect) {
            hstBadge.textContent = `${breakdown.hst} HST`;
            hstBadge.className = 'text-[10px] text-teal-900 font-black bg-teal-100 px-2 py-0.5 rounded-full border border-teal-200';
        } else if (breakdown.isTransplanted) {
            hstBadge.textContent = `${breakdown.hst} HST`;
            hstBadge.className = 'text-[10px] text-blue-900 font-black bg-blue-100 px-2 py-0.5 rounded-full border border-blue-200';
        } else {
            hstBadge.textContent = 'Belum Tanam';
            hstBadge.className = 'text-[10px] text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200';
        }
    }

    const commInput = document.getElementById('crop-commodity');
    const selectedComm = commInput ? commInput.value : 'Cabai Rawit';

    const dummyCrop = {
        commodity: selectedComm,
        plantingMethod,
        planting_method: plantingMethod,
        seedingDate: isDirect ? null : (seedingDate || null),
        transplantDate: isDirect ? null : (transplantDate || null),
        plantDate: transplantDate || seedingDate || new Date().toISOString().slice(0, 10),
        estHarvestDate: document.getElementById('crop-harvest-date')?.value
    };

    const ageInfo = window.db.calculateCropAge(dummyCrop);

    if (plantDateInput) {
        plantDateInput.value = transplantDate || seedingDate || new Date().toISOString().slice(0, 10);
    }
    if (ageInput) {
        ageInput.value = ageInfo.activeAge;
    }

    if (phasePreview) {
        phasePreview.textContent = `Fase: ${ageInfo.phase}`;
    }
    if (ageBadge) {
        if (isDirect) {
            ageBadge.textContent = `${breakdown.hst} HST (Tanam Langsung di Lahan)`;
            ageBadge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-100 text-teal-900';
        } else if (breakdown.isTransplanted) {
            ageBadge.textContent = `${breakdown.hst} HST • ${breakdown.hss} HSS sejak semai`;
            ageBadge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800';
        } else {
            ageBadge.textContent = `${breakdown.hss} HSS (Persemaian)`;
            ageBadge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800';
        }
    }
    if (careHint) {
        careHint.textContent = `💡 Rekomendasi: "${ageInfo.currentRecommendations || ageInfo.careInstruction}"`;
    }

    // Update opsi stage
    if (stageSelect && ageInfo.phases) {
        const currentSelected = stageSelect.value;
        const maxHarvestLabel = ageInfo.commConfig?.harvest?.label || 'Panen';
        stageSelect.innerHTML = [
            ...ageInfo.phases.map(p => `<option value="${p.name}">${p.name} (${p.label})</option>`),
            `<option value="Panen (${maxHarvestLabel})">Panen (${maxHarvestLabel})</option>`
        ].join('');

        if (ageInfo.isHarvestReady) {
            stageSelect.value = `Panen (${maxHarvestLabel})`;
        } else if (ageInfo.phases.some(p => p.name === currentSelected)) {
            stageSelect.value = currentSelected;
        } else {
            stageSelect.value = ageInfo.phase;
        }
    }

    // Auto calculate target harvest date jika pemicu komoditas atau tanggal tanam
    if (trigger === 'commodity' || trigger === 'seeding' || trigger === 'transplant' || trigger === 'init' || trigger === 'method') {
        const harvestInput = document.getElementById('crop-harvest-date');
        const commConfig = ageInfo.commConfig;
        if (harvestInput && commConfig && commConfig.harvest) {
            const baseHarvestDateStr = isDirect ? transplantDate : (breakdown.isTransplanted ? transplantDate : seedingDate);
            const p = window.parseDateParts(baseHarvestDateStr || new Date().toISOString().slice(0, 10));
            if (p) {
                const extraNursery = isDirect ? 0 : (breakdown.isTransplanted ? 0 : 25);
                const targetDays = (commConfig.harvest.targetDays || 110) + extraNursery;
                const harvestUtc = Date.UTC(p.year, p.month, p.day) + targetDays * 86400000;
                const hDate = new Date(harvestUtc);
                harvestInput.value = `${hDate.getUTCFullYear()}-${String(hDate.getUTCMonth() + 1).padStart(2, '0')}-${String(hDate.getUTCDate()).padStart(2, '0')}`;
            }
        }
    }

    return isValid;
}

// ----------------------------------------------------
// 4. MODUL INVENTARIS & SAPROTAN
// ----------------------------------------------------
function renderInventory() {
    const inventory = window.db.getInventory();
    const container = document.getElementById('inventory-table-body');
    const categoryFilter = document.getElementById('filter-inventory-cat');
    const searchInput = document.getElementById('search-inventory');

    if (!container) return;

    const filterVal = categoryFilter ? categoryFilter.value : 'all';
    const query = searchInput ? (searchInput.value || '').toLowerCase().trim() : '';

    const filtered = inventory.filter(item => {
        const matchCat = filterVal === 'all' || item.category === filterVal;
        const matchSearch = (item.name || '').toLowerCase().includes(query) ||
                            (item.location || '').toLowerCase().includes(query) ||
                            (item.notes || '').toLowerCase().includes(query);
        return matchCat && matchSearch;
    });

    const totalItems = inventory.length;
    const lowStockCount = inventory.filter(i => Number(i.stock) <= Number(i.minStock)).length;
    const totalValue = inventory.reduce((acc, i) => acc + (Number(i.stock || 0) * Number(i.unitPrice || 0)), 0);

    const elTotal = document.getElementById('inv-stat-total');
    const elLow = document.getElementById('inv-stat-low');
    const elVal = document.getElementById('inv-stat-val');
    if (elTotal) elTotal.textContent = `${totalItems} Produk`;
    if (elLow) elLow.textContent = `${lowStockCount} Kritis/Menipis`;
    if (elVal) elVal.textContent = formatRupiah(totalValue);

    if (filtered.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="7" class="py-8 text-center text-slate-400 text-sm">Tidak ada barang inventaris sesuai filter.</td>
            </tr>
        `;
        return;
    }

    container.innerHTML = filtered.map(item => {
        const isLow = Number(item.stock) <= Number(item.minStock);
        const subtotal = Number(item.stock) * Number(item.unitPrice);

        return `
            <tr class="border-b border-slate-100 hover:bg-slate-50/70 transition">
                <td class="py-3 px-4">
                    <div class="text-xs font-bold text-slate-800">${item.name}</div>
                    <div class="text-[11px] text-slate-400">${item.location || '-'}</div>
                </td>
                <td class="py-3 px-4">
                    <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        ${item.category}
                    </span>
                </td>
                <td class="py-3 px-4">
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-bold ${isLow ? 'text-rose-600' : 'text-slate-800'}">
                            ${item.stock} ${item.unit}
                        </span>
                        ${isLow ? `<span class="badge-low-stock text-[10px] font-bold px-1.5 py-0.5 rounded">Menipis!</span>` : ''}
                    </div>
                    <span class="text-[10px] text-slate-400">Min: ${item.minStock} ${item.unit}</span>
                </td>
                <td class="py-3 px-4 text-xs text-slate-700 font-medium">
                    ${formatRupiah(item.unitPrice)} / ${item.unit}
                </td>
                <td class="py-3 px-4 text-xs font-bold text-emerald-800">
                    ${formatRupiah(subtotal)}
                </td>
                <td class="py-3 px-4 text-xs">
                    <div class="flex items-center gap-1.5">
                        <button onclick="adjustStockModal('${item.id}', -1)" class="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold flex items-center justify-center transition" title="Gunakan / Kurang Stok">
                            -
                        </button>
                        <button onclick="adjustStockModal('${item.id}', 1)" class="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center transition" title="Tambah / Restock">
                            +
                        </button>
                    </div>
                </td>
                <td class="py-3 px-4 text-right text-xs whitespace-nowrap">
                    <button onclick="editInventory('${item.id}')" class="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition" title="Edit">
                        <i data-lucide="edit-3" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deleteInventory('${item.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Hapus">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    lucide.createIcons();
}

// ----------------------------------------------------
// 5. MODUL KEUANGAN & PANEN (AKUN -> LAHAN -> SIKLUS -> TRANSAKSI)
// ----------------------------------------------------
function populateFinanceFilters() {
    if (!window.db) return;
    const plots = window.db.getPlots() || [];
    const crops = window.db.getCrops() || [];

    const lahanSelect = document.getElementById('filter-finance-lahan');
    const plotSelect = document.getElementById('filter-finance-plot');
    const cropSelect = document.getElementById('filter-finance-crop');

    const currentLahan = lahanSelect ? lahanSelect.value : 'all';
    const currentPlot = plotSelect ? plotSelect.value : 'all';
    const currentCrop = cropSelect ? cropSelect.value : 'all';

    // 1. Populasi Lahan (Lokasi / Sentra)
    if (lahanSelect) {
        const locations = [];
        plots.forEach(p => {
            const loc = (p.location || '').trim();
            if (loc && !locations.includes(loc)) locations.push(loc);
        });
        lahanSelect.innerHTML = `<option value="all">Semua Lahan</option>` +
            locations.map(loc => `<option value="${loc}">${loc}</option>`).join('');
        if (currentLahan && (currentLahan === 'all' || locations.includes(currentLahan))) {
            lahanSelect.value = currentLahan;
        } else {
            lahanSelect.value = 'all';
        }
    }

    // 2. Populasi Blok
    if (plotSelect) {
        const activeLahan = lahanSelect ? lahanSelect.value : 'all';
        const filteredPlots = (activeLahan && activeLahan !== 'all')
            ? plots.filter(p => (p.location || '').trim() === activeLahan)
            : plots;

        plotSelect.innerHTML = `<option value="all">Semua Blok</option>` +
            `<option value="general">Umum (Tanpa Blok)</option>` +
            filteredPlots.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

        if (currentPlot && (currentPlot === 'all' || currentPlot === 'general' || filteredPlots.some(p => p.id === currentPlot))) {
            plotSelect.value = currentPlot;
        } else {
            plotSelect.value = 'all';
        }
    }

    // 3. Populasi Tanaman / Batch (Dinamis berjenjang sesuai Blok)
    const activePlot = plotSelect ? plotSelect.value : 'all';
    if (cropSelect) {
        let matchingCrops = crops;
        if (activePlot && activePlot !== 'all') {
            if (activePlot === 'general') {
                matchingCrops = [];
            } else {
                matchingCrops = crops.filter(c => c.plotId === activePlot);
            }
        }

        cropSelect.innerHTML = `<option value="all">Semua Tanaman/Batch</option>` +
            `<option value="general">Umum (Tanpa Tanaman)</option>` +
            matchingCrops.map(c => {
                const plot = plots.find(p => p.id === c.plotId);
                const plotLabel = plot ? ` [${plot.name}]` : '';
                return `<option value="${c.id}">${c.commodity} — ${c.cycleCode || 'Siklus'}${plotLabel}</option>`;
            }).join('');

        if (currentCrop && (currentCrop === 'all' || currentCrop === 'general' || matchingCrops.some(c => c.id === currentCrop))) {
            cropSelect.value = currentCrop;
        } else {
            cropSelect.value = 'all';
        }
    }
}
window.populateFinanceFilters = populateFinanceFilters;

function onFinanceLahanFilterChange(lahanVal) {
    populateFinanceFilters();
    renderFinance();
}
window.onFinanceLahanFilterChange = onFinanceLahanFilterChange;

function onFinancePlotFilterChange(plotVal) {
    if (!window.db) return;
    const crops = window.db.getCrops() || [];
    const plots = window.db.getPlots() || [];
    const cropSelect = document.getElementById('filter-finance-crop');

    if (cropSelect) {
        let matchingCrops = crops;
        if (plotVal && plotVal !== 'all') {
            if (plotVal === 'general') {
                matchingCrops = [];
            } else {
                matchingCrops = crops.filter(c => c.plotId === plotVal);
            }
        }

        const currentCrop = cropSelect.value;
        cropSelect.innerHTML = `<option value="all">Semua Tanaman/Batch</option>` +
            `<option value="general">Umum (Tanpa Tanaman)</option>` +
            matchingCrops.map(c => {
                const plot = plots.find(p => p.id === c.plotId);
                const plotLabel = plot ? ` [${plot.name}]` : '';
                return `<option value="${c.id}">${c.commodity} — ${c.cycleCode || 'Siklus'}${plotLabel}</option>`;
            }).join('');

        if (currentCrop && (currentCrop === 'all' || currentCrop === 'general' || matchingCrops.some(c => c.id === currentCrop))) {
            cropSelect.value = currentCrop;
        } else {
            cropSelect.value = 'all';
        }
    }

    renderFinance();
}
window.onFinancePlotFilterChange = onFinancePlotFilterChange;

function resetFinanceFilters() {
    const lahanSelect = document.getElementById('filter-finance-lahan');
    const plotSelect = document.getElementById('filter-finance-plot');
    const cropSelect = document.getElementById('filter-finance-crop');
    const typeSelect = document.getElementById('filter-finance-type');

    if (lahanSelect) lahanSelect.value = 'all';
    if (plotSelect) plotSelect.value = 'all';
    if (cropSelect) cropSelect.value = 'all';
    if (typeSelect) typeSelect.value = 'all';

    populateFinanceFilters();
    renderFinance();
    showToast('Filter keuangan telah direset ke seluruh data.', 'info');
}
window.resetFinanceFilters = resetFinanceFilters;

function renderFinance() {
    if (!window.db) return;
    const finance = window.db.getFinance();
    const plots = window.db.getPlots();
    const crops = window.db.getCrops();
    const container = document.getElementById('finance-table-body');
    const filterLahan = document.getElementById('filter-finance-lahan');
    const filterPlot = document.getElementById('filter-finance-plot');
    const filterCrop = document.getElementById('filter-finance-crop');
    const filterType = document.getElementById('filter-finance-type');

    if (!container) return;

    const lahanVal = filterLahan ? filterLahan.value : 'all';
    const plotVal = filterPlot ? filterPlot.value : 'all';
    const cropVal = filterCrop ? filterCrop.value : 'all';
    const typeVal = filterType ? filterType.value : 'all';

    const filtered = finance.filter(item => {
        // 1. Filter Tipe Transaksi
        if (typeVal !== 'all' && item.type !== typeVal) return false;

        // 2. Filter Lahan (Lokasi)
        if (lahanVal !== 'all') {
            const itemPlotId = item.plot_id || item.plotId;
            const plot = plots.find(p => p.id === itemPlotId);
            const loc = (plot?.location || plot?.name || '').trim();
            if (loc !== lahanVal && plot?.id !== lahanVal) return false;
        }

        // 3. Filter Blok
        if (plotVal !== 'all') {
            const itemPlotId = item.plot_id || item.plotId;
            if (plotVal === 'general') {
                if (itemPlotId) return false;
            } else {
                if (String(itemPlotId) !== String(plotVal)) return false;
            }
        }

        // 4. Filter Tanaman / Batch
        if (cropVal !== 'all') {
            const itemCropId = item.crop_id || item.cropId;
            if (cropVal === 'general') {
                if (itemCropId) return false;
            } else {
                if (String(itemCropId) !== String(cropVal)) return false;
            }
        }

        return true;
    });

    // 2. Kartu Ringkasan Keuangan (mengikuti filter aktif per Requirement 2 & 15)
    const totalIncome = filtered.filter(f => f.type === 'income').reduce((acc, f) => acc + Number(f.amount || 0), 0);
    const totalExpense = filtered.filter(f => f.type === 'expense').reduce((acc, f) => acc + Number(f.amount || 0), 0);
    const netCashflow = totalIncome - totalExpense;

    const elInc = document.getElementById('fin-total-income');
    const elExp = document.getElementById('fin-total-expense');
    const elNet = document.getElementById('fin-net-profit');

    if (elInc) elInc.textContent = formatRupiah(totalIncome);
    if (elExp) elExp.textContent = formatRupiah(totalExpense);
    if (elNet) {
        elNet.textContent = (netCashflow < 0 ? '-' : '') + formatRupiah(Math.abs(netCashflow));
        if (netCashflow > 0) {
            elNet.className = 'text-2xl font-extrabold text-emerald-700 mt-2';
        } else if (netCashflow < 0) {
            elNet.className = 'text-2xl font-extrabold text-rose-600 mt-2';
        } else {
            elNet.className = 'text-2xl font-extrabold text-slate-800 mt-2';
        }
    }

    // 8. Render Tabel Transaksi (8 Kolom: Tanggal, Tipe, Uraian, Kategori, Lahan/Blok, Tanaman/Batch, Nominal, Aksi)
    if (filtered.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="8" class="py-12 text-center text-slate-400 text-xs sm:text-sm">
                    <div class="flex flex-col items-center justify-center gap-2">
                        <i data-lucide="receipt" class="w-8 h-8 text-slate-300"></i>
                        <span>Belum ada transaksi keuangan yang sesuai dengan filter.</span>
                    </div>
                </td>
            </tr>
        `;
        if (window.lucide) lucide.createIcons();
        return;
    }

    container.innerHTML = filtered.map(item => {
        const itemPlotId = item.plot_id || item.plotId;
        const itemCropId = item.crop_id || item.cropId;
        const plot = plots.find(p => p.id === itemPlotId);
        const crop = crops.find(c => c.id === itemCropId);
        const isIncome = item.type === 'income';

        // Lahan / Blok label
        let plotBadgeHTML = '';
        if (plot) {
            plotBadgeHTML = `
                <div class="text-xs font-bold text-slate-800">${plot.name}</div>
                ${plot.location ? `<div class="text-[10px] text-slate-400 truncate max-w-[140px]">${plot.location}</div>` : ''}
            `;
        } else {
            plotBadgeHTML = `
                <span class="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                    Umum / Bebas Lahan
                </span>
            `;
        }

        // Tanaman / Batch label
        let cropBadgeHTML = '';
        if (crop) {
            cropBadgeHTML = `
                <div class="text-xs font-bold text-emerald-800">${crop.commodity}</div>
                <div class="text-[10px] text-slate-500 font-medium truncate max-w-[140px]">${crop.cycleCode || 'Siklus'} • ${crop.variety || '-'}</div>
            `;
        } else {
            cropBadgeHTML = `
                <span class="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                    Umum / Bebas Tanaman
                </span>
            `;
        }

        return `
            <tr class="border-b border-slate-100 hover:bg-slate-50/70 transition">
                <td class="py-3 px-4 text-xs font-medium text-slate-600 whitespace-nowrap">${formatDateIndo(item.date)}</td>
                <td class="py-3 px-4 text-xs whitespace-nowrap">
                    <span class="px-2.5 py-0.5 rounded-full font-bold text-[10px] ${isIncome ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'}">
                        ${isIncome ? 'Pemasukan (+)' : 'Pengeluaran (-)'}
                    </span>
                </td>
                <td class="py-3 px-4">
                    <div class="text-xs font-bold text-slate-800">${item.title}</div>
                    ${item.notes ? `<div class="text-[10px] text-slate-400 truncate max-w-xs mt-0.5">${item.notes}</div>` : ''}
                </td>
                <td class="py-3 px-4 text-xs whitespace-nowrap">
                    <span class="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-medium text-[11px]">
                        ${item.category}
                    </span>
                </td>
                <td class="py-3 px-4 whitespace-nowrap">${plotBadgeHTML}</td>
                <td class="py-3 px-4 whitespace-nowrap">${cropBadgeHTML}</td>
                <td class="py-3 px-4 text-xs font-black whitespace-nowrap ${isIncome ? 'text-emerald-700' : 'text-rose-600'}">
                    ${isIncome ? '+' : '-'}${formatRupiah(item.amount)}
                </td>
                <td class="py-3 px-4 text-right whitespace-nowrap">
                    <button type="button" onclick="deleteFinance('${item.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Hapus Transaksi">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

// ----------------------------------------------------
// 6. MODUL PUSAT LAPORAN & ANALITIK USAHA TANI
// ----------------------------------------------------
function renderReports() {
    if (window.FarmAnalyticsReport && typeof window.FarmAnalyticsReport.renderReports === 'function') {
        return window.FarmAnalyticsReport.renderReports();
    }
}

// ----------------------------------------------------
// MODAL MANAGEMENT & FORMS
// ----------------------------------------------------
function setupModals() {
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });

    populatePlotSelects();
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        populatePlotSelects();
        modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
        lucide.createIcons();
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    }
}

function populatePlotSelects() {
    const plots = window.db.getPlots();
    const crops = window.db.getCrops();

    const plotSelects = ['crop-plot-id', 'finance-plot-id'];
    plotSelects.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const currentVal = el.value;
            const options = plots.map(p => `<option value="${p.id}">${p.name} (${p.area} m²)</option>`).join('');
            el.innerHTML = (id === 'finance-plot-id' ? `<option value="">Umum / Tidak terkait lahan</option>` : '') + options;
            if (currentVal && plots.some(p => p.id === currentVal)) {
                el.value = currentVal;
            }
        }
    });

    // Sinkronkan pilihan siklus tanaman pada modal keuangan sesuai blok lahan aktif
    const finPlotEl = document.getElementById('finance-plot-id');
    if (finPlotEl && typeof updateFinanceModalCropOptions === 'function') {
        updateFinanceModalCropOptions(finPlotEl.value);
    }

    const actCropSelect = document.getElementById('act-crop-id');
    if (actCropSelect) {
        const currentVal = actCropSelect.value;
        const options = crops.map(c => {
            const plot = plots.find(p => p.id === c.plotId);
            return `<option value="${c.id}">${c.commodity} (${c.variety || '-'}) - ${plot ? plot.name : ''}</option>`;
        }).join('');
        actCropSelect.innerHTML = options;
        if (currentVal && crops.some(c => c.id === currentVal)) {
            actCropSelect.value = currentVal;
        }
    }
}

function onCropPlotSelectChange(plotId) {
    if (!window.db) return;
    const plot = window.db.getPlotById(plotId);
    if (!plot) return;
    const petakNameEl = document.getElementById('crop-petak-name');
    if (petakNameEl) {
        petakNameEl.value = plot.name; // Sesuai nama blok aja!
    }
}
window.onCropPlotSelectChange = onCropPlotSelectChange;

// Dedicated Clean Modal Openers
function openNewPlotModal() {
    const form = document.getElementById('form-plot');
    if (form) form.reset();
    document.getElementById('plot-form-id').value = '';
    const title = document.getElementById('plot-modal-title');
    if (title) title.textContent = 'Tambah Blok Lahan Baru';
    openModal('modal-plot');
}

function openNewCropModal(defaultPlotId = null) {
    const plots = window.db.getPlots();
    if (plots.length === 0) {
        showToast('Harap buat blok lahan terlebih dahulu!', 'error');
        openNewPlotModal();
        return;
    }

    const form = document.getElementById('form-crop');
    if (form) form.reset();
    document.getElementById('crop-form-id').value = '';

    const crops = window.db.getCrops();
    const nextNum = crops.length + 1;
    const cycleCodeEl = document.getElementById('crop-cycle-code');
    if (cycleCodeEl) cycleCodeEl.value = `Siklus #${String(nextNum).padStart(3, '0')}`;

    // Populasi opsi blok lahan dan set petak name sesuai nama blok
    const plotSelect = document.getElementById('crop-plot-id');
    if (plotSelect) {
        plotSelect.innerHTML = plots.map(p => `<option value="${p.id}">${p.name} (${p.soilType || 'Lahan'})</option>`).join('');
        if (defaultPlotId) {
            plotSelect.value = defaultPlotId;
        }
    }
    const currentPlotId = defaultPlotId || (plotSelect ? plotSelect.value : plots[0]?.id);
    const initialPlot = plots.find(p => p.id === currentPlotId) || plots[0];
    const petakNameEl = document.getElementById('crop-petak-name');
    if (petakNameEl && initialPlot) {
        petakNameEl.value = initialPlot.name; // Sesuai nama blok aja!
    }

    // Populate dropdown komoditas HANYA dengan 18 Master Komoditas Permanen
    const commSelect = document.getElementById('crop-commodity');
    if (commSelect) {
        const names = window.MASTER_COMMODITY_NAMES || [];
        commSelect.innerHTML = names.map(n => `<option value="${n}">${n}</option>`).join('');
        commSelect.value = 'Cabai Rawit';
    }

    // Set metode tanam cerdas sesuai karakteristik komoditas default
    const defMethod = window.SmartCropEngine ? window.SmartCropEngine.getDefaultPlantingMethod('Cabai Rawit') : 'nursery_transplant';
    const methodSelect = document.getElementById('crop-planting-method');
    if (methodSelect) methodSelect.value = defMethod;
    if (typeof onCropPlantingMethodChange === 'function') {
        onCropPlantingMethodChange(defMethod);
    }
    
    // Inisialisasi tanggal semai = hari ini, tanggal pindah tanam kosong (fase persemaian)
    const today = new Date().toISOString().slice(0, 10);
    const seedingDateEl = document.getElementById('crop-seeding-date');
    if (seedingDateEl) seedingDateEl.value = today;

    const transplantDateEl = document.getElementById('crop-transplant-date');
    if (transplantDateEl) transplantDateEl.value = '';

    const plantDateEl = document.getElementById('crop-plant-date');
    if (plantDateEl) plantDateEl.value = today;

    const commConfig = (window.MASTER_COMMODITIES && window.MASTER_COMMODITIES['Cabai Rawit']) || { harvest: { targetDays: 110 } };
    const estHarvest = new Date(Date.now() + (commConfig.harvest.targetDays + 25) * 86400000).toISOString().slice(0, 10);
    const harvestDateEl = document.getElementById('crop-harvest-date');
    if (harvestDateEl) harvestDateEl.value = estHarvest;

    const progressEl = document.getElementById('crop-progress');
    if (progressEl) progressEl.value = '1';

    onCropDateOrAgeChange('init');
    openModal('modal-crop');

    if (defaultPlotId) {
        const select = document.getElementById('crop-plot-id');
        if (select) select.value = defaultPlotId;
    }
}

function openNewActivityModal(defaultCropId = null) {
    const crops = window.db.getCrops();
    if (crops.length === 0) {
        showToast('Harap daftarkan siklus tanam terlebih dahulu!', 'error');
        openNewCropModal();
        return;
    }

    const form = document.getElementById('form-activity');
    if (form) form.reset();

    const today = new Date().toISOString().slice(0, 10);
    const dateEl = document.getElementById('act-date');
    if (dateEl) dateEl.value = today;

    openModal('modal-activity');

    if (defaultCropId) {
        const select = document.getElementById('act-crop-id');
        if (select) select.value = defaultCropId;
    }
}

function openNewInventoryModal() {
    const form = document.getElementById('form-inventory');
    if (form) form.reset();
    document.getElementById('inv-form-id').value = '';
    openModal('modal-inventory');
}

function updateFinanceModalCropOptions(plotId, selectedCropId = null) {
    const cropSelect = document.getElementById('finance-crop-id');
    if (!cropSelect || !window.db) return;

    if (!plotId || plotId === '' || plotId === 'all' || plotId === 'general') {
        cropSelect.innerHTML = `<option value="">Umum / Tidak terkait tanaman</option>`;
        cropSelect.value = '';
        return;
    }

    const crops = window.db.getCrops() || [];
    const matchingCrops = crops.filter(c => String(c.plotId) === String(plotId));

    if (matchingCrops.length === 0) {
        cropSelect.innerHTML = `<option value="">Umum / Tidak terkait tanaman (Belum ada siklus di blok ini)</option>`;
        cropSelect.value = '';
        return;
    }

    cropSelect.innerHTML = `<option value="">Umum / Tidak terkait tanaman</option>` +
        matchingCrops.map(c => `<option value="${c.id}">${c.commodity} — ${c.cycleCode || 'Siklus'}${c.variety ? ' (' + c.variety + ')' : ''}</option>`).join('');

    if (selectedCropId && matchingCrops.some(c => String(c.id) === String(selectedCropId))) {
        cropSelect.value = selectedCropId;
    } else {
        cropSelect.value = '';
    }
}
window.updateFinanceModalCropOptions = updateFinanceModalCropOptions;

function onFinancePlotFormChange(plotId) {
    updateFinanceModalCropOptions(plotId);
}
window.onFinancePlotFormChange = onFinancePlotFormChange;

function onFinanceCropFormChange(cropId) {
    if (!cropId || !window.db) return;
    const crop = window.db.getCropById(cropId);
    if (crop && crop.plotId) {
        const plotSelect = document.getElementById('finance-plot-id');
        if (plotSelect && plotSelect.value !== crop.plotId) {
            plotSelect.value = crop.plotId;
        }
    }
}
window.onFinanceCropFormChange = onFinanceCropFormChange;

function openNewFinanceModal(defaultPlotId = null, defaultCropId = null, defaultType = 'expense') {
    const form = document.getElementById('form-finance');
    if (form) form.reset();

    const today = new Date().toISOString().slice(0, 10);
    const dateEl = document.getElementById('fin-date');
    if (dateEl) dateEl.value = today;

    const typeEl = document.getElementById('fin-type');
    if (typeEl && defaultType) typeEl.value = defaultType;

    // Populasi dropdown Lahan / Blok
    const plots = window.db ? window.db.getPlots() : [];
    const plotSelect = document.getElementById('finance-plot-id');
    if (plotSelect) {
        plotSelect.innerHTML = `<option value="">Umum / Tidak terkait lahan</option>` +
            plots.map(p => `<option value="${p.id}">${p.name} (${p.location ? p.location + ' • ' : ''}${p.area} m²)</option>`).join('');
        
        let targetPlotId = defaultPlotId;
        if (!targetPlotId && defaultCropId && window.db) {
            const c = window.db.getCropById(defaultCropId);
            if (c) targetPlotId = c.plotId;
        }
        plotSelect.value = targetPlotId || '';
    }

    // Populasi dropdown Tanaman / Batch (dinamis berjenjang sesuai blok yang dipilih)
    const activePlotId = plotSelect ? plotSelect.value : defaultPlotId;
    updateFinanceModalCropOptions(activePlotId, defaultCropId);

    openModal('modal-finance');
}
window.openNewFinanceModal = openNewFinanceModal;

function openNewFinanceModalForCurrentCrop() {
    if (!currentDetailCropId || !window.db) return;
    const crop = window.db.getCropById(currentDetailCropId);
    if (!crop) return;
    openNewFinanceModal(crop.plotId, crop.id, 'expense');
}
window.openNewFinanceModalForCurrentCrop = openNewFinanceModalForCurrentCrop;

function renderCropDetailFinanceSummary(cropId) {
    if (!window.db || !cropId) return;
    const summary = window.db.getCropFinanceSummary(cropId);
    if (!summary) return;

    const elExpense = document.getElementById('crop-detail-fin-expense');
    const elIncome = document.getElementById('crop-detail-fin-income');
    const elNet = document.getElementById('crop-detail-fin-net');
    const elBadge = document.getElementById('crop-detail-fin-count-badge');
    const elPreview = document.getElementById('crop-detail-fin-transactions-preview');

    if (elExpense) elExpense.textContent = formatRupiah(summary.totalExpense);
    if (elIncome) elIncome.textContent = formatRupiah(summary.totalIncome);
    if (elNet) {
        const net = summary.netProfit;
        elNet.textContent = (net < 0 ? '-' : '') + formatRupiah(Math.abs(net));
        if (net > 0) {
            elNet.className = 'text-base sm:text-lg font-black text-emerald-700 mt-1';
        } else if (net < 0) {
            elNet.className = 'text-base sm:text-lg font-black text-rose-600 mt-1';
        } else {
            elNet.className = 'text-base sm:text-lg font-black text-slate-800 mt-1';
        }
    }

    if (elBadge) {
        elBadge.textContent = `${summary.transactions.length} Transaksi`;
    }

    if (elPreview) {
        if (summary.transactions.length === 0) {
            elPreview.innerHTML = `<p class="text-slate-400 text-[11px] text-center py-2">Belum ada transaksi tercatat untuk siklus ini.</p>`;
        } else {
            elPreview.innerHTML = summary.transactions.map(t => {
                const isInc = t.type === 'income';
                return `
                    <div class="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-[11px]">
                        <div class="min-w-0 pr-2">
                            <span class="font-bold text-slate-800 block truncate">${t.title}</span>
                            <span class="text-[10px] text-slate-400">${formatDateIndo(t.date)} • ${t.category}</span>
                        </div>
                        <span class="font-black shrink-0 ${isInc ? 'text-emerald-700' : 'text-rose-600'}">
                            ${isInc ? '+' : '-'}${formatRupiah(t.amount)}
                        </span>
                    </div>
                `;
            }).join('');
        }
    }
}
window.renderCropDetailFinanceSummary = renderCropDetailFinanceSummary;

// ----------------------------------------------------
// CRUD Actions: Lahan (Plots)
// ----------------------------------------------------
async function savePlotFromForm(e) {
    e.preventDefault();
    const id = document.getElementById('plot-form-id').value;
    const name = document.getElementById('plot-name').value.trim();
    const area = Number(document.getElementById('plot-area').value);
    const soilType = document.getElementById('plot-soil').value;
    const irrigationType = document.getElementById('plot-irrigation').value;
    const status = document.getElementById('plot-status').value;
    const location = document.getElementById('plot-location').value.trim();
    const notes = document.getElementById('plot-notes').value.trim();
    const submitBtn = e.target.querySelector('button[type="submit"]');

    if (!name || !area || isNaN(area)) {
        showToast('Harap isi nama lahan dan luas lahan!', 'error');
        return;
    }

    const plotData = {
        id: id || undefined,
        name,
        area,
        soilType,
        irrigationType,
        status,
        location,
        notes
    };

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="animate-spin mr-2">⏳</span> Menyimpan ke Supabase...`;
    }

    try {
        await window.db.savePlot(plotData);
        closeModal('modal-plot');
        renderPlots();
        renderDashboard();
        showToast(id ? 'Data lahan berhasil diperbarui di Supabase!' : 'Lahan baru berhasil ditambahkan ke Supabase!');
    } catch (err) {
        console.error('Error saat menyimpan lahan:', err);
        showToast('Gagal menyimpan lahan ke database: ' + (err.message || ''), 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i><span>Simpan Data Lahan</span>`;
            if (window.lucide) lucide.createIcons();
        }
    }
}

function editPlot(id) {
    const plot = window.db.getPlotById(id);
    if (!plot) return;

    document.getElementById('plot-form-id').value = plot.id;
    document.getElementById('plot-name').value = plot.name;
    document.getElementById('plot-area').value = plot.area;
    document.getElementById('plot-soil').value = plot.soilType || '';
    document.getElementById('plot-irrigation').value = plot.irrigationType || '';
    document.getElementById('plot-status').value = plot.status;
    document.getElementById('plot-location').value = plot.location || '';
    document.getElementById('plot-notes').value = plot.notes || '';

    const title = document.getElementById('plot-modal-title');
    if (title) title.textContent = 'Edit Data Blok Lahan';
    openModal('modal-plot');
}

function deletePlot(id) {
    showConfirmDialog(
        'Hapus Blok Lahan',
        'Yakin ingin menghapus blok lahan ini dari database Supabase? Data siklus tanam terkait akan terpengaruh.',
        async () => {
            try {
                await window.db.deletePlot(id);
                renderPlots();
                renderDashboard();
                showToast('Blok lahan berhasil dihapus dari Supabase!', 'info');
            } catch (err) {
                console.error('Error deletePlot:', err);
                showToast('Gagal menghapus lahan: ' + (err.message || ''), 'error');
            }
        },
        'Hapus Lahan',
        'trash-2',
        true
    );
}

// ----------------------------------------------------
// CRUD Actions: Siklus Tanam (Crops)
// ----------------------------------------------------
async function saveCropFromForm(e) {
    e.preventDefault();
    const id = document.getElementById('crop-form-id').value;
    const cycleCode = (document.getElementById('crop-cycle-code')?.value || '').trim();
    const petakName = (document.getElementById('crop-petak-name')?.value || '').trim();
    const plotId = document.getElementById('crop-plot-id').value;
    const rawCommodity = document.getElementById('crop-commodity').value.trim();
    const commodity = window.matchMasterCommodity ? window.matchMasterCommodity(rawCommodity) : rawCommodity;
    const variety = document.getElementById('crop-variety').value.trim();
    const jumlahTanaman = Number(document.getElementById('crop-plant-count')?.value || 0);
    const luasLahan = Number(document.getElementById('crop-area')?.value || 0);

    const methodSelect = document.getElementById('crop-planting-method');
    const plantingMethod = methodSelect ? methodSelect.value : (window.SmartCropEngine ? window.SmartCropEngine.getDefaultPlantingMethod(commodity) : 'nursery_transplant');
    const isDirect = (plantingMethod === 'direct_sowing' || plantingMethod === 'direct_planting');

    // Metode Tanam Cerdas (Point 2):
    // Jika tanam langsung: jangan pernah membuat tanggal semai, langsung tanggal tanam sebagai HST.
    const seedingDate = isDirect ? null : (document.getElementById('crop-seeding-date')?.value || '').trim();
    const transplantDate = isDirect ? null : ((document.getElementById('crop-transplant-date')?.value || '').trim() || null);
    const directPlantDate = isDirect ? (document.getElementById('crop-transplant-date')?.value || new Date().toISOString().slice(0, 10)) : null;
    const estHarvestDate = document.getElementById('crop-harvest-date').value;
    const targetYield = Number(document.getElementById('crop-target-yield').value);
    const stage = document.getElementById('crop-stage').value;
    const progress = Number(document.getElementById('crop-progress').value);
    const rawNotes = document.getElementById('crop-notes').value.trim();
    const submitBtn = e.target.querySelector('button[type="submit"]');

    if (!plotId) {
        showToast('Harap pilih blok lahan!', 'error');
        return;
    }

    if (!commodity || !estHarvestDate) {
        showToast('Lengkapi komoditas dan estimasi tanggal panen!', 'error');
        return;
    }

    if (!isDirect && !seedingDate) {
        showToast('Lengkapi tanggal semai untuk metode semai pindah tanam!', 'error');
        return;
    }

    if (isDirect && !directPlantDate) {
        showToast('Lengkapi tanggal tanam langsung di lahan!', 'error');
        return;
    }

    // Validasi Tanggal (jika nursery_transplant):
    // Tanggal pindah tanam tidak boleh lebih awal daripada tanggal semai
    if (!isDirect && seedingDate && transplantDate) {
        const diff = window.calculateDayDifference(seedingDate, transplantDate);
        if (diff < 0) {
            showToast('Tanggal pindah tanam tidak boleh lebih awal daripada tanggal semai!', 'error');
            const alertBox = document.getElementById('crop-form-validation-alert');
            if (alertBox) alertBox.classList.remove('hidden');
            return;
        }
    }

    const notes = window.embedAgroDatesInNotes ? window.embedAgroDatesInNotes(rawNotes, seedingDate, transplantDate, plantingMethod) : rawNotes;
    const plantDate = isDirect ? directPlantDate : (transplantDate || seedingDate);

    const cropData = {
        id: id || undefined,
        cycleCode: cycleCode || undefined,
        petakName: petakName || 'Petak Utama',
        plotId,
        commodity,
        variety,
        plantingMethod,
        planting_method: plantingMethod,
        jumlahTanaman: jumlahTanaman || undefined,
        luasLahan: luasLahan || undefined,
        seedingDate: isDirect ? null : seedingDate,
        seeding_date: isDirect ? null : seedingDate,
        transplantDate: isDirect ? null : transplantDate,
        transplant_date: isDirect ? null : transplantDate,
        plantDate,
        plant_date: plantDate,
        estHarvestDate,
        est_harvest_date: estHarvestDate,
        targetYield,
        stage,
        progress,
        status: progress >= 100 ? 'harvested' : 'growing',
        notes
    };

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="animate-spin mr-2">⏳</span> Menyimpan ke Supabase...`;
    }

    try {
        await window.db.saveCrop(cropData);

        const plot = window.db.getPlotById(plotId);
        if (plot && cropData.status === 'growing') {
            plot.status = 'active';
            await window.db.savePlot(plot).catch(() => {});
        }

        closeModal('modal-crop');
        renderCropsAndActivities();
        renderPlots();
        renderDashboard();
        populateAiInputs();
        runCoreAiEngine();
        showToast(id ? 'Siklus tanam berhasil diperbarui di Supabase!' : 'Siklus tanam baru berhasil disimpan ke Supabase!');
    } catch (err) {
        console.error('Error saat menyimpan siklus tanam:', err);
        showToast('Gagal menyimpan siklus tanam ke database: ' + (err.message || ''), 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i><span>Simpan Siklus Tanam</span>`;
            if (window.lucide) lucide.createIcons();
        }
    }
}

function editCrop(id) {
    const crop = window.db.getCropById(id);
    if (!crop) return;

    openModal('modal-crop');

    // Populate dropdown komoditas dengan 18 Master Komoditas Permanen
    const commSelect = document.getElementById('crop-commodity');
    if (commSelect) {
        const names = window.MASTER_COMMODITY_NAMES || [];
        commSelect.innerHTML = names.map(n => `<option value="${n}">${n}</option>`).join('');
        commSelect.value = window.matchMasterCommodity ? window.matchMasterCommodity(crop.commodity) : crop.commodity;
    }

    // Set metode tanam
    const plantingMethod = crop.plantingMethod || crop.planting_method || (window.SmartCropEngine ? window.SmartCropEngine.getDefaultPlantingMethod(crop.commodity) : 'nursery_transplant');
    const methodSelect = document.getElementById('crop-planting-method');
    if (methodSelect) methodSelect.value = plantingMethod;
    if (typeof onCropPlantingMethodChange === 'function') {
        onCropPlantingMethodChange(plantingMethod);
    }

    document.getElementById('crop-form-id').value = crop.id;
    const cycleCodeEl = document.getElementById('crop-cycle-code');
    if (cycleCodeEl) cycleCodeEl.value = crop.cycleCode || `Siklus #${crop.id}`;
    const petakNameEl = document.getElementById('crop-petak-name');
    if (petakNameEl) petakNameEl.value = crop.petakName || '';
    const plantCountEl = document.getElementById('crop-plant-count');
    if (plantCountEl) plantCountEl.value = crop.jumlahTanaman || '';
    const areaEl = document.getElementById('crop-area');
    if (areaEl) areaEl.value = crop.luasLahan || '';

    document.getElementById('crop-plot-id').value = crop.plotId;
    document.getElementById('crop-variety').value = crop.variety || '';

    // Pisahkan field Tanggal Semai & Tanggal Pindah Tanam (Requirement 5 & 11)
    const isDirect = (plantingMethod === 'direct_sowing' || plantingMethod === 'direct_planting');
    const seedingDate = isDirect ? '' : (crop.seedingDate || crop.seeding_date || '');
    const transplantDate = isDirect
        ? (crop.plantDate || crop.plant_date || crop.transplantDate || crop.transplant_date || '')
        : (crop.transplantDate || crop.transplant_date || '');

    const seedingInput = document.getElementById('crop-seeding-date');
    if (seedingInput) seedingInput.value = seedingDate;

    const transplantInput = document.getElementById('crop-transplant-date');
    if (transplantInput) transplantInput.value = transplantDate || '';

    const plantDateInput = document.getElementById('crop-plant-date');
    if (plantDateInput) plantDateInput.value = transplantDate || seedingDate;

    document.getElementById('crop-harvest-date').value = crop.estHarvestDate || '';
    document.getElementById('crop-target-yield').value = crop.targetYield || 0;
    document.getElementById('crop-notes').value = crop.notes || '';
    document.getElementById('crop-progress').value = crop.progress || 1;

    onCropDateOrAgeChange('init');

    if (crop.stage) {
        const stageEl = document.getElementById('crop-stage');
        if (stageEl) stageEl.value = crop.stage;
    }
}

function deleteCrop(id) {
    showConfirmDialog(
        'Hapus Siklus Tanam',
        'Hapus siklus tanam ini beserta seluruh riwayat aktivitasnya dari database Supabase?',
        async () => {
            try {
                await window.db.deleteCrop(id);
                renderCropsAndActivities();
                renderPlots();
                renderDashboard();
                populateAiInputs();
                runCoreAiEngine();
                showToast('Siklus tanam telah dihapus dari Supabase.', 'info');
            } catch (err) {
                console.error('Error deleteCrop:', err);
                showToast('Gagal menghapus siklus tanam: ' + (err.message || ''), 'error');
            }
        },
        'Hapus Siklus',
        'trash-2',
        true
    );
}

// ----------------------------------------------------
// Handler Reset Batch (langsung ke Supabase PostgreSQL)
// ----------------------------------------------------
async function confirmResetBatch(batchId) {
    if (!batchId) {
        showToast('Pilih batch tanaman terlebih dahulu!', 'error');
        return;
    }

    const crop = window.db.getCropById(batchId);
    const cropName = crop ? `${crop.commodity} (${crop.cycleCode || 'Siklus'})` : `Batch #${batchId}`;
    const isTransplanted = crop && (crop.transplantDate || crop.transplant_date);

    const promptMessage = isTransplanted
        ? `Apakah Anda yakin ingin mereset ${cropName}? Tanggal pindah tanam akan diperbarui ke hari ini (0 HST), tanggal semai (${crop.seedingDate || '-'}) tetap dipertahankan, fase kembali ke Vegetatif Awal (1%), serta riwayat aktivitas batch ini akan dibersihkan.`
        : `Apakah Anda yakin ingin mereset ${cropName}? Tanggal semai akan diperbarui ke hari ini (0 HSS), fase kembali ke Semai (1%), serta riwayat aktivitas batch ini akan dibersihkan.`;

    showConfirmDialog(
        'Reset Batch ke Hari Ini',
        promptMessage,
        async () => {
            if (!window.auth || !window.auth.isAuthenticated()) {
                showToast('Anda harus login terlebih dahulu untuk mereset batch!', 'error');
                return;
            }

            try {
                await window.db.resetBatch(batchId);

                // Data sudah diperbarui langsung di Supabase dan dimuat ulang.
                window.db.applyBatchResetLocal(batchId);

                closeModal('modal-crop-detail');
                renderCropsAndActivities();
                renderDashboard();
                populateAiInputs();
                runCoreAiEngine();

                showToast(`Batch "${cropName}" berhasil direset ke hari ini!`);
            } catch (err) {
                console.error('Error saat mereset batch di Supabase:', err);
                showToast('Gagal menghubungi server untuk reset batch: ' + err.message, 'error');
            }
        },
        'Reset Batch',
        'rotate-ccw',
        false
    );
}
window.confirmResetBatch = confirmResetBatch;

// ----------------------------------------------------
// Handler Clear All / Reset Semua Data (langsung ke Supabase PostgreSQL)
// ----------------------------------------------------
async function confirmResetAllBatches() {
    showConfirmDialog(
        'Clear All / Reset Semua Data Tanaman',
        'PERINGATAN: Seluruh data tanaman/batch, riwayat instruksi, dan catatan milik akun Anda akan dihapus permanen dari database sistem. Akun dan profil Anda tetap dipertahankan dengan kondisi awal (0 Batch). Lanjutkan?',
        async () => {
            if (!window.auth || !window.auth.isAuthenticated()) {
                showToast('Anda harus login terlebih dahulu!', 'error');
                return;
            }

            try {
                await window.db.resetAllData();

                // Data sudah dihapus langsung dari Supabase dan dimuat ulang.
                window.db.applyResetAllLocal();

                renderCropsAndActivities();
                renderDashboard();
                populateAiInputs();
                runCoreAiEngine();

                showToast('Seluruh data tanaman berhasil dihapus. Akun Anda kembali ke kondisi awal (0 Batch).', 'info');
            } catch (err) {
                console.error('Error saat mereset seluruh data di Supabase:', err);
                showToast('Gagal menghubungi server: ' + err.message, 'error');
            }
        },
        'Hapus Semua Data Tanaman',
        'trash-2',
        true
    );
}
window.confirmResetAllBatches = confirmResetAllBatches;

// ----------------------------------------------------
// CRUD Actions: Aktivitas Perawatan (Activities / Notes)
// ----------------------------------------------------
async function saveActivityFromForm(e) {
    e.preventDefault();
    const cropId = document.getElementById('act-crop-id').value;
    const date = document.getElementById('act-date').value;
    const type = document.getElementById('act-type').value;
    const title = document.getElementById('act-title').value.trim();
    const description = document.getElementById('act-desc').value.trim();
    const cost = Number(document.getElementById('act-cost').value || 0);
    const workerCount = Number(document.getElementById('act-workers').value || 1);
    const status = document.getElementById('act-status').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');

    if (!cropId) {
        showToast('Harap pilih komoditas / lahan yang dirawat!', 'error');
        return;
    }

    if (!title || !date) {
        showToast('Lengkapi judul dan tanggal aktivitas!', 'error');
        return;
    }

    const actData = {
        cropId,
        date,
        type,
        title,
        description,
        cost,
        workerCount,
        status
    };

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="animate-spin mr-2">⏳</span> Menyimpan ke Supabase...`;
    }

    try {
        await window.db.saveActivity(actData);

        if (cost > 0) {
            const crop = window.db.getCropById(cropId);
            await window.db.saveFinanceTransaction({
                date,
                type: 'expense',
                category: type === 'Pemupukan' || type === 'Penyemprotan' ? 'Saprotan' : 'Upah Tenaga Kerja',
                title: `Biaya Aktivitas: ${title}`,
                amount: cost,
                plotId: crop ? crop.plotId : null,
                cropId: cropId,
                notes: `Otomatis tercatat dari modul aktivitas (${type})`
            }).catch(e => console.warn('Gagal sinkron kas:', e));

            if (typeof currentDetailCropId !== 'undefined' && currentDetailCropId && typeof renderCropDetailFinanceSummary === 'function') {
                renderCropDetailFinanceSummary(currentDetailCropId);
            }
        }

        closeModal('modal-activity');
        renderCropsAndActivities();
        renderFinance();
        renderDashboard();
        showToast('Aktivitas perawatan berhasil disimpan ke Supabase!');
    } catch (err) {
        console.error('Error saat menyimpan aktivitas:', err);
        showToast('Gagal menyimpan aktivitas ke database: ' + (err.message || ''), 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i><span>Simpan Aktivitas</span>`;
            if (window.lucide) lucide.createIcons();
        }
    }
}

function deleteActivity(id) {
    showConfirmDialog(
        'Hapus Riwayat Aktivitas',
        'Hapus catatan riwayat aktivitas pemeliharaan ini dari database Supabase?',
        async () => {
            try {
                await window.db.deleteActivity(id);
                renderCropsAndActivities();
                renderDashboard();
                showToast('Aktivitas dihapus dari Supabase.', 'info');
            } catch (err) {
                console.error('Error deleteActivity:', err);
                showToast('Gagal menghapus aktivitas: ' + (err.message || ''), 'error');
            }
        },
        'Hapus Aktivitas',
        'trash-2',
        true
    );
}

// ----------------------------------------------------
// CRUD Actions: Inventaris (Saprotan)
// ----------------------------------------------------
async function saveInventoryFromForm(e) {
    e.preventDefault();
    const id = document.getElementById('inv-form-id').value;
    const name = document.getElementById('inv-name').value.trim();
    const category = document.getElementById('inv-category').value;
    const stock = Number(document.getElementById('inv-stock').value);
    const unit = document.getElementById('inv-unit').value.trim();
    const minStock = Number(document.getElementById('inv-min-stock').value);
    const unitPrice = Number(document.getElementById('inv-price').value);
    const location = document.getElementById('inv-location').value.trim();
    const notes = document.getElementById('inv-notes').value.trim();
    const submitBtn = e.target.querySelector('button[type="submit"]');

    if (!name || isNaN(stock)) {
        showToast('Nama barang dan jumlah stok wajib diisi!', 'error');
        return;
    }

    const itemData = {
        id: id || undefined,
        name,
        category,
        stock,
        unit,
        minStock,
        unitPrice,
        location,
        notes
    };

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="animate-spin mr-2">⏳</span> Menyimpan ke Supabase...`;
    }

    try {
        await window.db.saveInventoryItem(itemData);
        closeModal('modal-inventory');
        renderInventory();
        renderDashboard();
        showToast(id ? 'Data barang berhasil diperbarui di Supabase!' : 'Barang baru ditambahkan ke gudang Supabase!');
    } catch (err) {
        console.error('Error saat menyimpan inventaris:', err);
        showToast('Gagal menyimpan barang ke database: ' + (err.message || ''), 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i><span>Simpan Barang</span>`;
            if (window.lucide) lucide.createIcons();
        }
    }
}

function editInventory(id) {
    const item = window.db.getInventory().find(i => i.id === String(id));
    if (!item) return;

    document.getElementById('inv-form-id').value = item.id;
    document.getElementById('inv-name').value = item.name;
    document.getElementById('inv-category').value = item.category;
    document.getElementById('inv-stock').value = item.stock;
    document.getElementById('inv-unit').value = item.unit;
    document.getElementById('inv-min-stock').value = item.minStock;
    document.getElementById('inv-price').value = item.unitPrice;
    document.getElementById('inv-location').value = item.location || '';
    document.getElementById('inv-notes').value = item.notes || '';

    openModal('modal-inventory');
}

async function adjustStockModal(id, multiplier = 1) {
    const item = window.db.getInventory().find(i => i.id === String(id));
    if (!item) return;

    let amount = 1;
    try {
        const actionText = multiplier > 0 ? 'Tambah Stok Masuk (Restock)' : 'Pakai / Keluarkan Stok';
        const amountStr = window.prompt ? window.prompt(`${actionText} untuk "${item.name}":\nMasukkan jumlah (${item.unit}):`, '1') : '1';
        if (amountStr === null) return;
        const parsed = Number(amountStr);
        if (!isNaN(parsed) && parsed > 0) amount = parsed;
    } catch (e) {
        amount = 1;
    }

    try {
        await window.db.adjustStock(id, amount * multiplier);
        renderInventory();
        renderDashboard();
        const actionLabel = multiplier > 0 ? `+${amount} ${item.unit} ditambahkan` : `-${amount} ${item.unit} digunakan`;
        showToast(`Stok ${item.name} berhasil diperbarui (${actionLabel}) di Supabase.`);
    } catch (err) {
        console.error('Error saat update stok:', err);
        showToast('Gagal memperbarui stok di Supabase: ' + (err.message || ''), 'error');
    }
}

function quickRestock(id) {
    adjustStockModal(id, 1);
}

function deleteInventory(id) {
    showConfirmDialog(
        'Hapus Barang Inventaris',
        'Hapus barang ini dari daftar inventaris gudang di Supabase?',
        async () => {
            try {
                await window.db.deleteInventoryItem(id);
                renderInventory();
                renderDashboard();
                showToast('Barang berhasil dihapus dari Supabase.', 'info');
            } catch (err) {
                console.error('Error deleteInventory:', err);
                showToast('Gagal menghapus barang: ' + (err.message || ''), 'error');
            }
        },
        'Hapus Barang',
        'trash-2',
        true
    );
}

// ----------------------------------------------------
// CRUD Actions: Keuangan (Finance)
// ----------------------------------------------------
async function saveFinanceFromForm(e) {
    e.preventDefault();
    const date = document.getElementById('fin-date').value;
    const type = document.getElementById('fin-type').value;
    const category = document.getElementById('fin-category').value;
    const title = document.getElementById('fin-title').value.trim();
    const amount = Number(document.getElementById('fin-amount').value);
    const plotId = document.getElementById('finance-plot-id').value;
    const cropId = document.getElementById('finance-crop-id').value;
    const notes = document.getElementById('fin-notes').value.trim();
    const submitBtn = e.target.querySelector('button[type="submit"]');

    if (!title || !date || !amount || isNaN(amount)) {
        showToast('Lengkapi tanggal, uraian, dan jumlah nominal transaksi!', 'error');
        return;
    }

    let cleanPlotId = (plotId && plotId !== '' && plotId !== 'all' && plotId !== 'general') ? plotId : null;
    const cleanCropId = (cropId && cropId !== '' && cropId !== 'all' && cropId !== 'general') ? cropId : null;

    // Pastikan jika crop_id dipilih, plot_id selalu konsisten dengan blok tanaman
    if (cleanCropId && window.db) {
        const crop = window.db.getCropById(cleanCropId);
        if (crop) {
            if (!cleanPlotId) {
                cleanPlotId = crop.plotId;
            } else if (String(cleanPlotId) !== String(crop.plotId)) {
                showToast('Tanaman/batch yang dipilih tidak berada pada blok yang Anda pilih!', 'error');
                return;
            }
        }
    }

    const transData = {
        date,
        type,
        category,
        title,
        amount,
        plotId: cleanPlotId,
        cropId: cleanCropId,
        notes
    };

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="animate-spin mr-2">⏳</span> Menyimpan ke Supabase...`;
    }

    try {
        await window.db.saveFinanceTransaction(transData);
        closeModal('modal-finance');
        renderFinance();
        renderDashboard();

        // Jika modal detail siklus sedang terbuka, perbarui ringkasan keuangannya
        if (typeof currentDetailCropId !== 'undefined' && currentDetailCropId && typeof renderCropDetailFinanceSummary === 'function') {
            renderCropDetailFinanceSummary(currentDetailCropId);
        }

        showToast('Transaksi keuangan berhasil disimpan ke Supabase!');
    } catch (err) {
        console.error('Error saat menyimpan keuangan:', err);
        showToast('Gagal menyimpan transaksi ke database: ' + (err.message || ''), 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i><span>Simpan Transaksi</span>`;
            if (window.lucide) lucide.createIcons();
        }
    }
}

function deleteFinance(id) {
    showConfirmDialog(
        'Hapus Catatan Transaksi',
        'Hapus catatan transaksi keuangan ini dari database Supabase?',
        async () => {
            try {
                await window.db.deleteFinanceTransaction(id);
                renderFinance();
                renderDashboard();
                if (typeof currentDetailCropId !== 'undefined' && currentDetailCropId && typeof renderCropDetailFinanceSummary === 'function') {
                    renderCropDetailFinanceSummary(currentDetailCropId);
                }
                showToast('Transaksi dihapus dari Supabase.', 'info');
            } catch (err) {
                console.error('Error deleteFinance:', err);
                showToast('Gagal menghapus transaksi: ' + (err.message || ''), 'error');
            }
        },
        'Hapus Transaksi',
        'trash-2',
        true
    );
}

// ----------------------------------------------------
// BACKUP, RESTORE & PRINT
// ----------------------------------------------------
function exportDataBackup() {
    const tenant = window.auth ? window.auth.getCurrentTenant() : null;
    const tenantSlug = tenant ? tenant.slug : 'default';
    const dataStr = window.db.exportAllData();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Backup-Agrofarm-${tenantSlug}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Backup database ${tenant ? tenant.name : ''} berhasil diunduh!`);
}

function importDataBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const success = window.db.importData(e.target.result);
        if (success) {
            renderAllViews();
            showToast('Database berhasil dipulihkan dari file backup!');
        } else {
            showToast('Gagal memulihkan file! Format tidak valid.', 'error');
        }
    };
    reader.readAsText(file);
}

function resetDataDefault() {
    const tenant = window.auth ? window.auth.getCurrentTenant() : null;
    const tenantName = tenant ? tenant.name : 'organisasi aktif';
    showConfirmDialog(
        'Reset Database ke Default',
        `PERINGATAN: Semua perubahan data pada "${tenantName}" akan dikembalikan ke data default bawaan. Data tenant/kebun lain tidak akan terpengaruh. Lanjutkan?`,
        () => {
            window.db.resetToDefault();
            renderAllViews();
            showToast(`Database "${tenantName}" berhasil direset ke data default bawaan.`, 'info');
        },
        'Reset Data',
        'refresh-cw',
        true
    );
}

function printReport() {
    window.print();
}

// ============================================================================
// MODUL AGRO-KLIMATOLOGI & CUACA TERKINI (REALTIME OPEN-METEO & GOOGLE CUACA)
// ============================================================================

const WEATHER_CODE_MAP = {
    0: { label: 'Cerah', icon: 'sun', advice: 'Sangat optimal untuk fotosintesis, penjemuran hasil panen, dan penyerapan hara.' },
    1: { label: 'Sebagian Cerah', icon: 'cloud-sun', advice: 'Kondisi ideal untuk pemupukan daun dan penyemprotan proteksi tanaman.' },
    2: { label: 'Cerah Berawan', icon: 'cloud-sun', advice: 'Suhu ideal, penguapan terkendali. Cocok untuk aplikasi saprotan & irigasi.' },
    3: { label: 'Berawan Tebal', icon: 'cloud', advice: 'Intensitas cahaya berkurang. Pantau kelembaban media tanam & atur dosis air irigasi.' },
    45: { label: 'Berkabut', icon: 'cloud-fog', advice: 'Kelembaban tinggi. Waspadai spora jamur dan bercak daun pada komoditas.' },
    48: { label: 'Kabut Tebal', icon: 'cloud-fog', advice: 'Pastikan aerasi bedengan lancar untuk mencegah busuk pangkal batang.' },
    51: { label: 'Gerimis Ringan', icon: 'cloud-drizzle', advice: 'Tunda penyemprotan pestisida/pupuk cair agar tidak terbilas air.' },
    53: { label: 'Gerimis Sedang', icon: 'cloud-drizzle', advice: 'Tunda penyemprotan. Pantau saluran pembuangan air di sekitar lahan.' },
    55: { label: 'Gerimis Lebat', icon: 'cloud-rain', advice: 'Hindari pemupukan tabur di bedengan miring untuk cegah pupuk hanyut.' },
    61: { label: 'Hujan Ringan', icon: 'cloud-rain', advice: 'Tunda pemupukan daun. Cek parit drainase agar tidak terjadi genangan akar.' },
    63: { label: 'Hujan Sedang', icon: 'cloud-rain', advice: 'Pastikan parit drainase lancar. Waspada peningkatan kelembaban tanah berlebih.' },
    65: { label: 'Hujan Lebat', icon: 'cloud-rain', advice: 'Waspada erosi bedengan. Kurangi suplai irigasi pompa secara total.' },
    80: { label: 'Hujan Sesaat', icon: 'cloud-rain', advice: 'Segera bersihkan saluran buang. Lakukan penyemprotan setelah daun mengering.' },
    81: { label: 'Hujan Deras', icon: 'cloud-rain', advice: 'Siagakan pompa sedot bila lahan tergenang. Jangan lakukan pemupukan.' },
    95: { label: 'Hujan Petir', icon: 'cloud-lightning', advice: 'Hentikan aktivitas lapangan sementara demi keselamatan tenaga kerja tani.' }
};

let liveWeatherState = {
    temp: 25.6,
    humidity: 92,
    wind: 6.9,
    code: 2,
    city: 'Subang, Jawa Barat',
    lat: -6.5600,
    lon: 107.7600,
    lastUpdated: null,
    isFetched: false
};

const PRESET_MANUAL_LOCATIONS = [
    { name: 'Subang, Jawa Barat', lat: -6.5600, lon: 107.7600, tag: 'Sentra Padi Ciherang & Palawija' },
    { name: 'Lembang / Bandung, Jawa Barat', lat: -6.8000, lon: 107.6000, tag: 'Dataran Tinggi Sayur & Tomat' },
    { name: 'Karawang, Jawa Barat', lat: -6.3000, lon: 107.3000, tag: 'Lumbung Padi Nasional' },
    { name: 'Malang / Batu, Jawa Timur', lat: -7.9800, lon: 112.6300, tag: 'Sentra Hortikultura & Jagung' },
    { name: 'Sleman, D.I. Yogyakarta', lat: -7.7100, lon: 110.3500, tag: 'Tanaman Pangan & Cabai' },
    { name: 'Brebes, Jawa Tengah', lat: -6.8700, lon: 109.0400, tag: 'Sentra Bawang Merah Nasional' },
    { name: 'Boyolali, Jawa Tengah', lat: -7.5300, lon: 110.5900, tag: 'Sayuran & Palawija' },
    { name: 'Lampung Tengah, Lampung', lat: -4.9500, lon: 105.2500, tag: 'Sentra Jagung & Singkong' },
    { name: 'Tanah Datar, Sumatera Barat', lat: -0.4500, lon: 100.5800, tag: 'Padi & Hortikultura' },
    { name: 'Gowa, Sulawesi Selatan', lat: -5.2000, lon: 119.4500, tag: 'Sentra Jagung & Padi' },
    { name: 'Tabanan, Bali', lat: -8.5400, lon: 115.1200, tag: 'Sentra Padi Organik' }
];

function getSelectedManualLocation() {
    return localStorage.getItem('agrosmart_manual_location') || 'Subang, Jawa Barat';
}

function setSelectedManualLocation(name, lat, lon) {
    localStorage.setItem('agrosmart_manual_location', name);
    if (lat !== undefined && lon !== undefined) {
        localStorage.setItem('agrosmart_manual_lat', String(lat));
        localStorage.setItem('agrosmart_manual_lon', String(lon));
    }
    closeModal('modal-manual-location');
    fetchLiveWeather(true).then(() => {
        runCoreAiEngine();
    });
}

function openManualLocationModal() {
    const listEl = document.getElementById('preset-locations-list');
    const currentLoc = getSelectedManualLocation();
    if (listEl) {
        listEl.innerHTML = PRESET_MANUAL_LOCATIONS.map(loc => {
            const isSelected = loc.name === currentLoc;
            return `
                <button type="button" onclick="setSelectedManualLocation('${loc.name}', ${loc.lat}, ${loc.lon})" class="w-full text-left p-2.5 rounded-xl border ${isSelected ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'} transition flex items-center justify-between">
                    <div>
                        <div class="flex items-center gap-1.5">
                            <i data-lucide="map-pin" class="w-3.5 h-3.5 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}"></i>
                            <span class="text-xs">${loc.name}</span>
                        </div>
                        <span class="text-[10px] text-slate-500 block ml-5">${loc.tag}</span>
                    </div>
                    ${isSelected ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">Dipilih</span>' : '<i data-lucide="chevron-right" class="w-4 h-4 text-slate-300"></i>'}
                </button>
            `;
        }).join('');
    }
    openModal('modal-manual-location');
    setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 50);
}

function applyCustomLocation() {
    const input = document.getElementById('input-custom-location');
    if (!input || !input.value.trim()) {
        showToast('Masukkan nama lokasi manual terlebih dahulu!', 'error');
        return;
    }
    const locName = input.value.trim();
    const matched = PRESET_MANUAL_LOCATIONS.find(p => locName.toLowerCase().includes(p.name.split(',')[0].toLowerCase()));
    const lat = matched ? matched.lat : -6.5600;
    const lon = matched ? matched.lon : 107.7600;
    setSelectedManualLocation(locName, lat, lon);
    input.value = '';
}

async function fetchLiveWeather(force = false) {
    const refreshBtn = document.getElementById('weather-refresh-icon');
    if (refreshBtn) refreshBtn.classList.add('animate-spin');

    const locationName = getSelectedManualLocation();
    let lat = -6.5600;
    let lon = 107.7600;

    const matched = PRESET_MANUAL_LOCATIONS.find(l => l.name === locationName);
    if (matched) {
        lat = matched.lat;
        lon = matched.lon;
    } else {
        const storedLat = localStorage.getItem('agrosmart_manual_lat');
        const storedLon = localStorage.getItem('agrosmart_manual_lon');
        if (storedLat && storedLon) {
            lat = parseFloat(storedLat);
            lon = parseFloat(storedLon);
        }
    }

    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Gagal mengambil data Open-Meteo');
        const data = await res.json();

        if (data && data.current) {
            liveWeatherState.temp = Math.round(data.current.temperature_2m * 10) / 10;
            liveWeatherState.humidity = data.current.relative_humidity_2m;
            liveWeatherState.wind = Math.round(data.current.wind_speed_10m * 10) / 10;
            liveWeatherState.code = data.current.weather_code;
            liveWeatherState.lat = lat;
            liveWeatherState.lon = lon;
            liveWeatherState.city = locationName;
            liveWeatherState.lastUpdated = new Date();
            liveWeatherState.isFetched = true;

            updateWeatherUI();
            syncWeatherForAi();
            if (force) {
                showToast(`Cuaca lokasi pilihan ${locationName} berhasil diperbarui: ${liveWeatherState.temp}°C, ${WEATHER_CODE_MAP[liveWeatherState.code]?.label || 'Stabil'}`);
            }
        }
    } catch (err) {
        console.warn('Gagal memuat cuaca realtime, gunakan data tersimpan:', err);
        liveWeatherState.city = locationName;
        updateWeatherUI();
        syncWeatherForAi();
    } finally {
        if (refreshBtn) {
            setTimeout(() => {
                refreshBtn.classList.remove('animate-spin');
            }, 500);
        }
    }
}

function updateWeatherUI() {
    const info = WEATHER_CODE_MAP[liveWeatherState.code] || WEATHER_CODE_MAP[2];
    const googleQuery = encodeURIComponent(`cuaca ${liveWeatherState.city.replace(/[^a-zA-Z0-9 ]/g, '')}`);
    const googleUrl = `https://www.google.com/search?q=${googleQuery || 'cuaca'}`;

    // 1. Sidebar Elements
    const sideLocText = document.getElementById('weather-location-text');
    const sideTemp = document.getElementById('weather-temp');
    const sideDesc = document.getElementById('weather-desc');
    const sideHum = document.getElementById('weather-humidity');
    const sideWind = document.getElementById('weather-wind');
    const sideAdvice = document.getElementById('weather-advice');
    const sideMainIcon = document.getElementById('weather-main-icon');
    const sideLink = document.getElementById('weather-google-link');

    if (sideLocText) sideLocText.textContent = liveWeatherState.city;
    if (sideTemp) sideTemp.textContent = `${liveWeatherState.temp}°C`;
    if (sideDesc) sideDesc.textContent = info.label;
    if (sideHum) sideHum.textContent = `${liveWeatherState.humidity}%`;
    if (sideWind) sideWind.textContent = `${liveWeatherState.wind} km/j`;
    if (sideAdvice) sideAdvice.textContent = info.advice;
    if (sideLink) sideLink.href = googleUrl;

    if (sideMainIcon) {
        sideMainIcon.innerHTML = `<i data-lucide="${info.icon}" class="w-7 h-7"></i>`;
    }

    // 2. Dashboard Elements
    const dashLoc = document.getElementById('dash-weather-location');
    const dashTemp = document.getElementById('dash-weather-temp');
    const dashDesc = document.getElementById('dash-weather-desc');
    const dashDetails = document.getElementById('dash-weather-details');
    const dashAdvice = document.getElementById('dash-weather-advice');
    const dashIconBox = document.getElementById('dash-weather-icon-box');
    const dashLink = document.getElementById('dash-weather-google-link');

    if (dashLoc) dashLoc.textContent = liveWeatherState.city;
    if (dashTemp) dashTemp.textContent = `${liveWeatherState.temp}°C`;
    if (dashDesc) dashDesc.textContent = info.label;
    if (dashDetails) dashDetails.textContent = `Kelembaban: ${liveWeatherState.humidity}% | Angin: ${liveWeatherState.wind} km/j`;
    if (dashAdvice) dashAdvice.textContent = `Saran Agronomi: ${info.advice}`;
    if (dashLink) dashLink.href = googleUrl;

    if (dashIconBox) {
        dashIconBox.innerHTML = `<i data-lucide="${info.icon}" class="w-7 h-7 sm:w-8 sm:h-8"></i>`;
    }

    // 3. Tab Siklus AI Input Location select sync
    const aiLocSelect = document.getElementById('ai-input-location');
    if (aiLocSelect && aiLocSelect.value !== liveWeatherState.city) {
        aiLocSelect.value = liveWeatherState.city;
    }

    if (window.lucide) {
        lucide.createIcons();
    }
}

// ============================================================================
// CORE AI ENGINE: SIKLUS PENANAMAN & KOMODITAS (GOOGLE GEMINI 2.5 FLASH)
// ============================================================================

let latestCropEngineData = {
    planting_cycle_id: "crop-cabai-1",
    status_blok: { hari_setelah_tanam: "35 HSS", fase_saat_ini: "Fase Vegetatif" },
    konversi_waktu: { teks_masa_tanam: "5 minggu 0 hari masa tanam" },
    lini_masa: { fase_aktif: "26–60 HSS Vegetatif aktif", persentase_siklus: "29%", estimasi_panen: "30 November – 30 Desember 2026" },
    instruksi_umur: { judul: "Instruksi umur 35 HSS", kategori: "Pemupukan NPK & Pertunasan", deskripsi: "Pada Fase Vegetatif (26–60 HSS), komoditas membutuhkan suplai pupuk NPK seimbang, pengendalian gulma di sekitar perakaran, serta penjarangan cabang produktif." },
    agro_klimatologi: { lokasi_terpilih: "Subang, Jawa Barat", instruksi_agronomi: "Berdasarkan Subang, Jawa Barat (Cerah Berawan, suhu 25.6°C, kelembapan 92%): Pada Fase Vegetatif, tingginya kelembapan udara meningkatkan risiko jamur/bercak daun. Pastikan saluran drainase lancar dan tunda aplikasi pupuk daun hingga dedaunan kering." }
};
window.latestCropEngineData = latestCropEngineData;
window.selectedAiCycleId = 'crop-cabai-1';

function populateAiInputs() {
    const cycleSelect = document.getElementById('ai-input-crop-cycle');
    const commSelect = document.getElementById('ai-input-commodity');
    const locSelect = document.getElementById('ai-input-location');
    const plantDateInput = document.getElementById('ai-input-plant-date');
    const todayDateInput = document.getElementById('ai-input-today-date');

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    if (todayDateInput && !todayDateInput.value) todayDateInput.value = todayStr;

    const crops = window.db ? window.db.getCrops() : [];

    // Populasi Dropdown Siklus Tanam (Batch)
    if (cycleSelect) {
        if (crops.length > 0) {
            if (!window.selectedAiCycleId || !crops.some(c => c.id === window.selectedAiCycleId)) {
                const firstActive = crops.find(c => c.status === 'growing') || crops[0];
                window.selectedAiCycleId = firstActive.id;
            }
            const plots = window.db ? window.db.getPlots() : [];
            cycleSelect.innerHTML = crops.map(c => {
                const plot = plots.find(p => p.id === c.plotId);
                const blockName = (plot ? plot.name : c.petakName) || 'Blok A';
                return `
                    <option value="${c.id}" ${c.id === window.selectedAiCycleId ? 'selected' : ''}>
                        ${c.cycleCode || ('Siklus #' + c.id)}: ${c.commodity} (${blockName})
                    </option>
                `;
            }).join('');

            const selectedCrop = crops.find(c => c.id === window.selectedAiCycleId) || crops[0];
            if (selectedCrop) {
                if (commSelect) commSelect.value = selectedCrop.commodity;
                if (plantDateInput && selectedCrop.plantDate) plantDateInput.value = selectedCrop.plantDate;
                updateActiveAiCycleBadge(selectedCrop);
            }
        } else {
            window.selectedAiCycleId = null;
            cycleSelect.innerHTML = `<option value="">-- Belum ada siklus penanaman --</option>`;
            updateActiveAiCycleBadge(null);
        }
    }

    if (commSelect) {
        // HANYA 18 Master Komoditas Permanen (Tidak boleh ada Lainnya / komoditas di luar 18)
        const names = window.MASTER_COMMODITY_NAMES || [
            'Cabai Rawit', 'Cabai Merah', 'Tomat', 'Terong', 'Mentimun',
            'Kacang Panjang', 'Sawi', 'Kangkung', 'Bayam', 'Bawang Merah',
            'Bawang Putih', 'Jagung', 'Padi', 'Padi Ketan', 'Kedelai',
            'Kacang Tanah', 'Semangka', 'Melon'
        ];
        const currentVal = commSelect.value || 'Cabai Rawit';
        commSelect.innerHTML = names.map(name => `
            <option value="${name}" ${name === currentVal ? 'selected' : ''}>${name}</option>
        `).join('');
    }

    if (locSelect) {
        const currentLoc = getSelectedManualLocation();
        locSelect.innerHTML = PRESET_MANUAL_LOCATIONS.map(l => `
            <option value="${l.name}" ${l.name === currentLoc ? 'selected' : ''}>${l.name}</option>
        `).join('');
    }

    syncWeatherForAi();
    updateActiveAiCycleBadge();
}

function updateActiveAiCycleBadge(cropParam) {
    const badgeEl = document.getElementById('ai-active-cycle-badge');
    if (!badgeEl) return;
    const cycleSelect = document.getElementById('ai-input-crop-cycle');
    const cycleId = (cycleSelect && cycleSelect.value) ? cycleSelect.value : window.selectedAiCycleId;
    const crop = cropParam || (window.db && cycleId ? window.db.getCropById(cycleId) : null);
    if (crop) {
        const plots = window.db ? window.db.getPlots() : [];
        const plot = plots.find(p => p.id === crop.plotId);
        const blockName = (plot ? plot.name : crop.petakName) || 'Blok A';
        badgeEl.textContent = `${crop.cycleCode || ('Siklus #' + crop.id)}: ${crop.commodity} (${blockName})`;
    } else {
        badgeEl.textContent = 'Belum Ada Siklus Tanam';
    }
}
window.updateActiveAiCycleBadge = updateActiveAiCycleBadge;

function onAiCropCycleChange(cycleId) {
    window.selectedAiCycleId = cycleId;
    const crop = window.db ? window.db.getCropById(cycleId) : null;
    if (crop) {
        const commSelect = document.getElementById('ai-input-commodity');
        const plantDateInput = document.getElementById('ai-input-plant-date');
        if (commSelect) commSelect.value = crop.commodity;
        if (plantDateInput && crop.plantDate) plantDateInput.value = crop.plantDate;
        updateActiveAiCycleBadge(crop);
    } else {
        updateActiveAiCycleBadge();
    }
    runCoreAiEngine();
}

function openCurrentAiCycleDetail() {
    const cycleId = window.selectedAiCycleId;
    if (cycleId) {
        openCropDetailModal(cycleId);
    } else {
        const crops = window.db ? window.db.getCrops() : [];
        if (crops.length > 0) openCropDetailModal(crops[0].id);
    }
}
window.onAiCropCycleChange = onAiCropCycleChange;
window.openCurrentAiCycleDetail = openCurrentAiCycleDetail;
window.openCropDetailModal = openCropDetailModal;

function onAiCommodityChange(val) {
    const commName = window.matchMasterCommodity ? window.matchMasterCommodity(val) : val;
    const crops = window.db ? window.db.getCrops() : [];
    // Cari siklus yang cocok dengan komoditas ini
    const matched = crops.find(c => c.commodity === commName);
    const plantDateInput = document.getElementById('ai-input-plant-date');
    const cycleSelect = document.getElementById('ai-input-crop-cycle');

    if (matched) {
        window.selectedAiCycleId = matched.id;
        if (cycleSelect) cycleSelect.value = matched.id;
        if (matched.plantDate && plantDateInput) {
            plantDateInput.value = matched.plantDate;
        }
        updateActiveAiCycleBadge(matched);
    }
    runCoreAiEngine();
}

function onAiLocationChange(val) {
    const matched = PRESET_MANUAL_LOCATIONS.find(l => l.name === val);
    if (matched) {
        setSelectedManualLocation(matched.name, matched.lat, matched.lon);
    } else {
        localStorage.setItem('agrosmart_manual_location', val);
        fetchLiveWeather(true).then(() => runCoreAiEngine());
    }
}

function onAiDateChange() {
    runCoreAiEngine();
}

function syncWeatherForAi() {
    const sumEl = document.getElementById('ai-weather-summary');
    const tempEl = document.getElementById('ai-weather-param-temp');
    const humEl = document.getElementById('ai-weather-param-hum');
    const windEl = document.getElementById('ai-weather-param-wind');

    const info = WEATHER_CODE_MAP[liveWeatherState.code] || WEATHER_CODE_MAP[2];
    if (sumEl) sumEl.textContent = `${info.label} • ${liveWeatherState.temp}°C`;
    if (tempEl) tempEl.textContent = `Suhu: ${liveWeatherState.temp}°C`;
    if (humEl) humEl.textContent = `Kelembapan: ${liveWeatherState.humidity}%`;
    if (windEl) windEl.textContent = `Angin: ${liveWeatherState.wind} km/j`;
}

async function runCoreAiEngine() {
    const cycleSelect = document.getElementById('ai-input-crop-cycle');
    const commSelect = document.getElementById('ai-input-commodity');
    const plantDateInput = document.getElementById('ai-input-plant-date');
    const todayDateInput = document.getElementById('ai-input-today-date');
    const spinner = document.getElementById('ai-engine-spinner');
    const btnText = document.getElementById('ai-engine-btn-text');

    if (spinner) spinner.classList.add('animate-spin');
    if (btnText) btnText.textContent = 'Menganalisis...';

    const selectedCycleId = (cycleSelect && cycleSelect.value) ? cycleSelect.value : (window.selectedAiCycleId || null);
    window.selectedAiCycleId = selectedCycleId;

    let selectedCrop = null;
    if (selectedCycleId && window.db) {
        selectedCrop = window.db.getCropById(selectedCycleId);
    }

    const rawComm = commSelect && commSelect.value ? commSelect.value : (selectedCrop ? selectedCrop.commodity : 'Cabai Rawit');
    const komoditas = window.matchMasterCommodity ? window.matchMasterCommodity(rawComm) : rawComm;
    const tanggalTanam = plantDateInput && plantDateInput.value ? plantDateInput.value : (selectedCrop ? (selectedCrop.transplantDate || selectedCrop.plantDate) : '2026-08-26');
    const tanggalHariIni = todayDateInput && todayDateInput.value ? todayDateInput.value : new Date().toISOString().split('T')[0];
    const lokasiManual = getSelectedManualLocation();

    const info = WEATHER_CODE_MAP[liveWeatherState.code] || WEATHER_CODE_MAP[2];
    const cuacaInput = {
        suhu: liveWeatherState.temp || 25.6,
        kondisi: info.label || 'Cerah Berawan',
        kelembapan: liveWeatherState.humidity || 92,
        kecepatan_angin: `${liveWeatherState.wind || 6.9} km/j`
    };

    const payload = {
        planting_cycle_id: selectedCycleId,
        crop_cycle_id: selectedCycleId,
        tanggal_hari_ini: tanggalHariIni,
        komoditas: komoditas,
        tanggal_tanam: tanggalTanam,
        lokasi_pilihan_manual: lokasiManual,
        data_cuaca_input: cuacaInput
    };

    try {
        // Engine lokal deterministik adalah jalur utama pada Netlify static deploy.
        // Ini menghindari ketergantungan endpoint Express yang tidak tersedia pada
        // deploy statis dan tetap menghasilkan output agronomi yang konsisten.
        const data = calculateClientDeterministicOutput(payload);
        latestCropEngineData = data;
        window.latestCropEngineData = data;
        renderAiEngineOutput(data);
    } catch (err) {
        console.error('Core AI Engine lokal gagal:', err);
        showToast('Core AI Engine gagal menghitung rekomendasi: ' + (err.message || err), 'error');
    } finally {
        if (spinner) spinner.classList.remove('animate-spin');
        if (btnText) btnText.textContent = 'Jalankan Core AI Engine';
    }
}

function calculateClientDeterministicOutput(input) {
    let cycle = null;
    if (input.planting_cycle_id && window.db) {
        cycle = window.db.getCropById(input.planting_cycle_id);
    } else if (window.selectedAiCycleId && window.db) {
        cycle = window.db.getCropById(window.selectedAiCycleId);
    }

    const rawComm = (cycle && cycle.commodity) ? cycle.commodity : (input.komoditas || 'Cabai Rawit');
    const commName = window.matchMasterCommodity ? window.matchMasterCommodity(rawComm) : rawComm;
    const refToday = input.tanggal_hari_ini || null;

    const defaultMethod = window.SmartCropEngine ? window.SmartCropEngine.getDefaultPlantingMethod(commName) : 'nursery_transplant';
    const plantingMethod = cycle ? (cycle.plantingMethod || cycle.planting_method || defaultMethod) : defaultMethod;
    const isDirect = (plantingMethod === 'direct_sowing' || plantingMethod === 'direct_planting');

    const ageInfo = cycle
        ? window.db.calculateCropAge(cycle, refToday)
        : window.db.calculateCropAge({
            commodity: commName,
            plantingMethod,
            planting_method: plantingMethod,
            seedingDate: isDirect ? null : '2026-08-05',
            transplantDate: isDirect ? null : (input.tanggal_tanam || '2026-08-26'),
            plantDate: input.tanggal_tanam || '2026-08-26'
        }, refToday);

    const isTransplanted = ageInfo.isTransplanted;
    const currentPhase = ageInfo.activePhase;
    const activeAge = ageInfo.activeAge;
    const activeUnit = ageInfo.activeUnit;

    const faseSaatIni = currentPhase.name;
    const faseShort = currentPhase.shortName || faseSaatIni;
    const faseAktif = `${currentPhase.start}–${currentPhase.end} ${activeUnit} ${faseShort}`;

    const kategori = ageInfo.focusToday || ageInfo.careType || 'Pengakaran & Pertumbuhan';

    const lokasi = input.lokasi_pilihan_manual || 'Subang, Jawa Barat';
    const cuaca = input.data_cuaca_input || { suhu: 25.6, kondisi: 'Cerah Berawan', kelembapan: 92, kecepatan_angin: '6.9 km/j' };

    let agro = `Berdasarkan ${lokasi} (${cuaca.kondisi || 'Stabil'}, suhu ${cuaca.suhu || 26}°C, kelembapan ${cuaca.kelembapan || 85}%): Pada ${faseSaatIni} (${commName}), `;
    if ((cuaca.kelembapan && cuaca.kelembapan > 85) || (cuaca.kondisi && cuaca.kondisi.toLowerCase().includes('hujan'))) {
        agro += 'tingginya kelembapan udara meningkatkan risiko jamur/bercak daun. Pastikan saluran drainase lancar dan tunda aplikasi pupuk daun hingga dedaunan kering.';
    } else if (cuaca.suhu && cuaca.suhu > 31) {
        agro += 'suhu terik meningkatkan laju transpirasi. Lakukan pengairan/irigasi pada pagi atau sore hari untuk menjaga turgor sel tanaman.';
    } else {
        agro += 'kondisi agroklimat sangat kondusif untuk penyerapan unsur hara. Lakukan pemupukan berimbang sesuai fase komoditas dan monitor kebersihan bedengan.';
    }

    return {
        planting_cycle_id: cycle ? cycle.id : null,
        commodity: commName,
        status_blok: {
            hari_setelah_tanam: isDirect ? `${ageInfo.hst} HST` : (isTransplanted ? `${ageInfo.hst} HST` : `${ageInfo.hss} HSS`),
            fase_saat_ini: faseSaatIni,
            fase_short: faseShort,
            stage_status: ageInfo.stageStatus || 'FASE ESTIMASI',
            stage_confidence: ageInfo.stageConfidence || 75,
            growth_status: ageInfo.growthStatus || 'Normal berdasarkan umur kalender',
            secondary_age: isDirect ? 'Tanam Langsung di Lahan' : (isTransplanted ? `${ageInfo.hss} HSS sejak semai` : 'Persemaian'),
            status_lahan: ageInfo.transplantStatus
        },
        konversi_waktu: {
            teks_masa_tanam: ageInfo.teksMasaTanam
        },
        lini_masa: {
            fase_aktif: faseAktif,
            persentase_siklus: `${ageInfo.progressPercent}%`,
            estimasi_panen: ageInfo.estimasiPanenRange,
            phases: ageInfo.phases || []
        },
        instruksi_umur: {
            judul: `Instruksi Umur ${activeAge} ${activeUnit} (${faseShort}):`,
            kategori: kategori,
            deskripsi: ageInfo.currentRecommendations || currentPhase.description || 'Pemeliharaan rutin sesuai SOP fase tanaman.'
        },
        agro_klimatologi: {
            lokasi_terpilih: lokasi,
            instruksi_agronomi: agro
        }
    };
}

function renderAiEngineOutput(data) {
    if (!data) return;

    // 1. status_blok
    const hstEl = document.getElementById('ai-out-hst');
    const faseEl = document.getElementById('ai-out-fase');
    const statusBadgeEl = document.getElementById('ai-out-status-badge');
    const kondisiEl = document.getElementById('ai-out-kondisi');

    if (hstEl) hstEl.textContent = data.status_blok?.hari_setelah_tanam || '39 HST';
    if (faseEl) faseEl.textContent = data.status_blok?.fase_short || data.status_blok?.fase_saat_ini || 'Vegetatif Aktif';
    if (statusBadgeEl) {
        const isConfirmed = data.status_blok?.stage_status === 'FASE TERKONFIRMASI';
        statusBadgeEl.textContent = data.status_blok?.stage_status || 'FASE ESTIMASI';
        statusBadgeEl.className = isConfirmed
            ? 'px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/25 text-emerald-300 border border-emerald-500/50'
            : 'px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40';
    }
    if (kondisiEl) {
        kondisiEl.textContent = data.status_blok?.growth_status || 'Normal berdasarkan umur kalender';
    }

    // 2. konversi_waktu
    const konversiEl = document.getElementById('ai-out-konversi');
    if (konversiEl) konversiEl.textContent = data.konversi_waktu?.teks_masa_tanam || '5 minggu 4 hari masa tanam di lahan (HST)';

    // 3. lini_masa
    const persenEl = document.getElementById('ai-out-persen');
    const panenEl = document.getElementById('ai-out-panen');
    const liniFaseEl = document.getElementById('ai-out-lini-fase');
    const progressBar = document.getElementById('ai-out-progress-bar');
    if (persenEl) persenEl.textContent = data.lini_masa?.persentase_siklus || '43%';
    if (panenEl) {
        const panenText = data.lini_masa?.estimasi_panen || '80–90 HST';
        panenEl.textContent = `Est. Panen: ${panenText}`;
    }
    if (liniFaseEl) liniFaseEl.textContent = data.lini_masa?.fase_aktif || 'Vegetatif Aktif';
    if (progressBar) {
        const pct = parseInt(data.lini_masa?.persentase_siklus || '43', 10);
        progressBar.style.width = `${Math.min(100, Math.max(1, pct))}%`;
    }

    // Render Timeline Pills Komoditas Terpilih (Sesuai Smart Crop Engine)
    const pillsEl = document.getElementById('ai-out-timeline-pills');
    if (pillsEl) {
        let phases = data.lini_masa?.phases;
        if (!phases || phases.length === 0) {
            const rawComm = data.commodity || 'Cabai Rawit';
            const commConfig = window.MASTER_COMMODITIES ? window.MASTER_COMMODITIES[rawComm] : null;
            if (commConfig && window.db) {
                phases = window.db.getFieldPhases(commConfig);
            }
        }
        if (phases && phases.length > 0) {
            pillsEl.innerHTML = phases.map(p => {
                const isCurrent = p.isCurrent || (data.status_blok?.fase_saat_ini && data.status_blok.fase_saat_ini.includes(p.shortName)) || (data.lini_masa?.fase_aktif && data.lini_masa.fase_aktif.includes(p.shortName));
                const isPast = p.status === 'PAST';
                return `
                    <span class="px-2 py-0.5 rounded-md text-[9px] font-bold border transition ${
                        isCurrent
                            ? 'bg-purple-500/30 text-purple-200 border-purple-400 ring-1 ring-purple-400/60 font-extrabold shadow-2xs'
                            : (isPast
                                ? 'bg-slate-900/60 text-emerald-400/80 border-emerald-900/50'
                                : 'bg-slate-800/70 text-slate-400 border-slate-700/60')
                    }" title="${p.name} (${p.description || ''})">
                        [${p.label}${isCurrent ? ` • ${p.shortName}` : ''}]
                    </span>
                `;
            }).join('');
        }
    }

    // 4. instruksi_umur
    const judulEl = document.getElementById('ai-out-instruksi-judul');
    const kategoriEl = document.getElementById('ai-out-kategori');
    const descEl = document.getElementById('ai-out-instruksi-desc');
    if (judulEl) judulEl.textContent = data.instruksi_umur?.judul || 'Instruksi Umur 39 HST:';
    if (kategoriEl) kategoriEl.textContent = data.instruksi_umur?.kategori || 'Fokus: Cabang V';
    if (descEl) descEl.textContent = data.instruksi_umur?.deskripsi || 'Penguatan cabang utama V dan pembesaran batang. Aplikasi pupuk NPK seimbang 16-16-16 secara berkala dan lakukan pewiwilan tunas air di bawah cabang V.';

    // 5. agro_klimatologi
    const lokasiEl = document.getElementById('ai-out-lokasi-terpilih');
    const agronomiEl = document.getElementById('ai-out-agronomi');
    if (lokasiEl) lokasiEl.textContent = `Lokasi Terpilih: ${data.agro_klimatologi?.lokasi_terpilih || 'Subang, Jawa Barat'}`;
    if (agronomiEl) agronomiEl.textContent = data.agro_klimatologi?.instruksi_agronomi || '';

    // Update active cycle badge
    updateActiveAiCycleBadge();

    // Update raw json viewer if open
    const preEl = document.getElementById('json-raw-display');
    if (preEl) preEl.textContent = JSON.stringify(data, null, 2);
}

function toggleRawJsonModal() {
    const preEl = document.getElementById('json-raw-display');
    if (preEl) {
        preEl.textContent = JSON.stringify(window.latestCropEngineData || {}, null, 2);
    }
    openModal('modal-json-inspector');
    setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 50);
}

function copyJsonToClipboard() {
    const text = JSON.stringify(window.latestCropEngineData || {}, null, 2);
    navigator.clipboard.writeText(text).then(() => {
        const btnText = document.getElementById('btn-copy-json-text');
        if (btnText) {
            btnText.textContent = 'Tersalin!';
            setTimeout(() => { btnText.textContent = 'Salin JSON'; }, 2000);
        }
        showToast('Output JSON valid berhasil disalin ke clipboard!', 'success');
    }).catch(() => {
        showToast('Gagal menyalin otomatis, silakan blok dan salin teks.', 'info');
    });
}

function scrollToAiEngine() {
    const el = document.getElementById('core-ai-engine-panel');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
}

// ----------------------------------------------------
// Hash Routing Listener: /tanaman/detail/:id
// ----------------------------------------------------
function checkUrlRoute() {
    const hash = window.location.hash || '';
    const match = hash.match(/(?:#|\/)?(?:tanaman\/detail\/)([^/?#]+)/i);
    if (match && match[1]) {
        const cycleId = match[1];
        if (typeof switchTab === 'function') {
            switchTab('tanam');
        }
        setTimeout(() => {
            openCropDetailModal(cycleId);
        }, 150);
    }
}
window.addEventListener('hashchange', checkUrlRoute);
window.checkUrlRoute = checkUrlRoute;

