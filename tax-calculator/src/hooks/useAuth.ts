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
    // If session was marked temporary (no "remember me"), clear it on fresh page load
    // sessionStorage flag survives tab refreshes but not browser close
    const isTemp = localStorage.getItem('tax-calc-session-temp') === 'true'
    const stillAlive = sessionStorage.getItem('tax-calc-session-alive')
    if (isTemp && !stillAlive) {
      // Browser was closed and reopened — sign out
      supabase.auth.signOut().then(() => {
        localStorage.removeItem('tax-calc-session-temp')
        setState({ user: null, session: null, loading: false, isAdmin: false })
      })
      return
    }
    // Mark session as alive for this browser session
    if (isTemp) {
      sessionStorage.setItem('tax-calc-session-alive', 'true')
    }

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
  localStorage.removeItem('tax-calc-session-temp')
  sessionStorage.removeItem('tax-calc-session-alive')
  return supabase.auth.signOut()
}
