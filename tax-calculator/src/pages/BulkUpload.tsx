import { useState, useCallback, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useClients } from '@/hooks/useClients'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DropZone } from '@/components/upload/DropZone'
import { NewClientModal } from '@/components/upload/NewClientModal'
import { supabase, type DbClient } from '@/lib/supabase'
import { uploadDocument } from '@/lib/storage'
import { extractClientCode, detectDocumentType } from '@/lib/detectFileType'
import { calculateTax } from '@/tax-engine'
import { QUARTER_OPTIONS } from '@/constants/quarters'
import type { TaxInput, Quarter, CompanyType, FilingStatus, StateCode } from '@/types/engine'
import type { PLExtractedData } from '@/lib/parsePL'
import type { ADPExtractedData } from '@/lib/parseADP'

// Returns the previous calendar quarter (same logic as Dashboard)
function getPreviousQuarter(): { quarter: Quarter; year: number } {
  const m = new Date().getMonth()
  const y = new Date().getFullYear()
  if (m < 3)  return { quarter: 'Q4', year: y - 1 }
  if (m < 6)  return { quarter: 'Q1', year: y }
  if (m < 9)  return { quarter: 'Q2', year: y }
  return       { quarter: 'Q3', year: y }
}

type FileStatus = 'parsing' | 'matched' | 'new_client' | 'unmatched' | 'assigned' | 'skipped' | 'uploading' | 'done' | 'error'

interface ParsedFile {
  file: File
  id: string                     // unique key
  clientCode: string | null
  fileType: 'pl' | 'adp_payroll' | 'unknown'
  parsedData: PLExtractedData | ADPExtractedData | null
  status: FileStatus
  matchedClient: DbClient | null
  errorMessage?: string
}

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function getKeyData(file: ParsedFile): string {
  if (!file.parsedData) return '—'
  if (file.fileType === 'pl') {
    const data = file.parsedData as PLExtractedData
    if (data.netIncome !== null) return `Net Income: ${formatCurrency(data.netIncome)}`
    return 'No net income found'
  }
  if (file.fileType === 'adp_payroll') {
    const data = file.parsedData as ADPExtractedData
    if (data.ytdGrossWages !== null) return `Salary: ${formatCurrency(data.ytdGrossWages)}`
    return 'No salary found'
  }
  return '—'
}

