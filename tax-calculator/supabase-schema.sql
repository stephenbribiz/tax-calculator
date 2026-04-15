-- Run this in your Supabase SQL editor to set up the database.

-- ============================================================
-- CLIENTS TABLE
-- ============================================================
create table if not exists public.clients (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid not null references auth.users(id) on delete cascade,
  company_name    text not null,
  company_type    text not null,
  owner_name      text not null,
  state           text not null,
  filing_status   text,
  ownership_pct   numeric(5,2) default 100,
  num_dependents  integer default 0,
  notes           text,
  unique (company_name, created_by)
);

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clients_updated_at
  before update on public.clients
  for each row execute procedure public.handle_updated_at();

-- ============================================================
-- REPORTS TABLE
-- ============================================================
create table if not exists public.reports (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  client_id        uuid not null references public.clients(id) on delete cascade,
  created_by       uuid not null references auth.users(id) on delete cascade,
  tax_year         integer not null,
  quarter          text not null,
  date_completed   date,
  input_snapshot   jsonb not null,
  output_snapshot  jsonb not null,
  is_final         boolean default false
);

create index if not exists reports_client_year_quarter
  on public.reports (client_id, tax_year, quarter);

-- ============================================================
-- ROW LEVEL SECURITY
-- All data is scoped to the authenticated user.
-- ============================================================
alter table public.clients enable row level security;
alter table public.reports enable row level security;

-- Clients: users can only see/modify their own records
create policy "clients_select" on public.clients
  for select using (auth.uid() = created_by);

create policy "clients_insert" on public.clients
  for insert with check (auth.uid() = created_by);

create policy "clients_update" on public.clients
  for update using (auth.uid() = created_by);

create policy "clients_delete" on public.clients
  for delete using (auth.uid() = created_by);

-- Reports: users can only see/modify their own records
create policy "reports_select" on public.reports
  for select using (auth.uid() = created_by);

create policy "reports_insert" on public.reports
  for insert with check (auth.uid() = created_by);

create policy "reports_update" on public.reports
  for update using (auth.uid() = created_by);

create policy "reports_delete" on public.reports
  for delete using (auth.uid() = created_by);

-- ============================================================
-- CLIENT ASSIGNMENTS (staff assignment, many-to-many)
-- Run this migration after the base schema above.
-- ============================================================

-- 1. Create the junction table
create table if not exists public.client_assignments (
  client_id    uuid not null references public.clients(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  assigned_at  timestamptz not null default now(),
  assigned_by  uuid references auth.users(id),
  primary key (client_id, user_id)
);

create index if not exists client_assignments_user_id
  on public.client_assignments (user_id);

alter table public.client_assignments enable row level security;

-- Any authenticated user can read assignments (to show the filter UI)
create policy "assignments_select" on public.client_assignments
  for select using (auth.role() = 'authenticated');

-- Only the client owner can add/remove assignments
create policy "assignments_insert" on public.client_assignments
  for insert with check (
    exists (select 1 from public.clients where id = client_id and created_by = auth.uid())
  );

create policy "assignments_delete" on public.client_assignments
  for delete using (
    exists (select 1 from public.clients where id = client_id and created_by = auth.uid())
  );

-- 2. Update clients SELECT policy so assigned users can see their clients
drop policy if exists "clients_select" on public.clients;
create policy "clients_select" on public.clients
  for select using (
    auth.uid() = created_by
    or exists (
      select 1 from public.client_assignments
      where client_id = id and user_id = auth.uid()
    )
  );

-- 3. Allow all authenticated users to read profiles (for the assignment picker)
-- (Drop any restrictive existing policy first)
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (auth.role() = 'authenticated');
