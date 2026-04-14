import type { TaxInput, TaxOutput } from '@/types'
import { formatCurrency } from '@/lib/utils'

interface Props { input: TaxInput; output: TaxOutput }

function Row({ label, value, muted, indent }: { label: string; value: string; muted?: boolean; indent?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-2 ${indent ? 'pl-4' : ''}`}>
      <span className={`text-sm ${muted ? 'text-slate-400' : 'text-slate-600'}`}>{label}</span>
      <span className={`text-sm font-medium tabular-nums ${muted ? 'text-slate-400' : 'text-slate-900'}`}>{value}</span>
    </div>
  )
}

export function FederalBreakdown({ input, output }: Props) {
  const { federal, scorp } = output
  const isScorp = input.companyType === 'S-Corp'

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-3">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
          Federal Tax Breakdown
        </h3>
      </div>

      {/* Income Tax */}
      <div className="px-6 pb-1">
        <Row label="Gross Federal Income Tax" value={formatCurrency(federal.grossIncomeTax)} />
        {federal.childTaxCredit > 0 && (
          <Row label="Child Tax Credit" value={`− ${formatCurrency(federal.childTaxCredit)}`} />
        )}
        <Row label="Net Federal Income Tax" value={formatCurrency(federal.netIncomeTax)} />
      </div>

      {/* SE Tax or FICA */}
      <div className="px-6 pb-2">
        <div className="border-t border-slate-100 pt-2">
          {isScorp ? (
            <>
              <Row label="FICA Paid via Payroll" value={`− ${formatCurrency(federal.ficaAlreadyPaid)}`} />
              <Row label="Employer Portion" value={formatCurrency(federal.ficaAlreadyPaid / 2)} indent muted />
              <Row label="Employee Portion" value={formatCurrency(federal.ficaAlreadyPaid / 2)} indent muted />
              {scorp && scorp.additionalFICA > 0 && (
                <Row
                  label="Additional FICA (salary adjustment)"
                  value={`+ ${formatCurrency(scorp.additionalFICA)}`}
                />
              )}
              {input.federalWithholding > 0 && (
                <Row label="Federal Withholding" value={`− ${formatCurrency(input.federalWithholding)}`} />
              )}
            </>
          ) : (
            <>
              <Row label="Self-Employment Tax" value={formatCurrency(federal.seTax)} />
              <Row label="Social Security (12.4%)" value={formatCurrency(federal.seSocialSecurity)} indent muted />
              <Row label="Medicare (2.9%)" value={formatCurrency(federal.seMedicare)} indent muted />
              {federal.seAdditionalMedicare > 0 && (
                <Row label="Additional Medicare (0.9%)" value={formatCurrency(federal.seAdditionalMedicare)} indent muted />
              )}
            </>
          )}
        </div>
      </div>

      {/* Federal Owed — highlighted */}
      <div className="mx-4 mb-4 bg-orange-50 border border-orange-100 rounded-xl px-5 py-3 flex justify-between items-center">
        <span className="text-sm font-semibold text-orange-800">Federal Owed for {input.quarter}</span>
        <span className="text-lg font-bold text-orange-900 tabular-nums">{formatCurrency(output.totalFederalOwed)}</span>
      </div>
    </div>
  )
}
