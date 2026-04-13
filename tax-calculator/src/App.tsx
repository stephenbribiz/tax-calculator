import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { AppShell } from '@/components/layout/AppShell'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import NewReport from '@/pages/NewReport'
import ReportView from '@/pages/ReportView'
import ClientList from '@/pages/ClientList'
import ClientDetail from '@/pages/ClientDetail'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (user) return <Navigate to="/" replace />
  return <Login />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/" element={<AuthGuard><Dashboard /></AuthGuard>} />
        <Route path="/reports/new" element={<AuthGuard><NewReport /></AuthGuard>} />
        <Route path="/reports/:id" element={<AuthGuard><ReportView /></AuthGuard>} />
        <Route path="/clients" element={<AuthGuard><ClientList /></AuthGuard>} />
        <Route path="/clients/:id" element={<AuthGuard><ClientDetail /></AuthGuard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
