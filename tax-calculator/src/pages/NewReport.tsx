import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { TaxInput, TaxOutput, Step1Data, Step2Data, Step3Data } from '@/types'
import { calculateTax } from '@/tax-engine'
import { useFormState } from '@/hooks/useFormState'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { FormStepper } from '@/components/form/FormStepper'
import { Step1ClientInfo } from '@/components/form/Step1ClientInfo'
import { Step2TaxProfile } from '@/components/form/Step2TaxProfile'
import { Step3FinancialData } from '@/components/form/Step3FinancialData'
import { ResultsPanel } from '@/components/results/ResultsPanel'
import { Button } from '@/components/ui/Button'

const PDFDownloadButton = lazy(() =>
  import('@/components/pdf/PDFDownloadButton').then(m => ({ default: m.PDFDownloadButton }))
)

function toTaxInput(s1: Step1Data, s2: Step2Data, s3: Step3Data): TaxInput {
  return {
    companyName:          s1.companyName,
    companyType:          s1.companyType,
    ownerName:            s1.ownerName,
    taxYear:              s1.taxYear,
    dateCompleted:        s1.dateCompleted,
    quarter:              s2.quarter,
    filingStatus:         s2.filingStatus,
    ownershipPct:         s2.ownershipPct,
    numDependentChildren: s2.numDependentChildren,
    state:                s2.state,
    businessNetIncome:    s3.businessNetIncome,
    shareholderSalary:    s3.shareholderSalary,
    mealExpense:          s3.mealExpense,
    shareholderDraw:      s3.shareholderDraw,
    otherIncome:          s3.otherIncome,
    spousalIncome:        s3.spousalIncome,
    priorEstimatesPaid:   s3.priorEstimatesPaid,
    deductionOverride:    s3.deductionOverride,
    annualizeIncome:      s3.annualizeIncome,
  }
}

export default function NewReport() {
  const { state, dispatch } = useFormState()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [output, setOutput] = useState<TaxOutput | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Live calculation — debounced 300ms
  const taxInput = useMemo(() => toTaxInput(state.step1, state.step2, state.step3), [state.step1, state.step2, state.step3])

  useEffect(() => {
    if (state.step !== 'results') return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      try {
        setOutput(calculateTax(taxInput))
      } catch {
        // silently ignore during partial input
      }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [taxInput, state.step])

  const handleStep1 = useCallback((data: Step1Data) => {
    dispatch({ type: 'SET_STEP1', payload: data })
    dispatch({ type: 'GO_TO_STEP', payload: 2 })
  }, [dispatch])

  const handleStep2 = useCallback((data: Step2Data) => {
    dispatch({ type: 'SET_STEP2', payload: data })
    dispatch({ type: 'GO_TO_STEP', payload: 3 })
  }, [dispatch])

  const handleStep3 = useCallback((data: Step3Data) => {
    dispatch({ type: 'SET_STEP3', payload: data })
    const input = toTaxInput(state.step1, state.step2, data)
    setOutput(calculateTax(input))
    dispatch({ type: 'GO_TO_STEP', payload: 'results' })
  }, [dispatch, state.step1, state.step2])

  async function handleSave() {
    if (!output || !user) return
    setSaving(true)
    setSaveError(null)

    // Upsert client
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .upsert({
        company_name:   state.step1.companyName,
        company_type:   state.step1.companyType,
        owner_name:     state.step1.ownerName,
        state:          state.step2.state,
        filing_status:  state.step2.filingStatus,
        ownership_pct:  state.step2.ownershipPct,
        num_dependents: state.step2.numDependentChildren,
        created_by:     user.id,
      }, { onConflict: 'company_name,created_by' })
      .select('id')
      .single()

    if (clientError) { setSaveError(clientError.message); setSaving(false); return }

    const { error: reportError } = await supabase.from('reports').insert({
      client_id:       clientData.id,
      created_by:      user.id,
      tax_year:        state.step1.taxYear,
      quarter:         state.step2.quarter,
      date_completed:  state.step1.dateCompleted,
      input_snapshot:  taxInput as unknown as Record<string, unknown>,
      output_snapshot: output as unknown as Record<string, unknown>,
    })

    if (reportError) { setSaveError(reportError.message); setSaving(false); return }
    navigate('/')
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">New Tax Estimate</h1>
        <p className="text-sm text-slate-500 mt-1">
          {state.step1.companyName || 'New Client'} {state.step2.quarter && `· ${state.step2.quarter}`}
        </p>
      </div>

      {state.step !== 'results' && (
        <div className="mb-8">
          <FormStepper currentStep={state.step} />
        </div>
      )}

      {state.step === 1 && (
        <div className="max-w-2xl">
          <Step1ClientInfo defaultValues={state.step1} onSubmit={handleStep1} />
        </div>
      )}

      {state.step === 2 && (
        <div className="max-w-2xl">
          <Step2TaxProfile
            defaultValues={state.step2}
            onSubmit={handleStep2}
            onBack={() => dispatch({ type: 'GO_TO_STEP', payload: 1 })}
          />
        </div>
      )}

      {state.step === 3 && (
        <div className="max-w-2xl">
          <Step3FinancialData
            defaultValues={state.step3}
            companyType={state.step1.companyType}
            filingStatus={state.step2.filingStatus}
            taxYear={state.step1.taxYear}
            onSubmit={handleStep3}
            onBack={() => dispatch({ type: 'GO_TO_STEP', payload: 2 })}
          />
        </div>
      )}

      {state.step === 'results' && output && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: form summary + actions */}
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Report Details</h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-slate-500">Client</dt>
                <dd className="text-slate-900 font-medium">{state.step1.ownerName}</dd>
                <dt className="text-slate-500">Company</dt>
                <dd className="text-slate-900">{state.step1.companyName}</dd>
                <dt className="text-slate-500">Type</dt>
                <dd className="text-slate-900">{state.step1.companyType}</dd>
                <dt className="text-slate-500">Quarter / Year</dt>
                <dd className="text-slate-900">{state.step2.quarter} {state.step1.taxYear}</dd>
                <dt className="text-slate-500">State</dt>
                <dd className="text-slate-900">{state.step2.state}</dd>
                <dt className="text-slate-500">Filing Status</dt>
                <dd className="text-slate-900">{state.step2.filingStatus}</dd>
              </dl>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                onClick={() => dispatch({ type: 'GO_TO_STEP', payload: 3 })}
              >
                ← Edit Financials
              </Button>
              <Suspense fallback={<Button variant="secondary" disabled>↓ PDF</Button>}>
                <PDFDownloadButton input={taxInput} output={output} />
              </Suspense>
              <Button onClick={handleSave} loading={saving}>
                Save Report
              </Button>
            </div>

            {saveError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {saveError}
              </p>
            )}
          </div>

          {/* Right: results */}
          <div>
            <ResultsPanel input={taxInput} output={output} />
          </div>
        </div>
      )}
    </div>
  )
}
