-- ============================================================
-- ADMIN & AUDIT TRAIL MIGRATION
-- Run this in your Supabase SQL editor after the initial schema.
-- ============================================================

-- ============================================================
-- 1. PROFILES TABLE — stores user role (admin vs user)
-- ============================================================
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  role       text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Drop if exists to avoid duplicate trigger errors
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill profiles for existing users
insert into public.profiles (id, email, full_name)
select
  id,
  email,
  coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;

-- Auto-update updated_at on profiles
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

-- ============================================================
-- 2. AUDIT LOG TABLE — automatic change tracking
-- ============================================================
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  user_id     uuid references auth.users(id) on delete set null,
  user_email  text,
  action      text not null,         -- INSERT, UPDATE, DELETE
  table_name  text not null,         -- clients, reports
  record_id   uuid,                  -- the row that was changed
  old_data    jsonb,                 -- previous row (UPDATE/DELETE)
  new_data    jsonb,                 -- new row (INSERT/UPDATE)
  summary     text                   -- human-readable description
);

create index if not exists audit_log_created_at on public.audit_log (created_at desc);
create index if not exists audit_log_user_id on public.audit_log (user_id);
create index if not exists audit_log_table_name on public.audit_log (table_name);

-- ============================================================
-- 3. AUDIT TRIGGER FUNCTION
-- Automatically logs all changes to clients and reports tables.
-- ============================================================
create or replace function public.audit_trigger_func()
returns trigger language plpgsql security definer as $$
declare
  v_user_id   uuid;
  v_email     text;
  v_summary   text;
  v_record_id uuid;
begin
  -- Get the current user
  v_user_id := auth.uid();
  select email into v_email from public.profiles where id = v_user_id;

  -- Determine record ID and build summary
  if TG_OP = 'DELETE' then
    v_record_id := old.id;
    v_summary := TG_OP || ' on ' || TG_TABLE_NAME;
  else
    v_record_id := new.id;
    v_summary := TG_OP || ' on ' || TG_TABLE_NAME;
  end if;

  -- Add context to summary
  if TG_TABLE_NAME = 'clients' then
    if TG_OP = 'DELETE' then
      v_summary := v_summary || ': ' || old.company_name || ' (' || old.owner_name || ')';
    else
      v_summary := v_summary || ': ' || new.company_name || ' (' || new.owner_name || ')';
    end if;
  elsif TG_TABLE_NAME = 'reports' then
    if TG_OP = 'DELETE' then
      v_summary := v_summary || ': ' || old.quarter || ' ' || old.tax_year;
    else
      v_summary := v_summary || ': ' || new.quarter || ' ' || new.tax_year;
    end if;
  end if;

  insert into public.audit_log (user_id, user_email, action, table_name, record_id, old_data, new_data, summary)
  values (
    v_user_id,
    v_email,
    TG_OP,
    TG_TABLE_NAME,
    v_record_id,
    case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(new) else null end,
    v_summary
  );

  if TG_OP = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Attach audit triggers to clients table
drop trigger if exists audit_clients on public.clients;
create trigger audit_clients
  after insert or update or delete on public.clients
  for each row execute procedure public.audit_trigger_func();

-- Attach audit triggers to reports table
drop trigger if exists audit_reports on public.reports;
create trigger audit_reports
  after insert or update or delete on public.reports
  for each row execute procedure public.audit_trigger_func();

-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================

-- Profiles: users see their own, admins see all
alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_select_admin" on public.profiles
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id)
  with check (
    -- Users cannot change their own role (only admins can via direct SQL)
    role = (select p.role from public.profiles p where p.id = auth.uid())
  );

-- Audit log: only admins can read
alter table public.audit_log enable row level security;

create policy "audit_log_select_admin" on public.audit_log
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- 5. ADMIN ACCESS TO ALL CLIENTS AND REPORTS
-- Admins can view (but not modify) all team members' data.
-- ============================================================

-- Admins can read all clients
create policy "clients_select_admin" on public.clients
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Admins can read all reports
create policy "reports_select_admin" on public.reports
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- 6. MAKE YOURSELF AN ADMIN
-- Replace 'your-email@example.com' with YOUR email address,
-- then run this line to grant yourself admin access.
-- ============================================================
-- update public.profiles set role = 'admin' where email = 'your-email@example.com';
