import { Controller, useForm, useWatch } from 'react-hook-form'
import type { Step3Data } from '@/types'
import type { CompanyType } from '@/types'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { Toggle } from '@/components/ui/Toggle'
import { Button } from '@/components/ui/Button'
import { PLUpload } from '@/components/form/PLUpload'
import { getTaxDataByYear } from '@/tax-engine/constants'
import { useDocuments } from '@/hooks/useDocuments'
import { formatCurrency } from '@/lib/utils'
import type { DbDocument } from '@/lib/supabase'

interface Step3Props {
  defaultValues: Step3Data
  companyType: CompanyType
  filingStatus: string
  taxYear: number
  ownershipPct?: number
  stateCode?: string
  clientId?: string
  onSubmit: (data: Step3Data) => void
  onBack: () => void
}

/** Small inline component showing saved docs with Apply buttons */
function SavedDocumentPicker({
  clientId,
  taxYear,
  isScorp,
  onApplyPL,
  onApplyADP,
}: {
  clientId: string
  taxYear: number
  isScorp: boolean
  onApplyPL: (values: Record<string, number>) => void
  onApplyADP: (salary: number | null, withholding: number | null) => void
}) {
  const { documents, loading } = useDocuments(clientId)

  // Filter to current tax year only
  const plDocs = documents.filter(d => d.file_type === 'pl' && d.tax_year === taxYear)
  const adpDocs = documents.filter(d => d.file_type === 'adp_payroll' && d.tax_year === taxYear)

  if (loading || (plDocs.length === 0 && adpDocs.length === 0)) return null

  function applyPL(doc: DbDocument) {
    const data = doc.parsed_data as {
      netIncome?: number | null
      officerCompensation?: number | null
      mealExpense?: number | null
      shareholderDraw?: number | null
    } | null
    if (!data) return

    const values: Record<string, number> = {}
    if (data.netIncome != null) values['businessNetIncome'] = data.netIncome
    if (isScorp && data.officerCompensation != null) values['shareholderSalary'] = data.officerCompensation
    if (data.mealExpense != null) values['mealExpense'] = data.mealExpense
    if (data.shareholderDraw != null) values['shareholderDraw'] = data.shareholderDraw
    onApplyPL(values)
  }

  function applyADP(doc: DbDocument) {
    const data = doc.parsed_data as {
      ytdGrossWages?: number | null
      ytdFederalWithholding?: number | null
    } | null
    if (!data) return
    onApplyADP(data.ytdGrossWages ?? null, data.ytdFederalWithholding ?? null)
  }

  function getDocLabel(doc: DbDocument) {
    const parts: string[] = []
    if (doc.quarter) parts.push(doc.quarter)
    if (doc.file_type === 'pl') {
      const data = doc.parsed_data as { netIncome?: number | null } | null
      if (data?.netIncome != null) parts.push(`Net Income: ${formatCurrency(data.netIncome)}`)
    } else {
      const data = doc.parsed_data as { ytdGrossWages?: number | null; ytdFederalWithholding?: number | null } | null
      if (data?.ytdGrossWages != null) parts.push(`Salary: ${formatCurrency(data.ytdGrossWages)}`)
      if (data?.ytdFederalWithholding != null) parts.push(`Withholding: ${formatCurrency(data.ytdFederalWithholding)}`)
    }
    return parts.join(' · ')
  }

  return (
    <div className="border border-slate-200 rounded-lg bg-slate-50 overflow-hidden mb-1">
      <div className="px-4 py-2.5 border-b border-slate-200 bg-white">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Apply from Saved Documents ({taxYear})</p>
      </div>
      <div className="divide-y divide-slate-200">
        {plDocs.map(doc => (
          <div key={doc.id} className="flex items-center justify-between px-4 py-2.5 gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{doc.file_name}</p>
              <p className="text-xs text-slate-500">{getDocLabel(doc)}</p>
            </div>
            <button
              type="button"
              onClick={() => applyPL(doc)}
              className="shrink-0 text-xs font-medium text-orange-600 hover:text-orange-800 border border-orange-200 rounded-md px-3 py-1 bg-white hover:bg-orange-50"
            >
              Apply P&L
            </button>
          </div>
        ))}
        {isScorp && adpDocs.map(doc => (
          <div key={doc.id} className="flex items-center justify-between px-4 py-2.5 gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{doc.file_name}</p>
              <p className="text-xs text-slate-500">{getDocLabel(doc)}</p>
            </div>
            <button
              type="button"
              onClick={() => applyADP(doc)}
              className="shrink-0 text-xs font-medium text-blue-600 hover:text-blue-800 border border-blue-200 rounded-md px-3 py-1 bg-white hover:bg-blue-50"
            >
              Apply Payroll
            </button>
          </div>
        ))}
        {!isScorp && adpDocs.length > 0 && (
          <div className="px-4 py-2.5 text-xs text-slate-400">
            {adpDocs.length} ADP payroll report{adpDocs.length > 1 ? 's' : ''} saved — applicable for S-Corp clients only.
          </div>
        )}
      </div>
    </div>
  )
}

