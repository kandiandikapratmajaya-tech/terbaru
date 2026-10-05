SUPABASE FIX — DUAL SUPER ADMIN + SQL IDEMPOTENT

Perbaikan ini mengatasi dua hal:
1. ID whitelist Super Admin memakai gen_random_uuid(), bukan ID teks yang tidak valid untuk kolom UUID.
2. Policy smart-farm memakai DROP POLICY IF EXISTS sebelum CREATE POLICY, sehingga SQL aman dijalankan ulang setelah percobaan sebelumnya berhenti pada error “policy ... already exists”.

Akun Super Admin:
- kandiapj23@gmail.com — Kandi Andika Pratama Jaya
- pratamajayapreneur@gmail.com — Jaya Agrofarm Administrator

LANGKAH:
1. Jangan jalankan SQL versi lama.
2. Buka file SUPABASE_ISOLASI_AKUN.sql dari ZIP ini.
3. Di Supabase SQL Editor, buat New query, hapus isi query lama, paste SELURUH isi file ini.
4. Klik Run sekali.
5. Jika sukses, jangan jalankan ulang kecuali memang ada perubahan.

Catatan: SQL ini menggunakan tenant_id sebagai text, sesuai struktur project yang sedang dipakai; tidak mengubahnya menjadi UUID.

Perbaikan frontend 2026-10-04: query activities menggunakan created_at (bukan kolom date), panel kredensial Super Admin dihapus dari UI, dan PWA install mobile diperbaiki untuk Android/iOS + fallback manual.


PEMBARUAN 2026-10-05
- Tambahkan kolom public.activities.date jika belum ada dan isi dari activity_date/created_at.
- SQL migrasi sekarang idempotent untuk kolom dan policy yang sudah ada.
- Frontend memakai cache-busting query dan Service Worker v2.0.0 agar deployment Netlify tidak menyajikan JS lama.
- Panel legacy 'Akun Administrator Terdaftar / Isi Kredensial Super Admin' tidak ada lagi dan akan dibersihkan jika tersisa dari DOM versi lama.
