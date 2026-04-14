import type { TaxInput, TaxOutput } from '@/types'
import { formatCurrency } from '@/lib/utils'

interface Props { input: TaxInput; output: TaxOutput }

export function TaxSummary({ input, output }: Props) {
  const isOverpaid = output.netAmountDue === 0 && input.priorEstimatesPaid > output.totalTaxOwed
  const overpaidAmount = input.priorEstimatesPaid - output.totalTaxOwed

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
          Quarterly Tax Estimate
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">{input.quarter} {input.taxYear}</p>
      </div>

      {/* Federal / State side-by-side */}
      <div className="px-6 pb-5 grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-xl px-4 py-3.5 text-center">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Federal</p>
          <p className="text-xl font-bold text-slate-900">{formatCurrency(output.totalFederalOwed)}</p>
        </div>
        <div className="bg-slate-50 rounded-xl px-4 py-3.5 text-center">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">{output.state.stateName}</p>
          <p className="text-xl font-bold text-slate-900">{formatCurrency(output.totalStateOwed)}</p>
        </div>
      </div>

      {/* Totals */}
      <div className="px-6 pb-2">
        <div className="border-t border-slate-100 pt-3 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">Total Estimated Tax</span>
            <span className="text-sm font-semibold text-slate-900">{formatCurrency(output.totalTaxOwed)}</span>
          </div>
          {input.priorEstimatesPaid > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">Prior Estimated Payments</span>
              <span className="text-sm font-medium text-slate-400">− {formatCurrency(output.priorEstimatesPaid)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Net Amount Due — the hero number */}
      <div className={`mx-4 mb-4 rounded-xl px-5 py-4 flex justify-between items-center ${
        isOverpaid ? 'bg-emerald-600' : 'bg-slate-900'
      }`}>
        <span className="text-sm font-semibold text-white/80">
          {isOverpaid ? 'Overpaid — applied to next quarter' : `Net Amount Due`}
        </span>
        <span className="text-2xl font-bold text-white">
          {isOverpaid ? `− ${formatCurrency(overpaidAmount)}` : formatCurrency(output.netAmountDue)}
        </span>
      </div>

      {/* Disclaimer */}
      <div className="px-6 pb-4">
        <p className="text-[11px] text-slate-400 leading-relaxed">
          This estimate is for planning purposes only. Consult a licensed tax professional before filing.
        </p>
      </div>
    </div>
  )
}
