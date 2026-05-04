import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

type PageState = 'loading' | 'ready' | 'success' | 'error'

export default function SetPassword() {
  const navigate = useNavigate()
  const [pageState, setPageState]   = useState<PageState>('loading')
  const [isInvite, setIsInvite]     = useState(false)
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [showPw, setShowPw]         = useState(false)

  useEffect(() => {
    // Supabase automatically parses the #access_token fragment and fires
    // onAuthStateChange. We wait for that before showing the form.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        if (session) {
          // Detect whether they arrived via an invite link
          const hash = window.location.hash
          setIsInvite(hash.includes('type=invite'))
          setPageState('ready')
        }
      }
    })

    // Also check if there's already an active session (page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && pageState === 'loading') {
        const hash = window.location.hash
        setIsInvite(hash.includes('type=invite'))
        setPageState('ready')
      }
    })

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)

    if (error) {
      setError(error.message)
    } else {
      setPageState('success')
      setTimeout(() => navigate('/'), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-8">

        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mb-4">
            <span className="text-3xl font-black tracking-tight">
              <span style={{ color: '#4A4A4A' }}>BRI</span><span style={{ color: '#E8842C' }}>BIZ</span>
            </span>
            <div className="text-[10px] font-semibold tracking-[0.1em] uppercase mt-0.5" style={{ color: '#9B9B9B' }}>
              Entertainment Business Mgmt
            </div>
          </div>
          <h1 className="text-lg font-bold text-slate-900">Tax Calculator</h1>
        </div>

        {pageState === 'loading' && (
          <div className="text-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Verifying your link…</p>
          </div>
        )}

        {pageState === 'error' && (
          <div className="text-center space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800 font-medium">This link is invalid or has expired.</p>
              <p className="text-xs text-red-600 mt-1">
                Request a new password reset from the login page, or contact your administrator for a new invite.
              </p>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-orange-600 hover:text-orange-800 font-medium"
            >
              ← Back to sign in
            </button>
          </div>
        )}

        {pageState === 'ready' && (
          <>
            <div className="mb-6 text-center">
              <p className="text-slate-700 font-medium">
                {isInvite ? 'Welcome! Create your password to get started.' : 'Choose a new password for your account.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoFocus
                    autoComplete="new-password"
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="At least 8 characters"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPw
                      ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    }
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Re-enter your password"
                />
              </div>

              {/* Password strength hint */}
              {password.length > 0 && password.length < 8 && (
                <p className="text-xs text-amber-600">Password needs at least 8 characters.</p>
              )}
              {password.length >= 8 && confirm.length > 0 && password !== confirm && (
                <p className="text-xs text-red-600">Passwords don't match yet.</p>
              )}

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-orange-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
              >
                {saving ? 'Setting password…' : (isInvite ? 'Create Password & Sign In' : 'Set New Password')}
              </button>
            </form>
          </>
        )}

        {pageState === 'success' && (
          <div className="text-center space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <svg className="w-8 h-8 text-green-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-green-800 font-medium">Password set! Taking you to the app…</p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
