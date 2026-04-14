import type { TaxInput, TaxOutput } from '@/types'
import { Card, SectionHeader } from '@/components/ui/Card'
import { formatCurrency, formatPercent } from '@/lib/utils'

interface Props { input: TaxInput; output: TaxOutput }

export function StateBreakdown({ input, output }: Props) {
  const { state } = output
  const hasStateTax = state.stateIncomeTax > 0
  const hasEntityTax = state.exciseTax > 0 || state.franchiseTax > 0
  const annualFE = state.exciseTax + state.franchiseTax
  const priorFEPaid = input.priorFEPaid ?? 0
  const netFEOwed = Math.max(0, annualFE - priorFEPaid)

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
          </>
        ) : (
          <p className="text-sm text-slate-500 py-2">No individual state income tax for {state.stateName}.</p>
        )}

        {hasEntityTax && (
          <>
            <div className="pt-2 pb-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {input.companyType} Franchise & Excise Tax
              </span>
            </div>
            {state.exciseTax > 0 && (
              <div className="flex justify-between items-center py-1.5">
                <span className="text-sm text-slate-600">Excise Tax (6.5% on net earnings)</span>
                <span className="text-sm font-medium text-slate-900">{formatCurrency(state.exciseTax)}</span>
              </div>
            )}
            {state.exciseTax === 0 && (
              <div className="flex justify-between items-center py-1.5">
                <span className="text-sm text-slate-600">Excise Tax</span>
                <span className="text-sm font-medium text-slate-500">$0</span>
              </div>
            )}
            <div className="flex justify-between items-center py-1.5">
              <span className="text-sm text-slate-600">Franchise Tax (minimum)</span>
              <span className="text-sm font-medium text-slate-900">{formatCurrency(state.franchiseTax)}</span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="text-sm text-slate-600">Annual F&E Total</span>
              <span className="text-sm font-semibold text-slate-900">{formatCurrency(annualFE)}</span>
            </div>
            {priorFEPaid > 0 && (
              <div className="flex justify-between items-center py-1.5">
                <span className="text-sm text-slate-600">Prior F&E Payments</span>
                <span className="text-sm font-medium text-slate-900">− {formatCurrency(priorFEPaid)}</span>
              </div>
            )}
            <div className="flex justify-between items-center py-1.5">
              <span className="text-sm font-medium text-slate-700">F&E Owed</span>
              <span className="text-sm font-semibold text-slate-900">{formatCurrency(netFEOwed)}</span>
            </div>
          </>
        )}

        <div className="flex justify-between items-center py-1.5 bg-orange-50 -mx-1 px-1 rounded">
          <span className="text-sm font-semibold text-orange-800">State Owed for {input.quarter}</span>
          <span className="text-sm font-bold text-orange-900">{formatCurrency(output.totalStateOwed)}</span>
        </div>
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
