import type { TaxInput, TaxOutput } from '@/types'
import { Card, SectionHeader } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils'

interface Props { input: TaxInput; output: TaxOutput }

function Row({ label, value, muted, indent }: { label: string; value: string; muted?: boolean; indent?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-1.5 ${indent ? 'pl-3' : ''}`}>
      <span className={`text-sm ${muted ? 'text-slate-400' : 'text-slate-600'}`}>{label}</span>
      <span className={`text-sm font-medium ${muted ? 'text-slate-400' : 'text-slate-900'}`}>{value}</span>
    </div>
  )
}

export function FederalBreakdown({ input, output }: Props) {
  const { federal, scorp } = output
  const isScorp = input.companyType === 'S-Corp'
  const label = `${input.quarter} ${input.taxYear} (${output.quarterProration * 100}% proration)`

  return (
    <Card>
      <SectionHeader title="Federal Tax Breakdown" subtitle={label} />
      <div className="divide-y divide-slate-100">
        <Row label="Gross Federal Income Tax" value={formatCurrency(federal.grossIncomeTax)} />
        {federal.childTaxCredit > 0 && (
          <Row label="Child Tax Credit" value={`− ${formatCurrency(federal.childTaxCredit)}`} />
        )}
        <Row label="Net Federal Income Tax" value={formatCurrency(federal.netIncomeTax)} />

        {isScorp ? (
          <>
            <Row label="FICA — Employer Portion (est.)" value={formatCurrency(federal.ficaAlreadyPaid / 2)} indent />
            <Row label="FICA — Employee Portion (est.)" value={formatCurrency(federal.ficaAlreadyPaid / 2)} indent />
            <Row label="FICA Already Paid via Payroll" value={`− ${formatCurrency(federal.ficaAlreadyPaid)}`} />
            {scorp && scorp.additionalFICA > 0 && (
              <Row
                label={`Additional FICA (salary adj. to ${formatCurrency(scorp.adjustedSalary)})`}
                value={`+ ${formatCurrency(scorp.additionalFICA)}`}
              />
            )}
            {input.federalWithholding > 0 && (
              <Row label="Federal Income Tax Withheld" value={`− ${formatCurrency(input.federalWithholding)}`} />
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

        <div className="flex justify-between items-center py-2 mt-1">
          <span className="text-sm font-semibold text-slate-800">Federal Total</span>
          <span className="text-sm font-bold text-slate-900">{formatCurrency(federal.totalFederalBeforeProration)}</span>
        </div>
        <div className="flex justify-between items-center py-1.5 bg-orange-50 -mx-1 px-1 rounded">
          <span className="text-sm font-semibold text-orange-800">Federal Owed for {input.quarter}</span>
          <span className="text-sm font-bold text-orange-900">{formatCurrency(output.totalFederalOwed)}</span>
        </div>
      </div>
    </Card>
  )
}
