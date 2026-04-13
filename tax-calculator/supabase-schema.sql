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
