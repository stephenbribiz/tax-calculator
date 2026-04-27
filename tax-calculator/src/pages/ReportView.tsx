import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import type { TaxInput, TaxOutput } from '@/types'
import type { DbReport } from '@/lib/supabase'
import { calculateTax } from '@/tax-engine'
import { ResultsPanel } from '@/components/results/ResultsPanel'
import { Button } from '@/components/ui/Button'
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton'
import { formatDate } from '@/lib/utils'

const PDFDownloadButton = lazy(() =>
  import('@/components/pdf/PDFDownloadButton').then(m => ({ default: m.PDFDownloadButton }))
)

export default function ReportView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [input, setInput]                   = useState<TaxInput | null>(null)
  const [output, setOutput]                 = useState<TaxOutput | null>(null)
  const [clientId, setClientId]             = useState<string | null>(null)
  const [pipelineStatus, setPipelineStatus] = useState<DbReport['pipeline_status']>('draft')
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState<string | null>(null)
  const [finalizing, setFinalizing]         = useState(false)
  const [confirmFinalize, setConfirmFinalize] = useState(false)

  useEffect(() => {
    if (!id) return

    async function load() {
      // Fetch report directly (avoid join issues with RLS)
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('id', id)
        .single()

      if (error) { setError(error.message); setLoading(false); return }
      if (data) {
        setInput(data.input_snapshot as unknown as TaxInput)
        setOutput(data.output_snapshot as unknown as TaxOutput)
        setClientId(data.client_id)
        setPipelineStatus((data.pipeline_status as DbReport['pipeline_status']) ?? 'draft')
      }
      setLoading(false)
    }

    load()
  }, [id])

  // Allow the TN F&E salary toggle to recalculate live even on the read-only view
  const handleFEToggle = useCallback((feUsesAdjustedSalary: boolean) => {
    if (!input) return
    const updatedInput = { ...input, feUsesAdjustedSalary }
    setInput(updatedInput)
    try {
      setOutput(calculateTax(updatedInput))
    } catch { /* ignore */ }
  }, [input])

  async function finalizePlan() {
    if (!id) return
    setFinalizing(true)
    const { error } = await supabase
      .from('reports')
      .update({ pipeline_status: 'completed' })
      .eq('id', id)
    if (error) {
      toast('Failed to finalize: ' + error.message, 'error')
    } else {
      setPipelineStatus('completed')
      toast('Plan marked as completed')
    }
    setFinalizing(false)
    setConfirmFinalize(false)
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-slate-400">Loading tax plan…</p>
      </div>
    )
  }

  if (error || !input || !output) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-red-500">{error || 'Tax plan not found.'}</p>
        <Link to="/" className="text-sm text-orange-600 hover:underline mt-2 block">← Back to Dashboard</Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          {/* Breadcrumb — always shows Dashboard > Client > Plan */}
          <nav className="flex items-center gap-2 mb-1 text-sm">
            <Link to="/" className="text-slate-400 hover:text-slate-600">Dashboard</Link>
            <span className="text-slate-300">/</span>
            <Link
              to={clientId ? `/clients/${clientId}` : '/clients'}
              className="text-slate-400 hover:text-slate-600"
            >
              {input.ownerName || 'Client'}
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-slate-600">{input.quarter} {input.taxYear}</span>
          </nav>
          <h1 className="text-2xl font-bold text-slate-900">
            {input.ownerName} — {input.quarter} {input.taxYear} Tax Plan
          </h1>
          <p className="text-sm text-slate-500">
            {input.companyName} · {input.companyType}
            {pipelineStatus === 'completed' && input.dateCompleted
              ? ` · Completed ${formatDate(input.dateCompleted)}`
              : pipelineStatus === 'in_progress'
              ? ' · In Progress'
              : ' · Draft'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center justify-end">
          {pipelineStatus === 'in_progress' && (
            <button
              onClick={() => setConfirmFinalize(true)}
              disabled={finalizing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {finalizing
                ? <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              }
              Finalize Plan
            </button>
          )}
          {pipelineStatus === 'completed' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Completed
            </span>
          )}
          <Button
            variant="secondary"
            onClick={() => navigate(`/reports/new?edit=${id}`)}
          >
            Edit
          </Button>
          <ExcelDownloadButton input={input} output={output} />
          <Suspense fallback={<Button variant="secondary" disabled>↓ PDF</Button>}>
            <PDFDownloadButton input={input} output={output} />
          </Suspense>
        </div>
      </div>

      <ResultsPanel input={input} output={output} onFEToggle={handleFEToggle} />

      <ConfirmModal
        open={confirmFinalize}
        title="Finalize Tax Plan"
        message="Mark this plan as completed? It will appear on the exportable Table view and can no longer be edited without reopening it."
        confirmLabel="Finalize"
        variant="default"
        onCancel={() => setConfirmFinalize(false)}
        onConfirm={finalizePlan}
      />
    </div>
  )
}
