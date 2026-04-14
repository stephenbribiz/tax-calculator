import type { SCorpAnalysis as SCorpAnalysisType } from '@/types'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { formatCurrency } from '@/lib/utils'

interface Props {
  scorp: SCorpAnalysisType
  onAdjustedSalaryChange?: (value: number) => void
}

function Row({ label, value, accent }: { label: string; value: string; accent?: 'green' | 'orange' | 'amber' }) {
  const colorMap = {
    green: { label: 'text-emerald-700', value: 'text-emerald-700' },
    orange: { label: 'text-orange-700', value: 'text-orange-700' },
    amber: { label: 'text-amber-700', value: 'text-amber-700' },
  }
  const colors = accent ? colorMap[accent] : { label: 'text-slate-600', value: 'text-slate-900' }

  return (
    <div className="flex justify-between items-center py-2">
      <span className={`text-sm ${colors.label}`}>{label}</span>
      <span className={`text-sm font-medium tabular-nums ${colors.value}`}>{value}</span>
    </div>
  )
}

export function SCorpAnalysis({ scorp, onAdjustedSalaryChange }: Props) {
  const hasAdjustment = scorp.adjustedSalary !== 0
  const isRefund = scorp.additionalFICA < 0

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
          S-Corp Salary Analysis
        </h3>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
          scorp.isSalaryReasonable
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-amber-50 text-amber-700 border-amber-200'
        }`}>
          {scorp.isSalaryReasonable ? 'Salary Reasonable' : 'Review Recommended'}
        </span>
      </div>

      {/* Warning */}
      {scorp.warningMessage && (
        <div className="mx-4 mb-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-sm text-amber-800">
            <span className="font-semibold">IRS Reasonable Compensation: </span>
            {scorp.warningMessage}
          </p>
        </div>
      )}

      {/* Salary comparison */}
      <div className="px-6 pb-2">
        <Row label="Current Salary (YTD)" value={formatCurrency(scorp.currentSalary)} />
        <Row label="Recommended Minimum (40%)" value={formatCurrency(scorp.recommendedMinSalary)} />
        <Row label="FICA on Current Salary" value={formatCurrency(scorp.currentFICA)} />
        <Row label="FICA at Recommended Salary" value={formatCurrency(scorp.recommendedFICA)} />
        {scorp.ficaGap > 0 && (
          <Row label="FICA Gap" value={`+ ${formatCurrency(scorp.ficaGap)}`} accent="amber" />
        )}
      </div>

      {/* Payroll adjustment */}
      <div className="px-6 pb-4">
        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Payroll Adjustment
          </p>
          {onAdjustedSalaryChange && (
            <div className="mb-3">
              <CurrencyInput
                label="Adjusted Salary (YTD)"
                hint="Enter a target salary to see FICA impact"
                value={scorp.adjustedSalary}
                onChange={onAdjustedSalaryChange}
              />
            </div>
          )}
          {hasAdjustment && (
            <>
              <Row label="FICA at Adjusted Salary" value={formatCurrency(scorp.adjustedFICA)} />
              <Row
                label={isRefund ? 'FICA Savings' : 'Additional FICA'}
                value={isRefund
                  ? `− ${formatCurrency(Math.abs(scorp.additionalFICA))}`
                  : `+ ${formatCurrency(scorp.additionalFICA)}`}
                accent={isRefund ? 'green' : 'orange'}
              />
            </>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="px-6 pb-4">
        <p className="text-[11px] text-slate-400 leading-relaxed">
          The 40% threshold is a common guideline, not an IRS-mandated formula. Reasonable compensation
          is based on market rates for the services performed.
        </p>
      </div>
    </div>
  )
}
