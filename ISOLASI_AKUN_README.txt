JAYA AGROFARM NUSANTARA - ISOLASI DATA PER AKUN

Versi ini memisahkan data setiap akun menggunakan tenant_id unik per email.

WAJIB SEBELUM DEPLOY:
1. Buka Supabase -> SQL Editor.
2. Buka file SUPABASE_ISOLASI_AKUN.sql yang ada di ZIP ini.
3. Copy seluruh isinya ke SQL Editor.
4. Klik Run.
5. Pastikan query selesai tanpa error.
6. Baru deploy folder dist ke Netlify.

HASIL:
- Setiap email mendapatkan tenant/workspace unik.
- User biasa hanya dapat membaca/menambah/mengubah/menghapus data milik tenant-nya.
- OWNER_ADMIN dapat mengelola seluruh tenant.
- Data lama tenant-nusantara dipetakan ke Super Admin.
- Data lama tenant-lembang dipetakan ke petani.sukses@gmail.com.
- Data lama tenant-makmur dipetakan ke agrobisnis.subang@gmail.com.
- Jika ada data lama tenant-nusantara yang sebenarnya milik user lain, data tersebut perlu dipindahkan oleh admin setelah migrasi.

ZIP INI SUDAH BERISI:
- dist/ untuk deploy langsung ke Netlify
- SUPABASE_ISOLASI_AKUN.sql untuk migrasi keamanan
- Perbaikan frontend agar akun baru otomatis memakai tenant unik.
