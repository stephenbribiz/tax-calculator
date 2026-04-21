import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase, type DbBusiness } from '@/lib/supabase'

export function useBusinesses(ownerClientId?: string) {
  const { user } = useAuth()
  const [businesses, setBusinesses] = useState<DbBusiness[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)

  const fetchBusinesses = useCallback(async () => {
    if (!ownerClientId) {
      setBusinesses([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_client_id', ownerClientId)
      .order('company_name', { ascending: true })
    if (error) setError(error.message)
    else setBusinesses(data ?? [])
    setLoading(false)
  }, [ownerClientId])

  useEffect(() => { fetchBusinesses() }, [fetchBusinesses])

  async function addBusiness(fields: {
    company_name: string
    company_type: string
    company_code: string | null
    state: string
    notes: string | null
  }) {
    if (!user || !ownerClientId) return { error: new Error('Not authenticated') }
    const { data, error } = await supabase
      .from('businesses')
      .insert({ ...fields, owner_client_id: ownerClientId, created_by: user.id })
      .select()
      .single()
    if (!error && data) setBusinesses(prev => [...prev, data])
    return { data, error }
  }

  async function updateBusiness(id: string, fields: Partial<Omit<DbBusiness, 'id' | 'created_at' | 'created_by' | 'owner_client_id'>>) {
    const { data, error } = await supabase
      .from('businesses')
      .update(fields)
      .eq('id', id)
      .select()
      .single()
    if (!error && data) {
      setBusinesses(prev => prev.map(b => b.id === id ? data : b))
    }
    return { data, error }
  }

  async function deleteBusiness(id: string) {
    const { error } = await supabase.from('businesses').delete().eq('id', id)
    if (!error) setBusinesses(prev => prev.filter(b => b.id !== id))
    return error
  }

  return { businesses, loading, error, refetch: fetchBusinesses, addBusiness, updateBusiness, deleteBusiness }
}
