-- ============================================================
-- FIX: Admin RLS circular reference
-- The profiles_select_admin policy references profiles itself,
-- causing a silent failure. This creates a security definer
-- function that bypasses RLS for the admin check.
-- ============================================================

-- 1. Create a helper function that checks admin status without RLS
create or replace function public.is_admin()
returns boolean language plpgsql security definer as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$;

-- 2. Drop the broken policies
drop policy if exists "profiles_select_admin" on public.profiles;
drop policy if exists "audit_log_select_admin" on public.audit_log;
drop policy if exists "clients_select_admin" on public.clients;
drop policy if exists "reports_select_admin" on public.reports;

-- 3. Recreate them using the helper function
create policy "profiles_select_admin" on public.profiles
  for select using (public.is_admin());

create policy "audit_log_select_admin" on public.audit_log
  for select using (public.is_admin());

create policy "clients_select_admin" on public.clients
  for select using (public.is_admin());

create policy "reports_select_admin" on public.reports
  for select using (public.is_admin());
