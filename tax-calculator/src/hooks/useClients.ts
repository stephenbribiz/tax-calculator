import { useCallback, useEffect, useState } from 'react'
import { supabase, type DbClient } from '@/lib/supabase'

export function useClients() {
  const [clients, setClients]   = useState<DbClient[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const fetchClients = useCallback(async () => {
    setLoading(true)

    // Try with assignments join; fall back to plain select if migration hasn't run yet
    const { data, error } = await supabase
      .from('clients')
      .select('*, client_assignments(user_id, assigned_at, profiles(full_name, email))')

    if (error) {
      const fallback = await supabase.from('clients').select('*')
      if (fallback.error) setError(fallback.error.message)
      else setClients((fallback.data ?? []) as DbClient[])
    } else {
      setClients((data ?? []) as unknown as DbClient[])
    }

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
