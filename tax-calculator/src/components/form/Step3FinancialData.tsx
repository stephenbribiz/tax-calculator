import { Controller, useForm, useWatch } from 'react-hook-form'
import type { Step3Data } from '@/types'
import type { CompanyType } from '@/types'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { Toggle } from '@/components/ui/Toggle'
import { Button } from '@/components/ui/Button'
import { PLUpload } from '@/components/form/PLUpload'
import { getTaxDataByYear } from '@/tax-engine/constants'

interface Step3Props {
  defaultValues: Step3Data
  companyType: CompanyType
  filingStatus: string
  taxYear: number
  ownershipPct?: number
  stateCode?: string
  onSubmit: (data: Step3Data) => void
  onBack: () => void
}

export function Step3FinancialData({
  defaultValues,
  companyType,
  filingStatus,
  taxYear,
  ownershipPct = 100,
  stateCode,
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

  // Get standard deduction for the selected year/filing status
  const taxData = getTaxDataByYear(taxYear)
  const stdDeduction = taxData.standardDeduction[filingStatus as keyof typeof taxData.standardDeduction] ?? 15000

  const deductionOverride = useWatch({ control, name: 'deductionOverride' })
  const isItemizing = deductionOverride !== null && deductionOverride > 0

  const businessNetIncome = useWatch({ control, name: 'businessNetIncome' })
  const shareholderSalary = useWatch({ control, name: 'shareholderSalary' })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

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
