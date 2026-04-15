import { useCallback, useEffect, useState } from 'react'
import { supabase, type DbProfile } from '@/lib/supabase'

export function useProfiles() {
  const [profiles, setProfiles] = useState<DbProfile[]>([])
  const [loading, setLoading] = useState(true)

  const fetchProfiles = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, created_at, updated_at')
      .order('full_name')
    setProfiles((data ?? []) as DbProfile[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchProfiles() }, [fetchProfiles])

  return { profiles, loading, refetch: fetchProfiles }
}
