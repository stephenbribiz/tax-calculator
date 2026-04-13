import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getReport } from '@/hooks/useReports'
import type { TaxInput, TaxOutput } from '@/types'
import { ResultsPanel } from '@/components/results/ResultsPanel'
import { Button } from '@/components/ui/Button'

const PDFDownloadButton = lazy(() =>
  import('@/components/pdf/PDFDownloadButton').then(m => ({ default: m.PDFDownloadButton }))
)
import { formatDate } from '@/lib/utils'

export default function ReportView() {
  const { id } = useParams<{ id: string }>()
  const [input, setInput]   = useState<TaxInput | null>(null)
  const [output, setOutput] = useState<TaxOutput | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getReport(id).then(({ data, error }) => {
      if (error) { setError(error.message); setLoading(false); return }
      if (data) {
        setInput(data.input_snapshot as unknown as TaxInput)
        setOutput(data.output_snapshot as unknown as TaxOutput)
      }
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-slate-400">Loading report…</p>
      </div>
    )
  }

  if (error || !input || !output) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-red-500">{error || 'Report not found.'}</p>
        <Link to="/" className="text-sm text-blue-600 hover:underline mt-2 block">← Back to Dashboard</Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to="/" className="text-sm text-slate-400 hover:text-slate-600">Dashboard</Link>
            <span className="text-slate-300">/</span>
            <span className="text-sm text-slate-600">{input.ownerName}</span>
            <span className="text-slate-300">/</span>
            <span className="text-sm text-slate-600">{input.quarter} {input.taxYear}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {input.ownerName} — {input.quarter} {input.taxYear}
          </h1>
          <p className="text-sm text-slate-500">
            {input.companyName} · {input.companyType} · Completed {formatDate(input.dateCompleted)}
          </p>
        </div>
        <Suspense fallback={<Button variant="secondary" disabled>↓ PDF</Button>}>
          <PDFDownloadButton input={input} output={output} />
        </Suspense>
      </div>

      <ResultsPanel input={input} output={output} />
    </div>
  )
}
