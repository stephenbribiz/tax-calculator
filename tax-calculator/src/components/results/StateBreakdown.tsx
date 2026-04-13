import type { TaxInput, TaxOutput } from '@/types'
import { Card, SectionHeader } from '@/components/ui/Card'
import { formatCurrency, formatPercent } from '@/lib/utils'

interface Props { input: TaxInput; output: TaxOutput }

export function StateBreakdown({ input, output }: Props) {
  const { state } = output
  const hasStateTax = state.stateIncomeTax > 0

  return (
    <Card>
      <SectionHeader title={`${state.stateName} State Tax`} />
      <div className="divide-y divide-slate-100">
        {hasStateTax ? (
          <>
            <div className="flex justify-between items-center py-1.5">
              <span className="text-sm text-slate-600">State Deduction</span>
              <span className="text-sm font-medium text-slate-900">− {formatCurrency(state.stateDeduction)}</span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="text-sm text-slate-600">Effective State Rate</span>
              <span className="text-sm font-medium text-slate-900">{formatPercent(state.effectiveStateRate)}</span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="text-sm text-slate-600">State Income Tax (before proration)</span>
              <span className="text-sm font-medium text-slate-900">{formatCurrency(state.stateIncomeTax)}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 bg-blue-50 -mx-1 px-1 rounded">
              <span className="text-sm font-semibold text-blue-800">State Owed for {input.quarter}</span>
              <span className="text-sm font-bold text-blue-900">{formatCurrency(output.totalStateOwed)}</span>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500 py-2">No individual state income tax for {state.stateName}.</p>
        )}
      </div>

      {state.notes.length > 0 && (
        <div className="mt-3 space-y-1">
          {state.notes.map((note, i) => (
            <p key={i} className="text-xs text-slate-500 flex gap-1.5">
              <span className="text-slate-300 mt-0.5">•</span>
              <span>{note}</span>
            </p>
          ))}
        </div>
      )}
    </Card>
  )
}
