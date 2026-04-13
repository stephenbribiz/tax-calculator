import { Link, useParams } from 'react-router-dom'
import { useReports } from '@/hooks/useReports'
import { useClients } from '@/hooks/useClients'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { TaxOutput, TaxInput } from '@/types'

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const { clients } = useClients()
  const { reports, loading, deleteReport } = useReports(id)

  const client = clients.find(c => c.id === id)

  if (!client) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-slate-500">Loading client…</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to="/" className="text-sm text-slate-400 hover:text-slate-600">Dashboard</Link>
            <span className="text-slate-300">/</span>
            <span className="text-sm text-slate-600">{client.owner_name}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{client.owner_name}</h1>
          <p className="text-sm text-slate-500">{client.company_name} · {client.company_type} · {client.state}</p>
        </div>
        <Link to={`/reports/new?client=${client.id}`}>
          <Button size="sm">+ New Tax Plan</Button>
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-5 py-3 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-700">Tax Plans</h2>
        </div>
        {loading
          ? <p className="text-sm text-slate-400 px-5 py-6">Loading…</p>
          : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Period</th>
                  <th className="text-right text-xs font-semibold text-slate-500 px-5 py-3">Business Income</th>
                  <th className="text-right text-xs font-semibold text-slate-500 px-5 py-3">Total Owed</th>
                  <th className="text-right text-xs font-semibold text-slate-500 px-5 py-3">Net Due</th>
                  <th className="text-right text-xs font-semibold text-slate-500 px-5 py-3">Date</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.length === 0
                  ? (
                    <tr>
                      <td colSpan={6} className="text-center text-slate-400 py-8">
                        No tax plans for this client yet.
                      </td>
                    </tr>
                  )
                  : reports.map(report => {
                    const input = report.input_snapshot as unknown as TaxInput
                    const output = report.output_snapshot as unknown as TaxOutput
                    return (
                      <tr key={report.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3">
                          <Link to={`/reports/${report.id}`} className="font-medium text-blue-600 hover:underline">
                            {report.quarter} {report.tax_year}
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-right text-slate-600">
                          {formatCurrency(input.businessNetIncome)}
                        </td>
                        <td className="px-5 py-3 text-right text-slate-600">
                          {formatCurrency(output.totalTaxOwed)}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-slate-900">
                          {formatCurrency(output.netAmountDue)}
                        </td>
                        <td className="px-5 py-3 text-right text-slate-400 text-xs">
                          {report.date_completed ? formatDate(report.date_completed) : '—'}
                        </td>
                        <td className="px-5 py-3 text-right space-x-3">
                          <Link
                            to={`/reports/new?edit=${report.id}`}
                            className="text-xs text-blue-500 hover:text-blue-700"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={async () => {
                              if (confirm('Delete this tax plan?')) await deleteReport(report.id)
                            }}
                            className="text-xs text-red-400 hover:text-red-600"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    )
                  })
                }
              </tbody>
            </table>
          )
        }
      </div>
    </div>
  )
}
