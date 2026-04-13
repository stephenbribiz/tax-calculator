import { useCallback, useEffect, useState } from 'react'
import { supabase, type DbClient } from '@/lib/supabase'

export function useClients() {
  const [clients, setClients]   = useState<DbClient[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const fetchClients = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('company_name')

    if (error) setError(error.message)
    else setClients(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchClients() }, [fetchClients])

  async function deleteClient(id: string) {
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (!error) setClients(prev => prev.filter(c => c.id !== id))
    return error
  }

  return { clients, loading, error, refetch: fetchClients, deleteClient }
}
