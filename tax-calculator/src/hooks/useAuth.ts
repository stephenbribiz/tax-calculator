import { useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  isAdmin: boolean
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    isAdmin: false,
  })

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const isAdmin = session?.user ? await fetchIsAdmin(session.user.id) : false
      setState({ user: session?.user ?? null, session, loading: false, isAdmin })
    })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const isAdmin = session?.user ? await fetchIsAdmin(session.user.id) : false
      setState({ user: session?.user ?? null, session, loading: false, isAdmin })
    })

    return () => subscription.unsubscribe()
  }, [])

  return state
}

async function fetchIsAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  if (error) {
    console.warn('Failed to fetch user profile:', error.message)
    return false
  }
  return data?.role === 'admin'
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}

export async function signOut() {
  return supabase.auth.signOut()
}
