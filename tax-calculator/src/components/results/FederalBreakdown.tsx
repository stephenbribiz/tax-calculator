import { useEffect, useRef, useState } from 'react'
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

function OverrideField({
  label,
  calcLabel,
  value,
  isOverridden,
  suffix,
  onCommit,
  onReset,
}: {
  label: string
  calcLabel: string
  value: string
  isOverridden: boolean
  suffix?: string
  onCommit: (raw: string) => void
  onReset: () => void
}) {
  const [raw, setRaw] = useState(value)
  useEffect(() => { setRaw(value) }, [value])

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="block text-xs text-slate-400 mt-0.5">{isOverridden ? 'override active' : calcLabel}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative">
          <input
            type="text"
            value={raw}
            onChange={e => { setRaw(e.target.value); onCommit(e.target.value) }}
            className={`w-32 text-right text-sm tabular-nums border-2 rounded-lg px-3 py-1.5 ${suffix ? 'pr-7' : ''} focus:outline-none focus:ring-2 focus:ring-orange-400 ${
              isOverridden
                ? 'border-amber-400 bg-amber-50 text-amber-900 font-semibold'
                : 'border-slate-300 bg-white text-slate-800'
            }`}
          />
          {suffix && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
              {suffix}
            </span>
          )}
        </div>
        {isOverridden && (
          <button type="button" onClick={onReset} className="text-xs text-amber-600 hover:text-amber-800 font-medium whitespace-nowrap">
            ↩ reset
          </button>
        )}
      </div>
    </div>
  )
}

export function FederalBreakdown({ input, output, onTaxableIncomeOverride, onFederalRateOverride }: Props) {
  const { federal, scorp } = output
  const isScorp = input.companyType === 'S-Corp'

  const tiOverridden   = input.taxableIncomeOverride != null
  const rateOverridden = input.federalRateOverride   != null
  const anyOverridden  = tiOverridden || rateOverridden

  // Collapsed by default; auto-open if an override is already active
  const [open, setOpen] = useState(anyOverridden)
  const prevAnyRef = useRef(anyOverridden)
  useEffect(() => {
    if (anyOverridden && !prevAnyRef.current) setOpen(true)
    prevAnyRef.current = anyOverridden
  }, [anyOverridden])

  const tiDisplayValue   = tiOverridden   ? String(input.taxableIncomeOverride) : ''
  const rateDisplayValue = rateOverridden ? String((input.federalRateOverride! * 100).toFixed(2)) : ''

  const calcTI   = formatCurrency(output.taxableIncome)
  const calcRate = `bracket: ${(federal.effectiveFederalRate * 100).toFixed(2)}%`

  function handleTICommit(raw: string) {
    const num = parseFloat(raw.replace(/,/g, ''))
    if (!isNaN(num) && num >= 0) onTaxableIncomeOverride?.(num)
    else if (raw === '') onTaxableIncomeOverride?.(null)
  }

  function handleRateCommit(raw: string) {
    const pct = parseFloat(raw.replace(/%/g, ''))
    if (!isNaN(pct) && pct >= 0 && pct <= 100) onFederalRateOverride?.(pct / 100)
    else if (raw === '') onFederalRateOverride?.(null)
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-3">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
          Federal Tax Breakdown
        </h3>
      </div>

      {/* Input Adjustments — collapsible */}
      <div className="px-6 pb-3">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg border transition-colors ${
            anyOverridden
              ? 'bg-amber-50 border-amber-300 hover:bg-amber-100'
              : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span className={`text-xs font-semibold uppercase tracking-wide ${anyOverridden ? 'text-amber-700' : 'text-slate-500'}`}>
              Manual Input Adjustments
            </span>
            {anyOverridden && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-200 text-amber-800">
                active
              </span>
            )}
          </div>
          <svg
            className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="mt-2 rounded-lg border border-slate-200 bg-white px-4 py-3 space-y-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              Override the inputs that drive the federal calculation. Leave blank to use the calculated value. Changes take effect immediately.
            </p>
            <OverrideField
              label="Taxable Income"
              calcLabel={`calculated: ${calcTI}`}
              value={tiDisplayValue}
              isOverridden={tiOverridden}
              onCommit={handleTICommit}
              onReset={() => onTaxableIncomeOverride?.(null)}
            />
            <OverrideField
              label="Federal Rate"
              calcLabel={`calculated: ${calcRate}`}
              value={rateDisplayValue}
              isOverridden={rateOverridden}
              suffix="%"
              onCommit={handleRateCommit}
              onReset={() => onFederalRateOverride?.(null)}
            />
          </div>
        )}
      </div>

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
