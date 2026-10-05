
-- ============================================================
-- JAYA AGROFARM: ISOLASI DATA PER AKUN
-- Aman dijalankan ulang di Supabase -> SQL Editor -> New query.
-- Perubahan skema dibuat idempotent agar tidak berhenti pada policy/column yang sudah ada.
-- ============================================================

begin;

-- 0.1) Skema Profil Pengguna (app_users)
create table if not exists public.app_users (
  id text primary key,
  email text not null,
  name text,
  role text default 'farmer',
  tenant_id text,
  farm_name text,
  updated_at timestamptz default now()
);

create index if not exists idx_app_users_email on public.app_users(lower(email));
create index if not exists idx_app_users_tenant on public.app_users(tenant_id);

-- 1) Satu workspace/tenant unik untuk setiap email.
--    Data lama dipetakan:
--    tenant-nusantara -> Super Admin
--    tenant-lembang   -> Hendra
--    tenant-makmur    -> Koperasi Tani Makmur
--    Akun baru otomatis memakai pola tenant-user-<email>.
update public.whitelist
set tenant_id = 'tenant-user-' ||
  trim(both '-' from regexp_replace(lower(email), '[^a-z0-9]+', '-', 'g'))
where email is not null;

update public.app_users au
set tenant_id = w.tenant_id
from public.whitelist w
where lower(au.email) = lower(w.email);

update public.tenant_users tu
set tenant_id = w.tenant_id
from public.whitelist w
where lower(tu.email) = lower(w.email);

-- 1.0) Kompatibilitas kolom aktivitas
-- Aplikasi utama menggunakan activities.activity_date. Tambahkan alias date
-- hanya sebagai kompatibilitas versi lama, tanpa mengasumsikan kolom activity_date
-- selalu ada pada instalasi lama.
alter table if exists public.activities
  add column if not exists date date;

do $fn$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'activities' and column_name = 'activity_date'
  ) then
    execute $sql$update public.activities
             set date = coalesce(date, activity_date, (created_at at time zone 'UTC')::date)
             where date is null$sql$;
  else
    execute $sql$update public.activities
             set date = coalesce(date, (created_at at time zone 'UTC')::date)
             where date is null$sql$;
  end if;
end $fn$;

-- 1.1) Skema Relasi Keuangan: Lahan (plot_id) & Siklus Tanaman (crop_id)
alter table if exists public.finance
  add column if not exists plot_id text,
  add column if not exists crop_id text;

create index if not exists idx_finance_tenant on public.finance(tenant_id);
create index if not exists idx_finance_plot on public.finance(plot_id);
create index if not exists idx_finance_crop on public.finance(crop_id);
create index if not exists idx_finance_date on public.finance(transaction_date desc);

-- 2) Pindahkan data lama ke pemilik akun yang sesuai.
update public.crops
set tenant_id = 'tenant-user-pratamajayapreneur-gmail-com'
where tenant_id = 'tenant-nusantara';

update public.plots
set tenant_id = 'tenant-user-pratamajayapreneur-gmail-com'
where tenant_id = 'tenant-nusantara';

update public.activities
set tenant_id = 'tenant-user-pratamajayapreneur-gmail-com'
where tenant_id = 'tenant-nusantara';

update public.inventory
set tenant_id = 'tenant-user-pratamajayapreneur-gmail-com'
where tenant_id = 'tenant-nusantara';

update public.finance
set tenant_id = 'tenant-user-pratamajayapreneur-gmail-com'
where tenant_id = 'tenant-nusantara';

update public.crops
set tenant_id = 'tenant-user-petani-sukses-gmail-com'
where tenant_id = 'tenant-lembang';

update public.plots
set tenant_id = 'tenant-user-petani-sukses-gmail-com'
where tenant_id = 'tenant-lembang';

update public.activities
set tenant_id = 'tenant-user-petani-sukses-gmail-com'
where tenant_id = 'tenant-lembang';

update public.inventory
set tenant_id = 'tenant-user-petani-sukses-gmail-com'
where tenant_id = 'tenant-lembang';

