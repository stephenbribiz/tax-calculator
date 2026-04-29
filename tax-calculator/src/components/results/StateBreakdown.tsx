import { useState } from 'react'
import type { TaxInput, TaxOutput } from '@/types'
import { formatCurrency, formatPercent } from '@/lib/utils'

interface PayrollAdjState {
  adjustedSalary: number
  payrollAdjConfirmed: boolean
  shareholderSalary: number
}

interface Props {
  input: TaxInput
  output: TaxOutput
  /** TN S-Corp: called when the adjusted-salary toggle is flipped */
  onFEToggle?: (feUsesAdjustedSalary: boolean) => void
  /** TN: called when the F&E apportionment % changes */
  onApportionmentChange?: (pct: number) => void
  /** Raw form-state payroll values — used to show toggle before confirmation */
  payrollAdjState?: PayrollAdjState
}

function ApportionmentInput({ pct, onChange }: { pct: number; onChange: (v: number) => void }) {
  const [raw, setRaw] = useState(String(pct))
  const isOverridden = pct !== 100

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setRaw(v)
    const num = parseFloat(v)
    if (!isNaN(num) && num >= 0 && num <= 100) onChange(num)
  }

  function reset() {
    setRaw('100')
    onChange(100)
  }

  return (
    <div className={`mb-3 flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 ${isOverridden ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50 border border-slate-200'}`}>
      <div className="text-xs text-slate-600 leading-relaxed">
        <span className="font-medium text-slate-700">TN Apportionment</span>
        <span className="block text-slate-400 mt-0.5">
          Percentage of business income subject to TN F&E tax.
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative">
          <input
            type="text"
            value={raw}
            onChange={handleChange}
            className={`w-20 text-right text-sm tabular-nums border rounded-lg px-2 py-1 pr-6 focus:outline-none focus:ring-2 focus:ring-orange-400 ${
              isOverridden ? 'border-amber-400 bg-white text-amber-900' : 'border-slate-300 bg-white text-slate-700'
            }`}
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">%</span>
        </div>
        {isOverridden && (
          <button type="button" onClick={reset} className="text-xs text-amber-600 hover:text-amber-800 font-medium whitespace-nowrap">
            ↩ reset
          </button>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2">
      <span className={`text-sm ${muted ? 'text-slate-400' : 'text-slate-600'}`}>{label}</span>
      <span className={`text-sm font-medium tabular-nums ${muted ? 'text-slate-400' : 'text-slate-900'}`}>{value}</span>
    </div>
  )
}

export function StateBreakdown({ input, output, onFEToggle, onApportionmentChange }: Props) {
  const { state } = output
  const hasStateTax = state.stateIncomeTax > 0
  const hasEntityTax = state.exciseTax > 0 || state.franchiseTax > 0
  const annualFE = state.exciseTax + state.franchiseTax
  const priorFEPaid = input.priorFEPaid ?? 0
  const netFEOwed = Math.max(0, annualFE - priorFEPaid)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-3">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
          {state.stateName} State Tax
        </h3>
      </div>

      {/* State income tax */}
      <div className="px-6 pb-2">
        {hasStateTax ? (
          <>
            <Row label="State Deduction" value={`− ${formatCurrency(state.stateDeduction)}`} />
            <Row label="Effective State Rate" value={formatPercent(state.effectiveStateRate)} />
            <Row label="State Income Tax" value={formatCurrency(state.stateIncomeTax)} />
          </>
        ) : (
          <p className="text-sm text-slate-400 py-2">
            No individual income tax in {state.stateName}.
          </p>
        )}
      </div>

      {/* Entity-level tax (F&E) */}
      {hasEntityTax && (
        <div className="px-6 pb-2">
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              {input.companyType} Franchise & Excise
            </p>

            {/* TN: apportionment percentage */}
            {input.state === 'TN' && onApportionmentChange && (
              <ApportionmentInput
                pct={input.tnApportionmentPct ?? 100}
                onChange={onApportionmentChange}
              />
            )}

            {/* TN S-Corp: toggle to deduct shareholder salary from excise tax base */}
            {input.state === 'TN' && input.companyType === 'S-Corp' && (
              <div className="mb-3 flex items-start gap-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5">
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!input.feUsesAdjustedSalary}
                  onClick={() => onFEToggle && onFEToggle(!input.feUsesAdjustedSalary)}
                  disabled={!onFEToggle}
                  className={`relative inline-flex h-5 w-9 shrink-0 mt-0.5 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1 ${
                    onFEToggle ? 'cursor-pointer' : 'cursor-default opacity-60'
                  } ${input.feUsesAdjustedSalary ? 'bg-orange-500' : 'bg-slate-300'}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                      input.feUsesAdjustedSalary ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
                <div className="text-xs text-slate-600 leading-relaxed">
                  <span className="font-medium text-slate-700">Deduct salary from F&E excise base</span>
                  <span className="block text-slate-400 mt-0.5">
                    When on, the adjusted salary ({formatCurrency(input.feAdjustedSalary || input.adjustedSalary || input.shareholderSalary)}) is deducted from net income before calculating the 6.5% excise tax.
                  </span>
                </div>
              </div>
            )}

            <Row label="Excise Tax (6.5%)" value={formatCurrency(state.exciseTax)} />
            <Row label="Franchise Tax (minimum)" value={formatCurrency(state.franchiseTax)} />
            <Row label="Annual F&E Total" value={formatCurrency(annualFE)} />
            {priorFEPaid > 0 && (
              <Row label="Prior F&E Payments" value={`− ${formatCurrency(priorFEPaid)}`} muted />
            )}
            <Row label="F&E Owed" value={formatCurrency(netFEOwed)} />
          </div>
        </div>
      )}

      {/* State Owed — highlighted */}
      <div className="mx-4 mb-4 bg-orange-50 border border-orange-100 rounded-xl px-5 py-3 flex justify-between items-center">
        <span className="text-sm font-semibold text-orange-800">State Owed for {input.quarter}</span>
        <span className="text-lg font-bold text-orange-900 tabular-nums">{formatCurrency(output.totalStateOwed)}</span>
      </div>

      {/* Notes */}
      {state.notes.length > 0 && (
        <div className="px-6 pb-4 space-y-1">
          {state.notes.map((note, i) => (
            <p key={i} className="text-[11px] text-slate-400 leading-relaxed">
              • {note}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
