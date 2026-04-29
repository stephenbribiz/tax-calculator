import { useState } from 'react'
import type { TaxInput, TaxOutput } from '@/types'
import { formatCurrency } from '@/lib/utils'

interface Props {
  input: TaxInput
  output: TaxOutput
  onTaxableIncomeOverride?: (val: number | null) => void
  onFederalRateOverride?: (val: number | null) => void
}

function Row({ label, value, muted, indent }: { label: string; value: string; muted?: boolean; indent?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-2 ${indent ? 'pl-4' : ''}`}>
      <span className={`text-sm ${muted ? 'text-slate-400' : 'text-slate-600'}`}>{label}</span>
      <span className={`text-sm font-medium tabular-nums ${muted ? 'text-slate-400' : 'text-slate-900'}`}>{value}</span>
    </div>
  )
}

/** Small inline-editable field with amber highlight when value differs from the placeholder (calculated) value */
function OverrideInput({
  placeholder,
  value,
  onChange,
  onReset,
  suffix,
  isOverridden,
}: {
  placeholder: string
  value: string
  onChange: (raw: string) => void
  onReset: () => void
  suffix?: string
  isOverridden: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-28 text-right text-sm tabular-nums border rounded-lg px-2 py-1 pr-${suffix ? '6' : '2'} focus:outline-none focus:ring-2 focus:ring-orange-400 ${
            isOverridden
              ? 'border-amber-400 bg-amber-50 text-amber-900'
              : 'border-slate-200 bg-slate-50 text-slate-700'
          }`}
        />
        {suffix && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      {isOverridden && (
        <button
          type="button"
          onClick={onReset}
          title="Reset to calculated value"
          className="text-xs text-amber-600 hover:text-amber-800 font-medium whitespace-nowrap"
        >
          ↩ reset
        </button>
      )}
    </div>
  )
}

