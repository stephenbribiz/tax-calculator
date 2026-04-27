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
        {/* Multi-business per-company table */}
        {input.businessBreakdown && input.businessBreakdown.length > 1 && (
          <div className="mb-3">
            <div className="rounded-lg border border-slate-100 overflow-hidden text-xs">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wide">
                    <th className="text-left px-3 py-1.5">Company</th>
                    <th className="text-right px-3 py-1.5">Net Income</th>
                    {input.businessBreakdown.some(r => r.companyType === 'S-Corp') && (
                      <th className="text-right px-3 py-1.5">Salary</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {input.businessBreakdown.map(row => (
                    <tr key={row.businessId}>
                      <td className="px-3 py-1.5 text-slate-700">
                        {row.companyName}
                        <span className="ml-1 text-slate-400">{row.companyType}</span>
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-800">
                        {formatCurrency(row.netIncome)}
                      </td>
                      {input.businessBreakdown!.some(r => r.companyType === 'S-Corp') && (
                        <td className="px-3 py-1.5 text-right tabular-nums text-slate-800">
                          {row.companyType === 'S-Corp' && row.shareholderSalary > 0
                            ? formatCurrency(row.shareholderSalary)
                            : <span className="text-slate-300">—</span>
                          }
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {input.companyType === 'S-Corp' && input.shareholderSalary > 0 ? (
          // S-Corp breakdown: K-1 income + shareholder salary = effective income
          <>
            <Row
              label={input.ownershipPct < 100 ? `K-1 Income (${input.ownershipPct}% share)` : 'K-1 Pass-Through Income'}
              value={formatCurrency(output.allocatedBusinessIncome)}
            />
            <Row
              label="+ Shareholder Salary (W-2)"
              value={formatCurrency(input.shareholderSalary)}
            />
            <div className="flex justify-between items-center py-2 border-t border-slate-100 mt-0.5">
              <span className="text-sm font-semibold text-slate-700">Effective S-Corp Income</span>
              <span className="text-sm font-semibold text-slate-900 tabular-nums">
                {formatCurrency(Math.max(0, output.allocatedBusinessIncome + input.shareholderSalary))}
              </span>
            </div>
          </>
        ) : (
          <>
            <Row label="Business Net Income" value={formatCurrency(input.businessNetIncome)} />
            {input.ownershipPct < 100 && (
              <Row
                label={`Allocated to Owner (${input.ownershipPct}%)`}
                value={formatCurrency(output.allocatedBusinessIncome)}
              />
            )}
          </>
        )}

        {/* Adjustments — show only what applies */}
        {output.mealAddBack > 0 && (
          <Row label="Meal Add-Back (50%)" value={`+ ${formatCurrency(output.mealAddBack)}`} />
        )}
        {output.seTaxDeduction > 0 && (
          <Row label="SE Tax Deduction" value={`− ${formatCurrency(output.seTaxDeduction)}`} />
        )}
        {output.allocatedBusinessIncome > 0 && (
          output.qbiDeduction > 0
            ? <Row label="QBI Deduction (20%)" value={`− ${formatCurrency(output.qbiDeduction)}`} />
            : (
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-slate-600">QBI Deduction (20%)</span>
                <div className="text-right">
                  <span className="text-sm font-medium text-slate-400 tabular-nums">$0</span>
                  <span className="ml-2 text-[10px] text-slate-400 italic">phased out</span>
                </div>
              </div>
            )
        )}
        <Row
          label={input.deductionOverride !== null ? 'Itemized Deduction' : 'Standard Deduction'}
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