export default function BulkUpload() {
  const { user } = useAuth()
  const { clients, refetch: refetchClients } = useClients()

  const { quarter: prevQ, year: prevYear } = getPreviousQuarter()
  const [taxYear, setTaxYear] = useState(prevYear)
  const [quarter, setQuarter] = useState<Quarter>(prevQ)
  const [files, setFiles] = useState<ParsedFile[]>([])
  const [phase, setPhase] = useState<'drop' | 'review' | 'processing' | 'done'>('drop')
  const [processing, setProcessing] = useState(false)
  const [newClientCode, setNewClientCode] = useState<string | null>(null)
  const [results, setResults] = useState<{ uploaded: number; plans: number; skipped: number; errors: number }>({ uploaded: 0, plans: 0, skipped: 0, errors: 0 })

  // Track client list with any newly created clients
  const clientsRef = useRef(clients)
  clientsRef.current = clients

  // Re-run matching whenever clients finish loading (handles race condition where
  // PDF parsing completes before the Supabase client list returns)
  useEffect(() => {
    if (clients.length === 0) return
    setFiles(prev => prev.map(f => {
      if (f.status !== 'new_client' && f.status !== 'unmatched') return f
      if (!f.clientCode) return f
      const matched = clients.find(
        c => c.client_code?.toUpperCase() === f.clientCode!.toUpperCase()
      ) ?? null
      if (matched) return { ...f, matchedClient: matched, status: 'matched' }
      return f
    }))
  }, [clients])

  // ── Parse dropped files ──
  const handleFiles = useCallback(async (newFiles: File[]) => {
    const parsedFiles: ParsedFile[] = newFiles.map((file, idx) => ({
      file,
      id: `${Date.now()}-${idx}`,
      clientCode: extractClientCode(file.name),
      fileType: 'unknown' as const,
      parsedData: null,
      status: 'parsing' as const,
      matchedClient: null,
    }))

    setFiles(prev => [...prev, ...parsedFiles])
    setPhase('review')

    // Parse files with concurrency limit of 5
    const CONCURRENCY = 5
    for (let i = 0; i < parsedFiles.length; i += CONCURRENCY) {
      const batch = parsedFiles.slice(i, i + CONCURRENCY)
      await Promise.allSettled(batch.map(async (pf) => {
        try {
          // Lazy-load parsers
          const { extractTextFromPDF } = await import('@/lib/pdfUtils')
          const rawText = await extractTextFromPDF(pf.file)
          let fileType = detectDocumentType(rawText)

          let parsedData: PLExtractedData | ADPExtractedData | null = null
          if (fileType === 'pl') {
            const { parsePLFromPDF } = await import('@/lib/parsePL')
            parsedData = await parsePLFromPDF(pf.file)
          } else if (fileType === 'adp_payroll') {
            const { parseADPFromPDF } = await import('@/lib/parseADP')
            parsedData = await parseADPFromPDF(pf.file)
          } else {
            // Unknown type — try both parsers and use whichever extracts data
            console.log(`[BulkUpload] Unknown file type for "${pf.file.name}", trying both parsers`)
            const { parseADPFromPDF } = await import('@/lib/parseADP')
            const adpResult = await parseADPFromPDF(pf.file)
            if (adpResult.ytdGrossWages !== null || adpResult.ytdFederalWithholding !== null) {
              parsedData = adpResult
              fileType = 'adp_payroll'
              console.log(`[BulkUpload] → detected as ADP via parser fallback`)
            } else {
              const { parsePLFromPDF } = await import('@/lib/parsePL')
              parsedData = await parsePLFromPDF(pf.file)
              fileType = 'pl'
            }
          }

          // Match client by code
          const code = pf.clientCode
          let matchedClient: DbClient | null = null
          let status: FileStatus = 'unmatched'

          if (code) {
            matchedClient = clientsRef.current.find(
              c => c.client_code?.toUpperCase() === code.toUpperCase()
            ) ?? null
            status = matchedClient ? 'matched' : 'new_client'
          }

          setFiles(prev => prev.map(f => f.id === pf.id ? {
            ...f,
            fileType,
            parsedData,
            status,
            matchedClient,
          } : f))
        } catch (err) {
          setFiles(prev => prev.map(f => f.id === pf.id ? {
            ...f,
            status: 'error',
            errorMessage: err instanceof Error ? err.message : 'Parse failed',
          } : f))
        }
      }))
    }
  }, [])

  // ── Assign a client to a file ──
  const assignClient = useCallback((fileId: string, clientId: string) => {
    const client = clientsRef.current.find(c => c.id === clientId) ?? null
    setFiles(prev => prev.map(f => f.id === fileId ? {
      ...f,
      matchedClient: client,
      status: client ? 'assigned' : f.status,
    } : f))
  }, [])

  // ── Handle new client created from modal ──
  const handleNewClient = useCallback(async (client: DbClient) => {
    await refetchClients()
    // Assign this new client to all files with the matching code
    const code = newClientCode
    setFiles(prev => prev.map(f => {
      if (f.clientCode?.toUpperCase() === code?.toUpperCase() && (f.status === 'new_client')) {
        return { ...f, matchedClient: client, status: 'assigned' }
      }
      return f
    }))
    setNewClientCode(null)
  }, [newClientCode, refetchClients])

  // ── Skip a file ──
  const skipFile = useCallback((fileId: string) => {
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'skipped' } : f))
  }, [])

  // ── Remove a file from the list ──
  const removeFile = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId))
  }, [])

  // ── Process all: upload, store, create draft plans ──
  const processAll = useCallback(async () => {
    if (!user) return
    setProcessing(true)
    setPhase('processing')

    const processableFiles = files.filter(f =>
      (f.status === 'matched' || f.status === 'assigned') && f.matchedClient
    )

    let uploaded = 0, plans = 0, skipped = 0, errors = 0

    // Group files by client
    const clientFileMap = new Map<string, ParsedFile[]>()
    for (const f of processableFiles) {
      const clientId = f.matchedClient!.id
      if (!clientFileMap.has(clientId)) clientFileMap.set(clientId, [])
      clientFileMap.get(clientId)!.push(f)
    }

    // Count skipped
    skipped = files.filter(f => f.status === 'skipped' || f.status === 'unmatched' || f.status === 'new_client').length

    for (const [clientId, clientFiles] of clientFileMap) {
      const client = clientFiles[0].matchedClient!
      let plData: PLExtractedData | null = null
      let adpData: ADPExtractedData | null = null

      // Upload each file
      for (const cf of clientFiles) {
        try {
          setFiles(prev => prev.map(f => f.id === cf.id ? { ...f, status: 'uploading' } : f))

          const storagePath = await uploadDocument(user.id, clientId, taxYear, cf.file)

          // Insert document record
          await supabase.from('documents').insert({
            created_by:   user.id,
            client_id:    clientId,
            file_name:    cf.file.name,
            file_type:    cf.fileType,
            storage_path: storagePath,
            file_size:    cf.file.size,
            tax_year:     taxYear,
            quarter:      quarter,
            parsed_data:  cf.parsedData as unknown as Record<string, unknown>,
            status:       'applied',
          })

          uploaded++

          // Collect parsed data for tax plan
          if (cf.fileType === 'pl' && cf.parsedData) plData = cf.parsedData as PLExtractedData
          if (cf.fileType === 'adp_payroll' && cf.parsedData) adpData = cf.parsedData as ADPExtractedData

          setFiles(prev => prev.map(f => f.id === cf.id ? { ...f, status: 'done' } : f))
        } catch (err) {
          errors++
          setFiles(prev => prev.map(f => f.id === cf.id ? {
            ...f,
            status: 'error',
            errorMessage: err instanceof Error ? err.message : 'Upload failed',
          } : f))
        }
      }

      // Create draft tax plan for this client
      if (plData || adpData) {
        try {
          const today = new Date().toISOString().slice(0, 10)
          const taxInput: TaxInput = {
            companyName:          client.company_name,
            companyType:          client.company_type as CompanyType,
            ownerName:            client.owner_name,
            taxYear:              taxYear,
            dateCompleted:        today,
            quarter:              quarter,
            filingStatus:         (client.filing_status ?? 'Single') as FilingStatus,
            ownershipPct:         client.ownership_pct ?? 100,
            numDependentChildren: client.num_dependents ?? 0,
            state:                client.state as StateCode,
            businessNetIncome:    plData?.netIncome ?? 0,
            shareholderSalary:    adpData?.ytdGrossWages ?? plData?.officerCompensation ?? 0,
            adjustedSalary:       0,
            federalWithholding:   adpData?.ytdFederalWithholding ?? 0,
            mealExpense:          plData?.mealExpense ?? 0,
            shareholderDraw:      plData?.shareholderDraw ?? 0,
            otherIncome:          0,
            spousalIncome:        0,
            priorEstimatesPaid:   0,
            priorFEPaid:          0,
            deductionOverride:    null,
            annualizeIncome:      false,
            feUsesAdjustedSalary: false,
            feAdjustedSalary:     0,
          }

          const output = calculateTax(taxInput)

          const { error: reportError } = await supabase.from('reports').insert({
            client_id:       clientId,
            created_by:      user.id,
            tax_year:        taxYear,
            quarter:         quarter,
            date_completed:  today,
            input_snapshot:  taxInput as unknown as Record<string, unknown>,
            output_snapshot: output as unknown as Record<string, unknown>,
            is_final:        false, // Draft
          })

          if (!reportError) plans++
        } catch (err) {
          console.error('Failed to create draft plan for', client.company_name, err)
        }
      }
    }

    setResults({ uploaded, plans, skipped, errors })
    setPhase('done')
    setProcessing(false)
  }, [files, user, taxYear, quarter])

  // Computed stats
  const readyCount = files.filter(f => f.status === 'matched' || f.status === 'assigned').length
  const needsAttention = files.filter(f => f.status === 'new_client' || f.status === 'unmatched').length
  const parsingCount = files.filter(f => f.status === 'parsing').length
  const clientsWithCodes = clients.filter(c => c.client_code).length

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Bulk Upload</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload P&L and ADP payroll PDFs to auto-create draft tax plans for your clients.
        </p>
      </div>

      {/* Config bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Tax Year</label>
            <select
              value={taxYear}
              onChange={e => setTaxYear(Number(e.target.value))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              disabled={phase !== 'drop' && phase !== 'review'}
            >
              <option value={2024}>2024</option>
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Quarter</label>
            <select
              value={quarter}
              onChange={e => setQuarter(e.target.value as Quarter)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              disabled={phase !== 'drop' && phase !== 'review'}
            >
              {QUARTER_OPTIONS.map(q => (
                <option key={q.value} value={q.value}>{q.label} ({q.months})</option>
              ))}
            </select>
          </div>
          {files.length > 0 && phase === 'review' && (
            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs text-slate-500">
                {readyCount} ready{needsAttention > 0 ? ` · ${needsAttention} need attention` : ''}
                {parsingCount > 0 ? ` · ${parsingCount} parsing...` : ''}
              </span>
              <Button
                onClick={processAll}
                disabled={readyCount === 0 || parsingCount > 0}
              >
                Process All ({readyCount})
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Warning: no client codes configured */}
      {phase === 'drop' && clients.length > 0 && clientsWithCodes === 0 && (
        <div className="mb-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
          <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div>
            <p className="font-medium text-amber-800">No client codes configured</p>
            <p className="text-amber-700 mt-0.5">
              Files are matched to clients by the prefix in the filename (e.g., <span className="font-mono font-bold">GBG</span> in "GBG 03-2026 Report.pdf").
              Go to each <Link to="/clients" className="underline hover:text-amber-900">client profile</Link> and set their client code so files are matched automatically.
            </p>
          </div>
        </div>
      )}

      {/* Drop zone */}
      {(phase === 'drop' || phase === 'review') && (
        <div className="mb-6">
          <DropZone
            onFiles={handleFiles}
            disabled={processing}
            label="Drop P&L and ADP Payroll PDFs here"
            hint="Files are matched to clients by the 2–4 letter code at the start of the filename (e.g., GBG)"
          />
        </div>
      )}

      {/* File list / review table */}
      {files.length > 0 && phase !== 'done' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
            <h3 className="text-sm font-semibold text-slate-700">Files ({files.length})</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {files.map(f => (
              <div key={f.id} className="px-4 py-3 flex items-center gap-3">
                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{f.file.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {f.clientCode && <span className="font-mono font-bold text-orange-600 mr-2">{f.clientCode}</span>}
                    {f.fileType === 'adp_payroll' ? 'ADP Payroll' : 'P&L'}
                    {f.parsedData && ` · ${getKeyData(f)}`}
                  </p>
                </div>

                {/* Client match / action */}
                <div className="flex items-center gap-2 shrink-0">
                  {f.status === 'parsing' && (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600" />
                      <span className="text-xs text-slate-500">Parsing...</span>
                    </div>
                  )}

                  {f.status === 'matched' && (
                    <>
                      <Badge variant="success">Matched</Badge>
                      <span className="text-sm text-slate-700">{f.matchedClient?.company_name}</span>
                    </>
                  )}

                  {f.status === 'assigned' && (
                    <>
                      <Badge variant="info">Assigned</Badge>
                      <span className="text-sm text-slate-700">{f.matchedClient?.company_name}</span>
                    </>
                  )}

                  {f.status === 'new_client' && (
                    <>
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">Code <span className="font-mono font-bold text-slate-700">{f.clientCode}</span> not found —</span>
                          <button
                            onClick={() => setNewClientCode(f.clientCode)}
                            className="text-xs bg-orange-600 hover:bg-orange-700 text-white font-medium px-2.5 py-1 rounded"
                          >
                            Set up new client
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">or assign to:</span>
                          <select
                            className="text-xs border border-slate-300 rounded px-2 py-1"
                            defaultValue=""
                            onChange={e => { if (e.target.value) assignClient(f.id, e.target.value) }}
                          >
                            <option value="" disabled>existing client...</option>
                            {clients.map(c => (
                              <option key={c.id} value={c.id}>{c.company_name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => skipFile(f.id)}
                            className="text-xs text-slate-400 hover:text-slate-600"
                          >
                            Skip
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {f.status === 'unmatched' && (
                    <>
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">No code in filename — assign to:</span>
                          <select
                            className="text-xs border border-slate-300 rounded px-2 py-1"
                            defaultValue=""
                            onChange={e => { if (e.target.value) assignClient(f.id, e.target.value) }}
                          >
                            <option value="" disabled>Select client...</option>
                            {clients.map(c => (
                              <option key={c.id} value={c.id}>{c.company_name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => skipFile(f.id)}
                            className="text-xs text-slate-400 hover:text-slate-600"
                          >
                            Skip
                          </button>
                        </div>
                        <p className="text-xs text-slate-400">Rename file to start with the client code to auto-match next time</p>
                      </div>
                    </>
                  )}

                  {f.status === 'skipped' && <Badge variant="neutral">Skipped</Badge>}

                  {f.status === 'uploading' && (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600" />
                      <span className="text-xs text-slate-500">Uploading...</span>
                    </div>
                  )}

                  {f.status === 'done' && <Badge variant="success">Done</Badge>}

                  {f.status === 'error' && (
                    <>
                      <Badge variant="error">Error</Badge>
                      <span className="text-xs text-red-600">{f.errorMessage}</span>
                    </>
                  )}
                </div>

                {/* Remove button */}
                {(f.status !== 'uploading' && f.status !== 'done' && phase === 'review') && (
                  <button
                    onClick={() => removeFile(f.id)}
                    className="p-1 text-slate-400 hover:text-red-500"
                    title="Remove"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Processing progress */}
      {phase === 'processing' && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-3" />
          <p className="text-sm text-slate-700 font-medium">Processing files...</p>
          <p className="text-xs text-slate-500 mt-1">Uploading documents and creating draft tax plans</p>
        </div>
      )}

      {/* Done summary */}
      {phase === 'done' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 bg-green-50">
            <h3 className="text-lg font-bold text-green-900">Upload Complete</h3>
          </div>
          <div className="px-6 py-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-900">{results.uploaded}</p>
                <p className="text-xs text-slate-500">Files Uploaded</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{results.plans}</p>
                <p className="text-xs text-slate-500">Draft Plans Created</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-400">{results.skipped}</p>
                <p className="text-xs text-slate-500">Skipped</p>
              </div>
              {results.errors > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{results.errors}</p>
                  <p className="text-xs text-slate-500">Errors</p>
                </div>
              )}
            </div>

            <p className="text-sm text-slate-600 mb-4">
              Draft tax plans have been created for each client. Review and finalize them from each client's detail page.
            </p>

            <div className="flex gap-3">
              <Link to="/clients">
                <Button variant="secondary">View Clients</Button>
              </Link>
              <Button onClick={() => { setFiles([]); setPhase('drop'); setResults({ uploaded: 0, plans: 0, skipped: 0, errors: 0 }) }}>
                Upload More
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* New client modal */}
      {newClientCode && (
        <NewClientModal
          clientCode={newClientCode}
          onCreated={handleNewClient}
          onCancel={() => {
            // Skip all files with this code
            setFiles(prev => prev.map(f =>
              f.clientCode?.toUpperCase() === newClientCode.toUpperCase() && f.status === 'new_client'
                ? { ...f, status: 'skipped' }
                : f
            ))
            setNewClientCode(null)
          }}
        />
      )}
    </div>
  )
}
