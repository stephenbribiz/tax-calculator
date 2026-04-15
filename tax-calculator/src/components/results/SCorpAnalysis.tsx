import { useState, useEffect, useCallback } from 'react'
import type { SCorpAnalysis as SCorpAnalysisType } from '@/types'
import { calculateFICA } from '@/tax-engine/federal/fica'
import { CurrencyInput } from '@/components/ui/CurrencyInput'
import { formatCurrency } from '@/lib/utils'

interface PayrollAdjState {
  adjustedSalary: number       // full YTD target (0 when unconfirmed)
  payrollAdjConfirmed: boolean
  shareholderSalary: number    // current YTD salary paid so far
}

interface Props {
  scorp: SCorpAnalysisType
  taxYear: number
  payrollAdjState?: PayrollAdjState
  onPayrollAdj?: (adjustedSalary: number, confirmed: boolean) => void
}

function Row({ label, value, accent, indent }: {
  label: string
  value: string
  accent?: 'green' | 'orange' | 'amber'
  indent?: boolean
}) {
  const colorMap = {
    green:  { label: 'text-emerald-700', value: 'text-emerald-700' },
    orange: { label: 'text-orange-700',  value: 'text-orange-700'  },
    amber:  { label: 'text-amber-700',   value: 'text-amber-700'   },
  }
  const colors = accent ? colorMap[accent] : { label: 'text-slate-600', value: 'text-slate-900' }

  return (
    <div className={`flex justify-between items-center py-2 ${indent ? 'pl-4' : ''}`}>
      <span className={`text-sm ${colors.label}`}>{label}</span>
      <span className={`text-sm font-medium tabular-nums ${colors.value}`}>{value}</span>
    </div>
  )
}

export function SCorpAnalysis({ scorp, taxYear, payrollAdjState, onPayrollAdj }: Props) {
  const isEditable = !!onPayrollAdj
  const isConfirmed = payrollAdjState?.payrollAdjConfirmed ?? false
  const currentSalary = payrollAdjState?.shareholderSalary ?? scorp.currentSalary

  // The quarterly *additional* amount the user is targeting.
  // Derived from payrollAdjState when available, otherwise seed from the FICA gap recommendation.
  const computeInitial = useCallback(() => {
    if (payrollAdjState?.adjustedSalary && payrollAdjState.adjustedSalary > currentSalary) {
      return payrollAdjState.adjustedSalary - currentSalary
    }
    return Math.max(0, scorp.recommendedMinSalary - currentSalary)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [quarterlyAdditional, setQuarterlyAdditional] = useState(computeInitial)

  // When user clicks "Edit" to unconfirm, restore from the stored draft value.
  useEffect(() => {
    if (!isConfirmed && payrollAdjState?.adjustedSalary && payrollAdjState.adjustedSalary > currentSalary) {
      setQuarterlyAdditional(payrollAdjState.adjustedSalary - currentSalary)
    }
  }, [isConfirmed]) // eslint-disable-line react-hooks/exhaustive-deps

  // Preview FICA — computed locally so we can show it before confirmation
  const previewYTD = currentSalary + quarterlyAdditional
  const previewAdditionalFICA = quarterlyAdditional > 0
    ? Math.max(0, calculateFICA(previewYTD, taxYear).totalFICA - calculateFICA(currentSalary, taxYear).totalFICA)
    : 0

  const handleAmountChange = (val: number) => {
    const clamped = Math.max(0, val)
    setQuarterlyAdditional(clamped)
    // Keep parent in sync with the draft YTD value (unconfirmed)
    onPayrollAdj?.(currentSalary + clamped, false)
  }

  const handleConfirm = () => {
    onPayrollAdj?.(currentSalary + quarterlyAdditional, true)
  }

  const handleEdit = () => {
    onPayrollAdj?.(0, false)
  }

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

      {/* ── Payroll Adjustment section ── */}
      <div className="px-6 pb-4">
        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Payroll Adjustment
          </p>

          {/* ── CONFIRMED STATE ── */}
          {isEditable && isConfirmed && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Adjustment Confirmed</p>
                    <p className="text-xs text-emerald-700 mt-0.5">Included in your tax total below</p>
                  </div>
                </div>
                <button
                  onClick={handleEdit}
                  className="text-xs text-emerald-700 hover:text-emerald-900 font-medium underline shrink-0"
                >
                  Edit
                </button>
              </div>
              <div className="mt-3 pt-3 border-t border-emerald-200 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-700">Additional payroll this quarter</span>
                  <span className="font-semibold text-emerald-900 tabular-nums">
                    {formatCurrency(scorp.adjustedSalary - scorp.currentSalary)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-700">Additional FICA owed</span>
                  <span className="font-semibold text-emerald-900 tabular-nums">
                    + {formatCurrency(scorp.additionalFICA)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-700">New YTD salary</span>
                  <span className="font-medium text-emerald-800 tabular-nums">
                    {formatCurrency(scorp.adjustedSalary)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── EDITABLE / PREVIEW STATE ── */}
          {isEditable && !isConfirmed && (
            <>
              <CurrencyInput
                label="Additional Payroll This Quarter"
                hint={`Recommended: ${formatCurrency(Math.max(0, scorp.recommendedMinSalary - scorp.currentSalary))} · New YTD: ${formatCurrency(previewYTD)}`}
                value={quarterlyAdditional}
                onChange={handleAmountChange}
              />

              {quarterlyAdditional > 0 && (
                <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">New YTD salary</span>
                    <span className="font-medium text-slate-900 tabular-nums">{formatCurrency(previewYTD)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Additional FICA</span>
                    <span className="font-semibold text-orange-700 tabular-nums">+ {formatCurrency(previewAdditionalFICA)}</span>
                  </div>
                  <p className="text-xs text-slate-400 pt-1 border-t border-slate-200 mt-1">
                    Not yet included in your tax total — confirm to add.
                  </p>
                </div>
              )}

              <button
                onClick={handleConfirm}
                disabled={quarterlyAdditional <= 0}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Confirm Adjustment
              </button>
            </>
          )}

          {/* ── READ-ONLY STATE (ReportView, no onPayrollAdj) ── */}
          {!isEditable && scorp.adjustedSalary > 0 && (
            <>
              <Row label="Adjusted Salary (YTD)" value={formatCurrency(scorp.adjustedSalary)} />
              <Row
                label="Additional FICA"
                value={`+ ${formatCurrency(scorp.additionalFICA)}`}
                accent="orange"
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
