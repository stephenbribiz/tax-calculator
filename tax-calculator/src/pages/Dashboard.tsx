import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useClients } from '@/hooks/useClients'
import { useReports } from '@/hooks/useReports'
import { useAssigneeFilter } from '@/hooks/useAssigneeFilter'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { AssigneeFilter } from '@/components/ui/AssigneeFilter'
import { formatCurrency, formatDate } from '@/lib/utils'
import { formatOwnerName } from '@/pages/ClientList'
import type { TaxOutput } from '@/types'

/**
 * Returns the previous calendar quarter and its tax year.
 * We look back at what already happened to determine estimated payments,
 * so Q1 (Jan–Mar) data is used in Q2 (Apr–Jun), etc.
 *
 * Apr–Jun  → Q1 of current year
 * Jul–Sep  → Q2 of current year
 * Oct–Dec  → Q3 of current year
 * Jan–Mar  → Q4 of previous year
 */
function getPreviousQuarter(): { quarter: string; year: number } {
  const now = new Date()
  const month = now.getMonth() // 0-indexed
  const year = now.getFullYear()

  if (month < 3)  return { quarter: 'Q4', year: year - 1 } // Jan–Mar → Q4 last year
  if (month < 6)  return { quarter: 'Q1', year }            // Apr–Jun → Q1
  if (month < 9)  return { quarter: 'Q2', year }            // Jul–Sep → Q2
  return           { quarter: 'Q3', year }                   // Oct–Dec → Q3
}

export default function Dashboard() {
  const { clients, loading: clientsLoading } = useClients()
  const { reports, loading: reportsLoading } = useReports()
  const [clientSearch, setClientSearch] = useState('')
  const { selected: selectedAssignees, toggle: toggleAssignee, clear: clearAssignees } = useAssigneeFilter()

  const { quarter: currentQuarter, year: currentYear } = getPreviousQuarter()

  const currentYearReports = useMemo(
    () => reports.filter(r => r.tax_year === currentYear),
    [reports, currentYear]
  )

  const currentQuarterCount = useMemo(
    () => currentYearReports.filter(r => r.quarter === currentQuarter).length,
    [currentYearReports, currentQuarter]
  )

  const filteredClients = clients.filter(c => {
    if (clientSearch) {
      const q = clientSearch.toLowerCase()
      if (!c.owner_name.toLowerCase().includes(q) && !c.company_name.toLowerCase().includes(q)) return false
    }
    if (selectedAssignees.length > 0) {
      return selectedAssignees.some(name => (c.assignees ?? []).includes(name))
    }
    return true
  })

  const recentReports = useMemo(() => {
    if (selectedAssignees.length === 0) return reports.slice(0, 10)
    return reports.filter(r => {
      const client = clients.find(c => c.id === r.client_id)
      return selectedAssignees.some(name => (client?.assignees ?? []).includes(name))
    }).slice(0, 10)
  }, [reports, clients, selectedAssignees])

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Quarterly tax estimates</p>
        </div>
        <div className="flex gap-3">
          <Link to="/upload">
            <Button>Bulk Upload</Button>
          </Link>
          <Link to="/clients/new">
            <Button variant="secondary">+ New Client</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Clients</p>
          <p className="text-3xl font-bold text-slate-900">
            {clientsLoading ? '—' : clients.length}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Tax Plans</p>
          <p className="text-3xl font-bold text-slate-900">
            {reportsLoading ? '—' : reports.length}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Current Quarter</p>
          <p className="text-3xl font-bold text-slate-900">
            {reportsLoading ? '—' : `${currentQuarter} ${currentYear}`}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {reportsLoading ? '' : `${currentQuarterCount} plan${currentQuarterCount !== 1 ? 's' : ''} created`}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client list */}
        <div className="lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">Clients</h2>
            <Link to="/clients" className="text-xs text-orange-600 hover:underline">View all</Link>
          </div>
          <input
            type="text"
            value={clientSearch}
            onChange={e => setClientSearch(e.target.value)}
            placeholder="Search clients..."
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
          <div className="mb-3">
            <AssigneeFilter
              selected={selectedAssignees}
              onToggle={toggleAssignee}
              onClear={clearAssignees}
            />
          </div>
          <div className="space-y-2">
            {clientsLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))
              : filteredClients.slice(0, 8).map(client => (
                <Link
                  key={client.id}
                  to={`/clients/${client.id}`}
                  className="block bg-white rounded-lg border border-slate-200 px-4 py-3 hover:border-orange-300 hover:shadow-sm transition-all"
                >
                  <p className="text-sm font-medium text-slate-900">{formatOwnerName(client.owner_name)}</p>
                  <p className="text-xs text-slate-500">{client.company_name} · {client.company_type}</p>
                </Link>
              ))
            }
          </div>
        </div>

        {/* Recent reports */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">Recent Tax Plans</h2>
          </div>
          {reportsLoading
            ? (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden p-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            )
            : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Client</th>
                      <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Period</th>
                      <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Amount Due</th>
                      <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentReports.length === 0
                      ? (
                        <tr>
                          <td colSpan={4} className="text-center text-slate-400 py-8">
                            No tax plans yet. <Link to="/reports/new" className="text-orange-600 hover:underline">Create your first tax plan →</Link>
                          </td>
                        </tr>
                      )
                      : recentReports.map(report => {
                        const output = report.output_snapshot as unknown as TaxOutput
                        return (
                          <tr key={report.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3">
                              <Link to={`/reports/${report.id}`} className="font-medium text-slate-900 hover:text-orange-600">
                                {(report.input_snapshot as Record<string, string>).ownerName}
                              </Link>
                              <p className="text-xs text-slate-400">{(report.input_snapshot as Record<string, string>).companyName}</p>
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {report.quarter} {report.tax_year}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-900">
                              {formatCurrency(output.netAmountDue)}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-400 text-xs">
                              {report.date_completed ? formatDate(report.date_completed) : '—'}
                            </td>
                          </tr>
                        )
                      })
                    }
                  </tbody>
                </table>
              </div>
            )
          }
        </div>
      </div>
    </div>
  )
}
