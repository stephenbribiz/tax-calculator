import { useMemo, useState, useCallback } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useReports } from '@/hooks/useReports'
import { useClients } from '@/hooks/useClients'
import { useDocuments } from '@/hooks/useDocuments'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { getDocumentUrl, uploadDocument } from '@/lib/storage'
import { detectDocumentType } from '@/lib/detectFileType'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { DropZone } from '@/components/upload/DropZone'
import { Skeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { TaxOutput, TaxInput } from '@/types'
import type { DbReport } from '@/lib/supabase'
import type { PLExtractedData } from '@/lib/parsePL'
import type { ADPExtractedData } from '@/lib/parseADP'

function ClientTaxSummary({ reports: allReports }: { reports: DbReport[] }) {
  const currentYear = new Date().getFullYear()
  const summary = useMemo(() => {
    const yearReports = allReports.filter(r => r.tax_year === currentYear)
    if (yearReports.length === 0) return null

    // Get the latest report (most recent quarter) for this year
    const sorted = [...yearReports].sort((a, b) => {
      const qOrder: Record<string, number> = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 }
      return (qOrder[b.quarter] ?? 0) - (qOrder[a.quarter] ?? 0)
    })
    const latest = sorted[0]
    const output = latest.output_snapshot as unknown as TaxOutput

    return {
      year: currentYear,
      latestQuarter: latest.quarter,
      totalTaxOwed: output.totalTaxOwed,
      netAmountDue: output.netAmountDue,
      priorPayments: output.priorEstimatesPaid,
      planCount: yearReports.length,
    }
  }, [allReports, currentYear])

  if (!summary) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <Card>
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total Tax ({summary.year})</p>
        <p className="text-xl font-bold text-slate-900">{formatCurrency(summary.totalTaxOwed)}</p>
        <p className="text-xs text-slate-400 mt-0.5">As of {summary.latestQuarter}</p>
      </Card>
      <Card>
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Net Due</p>
        <p className="text-xl font-bold text-slate-900">{formatCurrency(summary.netAmountDue)}</p>
      </Card>
      <Card>
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Prior Payments</p>
        <p className="text-xl font-bold text-slate-900">{formatCurrency(summary.priorPayments)}</p>
      </Card>
      <Card>
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Plans ({summary.year})</p>
        <p className="text-xl font-bold text-slate-900">{summary.planCount}</p>
      </Card>
    </div>
  )
}

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const

interface ComparisonRow {
  label: string
  values: (number | null)[]
}

