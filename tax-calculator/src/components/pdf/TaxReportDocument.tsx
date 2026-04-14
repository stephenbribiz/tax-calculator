import { Document, Page, Text, View } from '@react-pdf/renderer'
import type { TaxInput, TaxOutput } from '@/types'
import { formatCurrency, formatPercent, formatDate } from '@/lib/utils'
import { pdfStyles as s } from './pdfStyles'

function Row({ label, value, muted, indent }: { label: string; value: string; muted?: boolean; indent?: boolean }) {
  return (
    <View style={[s.row, indent ? { paddingLeft: 12 } : {}]}>
      <Text style={muted ? s.rowLabelMuted : s.rowLabel}>{label}</Text>
      <Text style={muted ? s.rowValueMuted : s.rowValue}>{value}</Text>
    </View>
  )
}

interface Props {
  input: TaxInput
  output: TaxOutput
}

export function TaxReportDocument({ input, output }: Props) {
  const { federal, state, scorp } = output
  const isScorp = input.companyType === 'S-Corp'
  const periodLabel = `${input.quarter} ${input.taxYear} (${output.quarterProration * 100}% of year)`
  const annualizedNote = output.annualizedBusinessIncome
    ? `Rate based on annualized income of ${formatCurrency(output.annualizedBusinessIncome)}`
    : undefined
  const isOverpaid = output.netAmountDue === 0 && input.priorEstimatesPaid > output.totalTaxOwed

  return (
    <Document title={`Tax Plan — ${input.ownerName} ${input.quarter} ${input.taxYear}`}>
      <Page size="LETTER" style={s.page}>

        {/* Header */}
        <View style={s.headerRow}>
          <View style={s.headerLeft}>
            <Text style={s.reportTitle}>Quarterly Tax Plan</Text>
            <Text style={s.reportSubtitle}>{periodLabel}</Text>
            <Text style={s.reportSubtitle}>Completed: {formatDate(input.dateCompleted)}</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.clientName}>{input.ownerName}</Text>
            <Text style={s.clientDetail}>{input.companyName}</Text>
            <Text style={s.clientDetail}>{input.companyType}</Text>
            <Text style={s.clientDetail}>{input.filingStatus} · {state.stateName}</Text>
          </View>
        </View>

        {/* ── Total Estimate (top — matches screen) ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Total Estimate — {input.quarter} {input.taxYear}</Text>
          <Row label={`Federal Tax (${input.quarter})`} value={formatCurrency(output.totalFederalOwed)} />
          <Row label={`State Tax — ${state.stateName} (${input.quarter})`} value={formatCurrency(output.totalStateOwed)} />
          <View style={s.subtotalRow}>
            <Text style={s.subtotalLabel}>Total Estimated Tax Owed</Text>
            <Text style={s.subtotalValue}>{formatCurrency(output.totalTaxOwed)}</Text>
          </View>
          {input.priorEstimatesPaid > 0 && (
            <Row label="Prior Estimated Payments" value={`− ${formatCurrency(output.priorEstimatesPaid)}`} muted />
          )}
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>
              {isOverpaid ? 'Overpaid (applied to next quarter)' : `Net Amount Due for ${input.quarter}`}
            </Text>
            <Text style={s.totalValue}>
              {isOverpaid
                ? `− ${formatCurrency(input.priorEstimatesPaid - output.totalTaxOwed)}`
                : formatCurrency(output.netAmountDue)}
            </Text>
          </View>
        </View>

        {/* ── Income Summary ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Income Summary</Text>
          <Row label="Business Net Income" value={formatCurrency(input.businessNetIncome)} />
          <Row label={`Allocated to Owner (${input.ownershipPct}%)`} value={formatCurrency(output.allocatedBusinessIncome)} />
          {output.mealAddBack > 0 && (
            <Row label="Meal Add-Back (50% non-deductible)" value={`+ ${formatCurrency(output.mealAddBack)}`} />
          )}
          {output.seTaxDeduction > 0 && (
            <Row label="SE Tax Deduction" value={`− ${formatCurrency(output.seTaxDeduction)}`} />
          )}
          {output.qbiDeduction > 0 && (
            <Row label="QBI Deduction (20%)" value={`− ${formatCurrency(output.qbiDeduction)}`} />
          )}
          <Row
            label={`Deduction Applied (${output.effectiveDeduction !== output.standardDeduction ? 'Itemized' : 'Standard'}, prorated for ${input.quarter})`}
            value={`− ${formatCurrency(output.effectiveDeduction)}`}
          />
          {(input.otherIncome > 0 || input.spousalIncome > 0) && (
            <Row
              label="Other / Spousal Income (bracket placement only)"
              value={formatCurrency(input.otherIncome + input.spousalIncome)}
              muted
            />
          )}
          <View style={s.subtotalRow}>
            <Text style={s.subtotalLabel}>Federal Taxable Income</Text>
            <Text style={s.subtotalValue}>{formatCurrency(output.taxableIncome)}</Text>
          </View>
          <Row label="Marginal Tax Rate" value={formatPercent(federal.marginalRate)} />
          <Row label="Effective Federal Rate" value={formatPercent(federal.effectiveFederalRate)} />
          {annualizedNote && <Text style={s.noteText}>{annualizedNote}</Text>}
        </View>

        {/* ── Federal Tax Breakdown ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Federal Tax Breakdown</Text>
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

          <View style={s.subtotalRow}>
            <Text style={s.subtotalLabel}>Federal Owed for {input.quarter}</Text>
            <Text style={s.subtotalValue}>{formatCurrency(output.totalFederalOwed)}</Text>
          </View>
        </View>

        {/* ── S-Corp Salary Analysis ── */}
        {isScorp && scorp && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>S-Corp Salary Analysis</Text>
            {scorp.warningMessage && (
              <View style={s.warningBox}>
                <Text style={s.warningText}>⚠ {scorp.warningMessage}</Text>
              </View>
            )}
            <Row label="Current Shareholder Salary (YTD)" value={formatCurrency(scorp.currentSalary)} />
            <Row label="Recommended Minimum Salary (40%)" value={formatCurrency(scorp.recommendedMinSalary)} />
            <Row label="FICA on Current Salary (employer + employee)" value={formatCurrency(scorp.currentFICA)} />
            <Row label="FICA at Recommended Salary" value={formatCurrency(scorp.recommendedFICA)} />
            {scorp.ficaGap > 0 && (
              <Row label="FICA Gap (recommended vs current)" value={`+ ${formatCurrency(scorp.ficaGap)}`} />
            )}
            {scorp.adjustedSalary > 0 && (
              <>
                <Row label="FICA at Adjusted Salary" value={formatCurrency(scorp.adjustedFICA)} />
                <Row
                  label={scorp.additionalFICA < 0 ? 'FICA Refund' : 'Additional FICA'}
                  value={scorp.additionalFICA < 0
                    ? `− ${formatCurrency(Math.abs(scorp.additionalFICA))}`
                    : `+ ${formatCurrency(scorp.additionalFICA)}`}
                />
              </>
            )}
          </View>
        )}

        {/* ── State Tax ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{state.stateName} State Tax</Text>
          {state.stateIncomeTax > 0 ? (
            <>
              <Row label="State Deduction" value={`− ${formatCurrency(state.stateDeduction)}`} />
              <Row label="Effective State Rate" value={formatPercent(state.effectiveStateRate)} />
              <Row label="State Income Tax (before proration)" value={formatCurrency(state.stateIncomeTax)} />
            </>
          ) : (
            <Row label={`No individual income tax in ${state.stateName}`} value="$0" muted />
          )}
          {(state.exciseTax > 0 || state.franchiseTax > 0) && (
            <>
              <Row label={`${input.companyType} Excise Tax (6.5%)`} value={formatCurrency(state.exciseTax)} />
              <Row label="Franchise Tax (minimum)" value={formatCurrency(state.franchiseTax)} />
              <Row label="Annual F&E Total" value={formatCurrency(state.exciseTax + state.franchiseTax)} />
              {(input.priorFEPaid ?? 0) > 0 && (
                <Row label="Prior F&E Payments" value={`− ${formatCurrency(input.priorFEPaid ?? 0)}`} />
              )}
              <Row
                label="F&E Owed"
                value={formatCurrency(Math.max(0, state.exciseTax + state.franchiseTax - (input.priorFEPaid ?? 0)))}
              />
            </>
          )}
          <View style={s.subtotalRow}>
            <Text style={s.subtotalLabel}>State Owed for {input.quarter}</Text>
            <Text style={s.subtotalValue}>{formatCurrency(output.totalStateOwed)}</Text>
          </View>
          {state.notes.map((note, i) => (
            <Text key={i} style={s.noteText}>• {note}</Text>
          ))}
        </View>

        {/* Disclaimer */}
        <View style={s.disclaimer}>
          <Text style={s.disclaimerText}>
            DISCLAIMER: This estimate is prepared for planning purposes only and does not constitute tax advice.
            Tax calculations are estimates based on information provided and may not reflect all applicable
            deductions, credits, or tax law changes. Consult a licensed tax professional before filing.
          </Text>
        </View>

      </Page>
    </Document>
  )
}