update public.finance
set tenant_id = 'tenant-user-petani-sukses-gmail-com'
where tenant_id = 'tenant-lembang';

update public.crops
set tenant_id = 'tenant-user-agrobisnis-subang-gmail-com'
where tenant_id = 'tenant-makmur';

update public.plots
set tenant_id = 'tenant-user-agrobisnis-subang-gmail-com'
where tenant_id = 'tenant-makmur';

update public.activities
set tenant_id = 'tenant-user-agrobisnis-subang-gmail-com'
where tenant_id = 'tenant-makmur';

update public.inventory
set tenant_id = 'tenant-user-agrobisnis-subang-gmail-com'
where tenant_id = 'tenant-makmur';

update public.finance
set tenant_id = 'tenant-user-agrobisnis-subang-gmail-com'
where tenant_id = 'tenant-makmur';

-- 2.1) Dua akun Super Admin resmi.
-- ID whitelist bertipe UUID, jadi gunakan gen_random_uuid().
-- Jangan memasukkan ID teks seperti wl-kandi-super-admin karena akan gagal pada kolom UUID.

insert into public.whitelist (id, tenant_id, email, name, notes, status, created_at)
select gen_random_uuid(), 'tenant-user-kandiapj23-gmail-com',
       'kandiapj23@gmail.com', 'Kandi Andika Pratama Jaya',
       'Super Administrator', 'active', now()
where not exists (
  select 1 from public.whitelist where lower(email) = 'kandiapj23@gmail.com'
);

insert into public.whitelist (id, tenant_id, email, name, notes, status, created_at)
select gen_random_uuid(), 'tenant-user-pratamajayapreneur-gmail-com',
       'pratamajayapreneur@gmail.com', 'Jaya Agrofarm Administrator',
       'Super Administrator', 'active', now()
where not exists (
  select 1 from public.whitelist where lower(email) = 'pratamajayapreneur@gmail.com'
);

update public.app_users
set role = 'OWNER_ADMIN',
    name = case
      when lower(email) = 'pratamajayapreneur@gmail.com' then 'Jaya Agrofarm Administrator'
      when lower(email) = 'kandiapj23@gmail.com' then 'Kandi Andika Pratama Jaya'
      else name
    end
where lower(email) in ('pratamajayapreneur@gmail.com', 'kandiapj23@gmail.com');

update public.whitelist
set status = 'active',
    name = case
      when lower(email) = 'pratamajayapreneur@gmail.com' then 'Jaya Agrofarm Administrator'
      when lower(email) = 'kandiapj23@gmail.com' then 'Kandi Andika Pratama Jaya'
      else name
    end,
    notes = 'Super Administrator'
where lower(email) in ('pratamajayapreneur@gmail.com', 'kandiapj23@gmail.com');

-- 3) Fungsi keamanan. SECURITY DEFINER agar policy dapat membaca
--    mapping user -> tenant tanpa membuka tabel kepada pengguna lain.
create or replace function public.current_user_tenant_id()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (
      select w.tenant_id
      from public.whitelist w
      where lower(w.email) = lower(coalesce(auth.jwt()->>'email',''))
        and w.status in ('active','approved','paid')
      limit 1
    ),
    (
      select au.tenant_id
      from public.app_users au
      where lower(au.email) = lower(coalesce(auth.jwt()->>'email',''))
      limit 1
    )
  );
$$;

create or replace function public.is_owner_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select lower(coalesce(auth.jwt()->>'email','')) in ('pratamajayapreneur@gmail.com', 'kandiapj23@gmail.com')
      or exists (
        select 1
        from public.app_users au
        where lower(au.email) = lower(coalesce(auth.jwt()->>'email',''))
          and au.role = 'OWNER_ADMIN'
      );
$$;

create or replace function public.check_login_access(p_email text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.whitelist w
    where lower(w.email) = lower(trim(p_email))
      and w.status in ('active','approved','paid')
  );
$$;

grant execute on function public.current_user_tenant_id() to authenticated, anon;
grant execute on function public.is_owner_admin() to authenticated, anon;
grant execute on function public.check_login_access(text) to authenticated, anon;

