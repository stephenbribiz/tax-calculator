-- ============================================================
-- PIPELINE STATUS + BUSINESSES MIGRATION
-- Run this in the Supabase SQL editor.
-- All statements are idempotent — safe to run multiple times.
--
-- 1. Add pipeline_status column to reports table
--    Values: 'draft' | 'in_progress' | 'completed'
--    Existing is_final=true reports → 'in_progress'
--    Existing is_final=false reports → 'draft'
-- 2. Create businesses table (multiple businesses per client)
-- ============================================================

-- 1. Add pipeline_status to reports
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS pipeline_status text NOT NULL DEFAULT 'draft';

-- Backfill: finalized reports → in_progress (they were already submitted to client)
UPDATE public.reports
  SET pipeline_status = 'in_progress'
  WHERE is_final = true AND pipeline_status = 'draft';

-- 2. Businesses table
CREATE TABLE IF NOT EXISTS public.businesses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  company_name    text NOT NULL,
  company_type    text NOT NULL DEFAULT 'S-Corp',
  company_code    text,
  state           text NOT NULL DEFAULT 'TN',
  notes           text
);

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read all businesses (mirrors clients policy)
DROP POLICY IF EXISTS "businesses_select" ON public.businesses;
CREATE POLICY "businesses_select" ON public.businesses
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only creator can insert
DROP POLICY IF EXISTS "businesses_insert" ON public.businesses;
CREATE POLICY "businesses_insert" ON public.businesses
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Any authenticated user can update any business
DROP POLICY IF EXISTS "businesses_update" ON public.businesses;
CREATE POLICY "businesses_update" ON public.businesses
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Any authenticated user can delete any business
DROP POLICY IF EXISTS "businesses_delete" ON public.businesses;
CREATE POLICY "businesses_delete" ON public.businesses
  FOR DELETE USING (auth.role() = 'authenticated');
