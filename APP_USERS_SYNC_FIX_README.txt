====================================================
PERBAIKAN SINKRONISASI NAMA PENGGUNA TERPUSAT (CROSS-DEVICE)
JAYA AGROFARM NUSANTARA — 2026-10-05
====================================================

1. MASALAH YANG DIPERBAIKI:
- Sebelumnya, nama akun Super Admin dioverride oleh data statis SUPER_ADMIN_PROFILES di memori saat login di Device B.
- Query app_users yang mengembalikan lebih dari 1 baris historis menyebabkan error pada .maybeSingle(), sehingga nama pengguna jatuh kembali ke nilai default/whitelist lama (misal "Budi" bukannya "Andi").
- Perubahan nama di Device A hanya disimpan ke app_users tanpa sinkronisasi ke auth.users metadata dan whitelist.
- Belum ada mekanisme Realtime channel dan tab visibility/focus refresh lintas perangkat.

2. SOLUSI & IMPLEMENTASI:
- Identitas Terpusat: Menggunakan Supabase Auth User ID (auth.users.id) sebagai identitas utama.
- Single Source of Truth: Database Supabase (public.app_users & auth.users metadata) adalah satu-satunya sumber kebenaran untuk nama pengguna.
- Tidak Ada Override Statis: Nilai default hanya menjadi fallback inisial jika akun baru belum memiliki profil di database Supabase.
- Query Robust: Query app_users menggunakan order by updated_at desc limit 1 dan mencari berdasarkan id (auth.users.id) serta email.
- Multi-Layer Persistence: Saat nama diubah di Device A:
  * Disimpan ke public.app_users (berdasarkan id & email).
  * Disinkronkan ke public.whitelist (kolom name).
  * Disinkronkan ke Supabase Auth user_metadata via supabase.auth.updateUser().
  * Diperbarui ke state in-memory (currentUser.name).
  * Disimpan ke cache sekunder scoped per ID (userProfile_${user.id}).
  * Disiarkan via Supabase Realtime channel (profile-sync-${user.id}) ke perangkat lain yang sedang terbuka.
- Auto-Sync Device B:
  * Saat login / checkSession: selalu mengambil profil terbaru langsung dari Supabase.
  * Saat tab aktif / window focus: refreshUserProfile() otomatis memuat data terbaru.
  * Saat Device A mengubah nama: Realtime listener pada Device B langsung memperbarui UI tanpa perlu logout.
- Isolasi Akun:
  * Dua akun berbeda (Akun A & Akun B) tidak pernah saling bertukar data nama karena query dan cache sepenuhnya terisolasi per auth.users.id dan email unik.
====================================================
