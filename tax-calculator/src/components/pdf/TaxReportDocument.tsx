import { Document, Page, Text, View } from '@react-pdf/renderer'
import type { TaxInput, TaxOutput } from '@/types'
import { formatCurrency, formatPercent, formatDate } from '@/lib/utils'
import { pdfStyles as s } from './pdfStyles'

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <View style={s.row}>
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

  return (
    <Document title={`Tax Estimate — ${input.ownerName} ${input.quarter} ${input.taxYear}`}>
      <Page size="LETTER" style={s.page}>

        {/* Header */}
        <View style={s.headerRow}>
          <View style={s.headerLeft}>
            <Text style={s.reportTitle}>Quarterly Tax Estimate</Text>
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

        {/* Income Summary */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Income Summary</Text>
          <Row label="Business Net Income" value={formatCurrency(input.businessNetIncome)} />
          {input.annualizeIncome && (
            <Row label="Annualized Business Income" value={formatCurrency(output.annualizedBusinessIncome)} />
          )}
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
            label={`Deduction (${output.effectiveDeduction !== output.standardDeduction ? 'Itemized' : 'Standard'})`}
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
        </View>

        {/* Federal Tax Breakdown */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Federal Tax Breakdown</Text>
          <Row label="Gross Federal Income Tax" value={formatCurrency(federal.grossIncomeTax)} />
          {federal.childTaxCredit > 0 && (
            <Row label="Child Tax Credit" value={`− ${formatCurrency(federal.childTaxCredit)}`} />
          )}
          <Row label="Net Federal Income Tax" value={formatCurrency(federal.netIncomeTax)} />
          {isScorp ? (
            <Row label="FICA Paid via Payroll (est.)" value={`− ${formatCurrency(federal.ficaAlreadyPaid)}`} />
          ) : (
            <>
              <Row label="Self-Employment Tax" value={formatCurrency(federal.seTax)} />
              <Row label="    Social Security (12.4%)" value={formatCurrency(federal.seSocialSecurity)} muted />
              <Row label="    Medicare (2.9%)" value={formatCurrency(federal.seMedicare)} muted />
              {federal.seAdditionalMedicare > 0 && (
                <Row label="    Additional Medicare (0.9%)" value={formatCurrency(federal.seAdditionalMedicare)} muted />
              )}
            </>
          )}
          <View style={s.subtotalRow}>
            <Text style={s.subtotalLabel}>Federal Total (before proration)</Text>
            <Text style={s.subtotalValue}>{formatCurrency(federal.totalFederalBeforeProration)}</Text>
          </View>
          <View style={s.subtotalRow}>
            <Text style={s.subtotalLabel}>Federal Owed for {input.quarter}</Text>
            <Text style={s.subtotalValue}>{formatCurrency(output.totalFederalOwed)}</Text>
          </View>
        </View>

        {/* S-Corp Salary Analysis */}
        {isScorp && scorp && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>S-Corp Shareholder Salary Analysis</Text>
            {scorp.warningMessage && (
              <View style={s.warningBox}>
                <Text style={s.warningText}>⚠ {scorp.warningMessage}</Text>
              </View>
            )}
            <Row label="Current Shareholder Salary" value={formatCurrency(scorp.currentSalary)} />
            <Row label="Recommended Minimum Salary (40% guideline)" value={formatCurrency(scorp.recommendedMinSalary)} />
            <Row label="FICA on Current Salary (employer + employee)" value={formatCurrency(scorp.currentFICA)} />
            <Row label="FICA at Recommended Salary" value={formatCurrency(scorp.recommendedFICA)} />
            {scorp.ficaGap > 0 && (
              <Row label="Additional FICA if Salary Adjusted" value={`+ ${formatCurrency(scorp.ficaGap)}`} />
            )}
            <Text style={s.noteText}>
              The 40% threshold is a common practice guideline. Reasonable compensation is determined
              by market rates for services performed.
            </Text>
          </View>
        )}

        {/* State Tax */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{state.stateName} State Tax</Text>
          {state.stateIncomeTax > 0 ? (
            <>
              <Row label="State Deduction" value={`− ${formatCurrency(state.stateDeduction)}`} />
              <Row label="Effective State Rate" value={formatPercent(state.effectiveStateRate)} />
              <Row label="State Income Tax (before proration)" value={formatCurrency(state.stateIncomeTax)} />
              <View style={s.subtotalRow}>
                <Text style={s.subtotalLabel}>State Owed for {input.quarter}</Text>
                <Text style={s.subtotalValue}>{formatCurrency(output.totalStateOwed)}</Text>
              </View>
            </>
          ) : (
            <Row label={`No individual income tax in ${state.stateName}`} value="$0" muted />
          )}
          {state.notes.map((note, i) => (
            <Text key={i} style={s.noteText}>• {note}</Text>
          ))}
        </View>

        {/* Total Summary */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Total Estimate — {input.quarter} {input.taxYear}</Text>
          <Row label={`Federal Tax (${input.quarter})`} value={formatCurrency(output.totalFederalOwed)} />
          <Row label={`State Tax — ${state.stateName} (${input.quarter})`} value={formatCurrency(output.totalStateOwed)} />
          <Row label="Total Estimated Tax Owed" value={formatCurrency(output.totalTaxOwed)} />
          {input.priorEstimatesPaid > 0 && (
            <Row label="Prior Estimated Payments This Year" value={`− ${formatCurrency(output.priorEstimatesPaid)}`} />
          )}
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Net Amount Due for {input.quarter}</Text>
            <Text style={s.totalValue}>{formatCurrency(output.netAmountDue)}</Text>
          </View>
        </View>

        {/* Shareholder draw — informational */}
        {input.shareholderDraw > 0 && (
          <View style={s.section}>
            <Row
              label="Shareholder Draw (expensed — not deductible)"
              value={formatCurrency(input.shareholderDraw)}
              muted
            />
          </View>
        )}

        {/* Disclaimer */}
        <View style={s.disclaimer}>
          <Text style={s.disclaimerText}>
            DISCLAIMER: This estimate is prepared for planning purposes only and does not constitute tax advice.
            Tax calculations are estimates based on information provided and may not reflect all applicable
            deductions, credits, or tax law changes. Actual tax liability may vary. This report should not
            be used as a substitute for professional tax advice. Consult a licensed tax professional before
            filing any tax return or making tax-related decisions.
          </Text>
        </View>

      </Page>
    </Document>
  )
}
