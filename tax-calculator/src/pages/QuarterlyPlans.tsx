import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useReports } from '@/hooks/useReports'
import { useClients } from '@/hooks/useClients'
import { useAssigneeFilter } from '@/hooks/useAssigneeFilter'
import { AssigneeFilter } from '@/components/ui/AssigneeFilter'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency } from '@/lib/utils'
import { formatOwnerName } from '@/pages/ClientList'
import type { TaxOutput, TaxInput } from '@/types'
import type { DbReport } from '@/lib/supabase'

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const
type Quarter = typeof QUARTERS[number]

type SortCol = 'client' | 'federal' | 'fica' | 'payroll' | 'state' | 'total'
type ViewMode = 'pipeline' | 'table'
type PipelineStatus = 'draft' | 'in_progress' | 'completed'

interface PlanRow {
  reportId: string
  clientId: string
  ownerName: string
  companyName: string
  companyType: string
  state: string
  quarter: string
  taxYear: number
  pipelineStatus: PipelineStatus
  federalIncomeTax: number
  ficaSE: number
  payrollAdj: number
  payrollAdjSalary: number
  stateTax: number
  netDue: number
}

const PIPELINE_STAGES: { key: PipelineStatus; label: string; color: string; dotColor: string }[] = [
  { key: 'draft',       label: 'Draft',       color: 'bg-slate-50 border-slate-200',  dotColor: 'bg-slate-400' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-amber-50 border-amber-200',  dotColor: 'bg-amber-500' },
  { key: 'completed',   label: 'Completed',   color: 'bg-emerald-50 border-emerald-200', dotColor: 'bg-emerald-500' },
]

function buildRow(r: DbReport): PlanRow {
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
    quarter: r.quarter,
    taxYear: r.tax_year,
    pipelineStatus: (r.pipeline_status as PipelineStatus) ?? 'draft',
    federalIncomeTax: out.federal.netIncomeTax * p,
    ficaSE: (out.federal.seTax + out.federal.ficaAlreadyPaid) * p,
    payrollAdj: out.scorp?.additionalFICA ?? 0,
    payrollAdjSalary: out.scorp
      ? Math.max(0, (out.scorp.adjustedSalary ?? 0) - (out.scorp.currentSalary ?? 0))
      : 0,
    stateTax: out.totalStateOwed,
    netDue: out.netAmountDue,
  }
}