-- 4) Hapus semua policy lama pada tabel yang perlu diisolasi.
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'crops','plots','activities','inventory','finance',
        'app_users','tenant_users','whitelist'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      r.policyname, r.schemaname, r.tablename
    );
  end loop;
end $$;

-- 5) Aktifkan RLS.
alter table public.crops enable row level security;
alter table public.plots enable row level security;
alter table public.activities enable row level security;
alter table public.inventory enable row level security;
alter table public.finance enable row level security;
alter table public.app_users enable row level security;
alter table public.tenant_users enable row level security;
alter table public.whitelist enable row level security;

-- 6) DATA PERTANIAN:
--    user biasa hanya melihat/mengubah tenant miliknya.
--    OWNER_ADMIN boleh melihat/mengelola seluruh tenant.
create policy "tenant_isolation_crops"
on public.crops for all to authenticated
using (public.is_owner_admin() or tenant_id = public.current_user_tenant_id())
with check (public.is_owner_admin() or tenant_id = public.current_user_tenant_id());

create policy "tenant_isolation_plots"
on public.plots for all to authenticated
using (public.is_owner_admin() or tenant_id = public.current_user_tenant_id())
with check (public.is_owner_admin() or tenant_id = public.current_user_tenant_id());

create policy "tenant_isolation_activities"
on public.activities for all to authenticated
using (public.is_owner_admin() or tenant_id = public.current_user_tenant_id())
with check (public.is_owner_admin() or tenant_id = public.current_user_tenant_id());

create policy "tenant_isolation_inventory"
on public.inventory for all to authenticated
using (public.is_owner_admin() or tenant_id = public.current_user_tenant_id())
with check (public.is_owner_admin() or tenant_id = public.current_user_tenant_id());

create policy "tenant_isolation_finance"
on public.finance for all to authenticated
using (public.is_owner_admin() or tenant_id = public.current_user_tenant_id())
with check (public.is_owner_admin() or tenant_id = public.current_user_tenant_id());

-- 7) APP USERS:
--    user hanya boleh membaca/memperbarui identitasnya sendiri;
--    admin boleh mengelola semuanya.
create policy "app_users_self_or_admin"
on public.app_users for all to authenticated
using (
  public.is_owner_admin()
  or id = auth.uid()::text
  or lower(email) = lower(coalesce(auth.jwt()->>'email',''))
)
with check (
  public.is_owner_admin()
  or (
    (id = auth.uid()::text or lower(email) = lower(coalesce(auth.jwt()->>'email','')))
    and tenant_id = public.current_user_tenant_id()
  )
);

-- 8) TENANT USERS:
--    user hanya melihat mapping dirinya sendiri; admin boleh semuanya.
create policy "tenant_users_self_or_admin"
on public.tenant_users for all to authenticated
using (
  public.is_owner_admin()
  or lower(email) = lower(coalesce(auth.jwt()->>'email',''))
  or user_id = auth.uid()
)
with check (
  public.is_owner_admin()
  or (
    lower(email) = lower(coalesce(auth.jwt()->>'email',''))
    and tenant_id = public.current_user_tenant_id()
  )
);

-- 9) WHITELIST:
--    admin boleh mengelola semuanya; user biasa hanya boleh membaca
--    baris whitelist miliknya sendiri (dibutuhkan saat login).
create policy "whitelist_select_self_or_admin"
on public.whitelist for select to authenticated
using (
  public.is_owner_admin()
  or lower(email) = lower(coalesce(auth.jwt()->>'email',''))
);

create policy "whitelist_admin_insert"
on public.whitelist for insert to authenticated
with check (public.is_owner_admin());

create policy "whitelist_admin_update"
on public.whitelist for update to authenticated
using (public.is_owner_admin())
with check (public.is_owner_admin());

create policy "whitelist_admin_delete"
on public.whitelist for delete to authenticated
using (public.is_owner_admin());

