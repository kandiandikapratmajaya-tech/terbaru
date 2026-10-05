/**
 * Jaya Agrofarm Nusantara - PWA Install Helper
 * Menangani install native Chrome/Android, iOS Add to Home Screen,
 * dan fallback manual untuk browser mobile yang tidak menyediakan prompt.
 */
(function () {
    let deferredPrompt = null;

    function isAndroid() {
        return /android/i.test(navigator.userAgent || '');
    }

    function isIOS() {
        return /iphone|ipad|ipod/i.test(navigator.userAgent || '') ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    function isMobile() {
        const ua = navigator.userAgent || '';
        const mobileHint = navigator.userAgentData && navigator.userAgentData.mobile;
        return Boolean(mobileHint || /android|iphone|ipad|ipod|windows phone/i.test(ua));
    }

    function isAppAlreadyInstalled() {
        return window.matchMedia('(display-mode: standalone)').matches ||
            window.matchMedia('(display-mode: fullscreen)').matches ||
            window.matchMedia('(display-mode: minimal-ui)').matches ||
            window.navigator.standalone === true ||
            document.referrer.indexOf('android-app://') === 0;
    }

    function updateInstallUI() {
        const section = document.getElementById('android-install-section');
        const btn = document.getElementById('btn-install-android');
        const btnText = document.getElementById('btn-install-android-text');
        const guide = document.getElementById('android-install-guide');
        const guideText = document.getElementById('android-install-guide-text');
        if (!section || !btn) return;

        if (!isMobile()) {
            section.classList.add('hidden');
            return;
        }

        section.classList.remove('hidden');
        btn.disabled = false;
        btn.classList.remove('opacity-90', 'cursor-default');
        btn.classList.add('cursor-pointer');

        if (isAppAlreadyInstalled()) {
            if (btnText) btnText.textContent = '✓ Aplikasi Terpasang';
            btn.disabled = true;
            btn.classList.remove('cursor-pointer');
            btn.classList.add('opacity-90', 'cursor-default');
            if (guide) guide.classList.add('hidden');
            return;
        }

        if (isIOS()) {
            if (btnText) btnText.textContent = 'Tambah ke Layar Utama';
            if (guideText) {
                guideText.innerHTML = 'Di iPhone/iPad, ketuk <strong class="text-white">Bagikan</strong> pada Safari lalu pilih <strong class="text-emerald-400">Tambahkan ke Layar Utama</strong>.';
            }
        } else if (deferredPrompt) {
            if (btnText) btnText.textContent = 'Install Aplikasi';
            if (guide) guide.classList.add('hidden');
        } else {
            if (btnText) btnText.textContent = 'Install Aplikasi';
            if (guideText) {
                guideText.innerHTML = 'Jika dialog instalasi belum muncul, buka menu browser <strong class="text-white">⋮</strong> lalu pilih <strong class="text-emerald-400">Install aplikasi</strong> atau <strong class="text-emerald-400">Tambahkan ke Layar Utama</strong>.';
            }
        }
    }


    function removeLegacyCredentialNotice() {
        const nodes = Array.from(document.querySelectorAll('body *'));
        nodes.forEach(function (el) {
            const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
            if ((text.includes('Akun Administrator') && text.includes('Kredensial Super Admin')) || (text.includes('pratamajayapreneur@gmail.com') && text.includes('kandiapj23@gmail.com') && text.includes('Kredensial'))) {
                // Remove the smallest legacy wrapper rather than the whole page.
                let target = el;
                for (let i = 0; i < 3 && target.parentElement; i++) {
                    const p = target.parentElement;
                    const pText = (p.textContent || '').replace(/\s+/g, ' ').trim();
                    if (pText.length > 450) break;
                    target = p;
                }
                target.remove();
            }
        });
    }

    function clearLegacyAppCache() {
        try {
            const key = 'jaya-agrofarm-cache-reset-v210';
            if (localStorage.getItem(key) === '1') return;
            localStorage.setItem(key, '1');
            if ('caches' in window) {
                caches.keys().then(function (keys) {
                    return Promise.all(keys.filter(function (k) { return k.indexOf('jaya-agrofarm-static-v') === 0 && k !== 'jaya-agrofarm-static-v2.1.0'; }).map(function (k) { return caches.delete(k); }));
                }).catch(function () {});
            }
        } catch (e) {}
    }

    function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return;
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
                .then(function (reg) {
                    console.log('[PWA] Service Worker aktif:', reg.scope);
                    reg.update().catch(function () {});
                })
                .catch(function (err) {
                    console.warn('[PWA] Service Worker gagal:', err);
                });
        });
    }

    window.addEventListener('beforeinstallprompt', function (event) {
        event.preventDefault();
        deferredPrompt = event;
        updateInstallUI();
    });

    window.addEventListener('appinstalled', function () {
        deferredPrompt = null;
        updateInstallUI();
    });

    async function triggerAndroidInstall() {
        if (isAppAlreadyInstalled()) return;

        if (deferredPrompt) {
            const promptEvent = deferredPrompt;
            deferredPrompt = null;
            try {
                promptEvent.prompt();
                const choice = await promptEvent.userChoice;
                console.log('[PWA] Hasil instalasi:', choice && choice.outcome);
            } catch (error) {
                console.warn('[PWA] Prompt install gagal:', error);
            }
            updateInstallUI();
            return;
        }

        const guide = document.getElementById('android-install-guide');
        if (guide) guide.classList.remove('hidden');
    }

    window.triggerAndroidInstall = triggerAndroidInstall;
    window.updateInstallUI = updateInstallUI;

    document.addEventListener('visibilitychange', updateInstallUI);
    document.addEventListener('DOMContentLoaded', function () { clearLegacyAppCache(); removeLegacyCredentialNotice(); });
    window.addEventListener('pageshow', updateInstallUI);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            clearLegacyAppCache();
            registerServiceWorker();
            removeLegacyCredentialNotice();
            updateInstallUI();
        });
    } else {
        clearLegacyAppCache();
        registerServiceWorker();
        removeLegacyCredentialNotice();
        updateInstallUI();
    }
})();