export function Step3FinancialData({
  defaultValues,
  companyType,
  filingStatus,
  taxYear,
  ownershipPct = 100,
  stateCode,
  clientId,
  onSubmit,
  onBack,
}: Step3Props) {
  const { control, handleSubmit, setValue } = useForm<Step3Data>({ defaultValues })
  const isScorp = companyType === 'S-Corp'
  const showFEField = stateCode === 'TN' && companyType !== 'Sole-Prop'

  function handlePLApply(values: Record<string, number>) {
    for (const [key, val] of Object.entries(values)) {
      setValue(key as keyof Step3Data, val, { shouldDirty: true, shouldValidate: true })
    }
  }

  function handleADPApply(salary: number | null, withholding: number | null) {
    if (salary != null) setValue('shareholderSalary', salary, { shouldDirty: true, shouldValidate: true })
    if (withholding != null) setValue('federalWithholding', withholding, { shouldDirty: true, shouldValidate: true })
  }

  // Get standard deduction for the selected year/filing status
  const taxData = getTaxDataByYear(taxYear)
  const stdDeduction = taxData.standardDeduction[filingStatus as keyof typeof taxData.standardDeduction] ?? 15000

  const deductionOverride = useWatch({ control, name: 'deductionOverride' })
  const isItemizing = deductionOverride !== null && deductionOverride > 0

  const businessNetIncome = useWatch({ control, name: 'businessNetIncome' })
  const shareholderSalary = useWatch({ control, name: 'shareholderSalary' })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      {/* Saved documents quick-apply (shown only when a known client is selected) */}
      {clientId && (
        <SavedDocumentPicker
          clientId={clientId}
          taxYear={taxYear}
          isScorp={isScorp}
          onApplyPL={handlePLApply}
          onApplyADP={handleADPApply}
        />
      )}

      {/* P&L Upload */}
      <PLUpload companyType={companyType} onApply={handlePLApply} />

      {/* Business Income */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b border-slate-100">
          Business Income
        </h4>
        <div className="space-y-4">
          <Controller name="businessNetIncome" control={control} render={({ field }) => (
            <div>
              <CurrencyInput
                label="Business Net Income (YTD)"
                hint="Cumulative net profit through this quarter (after business expenses, before owner distributions)"
                value={field.value}
                onChange={field.onChange}
              />
              {businessNetIncome < 0 && (
                <p className="text-xs text-amber-600 mt-1">Net income is negative. This will reduce your tax estimate.</p>
              )}
              {businessNetIncome * (ownershipPct / 100) > 10_000_000 && (
                <p className="text-xs text-amber-600 mt-1">Please verify this amount.</p>
              )}
            </div>
          )} />

          {isScorp && (
            <>
              <Controller name="shareholderSalary" control={control} render={({ field }) => (
                <div>
                  <CurrencyInput
                    label="Shareholder Salary Paid (YTD)"
                    hint="Cumulative W-2 salary paid to the shareholder through this quarter. FICA already withheld will be subtracted."
                    value={field.value}
                    onChange={field.onChange}
                  />
                  {shareholderSalary > businessNetIncome && businessNetIncome > 0 && (
                    <p className="text-xs text-amber-600 mt-1">Shareholder salary exceeds business net income.</p>
                  )}
                </div>
              )} />
              <Controller name="federalWithholding" control={control} render={({ field }) => (
                <CurrencyInput
                  label="Federal Income Tax Withheld (YTD)"
                  hint="Cumulative federal income tax withheld from shareholder payroll through this quarter."
                  value={field.value}
                  onChange={field.onChange}
                />
              )} />
            </>
          )}

          <Controller name="mealExpense" control={control} render={({ field }) => (
            <CurrencyInput
              label="Business Meal / Food Expense"
              hint="50% of this amount is deductible"
              value={field.value}
              onChange={field.onChange}
            />
          )} />

          <Controller name="shareholderDraw" control={control} render={({ field }) => (
            <CurrencyInput
              label="Shareholder Draw (Expensed)"
              hint="For records only — not tax deductible"
              value={field.value}
              onChange={field.onChange}
            />
          )} />
        </div>
      </div>

      {/* Other Income */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b border-slate-100">
          Other Income
          <span className="text-xs font-normal text-slate-400 ml-2">Used for bracket placement only — not included in estimate total</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Controller name="otherIncome" control={control} render={({ field }) => (
            <CurrencyInput
              label="Other Personal Income"
              hint="Rental, investment, side income, etc."
              value={field.value}
              onChange={field.onChange}
            />
          )} />
          <Controller name="spousalIncome" control={control} render={({ field }) => (
            <CurrencyInput
              label="Spousal Income"
              value={field.value}
              onChange={field.onChange}
            />
          )} />
        </div>
      </div>

      {/* Deduction & Prior Payments */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b border-slate-100">
          Deductions & Payments
        </h4>
        <div className="space-y-4">
          <Controller name="deductionOverride" control={control} render={({ field }) => (
            <CurrencyInput
              label={isItemizing ? 'Itemized Deduction Amount' : 'Deduction Amount'}
              hint={isItemizing
                ? `Itemizing: overriding standard deduction of $${stdDeduction.toLocaleString()}`
                : `Standard deduction for ${filingStatus}: $${stdDeduction.toLocaleString()}. Enter a larger amount to itemize.`}
              value={field.value ?? stdDeduction}
              onChange={val => field.onChange(val === stdDeduction || val === 0 ? null : val)}
            />
          )} />

          <Controller name="priorEstimatesPaid" control={control} render={({ field }) => (
            <CurrencyInput
              label="Prior Estimated Tax Payments (YTD)"
              hint="Total of all estimated payments already made for this tax year through prior quarters"
              value={field.value}
              onChange={field.onChange}
            />
          )} />

          {showFEField && (
            <Controller name="priorFEPaid" control={control} render={({ field }) => (
              <CurrencyInput
                label="Prior F&E Tax Payments (YTD)"
                hint="TN Franchise & Excise estimates already paid for this tax year"
                value={field.value}
                onChange={field.onChange}
              />
            )} />
          )}
        </div>
      </div>

      {/* Annualization */}
      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
        <Controller name="annualizeIncome" control={control} render={({ field }) => (
          <Toggle
            checked={field.value}
            onChange={field.onChange}
            label="Annualize Income"
            hint={`Projects this quarter's income to a full year for accurate tax bracket placement. E.g., Q1 income × 4 = estimated annual income.`}
          />
        )} />
      </div>

      <div className="flex justify-between pt-2">
        <Button type="button" variant="secondary" onClick={onBack}>← Back</Button>
        <Button type="submit">Calculate →</Button>
      </div>
    </form>
  )
}
