import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { ToastProvider } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { AppShell } from '@/components/layout/AppShell'
import Login from '@/pages/Login'
import SetPassword from '@/pages/SetPassword'
import Dashboard from '@/pages/Dashboard'
import NewReport from '@/pages/NewReport'
import ReportView from '@/pages/ReportView'
import ClientList from '@/pages/ClientList'
import ClientDetail from '@/pages/ClientDetail'
import NewClient from '@/pages/NewClient'
import QuickCalculator from '@/pages/QuickCalculator'
import AdminAuditLog from '@/pages/AdminAuditLog'
import BulkUpload from '@/pages/BulkUpload'
import QuarterlyPlans from '@/pages/QuarterlyPlans'

/**
 * Detects invite/recovery tokens in the URL hash and redirects to /reset-password
 * before AuthGuard can send the auto-signed-in user straight to the dashboard.
 */
function AuthEventHandler() {
  const navigate = useNavigate()

  useEffect(() => {
    // Check hash on first load — Supabase puts type=invite or type=recovery here
    const hash = window.location.hash
    if (hash.includes('type=invite') || hash.includes('type=recovery')) {
      navigate('/reset-password', { replace: true })
      return
    }

    // Also listen for PASSWORD_RECOVERY events (fired when reset link is clicked)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password', { replace: true })
      }
    })
    return () => subscription.unsubscribe()
  }, [navigate])

  return null
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return <AppShell>{children}</AppShell>
}

// Redirect to dashboard if already logged in
function LoginRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
      </div>
    )
  }

  if (user) return <Navigate to="/" replace />
  return <Login />
}

export default function App() {
  return (
    <ToastProvider>
    <BrowserRouter>
      <AuthEventHandler />
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/reset-password" element={<SetPassword />} />
        <Route path="/" element={<AuthGuard><Dashboard /></AuthGuard>} />
        <Route path="/reports/new" element={<AuthGuard><NewReport /></AuthGuard>} />
        <Route path="/reports/:id" element={<AuthGuard><ReportView /></AuthGuard>} />
        <Route path="/clients" element={<AuthGuard><ClientList /></AuthGuard>} />
        <Route path="/clients/new" element={<AuthGuard><NewClient /></AuthGuard>} />
        <Route path="/clients/:id" element={<AuthGuard><ClientDetail /></AuthGuard>} />
        <Route path="/plans" element={<AuthGuard><QuarterlyPlans /></AuthGuard>} />
        <Route path="/upload" element={<AuthGuard><BulkUpload /></AuthGuard>} />
        <Route path="/calculator" element={<AuthGuard><QuickCalculator /></AuthGuard>} />
        <Route path="/admin" element={<AuthGuard><AdminAuditLog /></AuthGuard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </ToastProvider>
  )
}
