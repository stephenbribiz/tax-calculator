import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import type { TaxInput, TaxOutput, Step1Data, Step2Data, Step3Data, Quarter, CompanyType, FilingStatus, StateCode } from '@/types'
import { calculateTax } from '@/tax-engine'
import { useFormState } from '@/hooks/useFormState'
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { FormStepper } from '@/components/form/FormStepper'
import { Step1ClientInfo } from '@/components/form/Step1ClientInfo'
import { Step2TaxProfile } from '@/components/form/Step2TaxProfile'
import { Step3FinancialData } from '@/components/form/Step3FinancialData'
import { ResultsPanel } from '@/components/results/ResultsPanel'
import { Button } from '@/components/ui/Button'
import { ExcelDownloadButton } from '@/components/ExcelDownloadButton'
import { useToast } from '@/components/ui/Toast'

const PDFDownloadButton = lazy(() =>
  import('@/components/pdf/PDFDownloadButton').then(m => ({ default: m.PDFDownloadButton }))
)

function toTaxInput(s1: Step1Data, s2: Step2Data, s3: Step3Data): TaxInput {
  return {
    companyName:          s1.companyName,
    companyType:          s1.companyType,
    ownerName:            s1.ownerName,
    taxYear:              s2.taxYear,
    dateCompleted:        s2.dateCompleted,
    quarter:              s2.quarter,
    filingStatus:         s2.filingStatus,
    ownershipPct:         s2.ownershipPct,
    numDependentChildren: s2.numDependentChildren,
    state:                s2.state,
    businessNetIncome:    s3.businessNetIncome,
    shareholderSalary:    s3.shareholderSalary,
    // Only pass adjustedSalary to the engine when the user has explicitly confirmed the adjustment.
    // This keeps additionalFICA out of the tax total until confirmed.
    adjustedSalary:       s3.payrollAdjConfirmed ? s3.adjustedSalary : 0,
    federalWithholding:   s3.federalWithholding,
    mealExpense:          s3.mealExpense,
    shareholderDraw:      s3.shareholderDraw,
    otherIncome:          s3.otherIncome,
    spousalIncome:        s3.spousalIncome,
    priorEstimatesPaid:   s3.priorEstimatesPaid,
    priorFEPaid:          s3.priorFEPaid,
    deductionOverride:    s3.deductionOverride,
    annualizeIncome:      s3.annualizeIncome,
  }
}

// Reverse: convert a saved TaxInput back into form steps
function fromTaxInput(input: TaxInput): { step1: Step1Data; step2: Step2Data; step3: Step3Data } {
  return {
    step1: {
      companyName: input.companyName,
      companyType: input.companyType,
      ownerName:   input.ownerName,
    },
    step2: {
      quarter:              input.quarter,
      taxYear:              input.taxYear,
      dateCompleted:        input.dateCompleted,
      filingStatus:         input.filingStatus,
      ownershipPct:         input.ownershipPct,
      numDependentChildren: input.numDependentChildren,
      state:                input.state,
    },
    step3: {
      businessNetIncome:   input.businessNetIncome,
      shareholderSalary:   input.shareholderSalary,
      adjustedSalary:      input.adjustedSalary ?? 0,
      // A saved plan with a non-zero adjustedSalary had it confirmed — restore that state.
      payrollAdjConfirmed: (input.adjustedSalary ?? 0) > 0,
      federalWithholding:  input.federalWithholding ?? 0,
      mealExpense:        input.mealExpense,
      shareholderDraw:    input.shareholderDraw,
      otherIncome:        input.otherIncome,
      spousalIncome:      input.spousalIncome,
      priorEstimatesPaid: input.priorEstimatesPaid,
      priorFEPaid:        input.priorFEPaid ?? 0,
      deductionOverride:  input.deductionOverride,
      annualizeIncome:    input.annualizeIncome,
    },
  }
}

const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4']

