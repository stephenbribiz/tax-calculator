import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import type { Step3Data } from '@/types'
import type { BusinessRow, CompanyType } from '@/types/engine'
import type { DbBusiness } from '@/lib/supabase'
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
  businesses?: DbBusiness[]
  primaryCompanyName?: string
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

/** Build the initial per-business breakdown rows */
function buildInitialBreakdown(
  businesses: DbBusiness[],
  defaultValues: Step3Data,
  companyType: CompanyType,
  primaryCompanyName: string,
): BusinessRow[] {
  // If the saved plan already has a breakdown, use it — but merge in any new businesses
  // that may have been added to the DB since the plan was saved.
  const saved = defaultValues.businessBreakdown
  if (saved && saved.length > 0) {
    // Keep saved rows in order; append any DB businesses not already present
    const savedIds = new Set(saved.map(r => r.businessId))
    const newRows: BusinessRow[] = businesses
      .filter(b => !savedIds.has(b.id))
      .map(b => ({
        businessId: b.id,
        companyName: b.company_name,
        companyType: b.company_type as CompanyType,
        netIncome: 0,
        mealExpense: 0,
        shareholderSalary: 0,
        federalWithholding: 0,
      }))
    return [...saved, ...newRows]
  }

  // First time: build from primary company + DB businesses
  const primaryRow: BusinessRow = {
    businessId: 'primary',
    companyName: primaryCompanyName || 'Primary Business',
    companyType,
    netIncome: defaultValues.businessNetIncome,
    mealExpense: defaultValues.mealExpense,
    shareholderSalary: defaultValues.shareholderSalary,
    federalWithholding: defaultValues.federalWithholding,
  }

  const businessRows: BusinessRow[] = businesses.map(b => ({
    businessId: b.id,
    companyName: b.company_name,
    companyType: b.company_type as CompanyType,
    netIncome: 0,
    mealExpense: 0,
    shareholderSalary: 0,
    federalWithholding: 0,
  }))

  return [primaryRow, ...businessRows]
}

