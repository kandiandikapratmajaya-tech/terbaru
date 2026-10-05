-- ============================================================
-- JAYA AGROFARM NUSANTARA: SMART FARM UPGRADE SCHEMA
-- Jalankan di Supabase -> SQL Editor -> New Query
-- Menambahkan master fase, indikator fenologi, observasi lapangan,
-- feedback kesesuaian fase, serta isolasi data per tenant.
-- ============================================================

begin;

-- 1) Penambahan kolom metode tanam & panen aktual pada tabel crops
alter table if exists public.crops
  add column if not exists planting_method text default 'nursery_transplant',
  add column if not exists actual_first_harvest_date date,
  add column if not exists actual_harvest_cycle integer;

-- 2) Master Fase Pertumbuhan Tanaman (crop_growth_stages)
create table if not exists public.crop_growth_stages (
  id uuid default gen_random_uuid() primary key,
  commodity text not null,
  variety text,
  stage_code text not null,
  stage_name text not null,
  stage_group text not null, -- SEEDLING, VEGETATIVE, TRANSITION, GENERATIVE, FRUIT_DEVELOPMENT, MATURATION, PRODUCTION, HARVEST
  min_hst integer not null,
  max_hst integer not null,
  priority integer default 1,
  description text,
  is_estimate boolean default true,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 3) Master Indikator Fenologi (crop_growth_indicators)
create table if not exists public.crop_growth_indicators (
  id uuid default gen_random_uuid() primary key,
  code text not null unique,
  name text not null,
  category text not null,
  description text,
  promotes_group text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 4) Observasi Lapangan Batch Tanaman (batch_growth_observations)
create table if not exists public.batch_growth_observations (
  id uuid default gen_random_uuid() primary key,
  tenant_id text not null,
  batch_id text not null, -- Mereferensikan crops.id
  indicator_code text not null,
  indicator_name text,
  observed_date date not null default current_date,
  value text default 'true',
  notes text,
  created_by text,
  created_at timestamptz default now()
);

-- Index performa query observasi
create index if not exists idx_batch_obs_tenant_batch
  on public.batch_growth_observations (tenant_id, batch_id, observed_date desc);

-- 5) Feedback Kesesuaian Fase Pengguna (batch_growth_feedback)
create table if not exists public.batch_growth_feedback (
  id uuid default gen_random_uuid() primary key,
  tenant_id text not null,
  batch_id text not null,
  is_accurate boolean not null,
  reason text,
  notes text,
  observed_stage text,
  hst integer,
  created_at timestamptz default now()
);

create index if not exists idx_batch_feedback_tenant
  on public.batch_growth_feedback (tenant_id, batch_id);

-- 6) Konfigurasi Row Level Security (RLS) & Isolasi Multi-Tenant
alter table public.crop_growth_stages enable row level security;
alter table public.crop_growth_indicators enable row level security;
alter table public.batch_growth_observations enable row level security;
alter table public.batch_growth_feedback enable row level security;

-- Policy Master: Semua user terautentikasi dapat membaca master data fase & indikator
create policy "allow_select_stages"
  on public.crop_growth_stages for select to authenticated
  using (true);

create policy "allow_select_indicators"
  on public.crop_growth_indicators for select to authenticated
  using (true);

-- Policy Observasi: Isolasi ketat per tenant
create policy "tenant_isolation_observations"
  on public.batch_growth_observations for all to authenticated
  using (public.is_owner_admin() or tenant_id = public.current_user_tenant_id())
  with check (public.is_owner_admin() or tenant_id = public.current_user_tenant_id());

-- Policy Feedback: Isolasi ketat per tenant
create policy "tenant_isolation_feedback"
  on public.batch_growth_feedback for all to authenticated
  using (public.is_owner_admin() or tenant_id = public.current_user_tenant_id())
  with check (public.is_owner_admin() or tenant_id = public.current_user_tenant_id());

commit;
