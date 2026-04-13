import type { TaxInput, TaxOutput } from '@/types'
import { Card, SectionHeader } from '@/components/ui/Card'
import { formatCurrency, formatPercent } from '@/lib/utils'

interface Props { input: TaxInput; output: TaxOutput }

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex justify-between items-start py-1.5">
      <div>
        <span className="text-sm text-slate-600">{label}</span>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
      <span className="text-sm font-medium text-slate-900">{value}</span>
    </div>
  )
}

export function IncomeSummary({ input, output }: Props) {
  return (
    <Card>
      <SectionHeader title="Income Summary" subtitle={`${input.quarter} ${input.taxYear} — ${output.quarterProration * 100}% of year`} />
      <div className="divide-y divide-slate-100">
        <Row
          label="Business Net Income"
          value={formatCurrency(input.businessNetIncome)}
          sub={input.annualizeIncome ? `Annualized: ${formatCurrency(output.annualizedBusinessIncome)}` : undefined}
        />
        <Row
          label={`Allocated to Owner (${input.ownershipPct}%)`}
          value={formatCurrency(output.allocatedBusinessIncome)}
        />
        {output.mealDeduction > 0 && (
          <Row label="Meal Deduction (50%)" value={`− ${formatCurrency(output.mealDeduction)}`} />
        )}
        {output.seTaxDeduction > 0 && (
          <Row label="SE Tax Deduction (50% of SE tax)" value={`− ${formatCurrency(output.seTaxDeduction)}`} />
        )}
        {output.qbiDeduction > 0 && (
          <Row label="QBI Deduction (20%)" value={`− ${formatCurrency(output.qbiDeduction)}`} />
        )}
        <Row
          label="Deduction Applied"
          value={`− ${formatCurrency(output.effectiveDeduction)}`}
          sub={output.effectiveDeduction !== output.standardDeduction ? 'Itemized' : 'Standard'}
        />
        {(input.otherIncome > 0 || input.spousalIncome > 0) && (
          <Row
            label="Other / Spousal Income"
            value={formatCurrency(input.otherIncome + input.spousalIncome)}
            sub="Affects tax bracket only"
          />
        )}
        <div className="flex justify-between items-center py-2 mt-1">
          <span className="text-sm font-semibold text-slate-800">Federal Taxable Income</span>
          <span className="text-sm font-bold text-slate-900">{formatCurrency(output.taxableIncome)}</span>
        </div>
        <Row
          label="Marginal Tax Rate"
          value={formatPercent(output.federal.marginalRate)}
        />
        <Row
          label="Effective Federal Rate"
          value={formatPercent(output.federal.effectiveFederalRate)}
        />
      </div>
    </Card>
  )
}
