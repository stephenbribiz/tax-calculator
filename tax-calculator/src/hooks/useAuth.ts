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
    let cancelled = false

    async function init() {
      try {
        // If session was marked temporary (no "remember me"), clear it on fresh page load
        const isTemp = localStorage.getItem('tax-calc-session-temp') === 'true'
        const stillAlive = sessionStorage.getItem('tax-calc-session-alive')
        if (isTemp && !stillAlive) {
          localStorage.removeItem('tax-calc-session-temp')
          await supabase.auth.signOut().catch(() => {})
          if (!cancelled) setState({ user: null, session: null, loading: false, isAdmin: false })
          return
        }
        if (isTemp) {
          sessionStorage.setItem('tax-calc-session-alive', 'true')
        }

        // Get initial session with a timeout to prevent infinite spinner
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise<null>(resolve => setTimeout(() => resolve(null), 8000)),
        ])

        if (cancelled) return

        if (!sessionResult || !('data' in sessionResult)) {
          // Timed out — clear any stale auth state and show login
          console.warn('Auth session check timed out — clearing auth state')
          await supabase.auth.signOut().catch(() => {})
          setState({ user: null, session: null, loading: false, isAdmin: false })
          return
        }

        const session = sessionResult.data.session
        const isAdmin = session?.user ? await fetchIsAdmin(session.user.id) : false
        if (!cancelled) {
          setState({ user: session?.user ?? null, session, loading: false, isAdmin })
        }
      } catch (err) {
        console.warn('Auth initialization error:', err)
        if (!cancelled) {
          setState({ user: null, session: null, loading: false, isAdmin: false })
        }
      }
    }

    init()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return
      const isAdmin = session?.user ? await fetchIsAdmin(session.user.id) : false
      if (!cancelled) {
        setState({ user: session?.user ?? null, session, loading: false, isAdmin })
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  return state
}

async function fetchIsAdmin(userId: string): Promise<boolean> {
  try {
    const result = await Promise.race([
      supabase.from('profiles').select('role').eq('id', userId).single(),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 5000)),
    ])
    if (!result || !('data' in result)) return false
    if (result.error) {
      console.warn('Failed to fetch user profile:', result.error.message)
      return false
    }
    return result.data?.role === 'admin'
  } catch {
    return false
  }
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
