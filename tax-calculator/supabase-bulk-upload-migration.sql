-- ============================================================
-- BULK UPLOAD MIGRATION
-- Run this in your Supabase SQL editor after the initial schema.
-- ============================================================

-- 1. Add client_code to clients table
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_code text;

-- Unique per user (two different users can use the same code)
CREATE UNIQUE INDEX IF NOT EXISTS clients_code_unique_per_user
  ON public.clients (created_by, client_code)
  WHERE client_code IS NOT NULL;

-- 2. Documents table for tracking uploaded files
CREATE TABLE IF NOT EXISTS public.documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id     uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  file_name     text NOT NULL,
  file_type     text NOT NULL,          -- 'pl' | 'adp_payroll'
  storage_path  text NOT NULL,
  file_size     integer,
  tax_year      integer NOT NULL,
  quarter       text,                   -- 'Q1'–'Q4', nullable
  parsed_data   jsonb,                  -- PLExtractedData or ADPExtractedData
  status        text NOT NULL DEFAULT 'pending',  -- 'pending' | 'applied' | 'skipped'
  report_id     uuid REFERENCES public.reports(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS documents_client_idx
  ON public.documents (client_id, tax_year);

-- 3. RLS for documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_select" ON public.documents
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "documents_insert" ON public.documents
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "documents_update" ON public.documents
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "documents_delete" ON public.documents
  FOR DELETE USING (auth.uid() = created_by);

-- 4. Storage bucket for client documents
-- NOTE: Create the bucket 'client-documents' in the Supabase dashboard
-- Settings: Private, 20MB file size limit, allowed MIME types: application/pdf
--
-- Then add this storage RLS policy via SQL:
CREATE POLICY "storage_user_folder" ON storage.objects
  FOR ALL USING (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'client-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