export function FederalBreakdown({ input, output, onTaxableIncomeOverride, onFederalRateOverride }: Props) {
  const { federal, scorp } = output
  const isScorp = input.companyType === 'S-Corp'
  const canAdjust = !!(onTaxableIncomeOverride || onFederalRateOverride)

  // Local display state — tracks the raw string the user is typing
  const [tiRaw, setTiRaw] = useState<string>(
    input.taxableIncomeOverride != null ? String(input.taxableIncomeOverride) : ''
  )
  const [rateRaw, setRateRaw] = useState<string>(
    input.federalRateOverride != null ? String((input.federalRateOverride * 100).toFixed(2)) : ''
  )

  const tiOverridden   = input.taxableIncomeOverride != null
  const rateOverridden = input.federalRateOverride != null

  function handleTIChange(raw: string) {
    setTiRaw(raw)
    const num = parseFloat(raw.replace(/,/g, ''))
    if (!isNaN(num) && num >= 0) onTaxableIncomeOverride?.(num)
    else if (raw === '' || raw === '-') onTaxableIncomeOverride?.(null)
  }

  function handleRateChange(raw: string) {
    setRateRaw(raw)
    const pct = parseFloat(raw.replace(/%/g, ''))
    if (!isNaN(pct) && pct >= 0 && pct <= 100) onFederalRateOverride?.(pct / 100)
    else if (raw === '' || raw === '-') onFederalRateOverride?.(null)
  }

  function resetTI() {
    setTiRaw('')
    onTaxableIncomeOverride?.(null)
  }

  function resetRate() {
    setRateRaw('')
    onFederalRateOverride?.(null)
  }

  // Keep display in sync when input prop changes externally (e.g. navigating to saved plan)
  const syncedTI = input.taxableIncomeOverride != null ? String(input.taxableIncomeOverride) : ''
  const syncedRate = input.federalRateOverride != null ? String((input.federalRateOverride * 100).toFixed(2)) : ''
  if (tiRaw !== syncedTI && !document.activeElement?.matches('input')) setTiRaw(syncedTI)
  if (rateRaw !== syncedRate && !document.activeElement?.matches('input')) setRateRaw(syncedRate)

  const calcTI   = output.taxableIncome
  const calcRate = (federal.effectiveFederalRate * 100).toFixed(2)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-3">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
          Federal Tax Breakdown
        </h3>
      </div>

      {/* Input adjustments — taxable income and rate */}
      {canAdjust && (
        <div className="px-6 pb-3">
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Input Adjustments</p>

            {/* Taxable Income */}
            {onTaxableIncomeOverride && (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-sm text-slate-700 font-medium">Taxable Income</span>
                  {!tiOverridden && (
                    <span className="ml-2 text-xs text-slate-400">calc: {formatCurrency(calcTI)}</span>
                  )}
                  {tiOverridden && (
                    <span className="ml-2 text-xs text-amber-600">override active</span>
                  )}
                </div>
                <OverrideInput
                  placeholder={String(Math.round(calcTI))}
                  value={tiRaw}
                  onChange={handleTIChange}
                  onReset={resetTI}
                  isOverridden={tiOverridden}
                />
              </div>
            )}

            {/* Federal Rate */}
            {onFederalRateOverride && (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-sm text-slate-700 font-medium">Federal Rate</span>
                  {!rateOverridden && (
                    <span className="ml-2 text-xs text-slate-400">bracket: {calcRate}%</span>
                  )}
                  {rateOverridden && (
                    <span className="ml-2 text-xs text-amber-600">override active</span>
                  )}
                </div>
                <OverrideInput
                  placeholder={calcRate}
                  value={rateRaw}
                  onChange={handleRateChange}
                  onReset={resetRate}
                  suffix="%"
                  isOverridden={rateOverridden}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Income Tax */}
      <div className="px-6 pb-1">
        <Row label="Gross Federal Income Tax" value={formatCurrency(federal.grossIncomeTax)} />
        {federal.childTaxCredit > 0 && (
          <Row label="Child Tax Credit" value={`− ${formatCurrency(federal.childTaxCredit)}`} />
        )}
        <Row label="Net Federal Income Tax" value={formatCurrency(federal.netIncomeTax)} />
      </div>

      {/* SE Tax or FICA */}
      <div className="px-6 pb-2">
        <div className="border-t border-slate-100 pt-2">
          {isScorp ? (
            <>
              <Row label="FICA Paid via Payroll" value={`− ${formatCurrency(federal.ficaAlreadyPaid)}`} />
              <Row label="Employer Portion" value={formatCurrency(federal.ficaAlreadyPaid / 2)} indent muted />
              <Row label="Employee Portion" value={formatCurrency(federal.ficaAlreadyPaid / 2)} indent muted />
              {scorp && scorp.additionalFICA > 0 && (
                <Row
                  label="Additional FICA (salary adjustment)"
                  value={`+ ${formatCurrency(scorp.additionalFICA)}`}
                />
              )}
              {input.federalWithholding > 0 && (
                <Row label="Federal Withholding" value={`− ${formatCurrency(input.federalWithholding)}`} />
              )}
            </>
          ) : (
            <>
              <Row label="Self-Employment Tax" value={formatCurrency(federal.seTax)} />
              <Row label="Social Security (12.4%)" value={formatCurrency(federal.seSocialSecurity)} indent muted />
              <Row label="Medicare (2.9%)" value={formatCurrency(federal.seMedicare)} indent muted />
              {federal.seAdditionalMedicare > 0 && (
                <Row label="Additional Medicare (0.9%)" value={formatCurrency(federal.seAdditionalMedicare)} indent muted />
              )}
            </>
          )}
        </div>
      </div>

      {/* Federal Owed — highlighted */}
      <div className="mx-4 mb-4 bg-orange-50 border border-orange-100 rounded-xl px-5 py-3 flex justify-between items-center">
        <span className="text-sm font-semibold text-orange-800">Federal Owed for {input.quarter}</span>
        <span className="text-lg font-bold text-orange-900 tabular-nums">{formatCurrency(output.totalFederalOwed)}</span>
      </div>
    </div>
  )
}