export function Step3FinancialData({
  defaultValues,
  companyType,
  filingStatus,
  taxYear,
  ownershipPct = 100,
  stateCode,
  clientId,
  businesses = [],
  primaryCompanyName = '',
  onSubmit,
  onBack,
}: Step3Props) {
  const { control, handleSubmit, setValue } = useForm<Step3Data>({ defaultValues })
  const isScorp = companyType === 'S-Corp'
  const showFEField = stateCode === 'TN' && companyType !== 'Sole-Prop'

  // Multi-business mode: active when the client has businesses in the DB
  const isMultiBusiness = businesses.length > 0

  // Per-business breakdown (only used in multi-business mode)
  const [breakdown, setBreakdown] = useState<BusinessRow[]>(() =>
    isMultiBusiness
      ? buildInitialBreakdown(businesses, defaultValues, companyType, primaryCompanyName)
      : []
  )

  // When businesses list changes (async load), rebuild if we haven't yet
  useEffect(() => {
    if (!isMultiBusiness) return
    setBreakdown(prev =>
      prev.length > 0
        ? prev
        : buildInitialBreakdown(businesses, defaultValues, companyType, primaryCompanyName)
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMultiBusiness])

  // Sync breakdown totals into RHF fields so the normal form submit path works
  useEffect(() => {
    if (!isMultiBusiness || breakdown.length === 0) return
    const totalNetIncome      = breakdown.reduce((s, r) => s + r.netIncome, 0)
    const totalMealExpense    = breakdown.reduce((s, r) => s + r.mealExpense, 0)
    const totalSalary         = breakdown.reduce((s, r) => s + r.shareholderSalary, 0)
    const totalWithholding    = breakdown.reduce((s, r) => s + r.federalWithholding, 0)
    setValue('businessNetIncome',  totalNetIncome)
    setValue('mealExpense',        totalMealExpense)
    setValue('shareholderSalary',  totalSalary)
    setValue('federalWithholding', totalWithholding)
  }, [breakdown, isMultiBusiness, setValue])

  function updateBreakdownRow(idx: number, field: keyof BusinessRow, value: number) {
    setBreakdown(prev => prev.map((row, i) => i === idx ? { ...row, [field]: value } : row))
  }

  // Derived: does any row in the breakdown include an S-Corp?
  const hasAnySCorp = isMultiBusiness && breakdown.some(r => r.companyType === 'S-Corp')

  // Breakdown totals for the footer row
  const breakdownTotals = {
    netIncome:         breakdown.reduce((s, r) => s + r.netIncome, 0),
    mealExpense:       breakdown.reduce((s, r) => s + r.mealExpense, 0),
    shareholderSalary: breakdown.reduce((s, r) => s + r.shareholderSalary, 0),
    federalWithholding:breakdown.reduce((s, r) => s + r.federalWithholding, 0),
  }

  function handlePLApply(values: Record<string, number>) {
    for (const [key, val] of Object.entries(values)) {
      setValue(key as keyof Step3Data, val, { shouldDirty: true, shouldValidate: true })
    }
  }

  function handleADPApply(salary: number | null, withholding: number | null) {
    if (salary != null) setValue('shareholderSalary', salary, { shouldDirty: true, shouldValidate: true })
    if (withholding != null) setValue('federalWithholding', withholding, { shouldDirty: true, shouldValidate: true })
  }

  // Inject businessBreakdown into the submitted data in multi-business mode
  function internalSubmit(data: Step3Data) {
    onSubmit(isMultiBusiness ? { ...data, businessBreakdown: breakdown } : data)
  }

  // Get standard deduction for the selected year/filing status
  const taxData = getTaxDataByYear(taxYear)
  const stdDeduction = taxData.standardDeduction[filingStatus as keyof typeof taxData.standardDeduction] ?? 15000

  const deductionOverride = useWatch({ control, name: 'deductionOverride' })
  const isItemizing = deductionOverride !== null && deductionOverride > 0

  const businessNetIncome = useWatch({ control, name: 'businessNetIncome' })
  const shareholderSalary = useWatch({ control, name: 'shareholderSalary' })

  return (
    <form onSubmit={handleSubmit(internalSubmit)} className="space-y-6">

      {/* ── MULTI-BUSINESS BREAKDOWN ── */}
      {isMultiBusiness && (
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b border-slate-100">
            Business Breakdown
            <span className="text-xs font-normal text-slate-400 ml-2">Enter YTD figures for each company — totals flow into the tax calculation</span>
          </h4>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200">
                  <th className="text-left px-4 py-2.5">Company</th>
                  <th className="text-right px-3 py-2.5 min-w-[140px]">Net Income (YTD)</th>
                  <th className="text-right px-3 py-2.5 min-w-[130px]">Meal Expense</th>
                  {hasAnySCorp && <th className="text-right px-3 py-2.5 min-w-[150px]">Shareholder Salary</th>}
                  {hasAnySCorp && <th className="text-right px-3 py-2.5 min-w-[150px]">Fed Withholding</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {breakdown.map((row, idx) => {
                  const rowIsScorp = row.companyType === 'S-Corp'
                  return (
                    <tr key={row.businessId} className="bg-white">
                      <td className="px-4 py-2.5">
                        <div>
                          <span className="font-medium text-slate-800">{row.companyName}</span>
                          <span className="ml-1.5 text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{row.companyType}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <CurrencyInput
                          value={row.netIncome}
                          onChange={v => updateBreakdownRow(idx, 'netIncome', v)}
                          className="text-right"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <CurrencyInput
                          value={row.mealExpense}
                          onChange={v => updateBreakdownRow(idx, 'mealExpense', v)}
                          className="text-right"
                        />
                      </td>
                      {hasAnySCorp && (
                        <td className="px-3 py-2">
                          {rowIsScorp
                            ? <CurrencyInput value={row.shareholderSalary} onChange={v => updateBreakdownRow(idx, 'shareholderSalary', v)} className="text-right" />
                            : <span className="block text-center text-slate-300 py-2">—</span>
                          }
                        </td>
                      )}
                      {hasAnySCorp && (
                        <td className="px-3 py-2">
                          {rowIsScorp
                            ? <CurrencyInput value={row.federalWithholding} onChange={v => updateBreakdownRow(idx, 'federalWithholding', v)} className="text-right" />
                            : <span className="block text-center text-slate-300 py-2">—</span>
                          }
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-700 text-sm">
                  <td className="px-4 py-2.5">Combined Total</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(breakdownTotals.netIncome)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(breakdownTotals.mealExpense)}</td>
                  {hasAnySCorp && <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(breakdownTotals.shareholderSalary)}</td>}
                  {hasAnySCorp && <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(breakdownTotals.federalWithholding)}</td>}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── SINGLE-BUSINESS: document quick-apply + P&L upload ── */}
      {!isMultiBusiness && (
        <>
          {clientId && (
            <SavedDocumentPicker
              clientId={clientId}
              taxYear={taxYear}
              isScorp={isScorp}
              onApplyPL={handlePLApply}
              onApplyADP={handleADPApply}
            />
          )}
          <PLUpload companyType={companyType} onApply={handlePLApply} />
        </>
      )}

      {/* ── SINGLE-BUSINESS: Business Income fields ── */}
      {!isMultiBusiness && (
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
      )}

      {/* ── MULTI-BUSINESS: shareholder draw (informational) ── */}
      {isMultiBusiness && (
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b border-slate-100">
            Other Business Entries
          </h4>
          <Controller name="shareholderDraw" control={control} render={({ field }) => (
            <CurrencyInput
              label="Shareholder Draw (Expensed)"
              hint="For records only — not tax deductible"
              value={field.value}
              onChange={field.onChange}
            />
          )} />
        </div>
      )}

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
