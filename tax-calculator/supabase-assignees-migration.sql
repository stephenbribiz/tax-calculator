-- ============================================================
-- ASSIGNEES MIGRATION
-- Run this in the Supabase SQL editor.
--
-- 1. Replace the per-user client visibility RLS with a policy that
--    lets ANY authenticated user see ALL clients.
-- 2. Add a simple text[] column to store the static assignee names.
-- ============================================================

-- 1a. Drop the old policies that restrict visibility to created_by / assigned users
DROP POLICY IF EXISTS "clients_select" ON public.clients;

-- 1b. New policy: any logged-in user can see all clients
CREATE POLICY "clients_select" ON public.clients
  FOR SELECT USING (auth.role() = 'authenticated');

-- 2. Add the assignees column (array of static name strings)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS assignees text[] NOT NULL DEFAULT '{}';
