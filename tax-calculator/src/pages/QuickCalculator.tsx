import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { TaxInput, TaxOutput, Step3Data, CompanyType, FilingStatus, Quarter, StateCode } from '@/types'
import { calculateTax } from '@/tax-engine'
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning'
import { defaultStep3 } from '@/hooks/useFormState'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ResultsPanel } from '@/components/results/ResultsPanel'
import { Step3FinancialData } from '@/components/form/Step3FinancialData'
import { COMPANY_TYPE_OPTIONS } from '@/constants/companyTypes'
import { STATE_OPTIONS } from '@/constants/states'
import { QUARTER_OPTIONS, FILING_STATUS_OPTIONS } from '@/constants/quarters'

const PDFDownloadButton = lazy(() =>
  import('@/components/pdf/PDFDownloadButton').then(m => ({ default: m.PDFDownloadButton }))
)

interface ProfileData {
  companyType: CompanyType
  quarter: Quarter
  filingStatus: FilingStatus
  state: StateCode
  ownershipPct: number
  numDependentChildren: number
  taxYear: number
}

const YEAR_OPTIONS = [2024, 2025, 2026].map(y => ({ value: String(y), label: String(y) }))
const QUARTER_SELECT_OPTIONS = QUARTER_OPTIONS.map(q => ({
  value: q.value,
  label: `${q.label} (${q.months})`,
}))

export default function QuickCalculator() {
  const [step, setStep] = useState<'profile' | 'financials' | 'results'>('profile')
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [financials, setFinancials] = useState<Step3Data>(defaultStep3)
  const [output, setOutput] = useState<TaxOutput | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Warn before leaving with unsaved changes on financials or results step
  useUnsavedChangesWarning(step === 'financials' || step === 'results')

  const { register, handleSubmit, formState: { errors } } = useForm<ProfileData>({
    defaultValues: {
      companyType: 'S-Corp',
      quarter: 'Q1',
      filingStatus: 'Single',
      state: 'TN',
      ownershipPct: 100,
      numDependentChildren: 0,
      taxYear: new Date().getFullYear(),
    },
  })

  const taxInput: TaxInput | null = useMemo(() => {
    if (!profile) return null
    return {
      companyName:          'Quick Estimate',
      ownerName:            '',
      dateCompleted:        new Date().toISOString().split('T')[0],
      companyType:          profile.companyType,
      taxYear:              profile.taxYear,
      quarter:              profile.quarter,
      filingStatus:         profile.filingStatus,
      ownershipPct:         profile.ownershipPct,
      numDependentChildren: profile.numDependentChildren,
      state:                profile.state,
      ...financials,
      feAdjustedSalary:     0,
    }
  }, [profile, financials])

  // Live recalc when on results
  useEffect(() => {
    if (step !== 'results' || !taxInput) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      try {
        setOutput(calculateTax(taxInput))
      } catch {
        // ignore partial input
      }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [taxInput, step])

  const handleProfile = useCallback((data: ProfileData) => {
    setProfile(data)
    setStep('financials')
  }, [])

  const handleFinancials = useCallback((data: Step3Data) => {
    setFinancials(data)
    if (!profile) return
    const input: TaxInput = {
      companyName:          'Quick Estimate',
      ownerName:            '',
      dateCompleted:        new Date().toISOString().split('T')[0],
      companyType:          profile.companyType,
      taxYear:              profile.taxYear,
      quarter:              profile.quarter,
      filingStatus:         profile.filingStatus,
      ownershipPct:         profile.ownershipPct,
      numDependentChildren: profile.numDependentChildren,
      state:                profile.state,
      ...data,
      feAdjustedSalary:     0,
    }
    setOutput(calculateTax(input))
    setStep('results')
  }, [profile])

  const handleAdjustedSalaryChange = useCallback((value: number) => {
    setFinancials(prev => ({ ...prev, adjustedSalary: value }))
  }, [])

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Quick Calculator</h1>
        <p className="text-sm text-slate-500 mt-1">
          Run a quick estimate without setting up a client profile.
        </p>
      </div>

      {step === 'profile' && (
        <div className="max-w-2xl">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <form onSubmit={handleSubmit(handleProfile)} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Company Type"
                  options={COMPANY_TYPE_OPTIONS}
                  {...register('companyType')}
                />
                <Select
                  label="Tax Year"
                  options={YEAR_OPTIONS}
                  {...register('taxYear', { valueAsNumber: true })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Fiscal Quarter"
                  options={QUARTER_SELECT_OPTIONS}
                  {...register('quarter')}
                />
                <Select
                  label="Filing Status"
                  options={FILING_STATUS_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                  {...register('filingStatus')}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="State of Residence"
                  options={STATE_OPTIONS}
                  {...register('state')}
                />
                <Input
                  label="Ownership Percentage (%)"
                  type="number"
                  min="1"
                  max="100"
                  error={errors.ownershipPct?.message}
                  {...register('ownershipPct', {
                    valueAsNumber: true,
                    required: 'Required',
                    min: { value: 1, message: 'Must be at least 1%' },
                    max: { value: 100, message: 'Cannot exceed 100%' },
                  })}
                />
              </div>

              <Input
                label="Number of Dependent Children"
                type="number"
                min="0"
                hint="Qualifying children under 17 for Child Tax Credit"
                {...register('numDependentChildren', { valueAsNumber: true, min: 0 })}
              />

              <div className="flex justify-end pt-2">
                <Button type="submit">Continue →</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {step === 'financials' && profile && (
        <div className="max-w-2xl">
          <Step3FinancialData
            defaultValues={financials}
            companyType={profile.companyType}
            filingStatus={profile.filingStatus}
            taxYear={profile.taxYear}
            ownershipPct={profile.ownershipPct}
            stateCode={profile.state}
            onSubmit={handleFinancials}
            onBack={() => setStep('profile')}
          />
        </div>
      )}

      {step === 'results' && output && taxInput && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Estimate Details</h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-slate-500">Type</dt>
                <dd className="text-slate-900">{profile?.companyType}</dd>
                <dt className="text-slate-500">Quarter / Year</dt>
                <dd className="text-slate-900">{profile?.quarter} {profile?.taxYear}</dd>
                <dt className="text-slate-500">State</dt>
                <dd className="text-slate-900">{profile?.state}</dd>
                <dt className="text-slate-500">Filing Status</dt>
                <dd className="text-slate-900">{profile?.filingStatus}</dd>
              </dl>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => setStep('financials')}>
                ← Edit Financials
              </Button>
              <Suspense fallback={<Button variant="secondary" disabled>↓ PDF</Button>}>
                <PDFDownloadButton input={taxInput} output={output} />
              </Suspense>
              <Button variant="secondary" onClick={() => { setStep('profile'); setOutput(null) }}>
                Start Over
              </Button>
            </div>
          </div>

          <div>
            <ResultsPanel input={taxInput} output={output} onAdjustedSalaryChange={handleAdjustedSalaryChange} />
          </div>
        </div>
      )}
    </div>
  )
}
