import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { DbClientAssignment } from '@/lib/supabase'

export function useClientAssignments(clientId: string | undefined) {
  const [assignments, setAssignments] = useState<DbClientAssignment[]>([])
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()

  const fetchAssignments = useCallback(async () => {
    if (!clientId) return
    setLoading(true)
    // Fetch just user_id + assigned_at; profile names are resolved separately
    // from the profiles list (avoids a cross-schema FK join issue with PostgREST)
    const { data } = await supabase
      .from('client_assignments')
      .select('user_id, assigned_at')
      .eq('client_id', clientId)
      .order('assigned_at')
    setAssignments((data ?? []) as unknown as DbClientAssignment[])
    setLoading(false)
  }, [clientId])

  useEffect(() => { fetchAssignments() }, [fetchAssignments])

  const addAssignment = useCallback(async (userId: string) => {
    if (!clientId || !user) return null
    const { error } = await supabase
      .from('client_assignments')
      .insert({ client_id: clientId, user_id: userId, assigned_by: user.id })
    if (!error) await fetchAssignments()
    return error
  }, [clientId, user, fetchAssignments])

  const removeAssignment = useCallback(async (userId: string) => {
    if (!clientId) return null
    const { error } = await supabase
      .from('client_assignments')
      .delete()
      .eq('client_id', clientId)
      .eq('user_id', userId)
    if (!error) setAssignments(prev => prev.filter(a => a.user_id !== userId))
    return error
  }, [clientId])

  return { assignments, loading, addAssignment, removeAssignment, refetch: fetchAssignments }
}
