import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { signIn } from '@/hooks/useAuth'

export default function Login() {
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [rememberMe, setRememberMe]   = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [loading, setLoading]         = useState(false)
  const [mode, setMode]               = useState<'login' | 'forgot' | 'sent'>('login')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      })
      if (error) {
        setError(error.message)
      } else {
        setMode('sent')
      }
      setLoading(false)
      return
    }

    const { error } = await signIn(email, password)
    if (error) {
      setError(error.message)
    } else if (!rememberMe) {
      // If not remembering, mark session as temporary
      localStorage.setItem('tax-calc-session-temp', 'true')
    } else {
      localStorage.removeItem('tax-calc-session-temp')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-8">
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
          <p className="text-slate-500 mt-1 text-sm">
            {mode === 'login' && 'Sign in to your account'}
            {mode === 'forgot' && 'Reset your password'}
            {mode === 'sent' && 'Check your email'}
          </p>
        </div>

        {mode === 'sent' ? (
          <div className="text-center space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                Password reset link sent to <strong>{email}</strong>. Check your inbox and follow the link to set a new password.
              </p>
            </div>
            <button
              onClick={() => { setMode('login'); setError(null) }}
              className="text-sm text-orange-600 hover:text-orange-800 font-medium"
            >
              ← Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="you@firm.com"
              />
            </div>

            {mode === 'login' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>
            )}

            {mode === 'login' && (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-sm text-slate-600">Remember me for 30 days</span>
                </label>
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(null) }}
                  className="text-sm text-orange-600 hover:text-orange-800 font-medium"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading
                ? (mode === 'forgot' ? 'Sending…' : 'Signing in…')
                : (mode === 'forgot' ? 'Send Reset Link' : 'Sign In')}
            </button>

            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null) }}
                className="w-full text-sm text-slate-500 hover:text-slate-700 font-medium py-1"
              >
                ← Back to sign in
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