export default function NewReport() {
  const { state, dispatch, hasDraft, draft } = useFormState()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [output, setOutput] = useState<TaxOutput | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clientLoaded = useRef(false)
  const reportLoaded = useRef(false)
  const [draftDismissed, setDraftDismissed] = useState(false)

  // The ID of the report being edited (null = new report)
  const editReportId = searchParams.get('edit')
  const duplicateReportId = searchParams.get('duplicate')
  const clientParam = searchParams.get('client')
  // Show a loading placeholder while we fetch client data (prevents Step 1 flash)
  const [clientLoading, setClientLoading] = useState(!!clientParam && !editReportId)
  const [editClientId, setEditClientId] = useState<string | null>(null)
  const isEditing = !!editReportId
  const duplicateLoaded = useRef(false)

  // Show draft banner only when no URL params override and draft exists
  const showDraftBanner = hasDraft && !draftDismissed && !editReportId && !clientParam && !duplicateReportId

  // Warn before leaving with unsaved changes (step 2+, or results not yet saved)
  const isDirty = state.step === 2 || state.step === 3 || state.step === 'results'
  useUnsavedChangesWarning(isDirty)

  // Load existing report for editing when ?edit=<id> is present
  useEffect(() => {
    if (!editReportId || reportLoaded.current) return
    reportLoaded.current = true

    async function loadReport() {
      const { data } = await supabase
        .from('reports')
        .select('*, clients(id)')
        .eq('id', editReportId)
        .single()

      if (!data) return

      const input = data.input_snapshot as unknown as TaxInput
      const { step1, step2, step3 } = fromTaxInput(input)

      setEditClientId(data.client_id)

      dispatch({ type: 'SET_STEP1', payload: step1 })
      dispatch({ type: 'SET_STEP2', payload: step2 })
      dispatch({ type: 'SET_STEP3', payload: step3 })

      // Go straight to step 3 (financials) for editing
      dispatch({ type: 'GO_TO_STEP', payload: 3 })
    }

    loadReport()
  }, [editReportId, dispatch])

  // Load report for duplication when ?duplicate=<id> is present
  useEffect(() => {
    if (!duplicateReportId || duplicateLoaded.current) return
    duplicateLoaded.current = true

    async function loadDuplicate() {
      const { data } = await supabase
        .from('reports')
        .select('*')
        .eq('id', duplicateReportId)
        .single()

      if (!data) return

      const input = data.input_snapshot as unknown as TaxInput
      const { step1, step2, step3 } = fromTaxInput(input)

      // Update dateCompleted to today
      step2.dateCompleted = new Date().toISOString().split('T')[0]

      dispatch({ type: 'SET_STEP1', payload: step1 })
      dispatch({ type: 'SET_STEP2', payload: step2 })
      dispatch({ type: 'SET_STEP3', payload: step3 })

      // Go to Step 3 so user can adjust numbers — no editReportId set, so save creates a new report
      dispatch({ type: 'GO_TO_STEP', payload: 3 })
    }

    loadDuplicate()
  }, [duplicateReportId, dispatch])

  // Load client data when ?client=<id> is present (new report for existing client)
  useEffect(() => {
    const id = searchParams.get('client')
    if (!id || clientLoaded.current || isEditing) return
    clientLoaded.current = true

    async function loadClient() {
      const { data: client } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single()

      if (!client) return

      const taxYear = new Date().getFullYear()

      // Fetch existing reports for this client/year to find next quarter
      const { data: existingReports } = await supabase
        .from('reports')
        .select('quarter')
        .eq('client_id', id)
        .eq('tax_year', taxYear)

      const doneQuarters = (existingReports ?? []).map(r => r.quarter)
      const nextQuarter = QUARTERS.find(q => !doneQuarters.includes(q)) ?? 'Q1'

      // Pre-populate Step 1 from client identity
      dispatch({
        type: 'SET_STEP1',
        payload: {
          companyName:  client.company_name,
          companyType:  client.company_type as CompanyType,
          ownerName:    client.owner_name,
        },
      })

      // Pre-populate Step 2 with client profile + smart defaults for quarter/year
      dispatch({
        type: 'SET_STEP2',
        payload: {
          quarter:              nextQuarter as Quarter,
          taxYear,
          dateCompleted:        new Date().toISOString().split('T')[0],
          filingStatus:         (client.filing_status ?? 'Single') as FilingStatus,
          ownershipPct:         client.ownership_pct ?? 100,
          numDependentChildren: client.num_dependents ?? 0,
          state:                client.state as StateCode,
        },
      })

      // Skip straight to financials — client identity and profile are pre-filled
      dispatch({ type: 'GO_TO_STEP', payload: 3 })
      setClientLoading(false)
    }

    loadClient()
  }, [searchParams, dispatch, isEditing])

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

  // Called by SCorpAnalysis when the user types a new adjusted salary OR confirms/edits.
  // `adjustedSalary` is the full YTD target (currentSalary + quarterlyAdditional).
  // `confirmed` gates whether the FICA flows into the tax total.
  const handlePayrollAdj = useCallback((adjustedSalary: number, confirmed: boolean) => {
    dispatch({ type: 'SET_STEP3', payload: { ...state.step3, adjustedSalary, payrollAdjConfirmed: confirmed } })
  }, [dispatch, state.step3])

  async function handleSave() {
    if (!output || !user) return
    setSaving(true)
    setSaveError(null)

    if (isEditing && editReportId) {
      // ── UPDATE existing report ──
      const { error: reportError } = await supabase
        .from('reports')
        .update({
          tax_year:        state.step2.taxYear,
          quarter:         state.step2.quarter,
          date_completed:  state.step2.dateCompleted,
          input_snapshot:  taxInput as unknown as Record<string, unknown>,
          output_snapshot: output as unknown as Record<string, unknown>,
        })
        .eq('id', editReportId)

      if (reportError) { setSaveError(reportError.message); toast(reportError.message, 'error'); setSaving(false); return }

      // Also update the client profile in case any info changed
      if (editClientId) {
        await supabase
          .from('clients')
          .update({
            company_name:   state.step1.companyName,
            company_type:   state.step1.companyType,
            owner_name:     state.step1.ownerName,
            state:          state.step2.state,
            filing_status:  state.step2.filingStatus,
            ownership_pct:  state.step2.ownershipPct,
            num_dependents: state.step2.numDependentChildren,
          })
          .eq('id', editClientId)
      }

      dispatch({ type: 'CLEAR_DRAFT' })
      toast('Tax plan updated')
      navigate(editClientId ? `/clients/${editClientId}` : `/reports/${editReportId}`)
    } else {
      // ── CREATE new report ──
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

      if (clientError) { setSaveError(clientError.message); toast(clientError.message, 'error'); setSaving(false); return }

      const { error: reportError } = await supabase.from('reports').insert({
        client_id:       clientData.id,
        created_by:      user.id,
        tax_year:        state.step2.taxYear,
        quarter:         state.step2.quarter,
        date_completed:  state.step2.dateCompleted,
        input_snapshot:  taxInput as unknown as Record<string, unknown>,
        output_snapshot: output as unknown as Record<string, unknown>,
      })

      if (reportError) { setSaveError(reportError.message); toast(reportError.message, 'error'); setSaving(false); return }
      dispatch({ type: 'CLEAR_DRAFT' })
      toast('Tax plan saved')
      navigate(clientData.id ? `/clients/${clientData.id}` : '/')
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {isEditing ? 'Edit Tax Plan' : 'New Tax Plan'}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {state.step1.companyName || 'New Client'} {state.step2.quarter && `· ${state.step2.quarter} ${state.step2.taxYear}`}
        </p>
      </div>

      {showDraftBanner && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>You have a saved draft.</span>
          <button
            type="button"
            className="font-medium underline hover:text-amber-900"
            onClick={() => {
              if (draft) dispatch({ type: 'LOAD_DRAFT', payload: draft })
              setDraftDismissed(true)
            }}
          >
            Resume
          </button>
          <button
            type="button"
            className="font-medium underline hover:text-amber-900"
            onClick={() => {
              dispatch({ type: 'CLEAR_DRAFT' })
              setDraftDismissed(true)
            }}
          >
            Discard
          </button>
        </div>
      )}

      {/* Step indicator — only for brand-new clients (no client param) */}
      {state.step !== 'results' && !clientParam && (
        <div className="mb-8">
          <FormStepper currentStep={state.step} />
        </div>
      )}

      {/* Loading placeholder while client data fetches (prevents Step 1 flash) */}
      {clientLoading && (
        <div className="max-w-2xl">
          <div className="h-10 bg-slate-100 rounded-lg animate-pulse mb-4" />
          <div className="h-10 bg-slate-100 rounded-lg animate-pulse mb-4" />
          <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
        </div>
      )}

      {/* Period bar — shown for existing clients once loaded */}
      {clientParam && !clientLoading && state.step !== 'results' && (
        <div className="mb-6 flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm max-w-2xl">
          <span className="text-slate-500">Period:</span>
          <span className="font-semibold text-slate-900">{state.step2.quarter} {state.step2.taxYear}</span>
          {state.step === 3 && (
            <button
              type="button"
              onClick={() => dispatch({ type: 'GO_TO_STEP', payload: 2 })}
              className="text-xs text-orange-600 hover:text-orange-800 font-medium"
            >
              Change
            </button>
          )}
          <Link
            to={`/clients/${clientParam}`}
            className="ml-auto text-xs text-slate-400 hover:text-slate-600"
          >
            ← Back to client
          </Link>
        </div>
      )}

      {!clientLoading && state.step === 1 && (
        <div className="max-w-2xl">
          <Step1ClientInfo defaultValues={state.step1} onSubmit={handleStep1} />
        </div>
      )}

      {!clientLoading && state.step === 2 && (
        <div className="max-w-2xl">
          <Step2TaxProfile
            defaultValues={state.step2}
            onSubmit={handleStep2}
            onBack={() => {
              if (clientParam) dispatch({ type: 'GO_TO_STEP', payload: 3 })
              else dispatch({ type: 'GO_TO_STEP', payload: 1 })
            }}
          />
        </div>
      )}

      {!clientLoading && state.step === 3 && (
        <div className="max-w-2xl">
          <Step3FinancialData
            defaultValues={state.step3}
            companyType={state.step1.companyType}
            filingStatus={state.step2.filingStatus}
            taxYear={state.step2.taxYear}
            ownershipPct={state.step2.ownershipPct}
            stateCode={state.step2.state}
            clientId={clientParam ?? editClientId ?? undefined}
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
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Tax Plan Details</h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-slate-500">Client</dt>
                <dd className="text-slate-900 font-medium">{state.step1.ownerName}</dd>
                <dt className="text-slate-500">Company</dt>
                <dd className="text-slate-900">{state.step1.companyName}</dd>
                <dt className="text-slate-500">Type</dt>
                <dd className="text-slate-900">{state.step1.companyType}</dd>
                <dt className="text-slate-500">Quarter / Year</dt>
                <dd className="text-slate-900">{state.step2.quarter} {state.step2.taxYear}</dd>
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
              <ExcelDownloadButton input={taxInput} output={output} />
              <Suspense fallback={<Button variant="secondary" disabled>↓ PDF</Button>}>
                <PDFDownloadButton input={taxInput} output={output} />
              </Suspense>
              <Button onClick={handleSave} loading={saving}>
                {isEditing ? 'Update Tax Plan' : 'Save Tax Plan'}
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
            <ResultsPanel
              input={taxInput}
              output={output}
              onPayrollAdj={handlePayrollAdj}
              payrollAdjState={{
                adjustedSalary:      state.step3.adjustedSalary,
                payrollAdjConfirmed: state.step3.payrollAdjConfirmed,
                shareholderSalary:   state.step3.shareholderSalary,
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
