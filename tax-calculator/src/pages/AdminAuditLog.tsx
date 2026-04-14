import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Navigate } from 'react-router-dom'

interface AuditEntry {
  id: string
  created_at: string
  user_email: string | null
  action: string
  table_name: string
  record_id: string | null
  summary: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
}

interface TeamMember {
  id: string
  email: string
  full_name: string
  role: string
}

export default function AdminAuditLog() {
  const { isAdmin, loading: authLoading } = useAuth()
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'audit' | 'team'>('audit')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Filters
  const [filterAction, setFilterAction] = useState<string>('all')
  const [filterTable, setFilterTable] = useState<string>('all')
  const [filterUser, setFilterUser] = useState<string>('all')

  useEffect(() => {
    if (!isAdmin) return
    loadData()
  }, [isAdmin])

  async function loadData() {
    setLoading(true)
    const [auditRes, teamRes] = await Promise.all([
      supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .order('created_at', { ascending: true }),
    ])
    setEntries(auditRes.data ?? [])
    setMembers(teamRes.data ?? [])
    setLoading(false)
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
      </div>
    )
  }

  if (!isAdmin) return <Navigate to="/" replace />

  const filteredEntries = entries.filter(e => {
    if (filterAction !== 'all' && e.action !== filterAction) return false
    if (filterTable !== 'all' && e.table_name !== filterTable) return false
    if (filterUser !== 'all' && e.user_email !== filterUser) return false
    return true
  })

  const uniqueEmails = [...new Set(entries.map(e => e.user_email).filter(Boolean))]

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Admin Panel</h1>
        <p className="text-sm text-slate-500 mt-1">Audit trail and team management</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('audit')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'audit' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Audit Trail
        </button>
        <button
          onClick={() => setTab('team')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'team' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Team Members
        </button>
      </div>

      {tab === 'team' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Name</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Email</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map(m => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-900 font-medium">{m.full_name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{m.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      m.role === 'admin'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {m.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
            To change a user's role, run in Supabase SQL editor: <code className="bg-slate-200 px-1 py-0.5 rounded">update profiles set role = 'admin' where email = '...'</code>
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <select
              value={filterAction}
              onChange={e => setFilterAction(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white"
            >
              <option value="all">All Actions</option>
              <option value="INSERT">Created</option>
              <option value="UPDATE">Updated</option>
              <option value="DELETE">Deleted</option>
            </select>
            <select
              value={filterTable}
              onChange={e => setFilterTable(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white"
            >
              <option value="all">All Tables</option>
              <option value="clients">Clients</option>
              <option value="reports">Reports</option>
            </select>
            <select
              value={filterUser}
              onChange={e => setFilterUser(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white"
            >
              <option value="all">All Users</option>
              {uniqueEmails.map(email => (
                <option key={email} value={email!}>{email}</option>
              ))}
            </select>
            <button
              onClick={loadData}
              disabled={loading}
              className="text-sm text-orange-600 hover:text-orange-800 font-medium px-3 py-1.5"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {/* Audit Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">When</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">User</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Action</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">
                      {loading ? 'Loading audit trail...' : 'No audit entries found.'}
                    </td>
                  </tr>
                )}
                {filteredEntries.map(entry => (
                  <tr
                    key={entry.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  >
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                      {formatTimestamp(entry.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {entry.user_email ?? 'System'}
                    </td>
                    <td className="px-4 py-3">
                      <ActionBadge action={entry.action} table={entry.table_name} />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">
                      {entry.summary ?? `${entry.action} on ${entry.table_name}`}
                      {expandedId === entry.id && (
                        <div className="mt-2 space-y-2">
                          {entry.action === 'UPDATE' && entry.old_data && entry.new_data && (
                            <DiffView old_data={entry.old_data} new_data={entry.new_data} table={entry.table_name} />
                          )}
                          {entry.action === 'INSERT' && entry.new_data && (
                            <DataView label="Created" data={entry.new_data} table={entry.table_name} />
                          )}
                          {entry.action === 'DELETE' && entry.old_data && (
                            <DataView label="Deleted" data={entry.old_data} table={entry.table_name} />
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-400">
              Showing {filteredEntries.length} of {entries.length} entries (click a row to expand details)
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function ActionBadge({ action, table }: { action: string; table: string }) {
  const colors: Record<string, string> = {
    INSERT: 'bg-green-100 text-green-800',
    UPDATE: 'bg-orange-100 text-orange-800',
    DELETE: 'bg-red-100 text-red-800',
  }
  const labels: Record<string, string> = {
    INSERT: 'Created',
    UPDATE: 'Updated',
    DELETE: 'Deleted',
  }

  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[action] ?? 'bg-slate-100 text-slate-600'}`}>
        {labels[action] ?? action}
      </span>
      <span className="text-xs text-slate-400">{table}</span>
    </span>
  )
}

// Show relevant fields, skip noisy ones like jsonb snapshots
const SKIP_FIELDS = new Set(['id', 'created_at', 'updated_at', 'created_by', 'input_snapshot', 'output_snapshot'])

function DataView({ label, data, table }: { label: string; data: Record<string, unknown>; table: string }) {
  const fields = Object.entries(data).filter(([k]) => !SKIP_FIELDS.has(k))

  return (
    <div className="bg-slate-50 rounded-lg p-3 text-xs">
      <div className="font-semibold text-slate-500 mb-1">{label} {table} record:</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {fields.map(([key, value]) => (
          <div key={key}>
            <span className="text-slate-400">{key}:</span>{' '}
            <span className="text-slate-700">{String(value ?? '—')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DiffView({ old_data, new_data, table }: { old_data: Record<string, unknown>; new_data: Record<string, unknown>; table: string }) {
  const allKeys = [...new Set([...Object.keys(old_data), ...Object.keys(new_data)])]
    .filter(k => !SKIP_FIELDS.has(k))

  const changes = allKeys.filter(k => JSON.stringify(old_data[k]) !== JSON.stringify(new_data[k]))

  if (changes.length === 0) {
    return <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-400">No visible field changes ({table})</div>
  }

  return (
    <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1">
      <div className="font-semibold text-slate-500 mb-1">Changes to {table} record:</div>
      {changes.map(key => (
        <div key={key} className="flex gap-2">
          <span className="text-slate-400 w-28 flex-shrink-0">{key}:</span>
          <span className="text-red-600 line-through">{String(old_data[key] ?? '—')}</span>
          <span className="text-slate-400">→</span>
          <span className="text-green-700">{String(new_data[key] ?? '—')}</span>
        </div>
      ))}
    </div>
  )
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
