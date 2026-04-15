import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useReports } from '@/hooks/useReports'
import { useClients } from '@/hooks/useClients'
import { useProfiles } from '@/hooks/useProfiles'
import { useAuth } from '@/hooks/useAuth'
import { UserFilter } from '@/components/ui/UserFilter'
import { formatCurrency } from '@/lib/utils'
import { formatOwnerName } from '@/pages/ClientList'
import type { TaxOutput, TaxInput } from '@/types'

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const
type Quarter = typeof QUARTERS[number]

type SortCol = 'client' | 'federal' | 'fica' | 'payroll' | 'state' | 'total'

interface PlanRow {
  reportId: string
  clientId: string
  ownerName: string
  companyName: string
  companyType: string
  state: string
  federalIncomeTax: number
  ficaSE: number
  payrollAdj: number        // additional FICA from confirmed salary adjustment
  payrollAdjSalary: number  // the extra payroll amount (for display)
  stateTax: number
  netDue: number
}

export default function QuarterlyPlans() {
  const currentYear = new Date().getFullYear()
  const { reports, loading: reportsLoading } = useReports()
  const { clients } = useClients()
  const { profiles } = useProfiles()
  const { user } = useAuth()

  const [year, setYear] = useState(currentYear)
  const [quarter, setQuarter] = useState<Quarter>('Q1')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [sortCol, setSortCol] = useState<SortCol>('client')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const availableYears = useMemo(() => {
    const years = [...new Set(reports.map(r => r.tax_year))].sort((a, b) => b - a)
    if (!years.includes(currentYear)) years.unshift(currentYear)
    return years
  }, [reports, currentYear])

  const rows = useMemo<PlanRow[]>(() => {
    const filtered = reports.filter(r => {
      if (r.tax_year !== year || r.quarter !== quarter) return false
      if (selectedUsers.length > 0) {
        const client = clients.find(c => c.id === r.client_id)
        const ids = (client?.client_assignments ?? []).map(a => a.user_id)
        return selectedUsers.some(uid => ids.includes(uid))
      }
      return true
    })

    const mapped = filtered.map(r => {
      const input = r.input_snapshot as unknown as TaxInput
      const out = r.output_snapshot as unknown as TaxOutput
      const p = out.quarterProration
      return {
        reportId: r.id,
        clientId: r.client_id,
        ownerName: input.ownerName,
        companyName: input.companyName,
        companyType: input.companyType,
        state: input.state,
        federalIncomeTax: out.federal.netIncomeTax * p,
        ficaSE: (out.federal.seTax + out.federal.ficaAlreadyPaid) * p,
        payrollAdj: out.scorp?.additionalFICA ?? 0,
        payrollAdjSalary: out.scorp
          ? Math.max(0, (out.scorp.adjustedSalary ?? 0) - (out.scorp.currentSalary ?? 0))
          : 0,
        stateTax: out.totalStateOwed,
        netDue: out.netAmountDue,
      }
    })

    return [...mapped].sort((a, b) => {
      let cmp = 0
      if (sortCol === 'client') cmp = a.ownerName.localeCompare(b.ownerName)
      else if (sortCol === 'federal') cmp = a.federalIncomeTax - b.federalIncomeTax
      else if (sortCol === 'fica') cmp = a.ficaSE - b.ficaSE
      else if (sortCol === 'payroll') cmp = a.payrollAdj - b.payrollAdj
      else if (sortCol === 'state') cmp = a.stateTax - b.stateTax
      else if (sortCol === 'total') cmp = a.netDue - b.netDue
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [reports, clients, year, quarter, selectedUsers, sortCol, sortDir])

  const totals = useMemo(() => rows.reduce(
    (acc, r) => ({
      federalIncomeTax: acc.federalIncomeTax + r.federalIncomeTax,
      ficaSE: acc.ficaSE + r.ficaSE,
      payrollAdj: acc.payrollAdj + r.payrollAdj,
      stateTax: acc.stateTax + r.stateTax,
      netDue: acc.netDue + r.netDue,
    }),
    { federalIncomeTax: 0, ficaSE: 0, payrollAdj: 0, stateTax: 0, netDue: 0 }
  ), [rows])

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function exportCSV() {
    const headers = ['Client', 'Company', 'Type', 'State', 'Federal Income Tax', 'SE / FICA', 'Payroll Adj', 'State Tax', 'Net Due']
    const lines = [
      headers.join(','),
      ...rows.map(r => [
        `"${formatOwnerName(r.ownerName)}"`,
        `"${r.companyName}"`,
        r.companyType,
        r.state,
        r.federalIncomeTax.toFixed(2),
        r.ficaSE.toFixed(2),
        r.payrollAdj.toFixed(2),
        r.stateTax.toFixed(2),
        r.netDue.toFixed(2),
      ].join(',')),
      ['TOTALS', '', '', '',
        totals.federalIncomeTax.toFixed(2),
        totals.ficaSE.toFixed(2),
        totals.payrollAdj.toFixed(2),
        totals.stateTax.toFixed(2),
        totals.netDue.toFixed(2),
      ].join(','),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tax-plans-${quarter}-${year}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function SortIcon({ col }: { col: SortCol }) {
    const active = sortCol === col
    return (
      <svg className={`inline w-3 h-3 ml-1 ${active ? 'text-orange-500' : 'text-slate-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        {active && sortDir === 'asc'
          ? <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          : active && sortDir === 'desc'
          ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          : <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4M8 15l4 4 4-4" />}
      </svg>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quarterly Tax Plans</h1>
          <p className="text-sm text-slate-500 mt-0.5">Summary of completed tax plans by quarter</p>
        </div>
        <button
          onClick={exportCSV}
          disabled={rows.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-300 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Controls bar */}
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 mb-5 space-y-3">
        {/* Year + Quarter */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Year:</span>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="text-sm border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-slate-500 mr-0.5">Quarter:</span>
            {QUARTERS.map(q => (
              <button
                key={q}
                onClick={() => setQuarter(q)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  quarter === q
                    ? 'bg-orange-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Staff filter */}
        {profiles.length > 0 && (
          <UserFilter
            profiles={profiles}
            selected={selectedUsers}
            onToggle={uid => setSelectedUsers(prev =>
              prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
            )}
            onClear={() => setSelectedUsers([])}
            currentUserId={user?.id}
          />
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {reportsLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No tax plans found for {quarter} {year}.
            {selectedUsers.length > 0 && ' Try clearing the staff filter.'}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-5 py-3">
                      <button onClick={() => toggleSort('client')} className="text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center">
                        Client <SortIcon col="client" />
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Type</th>
                    <th className="text-right px-4 py-3">
                      <button onClick={() => toggleSort('federal')} className="text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center justify-end w-full">
                        Federal Tax <SortIcon col="federal" />
                      </button>
                    </th>
                    <th className="text-right px-4 py-3">
                      <button onClick={() => toggleSort('fica')} className="text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center justify-end w-full">
                        SE / FICA <SortIcon col="fica" />
                      </button>
                    </th>
                    <th className="text-right px-4 py-3">
                      <button onClick={() => toggleSort('payroll')} className="text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center justify-end w-full">
                        Payroll Adj <SortIcon col="payroll" />
                      </button>
                    </th>
                    <th className="text-right px-4 py-3">
                      <button onClick={() => toggleSort('state')} className="text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center justify-end w-full">
                        State Tax <SortIcon col="state" />
                      </button>
                    </th>
                    <th className="text-right px-5 py-3">
                      <button onClick={() => toggleSort('total')} className="text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center justify-end w-full">
                        Net Due <SortIcon col="total" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(row => (
                    <tr key={row.reportId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <Link to={`/reports/${row.reportId}`} className="font-medium text-orange-600 hover:underline">
                          {formatOwnerName(row.ownerName)}
                        </Link>
                        <p className="text-xs text-slate-400 mt-0.5">{row.companyName}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{row.companyType}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-800">{formatCurrency(row.federalIncomeTax)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-800">{formatCurrency(row.ficaSE)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.payrollAdj !== 0
                          ? (
                            <div>
                              <span className={`block ${row.payrollAdj > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                                {formatCurrency(Math.abs(row.payrollAdj))}
                              </span>
                              {row.payrollAdjSalary > 0 && (
                                <span className="block text-[11px] text-slate-400 mt-0.5">
                                  +{formatCurrency(row.payrollAdjSalary)} payroll
                                </span>
                              )}
                            </div>
                          )
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-800">{formatCurrency(row.stateTax)}</td>
                      <td className="px-5 py-3 text-right tabular-nums font-semibold text-slate-900">{formatCurrency(row.netDue)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wide" colSpan={2}>
                      Totals — {rows.length} plan{rows.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-900">{formatCurrency(totals.federalIncomeTax)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-900">{formatCurrency(totals.ficaSE)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-900">{formatCurrency(totals.payrollAdj)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-900">{formatCurrency(totals.stateTax)}</td>
                    <td className="px-5 py-3 text-right tabular-nums font-bold text-orange-700 text-base">{formatCurrency(totals.netDue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Column legend */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
        <p className="text-[11px] text-slate-400"><span className="font-medium">Federal Tax</span> — net income tax after credits, prorated for quarter</p>
        <p className="text-[11px] text-slate-400"><span className="font-medium">SE / FICA</span> — self-employment tax (sole prop) or FICA via payroll (S-Corp)</p>
        <p className="text-[11px] text-slate-400"><span className="font-medium">Payroll Adj</span> — confirmed additional FICA from an S-Corp salary adjustment (zero if not confirmed on the tax plan)</p>
        <p className="text-[11px] text-slate-400"><span className="font-medium">Net Due</span> — total owed after prior estimated payments</p>
      </div>
    </div>
  )
}
