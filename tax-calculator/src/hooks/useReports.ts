import { useCallback, useEffect, useState } from 'react'
import { supabase, type DbReport } from '@/lib/supabase'

export function useReports(clientId?: string) {
  const [reports, setReports]   = useState<DbReport[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('reports').select('*').order('tax_year', { ascending: false })
    if (clientId) query = query.eq('client_id', clientId)

    const { data, error } = await query
    if (error) setError(error.message)
    else setReports(data ?? [])
    setLoading(false)
  }, [clientId])

  useEffect(() => { fetchReports() }, [fetchReports])

  async function deleteReport(id: string) {
    const { error } = await supabase.from('reports').delete().eq('id', id)
    if (!error) setReports(prev => prev.filter(r => r.id !== id))
    return error
  }

  return { reports, loading, error, refetch: fetchReports, deleteReport }
}

export async function getReport(id: string) {
  return supabase.from('reports').select('*, clients(*)').eq('id', id).single()
}
