import type { TaxInput, TaxOutput } from '@/types'
import { formatCurrency, formatPercent } from '@/lib/utils'

interface Props { input: TaxInput; output: TaxOutput }

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2">
      <span className={`text-sm ${muted ? 'text-slate-400' : 'text-slate-600'}`}>{label}</span>
      <span className={`text-sm font-medium tabular-nums ${muted ? 'text-slate-400' : 'text-slate-900'}`}>{value}</span>
    </div>
  )
}

export function IncomeSummary({ input, output }: Props) {
  const annualizedNote = output.annualizedBusinessIncome
    ? `Rates based on annualized income of ${formatCurrency(output.annualizedBusinessIncome)}`
    : undefined

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-3">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
          Income Summary
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          {input.quarter} {input.taxYear} — {output.quarterProration * 100}% of year
        </p>
      </div>

      {/* Rows */}
      <div className="px-6 pb-2">
        <Row label="Business Net Income" value={formatCurrency(input.businessNetIncome)} />
        {input.ownershipPct < 100 && (
          <Row
            label={`Allocated to Owner (${input.ownershipPct}%)`}
            value={formatCurrency(output.allocatedBusinessIncome)}
          />
        )}

        {/* Adjustments — show only what applies */}
        {output.mealAddBack > 0 && (
          <Row label="Meal Add-Back (50%)" value={`+ ${formatCurrency(output.mealAddBack)}`} />
        )}
        {output.seTaxDeduction > 0 && (
          <Row label="SE Tax Deduction" value={`− ${formatCurrency(output.seTaxDeduction)}`} />
        )}
        {output.qbiDeduction > 0 && (
          <Row label="QBI Deduction (20%)" value={`− ${formatCurrency(output.qbiDeduction)}`} />
        )}
        <Row
          label={`${output.effectiveDeduction !== output.standardDeduction ? 'Itemized' : 'Standard'} Deduction`}
          value={`− ${formatCurrency(output.effectiveDeduction)}`}
        />
        {(input.otherIncome > 0 || input.spousalIncome > 0) && (
          <Row
            label="Other / Spousal Income"
            value={formatCurrency(input.otherIncome + input.spousalIncome)}
            muted
          />
        )}
      </div>

      {/* Taxable Income highlight */}
      <div className="mx-4 mb-3 bg-slate-50 rounded-xl px-5 py-3 flex justify-between items-center">
        <span className="text-sm font-semibold text-slate-700">Federal Taxable Income</span>
        <span className="text-base font-bold text-slate-900 tabular-nums">{formatCurrency(output.taxableIncome)}</span>
      </div>

      {/* Rates */}
      <div className="px-6 pb-4 flex gap-6">
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Marginal Rate</p>
          <p className="text-sm font-semibold text-slate-800">{formatPercent(output.federal.marginalRate)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-0.5">Effective Rate</p>
          <p className="text-sm font-semibold text-slate-800">{formatPercent(output.federal.effectiveFederalRate)}</p>
        </div>
      </div>

      {annualizedNote && (
        <div className="px-6 pb-4">
          <p className="text-[11px] text-slate-400 leading-relaxed">{annualizedNote}</p>
        </div>
      )}
    </div>
  )
}
