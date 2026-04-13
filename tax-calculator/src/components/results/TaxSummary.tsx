import type { TaxInput, TaxOutput } from '@/types'
import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Props { input: TaxInput; output: TaxOutput }

function Row({ label, value, bold, highlight, negative }: {
  label: string; value: string; bold?: boolean; highlight?: boolean; negative?: boolean
}) {
  return (
    <div className={cn(
      'flex justify-between items-center py-2',
      highlight && 'bg-slate-900 text-white -mx-5 px-5 rounded-lg',
    )}>
      <span className={cn('text-sm', bold && 'font-semibold', highlight && 'text-white')}>{label}</span>
      <span className={cn(
        'text-sm font-bold',
        highlight ? 'text-white text-base' : negative ? 'text-slate-500' : 'text-slate-900',
      )}>{value}</span>
    </div>
  )
}

export function TaxSummary({ input, output }: Props) {
  const isOverpaid = output.netAmountDue === 0 && input.priorEstimatesPaid > output.totalTaxOwed

  return (
    <Card padding="lg">
      <h3 className="text-base font-bold text-slate-900 mb-4">
        Total Estimate — {input.quarter} {input.taxYear}
      </h3>
      <div className="divide-y divide-slate-100">
        <Row label={`Federal Tax (${input.quarter})`} value={formatCurrency(output.totalFederalOwed)} />
        <Row label={`State Tax — ${output.state.stateName} (${input.quarter})`} value={formatCurrency(output.totalStateOwed)} />
        <Row label="Total Estimated Tax Owed" value={formatCurrency(output.totalTaxOwed)} bold />
        {input.priorEstimatesPaid > 0 && (
          <Row
            label="Prior Estimated Payments"
            value={`− ${formatCurrency(output.priorEstimatesPaid)}`}
            negative
          />
        )}
        <Row
          label={isOverpaid ? 'Overpaid (applied to next quarter)' : `Net Amount Due for ${input.quarter}`}
          value={isOverpaid
            ? `− ${formatCurrency(input.priorEstimatesPaid - output.totalTaxOwed)}`
            : formatCurrency(output.netAmountDue)}
          highlight
        />
      </div>
      <p className="text-xs text-slate-400 mt-4">
        This estimate is for planning purposes only. Actual tax liability may vary.
        Consult a licensed tax professional before filing.
      </p>
    </Card>
  )
}