function QuarterComparison({ reports: allReports }: { reports: DbReport[] }) {
  const [expanded, setExpanded] = useState(false)

  // Group reports by tax year, picking the latest report per quarter
  const { years, byYearQuarter } = useMemo(() => {
    const map = new Map<number, Map<string, { input: TaxInput; output: TaxOutput }>>()
    for (const r of allReports) {
      const input = r.input_snapshot as unknown as TaxInput
      const output = r.output_snapshot as unknown as TaxOutput
      const year = r.tax_year
      if (!map.has(year)) map.set(year, new Map())
      // Last one wins (reports are typically sorted by date)
      map.get(year)!.set(r.quarter, { input, output })
    }
    const sortedYears = Array.from(map.keys()).sort((a, b) => b - a)
    return { years: sortedYears, byYearQuarter: map }
  }, [allReports])

  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const activeYear = selectedYear ?? years[0] ?? null

  if (allReports.length === 0 || activeYear === null) return null

  const quarterData = byYearQuarter.get(activeYear)!
  const presentQuarters = QUARTERS.filter(q => quarterData.has(q))

  if (presentQuarters.length === 0) return null

  const rows: ComparisonRow[] = [
    {
      label: 'Business Net Income',
      values: QUARTERS.map(q => quarterData.get(q)?.input.businessNetIncome ?? null),
    },
    {
      label: 'Taxable Income',
      values: QUARTERS.map(q => quarterData.get(q)?.output.taxableIncome ?? null),
    },
    {
      label: 'Federal Income Tax',
      values: QUARTERS.map(q => quarterData.get(q)?.output.federal.netIncomeTax ?? null),
    },
    {
      label: 'SE Tax / FICA',
      values: QUARTERS.map(q => {
        const o = quarterData.get(q)?.output
        if (!o) return null
        return o.federal.seTax + o.federal.ficaAlreadyPaid
      }),
    },
    {
      label: 'State Tax',
      values: QUARTERS.map(q => quarterData.get(q)?.output.totalStateOwed ?? null),
    },
    {
      label: 'Total Tax',
      values: QUARTERS.map(q => quarterData.get(q)?.output.totalTaxOwed ?? null),
    },
    {
      label: 'Prior Payments',
      values: QUARTERS.map(q => quarterData.get(q)?.output.priorEstimatesPaid ?? null),
    },
    {
      label: 'Net Due',
      values: QUARTERS.map(q => quarterData.get(q)?.output.netAmountDue ?? null),
    },
  ]

  return (
    <div className="mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between bg-slate-50 px-5 py-3 border-b border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
      >
        <h2 className="text-sm font-semibold text-slate-700">Quarter-over-Quarter Comparison</h2>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="p-5">
          {years.length > 1 && (
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-semibold text-slate-500">Year:</span>
              {years.map(year => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    year === activeYear
                      ? 'bg-orange-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5 border border-slate-200">
                    Metric
                  </th>
                  {QUARTERS.map(q => (
                    <th
                      key={q}
                      className={`text-right text-xs font-semibold px-4 py-2.5 border border-slate-200 ${
                        quarterData.has(q) ? 'text-slate-500' : 'text-slate-300'
                      }`}
                    >
                      {q}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.label} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="text-left text-xs font-medium text-slate-600 px-4 py-2.5 border border-slate-200">
                      {row.label}
                    </td>
                    {row.values.map((val, qi) => (
                      <td
                        key={qi}
                        className={`text-right text-xs px-4 py-2.5 border border-slate-200 tabular-nums ${
                          val !== null
                            ? row.label === 'Net Due'
                              ? 'font-semibold text-slate-900'
                              : 'text-slate-600'
                            : 'text-slate-300'
                        }`}
                      >
                        {val !== null ? formatCurrency(val) : '--'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function DocumentsPanel({ clientId, taxYear }: { clientId: string; taxYear: number }) {
  const { user } = useAuth()
  const { documents, loading, deleteDocument, refetch: refetchDocs } = useDocuments(clientId)
  const { toast } = useToast()
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; path: string; name: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResults, setUploadResults] = useState<{ name: string; type: string; status: string }[]>([])

  async function handleView(storagePath: string) {
    try {
      const url = await getDocumentUrl(storagePath)
      window.open(url, '_blank')
    } catch {
      toast('Could not open document', 'error')
    }
  }

  const handleFiles = useCallback(async (files: File[]) => {
    if (!user) return
    setUploading(true)
    setUploadResults([])
    const results: { name: string; type: string; status: string }[] = []

    for (const file of files) {
      try {
        // Extract text and detect type (same logic as bulk upload)
        const { extractTextFromPDF } = await import('@/lib/pdfUtils')
        const rawText = await extractTextFromPDF(file)
        let fileType = detectDocumentType(rawText)

        // Parse the document
        let parsedData: PLExtractedData | ADPExtractedData | null = null
        if (fileType === 'pl') {
          const { parsePLFromPDF } = await import('@/lib/parsePL')
          parsedData = await parsePLFromPDF(file)
        } else if (fileType === 'adp_payroll') {
          const { parseADPFromPDF } = await import('@/lib/parseADP')
          parsedData = await parseADPFromPDF(file)
        } else {
          // Unknown — try ADP first, fall back to P&L
          const { parseADPFromPDF } = await import('@/lib/parseADP')
          const adpResult = await parseADPFromPDF(file)
          if (adpResult.ytdGrossWages !== null || adpResult.ytdFederalWithholding !== null) {
            parsedData = adpResult
            fileType = 'adp_payroll'
          } else {
            const { parsePLFromPDF } = await import('@/lib/parsePL')
            parsedData = await parsePLFromPDF(file)
            fileType = 'pl'
          }
        }

        // Upload to storage
        const storagePath = await uploadDocument(user.id, clientId, taxYear, file)

        // Insert document record
        await supabase.from('documents').insert({
          created_by:   user.id,
          client_id:    clientId,
          file_name:    file.name,
          file_type:    fileType,
          storage_path: storagePath,
          file_size:    file.size,
          tax_year:     taxYear,
          parsed_data:  parsedData as unknown as Record<string, unknown>,
          status:       'applied',
        })

        const typeLabel = fileType === 'adp_payroll' ? 'ADP Payroll' : 'P&L'
        let detail = typeLabel
        if (fileType === 'adp_payroll' && parsedData) {
          const adp = parsedData as ADPExtractedData
          if (adp.ytdGrossWages !== null) detail += ` · Salary: $${adp.ytdGrossWages.toLocaleString()}`
        } else if (fileType === 'pl' && parsedData) {
          const pl = parsedData as PLExtractedData
          if (pl.netIncome !== null) detail += ` · Net Income: $${pl.netIncome.toLocaleString()}`
        }

        results.push({ name: file.name, type: detail, status: 'done' })
      } catch (err) {
        results.push({ name: file.name, type: '', status: err instanceof Error ? err.message : 'Upload failed' })
      }
    }

    setUploadResults(results)
    setUploading(false)
    refetchDocs()

    const successCount = results.filter(r => r.status === 'done').length
    if (successCount > 0) toast(`${successCount} document${successCount > 1 ? 's' : ''} uploaded`)
  }, [user, clientId, taxYear, refetchDocs, toast])

  const hasDocuments = !loading && documents.length > 0

  return (
    <>
      <div className="mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center justify-between bg-slate-50 px-5 py-3 border-b border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-700">Documents</h2>
            {hasDocuments && <Badge variant="neutral">{documents.length}</Badge>}
          </div>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {expanded && (
          <div>
            {/* Upload drop zone */}
            <div className="px-5 py-4 border-b border-slate-100">
              <DropZone
                onFiles={handleFiles}
                disabled={uploading}
                label="Upload P&L or Payroll PDFs"
                hint="Files are automatically detected as P&L or ADP Payroll and parsed"
              />
              {uploading && (
                <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600" />
                  Processing...
                </div>
              )}
              {uploadResults.length > 0 && (
                <div className="mt-3 space-y-1">
                  {uploadResults.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {r.status === 'done' ? (
                        <>
                          <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-slate-700 truncate">{r.name}</span>
                          <span className="text-slate-400">{r.type}</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span className="text-slate-700 truncate">{r.name}</span>
                          <span className="text-red-500">{r.status}</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Existing documents list */}
            {hasDocuments && (
              <div className="divide-y divide-slate-100">
                {documents.map(doc => (
                  <div key={doc.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{doc.file_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        <Badge variant={doc.file_type === 'adp_payroll' ? 'info' : 'neutral'} className="mr-2">
                          {doc.file_type === 'adp_payroll' ? 'ADP' : 'P&L'}
                        </Badge>
                        {doc.quarter && `${doc.quarter} `}{doc.tax_year}
                        {' · '}{formatDate(doc.created_at)}
                        {doc.status === 'applied' && <Badge variant="success" className="ml-2">Applied</Badge>}
                      </p>
                    </div>
                    <button
                      onClick={() => handleView(doc.storage_path)}
                      className="text-xs text-orange-600 hover:text-orange-800 font-medium"
                    >
                      View
                    </button>
                    <button
                      onClick={() => setConfirmDelete({ id: doc.id, path: doc.storage_path, name: doc.file_name })}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!confirmDelete}
        title="Delete Document"
        message={`Delete "${confirmDelete?.name}"? This removes the file permanently.`}
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (confirmDelete) {
            await deleteDocument(confirmDelete.id, confirmDelete.path)
            toast('Document deleted')
          }
          setConfirmDelete(null)
        }}
      />
    </>
  )
}

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { clients, refetch: refreshClients } = useClients()
  const { reports, loading, deleteReport } = useReports(id)
  const { toast } = useToast()
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [confirmDeleteClient, setConfirmDeleteClient] = useState(false)
  const [notes, setNotes] = useState<string | null>(null)
  const [notesInitialized, setNotesInitialized] = useState(false)
  const [clientCode, setClientCode] = useState<string | null>(null)
  const [codeInitialized, setCodeInitialized] = useState(false)
  const [codeEditing, setCodeEditing] = useState(false)
  const [codeInput, setCodeInput] = useState('')
  const [codeSaving, setCodeSaving] = useState(false)

  const client = clients.find(c => c.id === id)

  // Initialize notes and code from client data once loaded
  if (client && !notesInitialized) {
    setNotes(client.notes ?? '')
    setNotesInitialized(true)
  }
  if (client && !codeInitialized) {
    setClientCode(client.client_code ?? '')
    setCodeInitialized(true)
  }

  function startEditCode() {
    setCodeInput(clientCode ?? '')
    setCodeEditing(true)
  }

  function cancelEditCode() {
    setCodeEditing(false)
    setCodeInput('')
  }

  async function saveClientCode() {
    if (!client) return
    setCodeSaving(true)
    const code = codeInput.trim().toUpperCase()
    await supabase
      .from('clients')
      .update({ client_code: code || null })
      .eq('id', client.id)
    setClientCode(code || null)
    await refreshClients()
    setCodeSaving(false)
    setCodeEditing(false)
    setCodeInput('')
    toast('Client code saved')
  }

  async function saveNotes() {
    if (!client) return
    const trimmed = (notes ?? '').trim()
    await supabase
      .from('clients')
      .update({ notes: trimmed || null })
      .eq('id', client.id)
    refreshClients()
  }

  if (!client) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8 space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden p-5 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
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
          <div className="flex items-center gap-2">
            <p className="text-sm text-slate-500">{client.company_name} · {client.company_type} · {client.state}</p>
            {client.client_code && (
              <Badge variant="info">{client.client_code}</Badge>
            )}
          </div>
        </div>
        <Link to={`/reports/new?client=${client.id}`}>
          <Button size="sm">+ New Tax Plan</Button>
        </Link>
      </div>

      {!loading && reports.length > 0 && (
        <ClientTaxSummary reports={reports} />
      )}

      <div className="mb-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="sm:col-span-1">
          <label className="block text-xs font-semibold text-slate-500 mb-1">Client Code</label>
          {codeEditing ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={codeInput}
                onChange={e => setCodeInput(e.target.value.replace(/[^A-Za-z]/g, '').slice(0, 4))}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveClientCode()
                  if (e.key === 'Escape') cancelEditCode()
                }}
                placeholder="e.g., GBG"
                maxLength={4}
                autoFocus
                style={{ textTransform: 'uppercase' }}
                className="text-sm text-slate-600 bg-white rounded-lg p-3 border border-orange-400 ring-1 ring-orange-400 w-full focus:outline-none font-mono"
              />
              <Button size="sm" onClick={saveClientCode} loading={codeSaving} disabled={codeSaving} className="shrink-0">
                Save
              </Button>
              <button
                onClick={cancelEditCode}
                className="text-xs text-slate-400 hover:text-slate-600 px-1"
                aria-label="Cancel"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-3 py-3 min-w-[72px] tracking-widest">
                {clientCode || <span className="text-slate-400 font-normal tracking-normal">—</span>}
              </span>
              <button
                onClick={startEditCode}
                className="text-xs text-orange-600 hover:text-orange-800 font-medium"
              >
                Edit
              </button>
            </div>
          )}
          <p className="text-[10px] text-slate-400 mt-1">2–4 letters for bulk upload matching</p>
        </div>
        <div className="sm:col-span-3">
          <label className="block text-xs font-semibold text-slate-500 mb-1">Notes</label>
          <textarea
          rows={3}
          value={notes ?? ''}
          onChange={e => setNotes(e.target.value)}
          onBlur={saveNotes}
          placeholder="Add notes about this client..."
          className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 border border-slate-200 w-full resize-y focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
        />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-5 py-3 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-700">Tax Plans</h2>
        </div>
        {loading
          ? (
            <div className="px-5 py-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )
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
                          <Link to={`/reports/${report.id}`} className="font-medium text-orange-600 hover:underline">
                            {report.quarter} {report.tax_year}
                          </Link>
                          {!report.is_final && (
                            <Badge variant="warning" className="ml-2">Draft</Badge>
                          )}
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
                            className="text-xs text-orange-500 hover:text-orange-700"
                          >
                            Edit
                          </Link>
                          <Link
                            to={`/reports/new?duplicate=${report.id}`}
                            className="text-xs text-orange-500 hover:text-orange-700"
                          >
                            Duplicate
                          </Link>
                          <button
                            onClick={() => setDeleteTarget(report.id)}
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

      {!loading && <QuarterComparison reports={reports} />}

      {id && <DocumentsPanel clientId={id} taxYear={new Date().getFullYear()} />}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Tax Plan"
        message="Are you sure you want to delete this tax plan? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteReport(deleteTarget)
            toast('Tax plan deleted')
          }
          setDeleteTarget(null)
        }}
      />

      <div className="mt-10 pt-6 border-t border-slate-100 flex justify-center">
        <button
          onClick={() => setConfirmDeleteClient(true)}
          className="text-xs text-slate-400 hover:text-red-500 transition-colors"
        >
          Delete this client
        </button>
      </div>

      <ConfirmModal
        open={confirmDeleteClient}
        title="Delete Client"
        message={`Permanently delete ${client.owner_name} and all of their tax plans? This cannot be undone.`}
        confirmLabel="Delete Client"
        variant="danger"
        onCancel={() => setConfirmDeleteClient(false)}
        onConfirm={async () => {
          const { error } = await supabase.rpc('delete_own_client', { client_id: client.id })
          if (error) {
            console.error('Delete client error:', error)
            toast('Error: ' + error.message, 'error')
          } else {
            navigate('/clients')
            toast(`${client.owner_name} deleted`)
          }
        }}
      />
    </div>
  )
}
