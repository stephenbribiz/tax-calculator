import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ---- Database types ----

export interface DbClient {
  id: string
  created_at: string
  updated_at: string
  created_by: string
  company_name: string
  company_type: string
  owner_name: string
  state: string
  filing_status: string
  ownership_pct: number
  num_dependents: number
  notes: string | null
}

export interface DbReport {
  id: string
  created_at: string
  client_id: string
  created_by: string
  tax_year: number
  quarter: string
  date_completed: string | null
  input_snapshot: Record<string, unknown>
  output_snapshot: Record<string, unknown>
  is_final: boolean
}
