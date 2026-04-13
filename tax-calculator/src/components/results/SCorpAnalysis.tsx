import type { SCorpAnalysis as SCorpAnalysisType } from '@/types'
import { Card, SectionHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'

interface Props { scorp: SCorpAnalysisType }

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1.5">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-sm font-medium text-slate-900">{value}</span>
    </div>
  )
}

export function SCorpAnalysis({ scorp }: Props) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <SectionHeader title="S-Corp Salary Analysis" />
        <Badge variant={scorp.isSalaryReasonable ? 'success' : 'warning'}>
          {scorp.isSalaryReasonable ? 'Salary Reasonable' : 'Review Recommended'}
        </Badge>
      </div>

      {scorp.warningMessage && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
          <strong>IRS Reasonable Compensation:</strong> {scorp.warningMessage}
        </div>
      )}

      <div className="divide-y divide-slate-100">
        <Row label="Current Shareholder Salary" value={formatCurrency(scorp.currentSalary)} />
        <Row label="Recommended Minimum Salary (40%)" value={formatCurrency(scorp.recommendedMinSalary)} />
        <Row label="FICA on Current Salary (employer + employee)" value={formatCurrency(scorp.currentFICA)} />
        <Row label="FICA at Recommended Salary" value={formatCurrency(scorp.recommendedFICA)} />
        {scorp.ficaGap > 0 && (
          <div className="flex justify-between items-center py-1.5">
            <span className="text-sm text-amber-700 font-medium">FICA Gap (recommended vs current)</span>
            <span className="text-sm font-bold text-amber-700">+ {formatCurrency(scorp.ficaGap)}</span>
          </div>
        )}
      </div>

      {scorp.adjustedSalary > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-200">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Payroll Adjustment</h4>
          <div className="divide-y divide-slate-100">
            <Row label="Adjusted Salary" value={formatCurrency(scorp.adjustedSalary)} />
            <Row label="FICA at Adjusted Salary" value={formatCurrency(scorp.adjustedFICA)} />
            <div className="flex justify-between items-center py-1.5">
              <span className="text-sm text-blue-700 font-medium">Additional FICA (added to tax total)</span>
              <span className="text-sm font-bold text-blue-700">+ {formatCurrency(scorp.additionalFICA)}</span>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400 mt-3">
        The 40% threshold is a common practice guideline, not an IRS-mandated formula. Reasonable compensation
        is based on market rates for the services performed. Use the "Adjusted Salary" field in Step 3 to model
        the FICA impact of a salary change.
      </p>
    </Card>
  )
}
