-- ============================================================
-- ASSIGNEES MIGRATION
-- Run this in the Supabase SQL editor.
-- All statements are idempotent — safe to run multiple times.
--
-- 1. Replace per-user client visibility RLS so ALL authenticated
--    users can see ALL clients.
-- 2. Replace per-user update restriction so ALL authenticated users
--    can edit any client (both Stephen and Brian manage shared data).
-- 3. Add assignees text[] column to store static staff names.
-- ============================================================

-- 1. SELECT: any authenticated user can read all clients
DROP POLICY IF EXISTS "clients_select" ON public.clients;
CREATE POLICY "clients_select" ON public.clients
  FOR SELECT USING (auth.role() = 'authenticated');

-- 2. UPDATE: any authenticated user can update any client
DROP POLICY IF EXISTS "clients_update" ON public.clients;
CREATE POLICY "clients_update" ON public.clients
  FOR UPDATE USING (auth.role() = 'authenticated');

-- 3. Add the assignees column (text array of static staff names)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS assignees text[] NOT NULL DEFAULT '{}';