export default function QuarterlyPlans() {
  const currentYear = new Date().getFullYear()
  const { reports, loading: reportsLoading, deleteReport, updatePipelineStatus } = useReports()
  const { clients } = useClients()
  const { toast } = useToast()

  const [year, setYear] = useState(currentYear)
  const [quarter, setQuarter] = useState<Quarter>('Q1')
  const [viewMode, setViewMode] = useState<ViewMode>('pipeline')
  const { selected: selectedAssignees, toggle: toggleAssignee, clear: clearAssignees } = useAssigneeFilter()
  const [sortCol, setSortCol] = useState<SortCol>('client')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null)

  const availableYears = useMemo(() => {
    const years = [...new Set(reports.map(r => r.tax_year))].sort((a, b) => b - a)
    if (!years.includes(currentYear)) years.unshift(currentYear)
    return years
  }, [reports, currentYear])

  // In pipeline view: all quarters for the year; in table view: filter by selected quarter
  const filteredRows = useMemo<PlanRow[]>(() => {
    const filtered = reports.filter(r => {
      if (r.tax_year !== year) return false
      if (viewMode === 'table' && r.quarter !== quarter) return false
      if (selectedAssignees.length > 0) {
        const client = clients.find(c => c.id === r.client_id)
        return selectedAssignees.some(name => (client?.assignees ?? []).includes(name))
      }
      return true
    })
    return filtered.map(r => buildRow(r))
  }, [reports, clients, year, quarter, viewMode, selectedAssignees])

  // Table-specific: sorted rows
  const tableRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      let cmp = 0
      if (sortCol === 'client') cmp = a.ownerName.localeCompare(b.ownerName)
      else if (sortCol === 'federal') cmp = a.federalIncomeTax - b.federalIncomeTax
      else if (sortCol === 'fica') cmp = a.ficaSE - b.ficaSE
      else if (sortCol === 'payroll') cmp = a.payrollAdj - b.payrollAdj
      else if (sortCol === 'state') cmp = a.stateTax - b.stateTax
      else if (sortCol === 'total') cmp = a.netDue - b.netDue
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filteredRows, sortCol, sortDir])

  const totals = useMemo(() => tableRows.reduce(
    (acc, r) => ({
      federalIncomeTax: acc.federalIncomeTax + r.federalIncomeTax,
      ficaSE: acc.ficaSE + r.ficaSE,
      payrollAdj: acc.payrollAdj + r.payrollAdj,
      stateTax: acc.stateTax + r.stateTax,
      netDue: acc.netDue + r.netDue,
    }),
    { federalIncomeTax: 0, ficaSE: 0, payrollAdj: 0, stateTax: 0, netDue: 0 }
  ), [tableRows])

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function exportCSV() {
    const headers = ['Client', 'Company', 'Type', 'State', 'Quarter', 'Federal Income Tax', 'SE / FICA', 'Payroll Adj', 'State Tax', 'Net Due']
    const lines = [
      headers.join(','),
      ...tableRows.map(r => [
        `"${formatOwnerName(r.ownerName)}"`,
        `"${r.companyName}"`,
        r.companyType,
        r.state,
        r.quarter,
        r.federalIncomeTax.toFixed(2),
        r.ficaSE.toFixed(2),
        r.payrollAdj.toFixed(2),
        r.stateTax.toFixed(2),
        r.netDue.toFixed(2),
      ].join(',')),
      ['TOTALS', '', '', '', '',
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
    a.download = `tax-plans-${viewMode === 'table' ? `${quarter}-` : ''}${year}.csv`
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

  // ── Pipeline card component ──
  function PipelineCard({ row }: { row: PlanRow }) {
    const stageIdx = PIPELINE_STAGES.findIndex(s => s.key === row.pipelineStatus)
    const canAdvance = stageIdx < PIPELINE_STAGES.length - 1
    const canRetreat = stageIdx > 0

    async function advance() {
      const nextStage = PIPELINE_STAGES[stageIdx + 1].key
      const err = await updatePipelineStatus(row.reportId, nextStage)
      if (err) toast('Failed to update status', 'error')
    }

    async function retreat() {
      const prevStage = PIPELINE_STAGES[stageIdx - 1].key
      const err = await updatePipelineStatus(row.reportId, prevStage)
      if (err) toast('Failed to update status', 'error')
    }

    return (
      <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between gap-2 mb-1">
          <Link
            to={`/reports/${row.reportId}`}
            className="font-semibold text-sm text-orange-600 hover:underline leading-tight"
          >
            {formatOwnerName(row.ownerName)}
          </Link>
          <span className="text-[10px] font-medium text-slate-400 shrink-0 mt-0.5">
            {row.quarter} {row.taxYear}
          </span>
        </div>
        <p className="text-xs text-slate-400 mb-2 truncate">{row.companyName}</p>
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-slate-500">Net Due</span>
          <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(row.netDue)}</span>
        </div>
        <div className="flex items-center gap-1">
          {canRetreat && (
            <button
              onClick={retreat}
              title="Move back"
              className="flex-1 text-[10px] text-slate-400 hover:text-slate-600 border border-slate-200 rounded px-2 py-1 hover:bg-slate-50 transition-colors"
            >
              ← Back
            </button>
          )}
          <div className="flex-1" />
          <Link
            to={`/reports/${row.reportId}`}
            className="text-[10px] text-orange-500 hover:text-orange-700 border border-orange-200 rounded px-2 py-1 hover:bg-orange-50 transition-colors"
          >
            View
          </Link>
          {canAdvance && (
            <button
              onClick={advance}
              title="Move to next stage"
              className="flex-1 text-[10px] bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200 rounded px-2 py-1 transition-colors font-medium"
            >
              {stageIdx === 0 ? 'Start →' : 'Complete →'}
            </button>
          )}
          <button
            onClick={() => setDeleteTarget({ id: row.reportId, label: `${formatOwnerName(row.ownerName)} ${row.quarter} ${row.taxYear}` })}
            className="text-[10px] text-red-300 hover:text-red-500 border border-red-100 rounded px-1.5 py-1 hover:bg-red-50 transition-colors"
            title="Delete"
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quarterly Tax Plans</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {viewMode === 'pipeline'
              ? 'Track plans through Draft → In Progress → Completed'
              : 'Summary of tax plans by quarter'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              onClick={() => setViewMode('pipeline')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'pipeline'
                  ? 'bg-orange-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Pipeline
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-xs font-medium border-l border-slate-200 transition-colors ${
                viewMode === 'table'
                  ? 'bg-orange-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Table
            </button>
          </div>
          {viewMode === 'table' && (
            <button
              onClick={exportCSV}
              disabled={tableRows.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-300 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Controls bar */}
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-4 mb-5 space-y-3">
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
          {/* Quarter selector — only relevant in table view */}
          {viewMode === 'table' && (
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
          )}
        </div>

        {/* Staff filter */}
        <AssigneeFilter
          selected={selectedAssignees}
          onToggle={toggleAssignee}
          onClear={clearAssignees}
        />
      </div>

      {reportsLoading ? (
        <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
      ) : viewMode === 'pipeline' ? (
        /* ── PIPELINE VIEW ── */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PIPELINE_STAGES.map(stage => {
            const stageRows = filteredRows.filter(r => r.pipelineStatus === stage.key)
            return (
              <div key={stage.key} className={`rounded-xl border-2 ${stage.color} p-4`}>
                {/* Column header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${stage.dotColor}`} />
                    <h3 className="text-sm font-bold text-slate-700">{stage.label}</h3>
                  </div>
                  <span className="text-xs font-medium text-slate-400 bg-white/80 rounded-full px-2 py-0.5 border border-slate-200">
                    {stageRows.length}
                  </span>
                </div>

                {stageRows.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No plans</p>
                ) : (
                  <div className="space-y-2">
                    {stageRows
                      .sort((a, b) => {
                        // Sort by quarter, then by client name
                        const qOrder: Record<string, number> = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 }
                        const qCmp = (qOrder[a.quarter] ?? 0) - (qOrder[b.quarter] ?? 0)
                        return qCmp !== 0 ? qCmp : a.ownerName.localeCompare(b.ownerName)
                      })
                      .map(row => (
                        <PipelineCard key={row.reportId} row={row} />
                      ))
                    }
                  </div>
                )}

                {/* Column total */}
                {stageRows.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-slate-200/60 flex justify-between text-xs text-slate-500">
                    <span>Total Net Due</span>
                    <span className="font-bold text-slate-700 tabular-nums">
                      {formatCurrency(stageRows.reduce((sum, r) => sum + r.netDue, 0))}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* ── TABLE VIEW ── */
        <>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {tableRows.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">
                No tax plans found for {quarter} {year}.
                {selectedAssignees.length > 0 && ' Try clearing the staff filter.'}
              </div>
            ) : (
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
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
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
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tableRows.map(row => (
                      <tr key={row.reportId} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3">
                          <Link to={`/reports/${row.reportId}`} className="font-medium text-orange-600 hover:underline">
                            {formatOwnerName(row.ownerName)}
                          </Link>
                          <p className="text-xs text-slate-400 mt-0.5">{row.companyName}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{row.companyType}</td>
                        <td className="px-4 py-3">
                          {row.pipelineStatus === 'draft' && <Badge variant="warning">Draft</Badge>}
                          {row.pipelineStatus === 'in_progress' && <Badge variant="info">In Progress</Badge>}
                          {row.pipelineStatus === 'completed' && <Badge variant="success">Completed</Badge>}
                        </td>
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
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setDeleteTarget({ id: row.reportId, label: `${formatOwnerName(row.ownerName)} ${row.quarter} ${row.taxYear}` })}
                            className="text-xs text-red-400 hover:text-red-600"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-200">
                      <td className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wide" colSpan={3}>
                        Totals — {tableRows.length} plan{tableRows.length !== 1 ? 's' : ''}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-900">{formatCurrency(totals.federalIncomeTax)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-900">{formatCurrency(totals.ficaSE)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-900">{formatCurrency(totals.payrollAdj)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-900">{formatCurrency(totals.stateTax)}</td>
                      <td className="px-5 py-3 text-right tabular-nums font-bold text-orange-700 text-base">{formatCurrency(totals.netDue)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Column legend */}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
            <p className="text-[11px] text-slate-400"><span className="font-medium">Federal Tax</span> — net income tax after credits, prorated for quarter</p>
            <p className="text-[11px] text-slate-400"><span className="font-medium">SE / FICA</span> — self-employment tax (sole prop) or FICA via payroll (S-Corp)</p>
            <p className="text-[11px] text-slate-400"><span className="font-medium">Payroll Adj</span> — confirmed additional FICA from an S-Corp salary adjustment</p>
            <p className="text-[11px] text-slate-400"><span className="font-medium">Net Due</span> — total owed after prior estimated payments</p>
          </div>
        </>
      )}

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Tax Plan"
        message={deleteTarget ? `Delete "${deleteTarget.label}"? This cannot be undone.` : ''}
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            const err = await deleteReport(deleteTarget.id)
            if (err) toast('Failed to delete plan', 'error')
            else toast('Tax plan deleted')
          }
          setDeleteTarget(null)
        }}
      />
    </div>
  )
}