-- ====================================================
-- 10) SMART FARM MANAGEMENT SYSTEM TABLES & POLICIES
-- ====================================================

-- 10.0) Idempotensi: jika script pernah dijalankan sebagian, hapus policy
--      smart-farm yang akan dibuat ulang di bawah ini.
drop policy if exists "crop_growth_stages_read" on public.crop_growth_stages;
drop policy if exists "crop_growth_stages_admin_write" on public.crop_growth_stages;
drop policy if exists "crop_growth_indicators_read" on public.crop_growth_indicators;
drop policy if exists "crop_growth_indicators_admin_write" on public.crop_growth_indicators;
drop policy if exists "tenant_isolation_batch_growth_observations" on public.batch_growth_observations;
drop policy if exists "tenant_isolation_batch_growth_feedback" on public.batch_growth_feedback;

-- 10.1 Master Fase Pertumbuhan Tanaman (crop_growth_stages)
create table if not exists public.crop_growth_stages (
  id text primary key,
  commodity_id text not null,
  variety_id text,
  stage_code text not null,
  stage_name text not null,
  stage_group text not null, -- SEEDLING, VEGETATIVE, TRANSITION, GENERATIVE, FRUIT_DEVELOPMENT, MATURATION, PRODUCTION, HARVEST
  min_hst integer not null default 0,
  max_hst integer not null default 100,
  priority integer not null default 0,
  description text,
  is_estimate boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

alter table public.crop_growth_stages enable row level security;

create policy "crop_growth_stages_read"
on public.crop_growth_stages for select to authenticated
using (true);

create policy "crop_growth_stages_admin_write"
on public.crop_growth_stages for all to authenticated
using (public.is_owner_admin())
with check (public.is_owner_admin());

-- 10.2 Master Indikator Fenologi (crop_growth_indicators)
create table if not exists public.crop_growth_indicators (
  id text primary key,
  commodity_id text,
  indicator_code text not null,
  indicator_name text not null,
  stage_target text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

alter table public.crop_growth_indicators enable row level security;

create policy "crop_growth_indicators_read"
on public.crop_growth_indicators for select to authenticated
using (true);

create policy "crop_growth_indicators_admin_write"
on public.crop_growth_indicators for all to authenticated
using (public.is_owner_admin())
with check (public.is_owner_admin());

-- 10.3 Observasi Lapangan Batch (batch_growth_observations)
create table if not exists public.batch_growth_observations (
  id text primary key default ('obs-' || floor(extract(epoch from now())*1000)::text),
  tenant_id text not null references public.tenants(id) on delete cascade,
  batch_id text not null,
  indicator_id text not null,
  observed_date date not null default current_date,
  value text,
  notes text,
  created_by text,
  created_at timestamptz default now()
);

create index if not exists idx_batch_obs_tenant on public.batch_growth_observations(tenant_id);
create index if not exists idx_batch_obs_batch on public.batch_growth_observations(batch_id);

alter table public.batch_growth_observations enable row level security;

create policy "tenant_isolation_batch_growth_observations"
on public.batch_growth_observations for all to authenticated
using (public.is_owner_admin() or tenant_id = public.current_user_tenant_id())
with check (public.is_owner_admin() or tenant_id = public.current_user_tenant_id());

-- 10.4 Masukan & Feedback Petani (batch_growth_feedback)
create table if not exists public.batch_growth_feedback (
  id text primary key default ('fb-' || floor(extract(epoch from now())*1000)::text),
  tenant_id text not null references public.tenants(id) on delete cascade,
  batch_id text not null,
  issue_type text,
  actual_stage text,
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_batch_fb_tenant on public.batch_growth_feedback(tenant_id);
create index if not exists idx_batch_fb_batch on public.batch_growth_feedback(batch_id);

alter table public.batch_growth_feedback enable row level security;

create policy "tenant_isolation_batch_growth_feedback"
on public.batch_growth_feedback for all to authenticated
using (public.is_owner_admin() or tenant_id = public.current_user_tenant_id())
with check (public.is_owner_admin() or tenant_id = public.current_user_tenant_id());

commit;
