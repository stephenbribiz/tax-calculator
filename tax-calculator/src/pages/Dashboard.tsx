import { Link } from 'react-router-dom'
import { useClients } from '@/hooks/useClients'
import { useReports } from '@/hooks/useReports'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { TaxOutput } from '@/types'

export default function Dashboard() {
  const { clients, loading: clientsLoading } = useClients()
  const { reports, loading: reportsLoading } = useReports()

  const recentReports = reports.slice(0, 10)

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Quarterly tax estimates</p>
        </div>
        <div className="flex gap-3">
          <Link to="/clients/new">
            <Button>+ New Client</Button>
          </Link>
          <Link to="/calculator">
            <Button variant="secondary">Quick Calculator</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">This Year</p>
          <p className="text-3xl font-bold text-slate-900">
            {reportsLoading ? '—' : reports.filter(r => r.tax_year === new Date().getFullYear()).length}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client list */}
        <div className="lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">Clients</h2>
            <Link to="/clients" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {clientsLoading
              ? <p className="text-sm text-slate-400">Loading…</p>
              : clients.slice(0, 8).map(client => (
                <Link
                  key={client.id}
                  to={`/clients/${client.id}`}
                  className="block bg-white rounded-lg border border-slate-200 px-4 py-3 hover:border-blue-300 hover:shadow-sm transition-all"
                >
                  <p className="text-sm font-medium text-slate-900">{client.owner_name}</p>
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
            ? <p className="text-sm text-slate-400">Loading…</p>
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
                            No tax plans yet. <Link to="/reports/new" className="text-blue-600 hover:underline">Create your first tax plan →</Link>
                          </td>
                        </tr>
                      )
                      : recentReports.map(report => {
                        const output = report.output_snapshot as unknown as TaxOutput
                        return (
                          <tr key={report.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3">
                              <Link to={`/reports/${report.id}`} className="font-medium text-slate-900 hover:text-blue-600">
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
