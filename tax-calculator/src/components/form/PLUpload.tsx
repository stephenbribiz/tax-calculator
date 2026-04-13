import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { PLExtractedData } from '@/lib/parsePL'

interface ExtractedField {
  label: string
  key: keyof PLExtractedData
  formKey: string
  value: number | null
  enabled: boolean
}

interface PLUploadProps {
  companyType: string
  onApply: (values: Record<string, number>) => void
}

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export function PLUpload({ companyType, onApply }: PLUploadProps) {
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extracted, setExtracted] = useState<PLExtractedData | null>(null)
  const [fields, setFields] = useState<ExtractedField[]>([])
  const [showRawText, setShowRawText] = useState(false)

  const isScorp = companyType === 'S-Corp'

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file.')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('File is too large. Maximum 20 MB.')
      return
    }

    setError(null)
    setParsing(true)
    setExtracted(null)
    setFields([])

    try {
      // Lazy-load the PDF parser (keeps it out of the main bundle)
      const { parsePLFromPDF } = await import('@/lib/parsePL')
      const data = await parsePLFromPDF(file)
      setExtracted(data)

      // Build the list of fields to show the user
      const fieldList: ExtractedField[] = []

      fieldList.push({
        label: 'Business Net Income',
        key: 'netIncome',
        formKey: 'businessNetIncome',
        value: data.netIncome,
        enabled: data.netIncome !== null,
      })

      if (isScorp) {
        fieldList.push({
          label: 'Officer / Shareholder Salary',
          key: 'officerCompensation',
          formKey: 'shareholderSalary',
          value: data.officerCompensation,
          enabled: data.officerCompensation !== null,
        })
      }

      fieldList.push({
        label: 'Meals & Entertainment',
        key: 'mealExpense',
        formKey: 'mealExpense',
        value: data.mealExpense,
        enabled: data.mealExpense !== null,
      })

      fieldList.push({
        label: 'Shareholder Draw / Distributions',
        key: 'shareholderDraw',
        formKey: 'shareholderDraw',
        value: data.shareholderDraw,
        enabled: data.shareholderDraw !== null,
      })

      setFields(fieldList)
    } catch (err) {
      console.error('PDF parse error:', err)
      setError('Could not read this PDF. Make sure it contains selectable text (not a scanned image).')
    } finally {
      setParsing(false)
    }
  }, [isScorp])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // Reset so same file can be re-selected
    e.target.value = ''
  }, [handleFile])

  function toggleField(idx: number) {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, enabled: !f.enabled } : f))
  }

  function updateFieldValue(idx: number, value: number) {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, value, enabled: true } : f))
  }

  function handleApply() {
    const values: Record<string, number> = {}
    for (const field of fields) {
      if (field.enabled && field.value !== null) {
        values[field.formKey] = field.value
      }
    }
    onApply(values)
    // Reset
    setExtracted(null)
    setFields([])
  }

  function handleClear() {
    setExtracted(null)
    setFields([])
    setError(null)
  }

  // Drop zone (before extraction)
  if (!extracted && !parsing) {
    return (
      <div className="mb-5">
        <div
          onDragEnter={e => { e.preventDefault(); setDragging(true) }}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-lg p-5 text-center transition-colors cursor-pointer ${
            dragging
              ? 'border-blue-400 bg-blue-50'
              : 'border-slate-300 bg-slate-50 hover:border-slate-400'
          }`}
          onClick={() => document.getElementById('pl-upload-input')?.click()}
        >
          <input
            id="pl-upload-input"
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={onFileInput}
          />
          <svg className="w-8 h-8 mx-auto mb-2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9.75m3 0l-3-3m3 3l3-3M4.5 3.375v17.25A2.25 2.25 0 006.75 22.5h10.5a2.25 2.25 0 002.25-2.25V8.625a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44l-2.122-2.121A1.5 1.5 0 007.629 3.375H6.75A2.25 2.25 0 004.5 5.625" />
          </svg>
          <p className="text-sm font-medium text-slate-700">Upload P&L Statement</p>
          <p className="text-xs text-slate-500 mt-1">
            Drag & drop a PDF or click to browse
          </p>
        </div>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </div>
    )
  }

  // Parsing state
  if (parsing) {
    return (
      <div className="mb-5 border border-slate-200 rounded-lg p-5 bg-slate-50 text-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2" />
        <p className="text-sm text-slate-600">Reading P&L...</p>
      </div>
    )
  }

  // Review extracted data
  const foundCount = fields.filter(f => f.value !== null).length

  return (
    <div className="mb-5 border border-blue-200 rounded-lg bg-blue-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-blue-200 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-blue-900">P&L Data Extracted</h4>
          <p className="text-xs text-blue-700">
            Found {foundCount} of {fields.length} fields. Review and adjust before applying.
          </p>
        </div>
        <button onClick={handleClear} className="text-xs text-blue-600 hover:text-blue-800 underline">
          Clear
        </button>
      </div>

      <div className="px-4 py-3 space-y-3">
        {fields.map((field, idx) => (
          <div key={field.key} className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={field.enabled && field.value !== null}
              disabled={field.value === null}
              onChange={() => toggleField(idx)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex-1 min-w-0">
              <label className="text-sm text-slate-700">{field.label}</label>
            </div>
            {field.value !== null ? (
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={field.value.toLocaleString('en-US')}
                  onChange={e => {
                    const raw = e.target.value.replace(/[^0-9.-]/g, '')
                    const num = parseFloat(raw)
                    if (!isNaN(num)) updateFieldValue(idx, num)
                  }}
                  className="w-32 pl-6 pr-2 py-1.5 text-sm text-right border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            ) : (
              <span className="text-xs text-slate-400 italic">Not found</span>
            )}
          </div>
        ))}

        {extracted?.totalRevenue !== null && (
          <p className="text-xs text-slate-500 mt-1">
            Total Revenue: {formatCurrency(extracted!.totalRevenue!)}
            {extracted!.totalExpenses !== null && ` | Total Expenses: ${formatCurrency(extracted!.totalExpenses!)}`}
          </p>
        )}
      </div>

      <div className="px-4 py-3 border-t border-blue-200 flex items-center justify-between">
        <button
          onClick={() => setShowRawText(!showRawText)}
          className="text-xs text-blue-600 hover:text-blue-800 underline"
        >
          {showRawText ? 'Hide' : 'Show'} extracted text
        </button>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleClear}>Cancel</Button>
          <Button size="sm" onClick={handleApply} disabled={fields.filter(f => f.enabled && f.value !== null).length === 0}>
            Apply to Form
          </Button>
        </div>
      </div>

      {showRawText && (
        <div className="px-4 pb-3">
          <pre className="text-xs text-slate-500 bg-white border border-slate-200 rounded p-3 max-h-48 overflow-auto whitespace-pre-wrap">
            {extracted?.rawText}
          </pre>
        </div>
      )}
    </div>
  )
}
