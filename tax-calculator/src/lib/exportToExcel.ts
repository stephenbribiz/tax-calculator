/**
 * Excel export for quarterly tax plans.
 * Every calculation cell contains a live Excel formula so the spreadsheet
 * remains fully functional if inputs are changed.
 *
 * Two sheets:
 *   "Tax Plan"  — inputs + formula-driven calculations, matching the PDF report layout
 *   "TaxData"   — tax brackets, standard deductions, and constants used by formulas
 */
import ExcelJS from 'exceljs'
import type { TaxInput, TaxOutput } from '@/types'
import { getTaxDataByYear } from '@/tax-engine/constants'

/* ─── Colours (ARGB) ──────────────────────────────────────────────────────── */
const C_ORANGE   = 'FFE8842C'
const C_DARK_ORA = 'FFCC6A1B'
const C_CHARCOAL = 'FF4A4A4A'
const C_WHITE    = 'FFFFFFFF'
const C_LT_ORA   = 'FFFFF4E8'  // calc row bg
const C_PALE     = 'FFF8F9FA'  // input row bg
const C_SUBTOTAL = 'FFFDE8CC'  // warm gold for section subtotals
const C_SLATE    = 'FF64748B'  // muted note text
const C_HAIR     = 'FFE2E8F0'

/* ─── Number formats ─────────────────────────────────────────────────────── */
const FMT_CCY  = '"$"#,##0.00'
const FMT_PCT  = '0.00%'
const FMT_INT  = '#,##0'

/* ─── Fill helper ────────────────────────────────────────────────────────── */
type FP = ExcelJS.FillPattern
const fill = (argb: string): FP => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })

/* ─── Row-style appliers ─────────────────────────────────────────────────── */
function styleSection(row: ExcelJS.Row) {
  for (let c = 1; c <= 3; c++) {
    const cell = row.getCell(c)
    cell.fill = fill(C_ORANGE)
    cell.font = { bold: true, size: 10, color: { argb: C_WHITE } }
  }
  row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
  row.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' }
  row.height = 20
}

function styleSubSection(row: ExcelJS.Row) {
  for (let c = 1; c <= 3; c++) {
    const cell = row.getCell(c)
    cell.fill = fill(C_DARK_ORA)
    cell.font = { bold: true, size: 9, color: { argb: C_WHITE } }
  }
  row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle', indent: 2 }
  row.height = 17
}

function styleInput(row: ExcelJS.Row) {
  const lbl = row.getCell(1); const val = row.getCell(2); const note = row.getCell(3)
  lbl.fill = fill(C_PALE); lbl.font = { size: 10, color: { argb: C_CHARCOAL } }
  lbl.alignment = { horizontal: 'left', indent: 2 }
  val.fill = fill(C_WHITE); val.font = { size: 10, color: { argb: C_CHARCOAL } }
  val.alignment = { horizontal: 'right' }
  val.border = { bottom: { style: 'hair', color: { argb: C_HAIR } } }
  note.font = { size: 9, italic: true, color: { argb: C_SLATE } }
}

function styleCalc(row: ExcelJS.Row, bold = false) {
  const lbl = row.getCell(1); const val = row.getCell(2); const note = row.getCell(3)
  lbl.fill = fill(C_LT_ORA); lbl.font = { size: 10, bold, color: { argb: C_CHARCOAL } }
  lbl.alignment = { horizontal: 'left', indent: 2 }
  val.fill = fill(C_LT_ORA); val.font = { size: 10, bold, color: { argb: C_CHARCOAL } }
  val.alignment = { horizontal: 'right' }
  val.border = { bottom: { style: 'hair', color: { argb: 'FFE9D5BE' } } }
  note.fill = fill(C_LT_ORA); note.font = { size: 9, italic: true, color: { argb: C_SLATE } }
}

function styleSubtotal(row: ExcelJS.Row) {
  const lbl = row.getCell(1); const val = row.getCell(2); const note = row.getCell(3)
  for (const c of [lbl, val, note]) c.fill = fill(C_SUBTOTAL)
  lbl.font = { bold: true, size: 10, color: { argb: C_CHARCOAL } }
  lbl.alignment = { horizontal: 'left', indent: 2 }
  val.font = { bold: true, size: 10, color: { argb: C_CHARCOAL } }
  val.alignment = { horizontal: 'right' }
  val.border = { top: { style: 'thin', color: { argb: 'FFC99B6E' } } }
  note.font = { size: 9, italic: true, color: { argb: C_SLATE } }
  row.height = 18
}

function styleTotal(row: ExcelJS.Row) {
  for (let c = 1; c <= 3; c++) {
    const cell = row.getCell(c)
    cell.fill = fill(C_ORANGE); cell.font = { bold: true, size: 11, color: { argb: C_WHITE } }
  }
  row.getCell(1).alignment = { horizontal: 'left', indent: 2 }
  row.getCell(2).alignment = { horizontal: 'right' }
  row.height = 24
}

function styleNetDue(row: ExcelJS.Row) {
  for (let c = 1; c <= 3; c++) {
    const cell = row.getCell(c)
    cell.fill = fill(C_CHARCOAL); cell.font = { bold: true, size: 13, color: { argb: C_WHITE } }
  }
  row.getCell(1).alignment = { horizontal: 'left', indent: 2 }
  row.getCell(2).alignment = { horizontal: 'right' }
  row.height = 30
}

/* ─── Formula value helper ───────────────────────────────────────────────── */
function fv(formula: string, result: number | string): ExcelJS.CellFormulaValue {
  return { formula, result: result as (number | string) }
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAX DATA SHEET
   Fixed cell positions referenced by formulas in the Tax Plan sheet:
     B3  = SS Wage Base
     B4  = SE Rate Factor (0.9235)
     B7:B13 = bracket rates
     C7:C13 = bracket lower bounds
     D7:D13 = bracket upper bounds
     B15 = Standard deduction for this filing status
     B17 = QBI phase-out start
     B18 = QBI phase-out end
     B20 = Child tax credit per child
     B21 = CTC phase-out start
     B22 = CTC phase-out increment
═══════════════════════════════════════════════════════════════════════════ */
function buildTaxDataSheet(ws: ExcelJS.Worksheet, input: TaxInput) {
  const td       = getTaxDataByYear(input.taxYear)
  const brackets = td.brackets[input.filingStatus]
  const qbiKey   = input.filingStatus === 'MFJ' ? 'MFJ' : 'Single'
  const ctcKey   = input.filingStatus === 'MFJ' ? 'MFJ' : 'Single'

  ws.columns = [{ width: 38 }, { width: 16 }, { width: 16 }, { width: 16 }]

  const hdr = ws.getRow(1)
  hdr.getCell(1).value = `Tax Tables — ${input.filingStatus} Filing Status — ${input.taxYear}`
  hdr.getCell(1).font  = { bold: true, size: 11, color: { argb: C_CHARCOAL } }

  // Constants
  ws.getCell('A3').value = 'SS Wage Base'; ws.getCell('B3').value = td.ssWageBase; ws.getCell('B3').numFmt = FMT_CCY
  ws.getCell('A4').value = 'SE Rate Factor (×0.9235)'; ws.getCell('B4').value = 0.9235

  // Bracket header
  for (const [c, v] of [['A6',''], ['B6','Rate'], ['C6','Lower Bound ($)'], ['D6','Upper Bound ($)']] as const) {
    ws.getCell(c).value = v; ws.getCell(c).font = { bold: true }
  }

  // Bracket rows 7–13 (always 7 brackets)
  brackets.forEach((b, i) => {
    const rn   = 7 + i
    const from = i === 0 ? 0 : brackets[i - 1].upTo
    const to   = b.upTo === Infinity ? 9_999_999_999 : b.upTo
    ws.getCell(`A${rn}`).value = `Bracket ${i + 1} (${(b.rate * 100).toFixed(0)}%)`
    ws.getCell(`B${rn}`).value = b.rate;         ws.getCell(`B${rn}`).numFmt = FMT_PCT
    ws.getCell(`C${rn}`).value = from;           ws.getCell(`C${rn}`).numFmt = FMT_CCY
    ws.getCell(`D${rn}`).value = to;             ws.getCell(`D${rn}`).numFmt = FMT_CCY
  })

  // Standard deduction
  ws.getCell('A15').value = `Standard Deduction — ${input.filingStatus}`
  ws.getCell('B15').value = td.standardDeduction[input.filingStatus]
  ws.getCell('B15').numFmt = FMT_CCY

  // QBI phase-out
  ws.getCell('A17').value = 'QBI Phase-Out Start'; ws.getCell('B17').value = td.qbiPhaseOutStart[qbiKey]; ws.getCell('B17').numFmt = FMT_CCY
  ws.getCell('A18').value = 'QBI Phase-Out End';   ws.getCell('B18').value = td.qbiPhaseOutEnd[qbiKey];   ws.getCell('B18').numFmt = FMT_CCY

  // Child tax credit
  ws.getCell('A20').value = 'Child Tax Credit per Child'; ws.getCell('B20').value = td.childTaxCredit.creditPerChild; ws.getCell('B20').numFmt = FMT_CCY
  ws.getCell('A21').value = `CTC Phase-Out Start — ${input.filingStatus}`; ws.getCell('B21').value = td.childTaxCredit.phaseOutStart[ctcKey]; ws.getCell('B21').numFmt = FMT_CCY
  ws.getCell('A22').value = 'CTC Reduction per $1,000 over threshold'; ws.getCell('B22').value = td.childTaxCredit.phaseOutIncrement
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAX PLAN SHEET
   Row numbers tracked in R{} so all formulas reference live cells.
═══════════════════════════════════════════════════════════════════════════ */
function buildTaxPlanSheet(ws: ExcelJS.Worksheet, input: TaxInput, output: TaxOutput) {
  ws.columns = [{ width: 40 }, { width: 18 }, { width: 42 }]

  const isSCorp      = input.companyType === 'S-Corp'
  const isPassThru   = !isSCorp
  const td           = getTaxDataByYear(input.taxYear)
  const TT           = 'TaxData'  // sheet name (no spaces = no quotes needed)

  // Row number registry
  let r = 1
  const R: Record<string, number> = {}

  function addRow(
    label: string | null,
    key: string | null,
    val: ExcelJS.CellValue | null,
    note: string | null,
    styleFn: ((r: ExcelJS.Row) => void) | null,
    numFmt?: string,
    bold?: boolean,
  ) {
    if (key) R[key] = r
    const row = ws.getRow(r++)
    if (!styleFn) { row.commit(); return }   // blank row
    if (label)  row.getCell(1).value = label
    if (val !== null) row.getCell(2).value = val
    if (note)   row.getCell(3).value = note
    if (numFmt && val !== null) row.getCell(2).numFmt = numFmt
    styleFn(row)
    if (bold) {
      row.getCell(1).font = { ...row.getCell(1).font, bold: true }
      row.getCell(2).font = { ...row.getCell(2).font, bold: true }
    }
    row.commit()
  }

  const blank       = () => addRow(null, null, null, null, null)
  const sec         = (lbl: string) => addRow(lbl, null, null, null, styleSection)
  const sub         = (lbl: string) => addRow(lbl, null, null, null, styleSubSection)
  const inp         = (lbl: string, key: string, val: ExcelJS.CellValue, note = '', fmt?: string) => addRow(lbl, key, val, note, styleInput, fmt)
  const calc        = (lbl: string, key: string, val: ExcelJS.CellValue, note = '', fmt?: string, bold?: boolean) => addRow(lbl, key, val, note, styleCalc, fmt, bold)
  const subtot      = (lbl: string, key: string, val: ExcelJS.CellValue, note = '', fmt?: string) => addRow(lbl, key, val, note, styleSubtotal, fmt)
  const tot         = (lbl: string, key: string, val: ExcelJS.CellValue, fmt?: string) => addRow(lbl, key, val, null, styleTotal, fmt)
  const netdue      = (lbl: string, key: string, val: ExcelJS.CellValue) => addRow(lbl, key, val, null, styleNetDue, FMT_CCY)

  /* ── Title ── */
  {
    const row = ws.getRow(r++)
    ws.mergeCells(`A${r - 1}:C${r - 1}`)
    row.getCell(1).value = `Quarterly Tax Estimate — ${input.ownerName} — ${input.quarter} ${input.taxYear}`
    row.getCell(1).font  = { bold: true, size: 14, color: { argb: C_CHARCOAL } }
    row.getCell(1).fill  = fill('FFF5E6D3')
    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle', indent: 2 }
    row.height = 30
    row.commit()
  }
  blank()

  /* ── CLIENT INFORMATION ── */
  sec('CLIENT INFORMATION')
  inp('Owner Name',     'ownerName',     input.ownerName,           '', '@')
  inp('Company',        'companyName',   input.companyName,          '', '@')
  inp('Entity Type',    'companyType',   input.companyType,          '', '@')
  inp('Filing Status',  'filingStatus',  input.filingStatus,         '', '@')
  inp('State',          'state',         input.state,                '', '@')
  inp('Tax Year',       'taxYear',       input.taxYear,              '', FMT_INT)
  inp('Quarter',        'quarter',       input.quarter,              '', '@')
  inp('Date Prepared',  'dateCompleted', input.dateCompleted,        '', '@')
  blank()

  /* ── INPUTS ── */
  sec('INPUTS')
  inp('Business Net Income',         'businessNetIncome',   input.businessNetIncome,                                     'Total P&L net income before owner allocation',       FMT_CCY)
  inp('Ownership %',                 'ownershipPct',        input.ownershipPct / 100,                                    'Owner\'s share of the business',                     FMT_PCT)
  inp('Shareholder Salary (W-2)',     'shareholderSalary',  input.shareholderSalary,                                     isSCorp ? 'S-Corp W-2 salary only' : 'N/A — pass-through entity', FMT_CCY)
  inp('Federal Income Tax Withheld', 'federalWithholding', input.federalWithholding,                                    isSCorp ? 'Withheld from S-Corp payroll' : 'N/A',      FMT_CCY)
  inp('Meal Expense (Total)',         'mealExpense',        input.mealExpense,                                           '50% non-deductible; add-back computed below',        FMT_CCY)
  inp('Other Income',                'otherIncome',        input.otherIncome,                                            'Non-business income (W-2, interest, etc.)',          FMT_CCY)
  inp('Spousal Income',              'spousalIncome',      input.spousalIncome,                                          'For bracket placement only; not in business estimate', FMT_CCY)
  inp('Dependent Children',          'numDependents',      input.numDependentChildren,                                   'For Child Tax Credit calculation',                   FMT_INT)
  inp('Prior Estimated Payments',    'priorEstimatesPaid', input.priorEstimatesPaid,                                     'Federal + state estimated payments made this year',  FMT_CCY)
  inp('Prior F&E Paid (TN)',         'priorFEPaid',        input.priorFEPaid,                                            'TN Franchise & Excise pre-payments this year',       FMT_CCY)
  inp('Deduction Override',          'deductionOverride',  input.deductionOverride ?? 'Standard',                        '"Standard" uses the standard deduction from TaxData', FMT_CCY)
  inp('Annualize Income',            'annualizeIncome',    input.annualizeIncome ? 'Yes' : 'No',                         'Annualize for Q1-Q3 to improve bracket accuracy',    '@')
  blank()

  /* ── INCOME CALCULATIONS ── */
  sec('INCOME CALCULATIONS')

  calc('Quarter Proration', 'quarterProration',
    fv(`=IF(B${R.quarter}="Q1",0.25,IF(B${R.quarter}="Q2",0.5,IF(B${R.quarter}="Q3",0.75,1)))`, output.quarterProration),
    'Q1=25%  Q2=50%  Q3=75%  Q4=100%', FMT_PCT)

  calc('Allocated Business Income', 'allocatedIncome',
    fv(`=B${R.businessNetIncome}*B${R.ownershipPct}`, output.allocatedBusinessIncome),
    '= Net Income × Ownership %', FMT_CCY)

  calc('Meal Add-Back (50% non-deductible)', 'mealAddBack',
    fv(`=B${R.mealExpense}*0.5`, output.mealAddBack),
    '50% of meals added back to income', FMT_CCY)

  blank()

  /* ── SE TAX or FICA (entity-specific) ── */
  if (isPassThru) {
    sub('SELF-EMPLOYMENT TAX')
    calc('SE Income (Net Income × 92.35%)', 'seIncome',
      fv(`=(B${R.allocatedIncome}+B${R.mealAddBack})*${TT}!$B$4`, (output.allocatedBusinessIncome + output.mealAddBack) * 0.9235),
      '= (Allocated Income + Meal Add-Back) × 0.9235', FMT_CCY)
    calc('Social Security (12.4%, up to wage base)', 'seSS',
      fv(`=MIN(B${R.seIncome},${TT}!$B$3)*0.124`, output.federal.seSocialSecurity),
      `= MIN(SE Income, $${td.ssWageBase.toLocaleString()}) × 12.4%`, FMT_CCY)
    calc('Medicare (2.9%)', 'seMedicare',
      fv(`=B${R.seIncome}*0.029`, output.federal.seMedicare),
      '= SE Income × 2.9%', FMT_CCY)
    calc('Additional Medicare (0.9% over $200k)', 'seAddlMedicare',
      fv(`=IF(B${R.seIncome}>200000,(B${R.seIncome}-200000)*0.009,0)`, output.federal.seAdditionalMedicare),
      'Additional 0.9% on SE income above $200,000', FMT_CCY)
    subtot('Total Self-Employment Tax', 'entityTaxTotal',
      fv(`=B${R.seSS}+B${R.seMedicare}+B${R.seAddlMedicare}`, output.federal.seTax),
      '', FMT_CCY)
    calc('SE Tax Deduction (Deductible Half)', 'seTaxDeduction',
      fv(`=(B${R.seSS}+B${R.seMedicare})/2`, output.seTaxDeduction),
      '50% of SS + Medicare is deductible from AGI', FMT_CCY)
  } else {
    sub('S-CORP FICA (PAYROLL TAXES)')
    calc('Employee Social Security (6.2%)', 'ficaEmpSS',
      fv(`=MIN(B${R.shareholderSalary},${TT}!$B$3)*0.062`, Math.min(input.shareholderSalary, td.ssWageBase) * 0.062),
      `= MIN(Salary, $${td.ssWageBase.toLocaleString()}) × 6.2%`, FMT_CCY)
    calc('Employee Medicare (1.45%)', 'ficaEmpMed',
      fv(`=B${R.shareholderSalary}*0.0145`, input.shareholderSalary * 0.0145),
      '= Salary × 1.45%', FMT_CCY)
    calc('Employer Social Security (6.2%)', 'ficaErSS',
      fv(`=MIN(B${R.shareholderSalary},${TT}!$B$3)*0.062`, Math.min(input.shareholderSalary, td.ssWageBase) * 0.062),
      'Employer matches employee SS portion', FMT_CCY)
    calc('Employer Medicare (1.45%)', 'ficaErMed',
      fv(`=B${R.shareholderSalary}*0.0145`, input.shareholderSalary * 0.0145),
      'Employer matches employee Medicare portion', FMT_CCY)
    subtot('Total FICA Paid via Payroll', 'entityTaxTotal',
      fv(`=B${R.ficaEmpSS}+B${R.ficaEmpMed}+B${R.ficaErSS}+B${R.ficaErMed}`, output.federal.ficaAlreadyPaid),
      '', FMT_CCY)
    // SE deduction = 0 for S-Corp; save placeholder row for formula consistency
    calc('SE Tax Deduction', 'seTaxDeduction',
      0, 'S-Corp pays FICA via payroll — no SE deduction', FMT_CCY)
  }
  blank()

  /* ── AGI & DEDUCTIONS ── */
  sec('AGI & DEDUCTIONS')

  calc('Total Adjusted Gross Income (AGI)', 'totalAGI',
    fv(`=B${R.allocatedIncome}+B${R.mealAddBack}+B${R.otherIncome}+B${R.spousalIncome}-B${R.seTaxDeduction}`, output.totalAGI),
    '= Allocated + Meal Add-Back + Other + Spousal − SE Deduction', FMT_CCY)

  calc(`Standard Deduction (${input.filingStatus}, Annual)`, 'standardDeduction',
    fv(`=${TT}!$B$15`, output.standardDeduction),
    'From TaxData sheet — full annual amount', FMT_CCY)

  calc('Custom Deduction Override (if entered)', 'customDeduction',
    input.deductionOverride ?? 0,
    'Change this to override the standard deduction; use 0 for standard', FMT_CCY)

  calc('Annual Deduction Used', 'annualDeductionUsed',
    fv(`=IF(B${R.customDeduction}>0,B${R.customDeduction},B${R.standardDeduction})`, output.standardDeduction),
    'Uses custom override if > 0, otherwise standard', FMT_CCY)

  calc(`Prorated Deduction (× ${(output.quarterProration * 100).toFixed(0)}% for ${input.quarter})`, 'proratedDeduction',
    fv(`=B${R.annualDeductionUsed}*B${R.quarterProration}`, output.effectiveDeduction),
    '= Annual Deduction × Quarter Proration', FMT_CCY)

  subtot('Taxable Income (Before QBI Deduction)', 'taxableBeforeQBI',
    fv(`=MAX(0,B${R.totalAGI}-B${R.proratedDeduction})`, output.taxableIncome + output.qbiDeduction),
    '', FMT_CCY)
  blank()

  /* ── QBI DEDUCTION ── */
  sec('QUALIFIED BUSINESS INCOME (QBI) DEDUCTION')

  calc('Business Adjusted Income', 'businessAdjIncome',
    fv(`=MAX(0,B${R.allocatedIncome}+B${R.mealAddBack}-B${R.seTaxDeduction})`, output.allocatedBusinessIncome + output.mealAddBack - output.seTaxDeduction),
    '= Allocated Income + Meal Add-Back − SE Deduction', FMT_CCY)

  calc('QBI Phase-Out Start (from TaxData)', 'qbiPhaseStart',
    fv(`=${TT}!$B$17`, td.qbiPhaseOutStart[input.filingStatus === 'MFJ' ? 'MFJ' : 'Single']),
    `${input.filingStatus} threshold`, FMT_CCY)

  calc('QBI Phase-Out End (from TaxData)', 'qbiPhaseEnd',
    fv(`=${TT}!$B$18`, td.qbiPhaseOutEnd[input.filingStatus === 'MFJ' ? 'MFJ' : 'Single']),
    `${input.filingStatus} threshold`, FMT_CCY)

  // QBI formula: 20% of businessAdjIncome, linearly phased out between start and end
  const qbiFormula =
    `=MAX(0,IF(B${R.taxableBeforeQBI}>=B${R.qbiPhaseEnd},0,` +
    `IF(B${R.taxableBeforeQBI}<=B${R.qbiPhaseStart},B${R.businessAdjIncome}*0.2,` +
    `B${R.businessAdjIncome}*0.2*(1-(B${R.taxableBeforeQBI}-B${R.qbiPhaseStart})/(B${R.qbiPhaseEnd}-B${R.qbiPhaseStart}))))*B${R.quarterProration})`
  calc('QBI Deduction (20%, phase-out applied, prorated)', 'qbiDeduction',
    fv(qbiFormula, output.qbiDeduction),
    '20% of business income × proration, reduced if income in phase-out range', FMT_CCY, true)

  blank()

  /* ── FEDERAL INCOME TAX ── */
  sec('FEDERAL INCOME TAX')

  subtot(`Taxable Income (Final, After QBI) — ${input.quarter} ${input.taxYear}`, 'taxableIncomeFinal',
    fv(`=MAX(0,B${R.taxableBeforeQBI}-B${R.qbiDeduction})`, output.taxableIncome),
    '', FMT_CCY)

  // SUMPRODUCT progressive bracket formula
  const bracketFormula =
    `=SUMPRODUCT((MIN(B${R.taxableIncomeFinal},${TT}!$D$7:$D$13)-MIN(B${R.taxableIncomeFinal},${TT}!$C$7:$C$13))*${TT}!$B$7:$B$13)`
  calc('Gross Federal Income Tax', 'grossFederalTax',
    fv(bracketFormula, output.federal.grossIncomeTax),
    'Progressive bracket calculation (SUMPRODUCT × TaxData brackets)', FMT_CCY)

  // Child tax credit
  const ctcFormula =
    `=MAX(0,B${R.numDependents}*${TT}!$B$20-ROUNDUP(MAX(0,B${R.taxableIncomeFinal}-${TT}!$B$21)/1000,0)*${TT}!$B$22)*B${R.quarterProration}`
  calc(`Child Tax Credit (${input.numDependentChildren} child${input.numDependentChildren !== 1 ? 'ren' : ''}, prorated)`, 'childTaxCredit',
    fv(ctcFormula, output.federal.childTaxCredit),
    `$${td.childTaxCredit.creditPerChild.toLocaleString()} per child × proration (phase-out applies)`, FMT_CCY)

  calc('Net Federal Income Tax', 'netFederalTax',
    fv(`=MAX(0,B${R.grossFederalTax}-B${R.childTaxCredit})`, output.federal.netIncomeTax),
    '= Gross Tax − Child Tax Credit', FMT_CCY)

  // Business ratio: apportions tax to just the business income portion
  const businessAdjFull   = Math.max(0, output.allocatedBusinessIncome + output.mealAddBack - output.seTaxDeduction)
  const businessTaxFull   = Math.max(0, businessAdjFull - output.effectiveDeduction - output.qbiDeduction)
  const businessRatioVal  = output.taxableIncome > 0 ? Math.min(1, businessTaxFull / output.taxableIncome) : 1
  const businessTaxable   = `=MAX(0,B${R.businessAdjIncome}-B${R.proratedDeduction}-B${R.qbiDeduction})`
  calc('Business Taxable Income', 'businessTaxable',
    fv(businessTaxable, businessTaxFull),
    '= Business Adj. Income − Prorated Deduction − QBI', FMT_CCY)

  calc('Business Income Ratio', 'businessRatio',
    fv(`=IF(B${R.taxableIncomeFinal}>0,MIN(1,B${R.businessTaxable}/B${R.taxableIncomeFinal}),1)`, businessRatioVal),
    'Apportions income tax to business income only', FMT_PCT)

  calc('Business Income Tax', 'businessIncomeTax',
    fv(`=B${R.netFederalTax}*B${R.businessRatio}`, output.federal.netIncomeTax * businessRatioVal),
    '= Net Federal Tax × Business Ratio', FMT_CCY)

  blank()

  /* ── FEDERAL ADJUSTMENTS (entity-specific) ── */
  if (isSCorp) {
    sub('S-CORP FEDERAL ADJUSTMENTS')
    calc('FICA Paid via Payroll', 'ficaPaid',
      fv(`=B${R.entityTaxTotal}`, output.federal.ficaAlreadyPaid),
      'Employee + employer FICA already paid (offset against federal owed)', FMT_CCY)
    calc('Federal Income Tax Withheld', 'federalWithholdingRow',
      fv(`=B${R.federalWithholding}`, input.federalWithholding),
      'From S-Corp payroll (offset against federal owed)', FMT_CCY)
    const addlFICA = output.scorp?.additionalFICA ?? 0
    calc('Additional FICA (Adjusted Salary)', 'additionalFICA',
      addlFICA,
      'Additional FICA cost if salary is raised to adjusted target', FMT_CCY)
    subtot(`Federal Tax Owed — ${input.quarter} ${input.taxYear}`, 'federalOwed',
      fv(`=MAX(0,B${R.businessIncomeTax}+B${R.additionalFICA}-B${R.ficaPaid}-B${R.federalWithholdingRow})`, output.totalFederalOwed),
      '= Business Income Tax + Add\'l FICA − FICA Paid − Withholding', FMT_CCY)
  } else {
    sub('FEDERAL ADJUSTMENTS — PASS-THROUGH')
    calc('Self-Employment Tax', 'seTaxForFederal',
      fv(`=B${R.entityTaxTotal}`, output.federal.seTax),
      'SE Tax added to federal total', FMT_CCY)
    subtot(`Federal Tax Owed — ${input.quarter} ${input.taxYear}`, 'federalOwed',
      fv(`=MAX(0,B${R.businessIncomeTax}+B${R.seTaxForFederal})`, output.totalFederalOwed),
      '= Business Income Tax + Self-Employment Tax', FMT_CCY)
  }
  blank()

  /* ── S-CORP SALARY ANALYSIS ── */
  if (isSCorp && output.scorp) {
    const scorp = output.scorp
    sec('S-CORP SALARY ANALYSIS')
    calc('Current Shareholder Salary', 'corpSalary',
      fv(`=B${R.shareholderSalary}`, input.shareholderSalary),
      '', FMT_CCY)
    calc('Recommended Minimum Salary (40% of Allocated Income)', 'corpRecommended',
      fv(`=B${R.allocatedIncome}*0.40`, scorp.recommendedMinSalary),
      'IRS reasonable compensation guideline (40% of net profit)', FMT_CCY)
    calc('Is Salary Reasonable?', 'corpReasonable',
      fv(`=IF(B${R.corpSalary}>=B${R.corpRecommended},"✓ Yes","⚠ Below Recommendation")`, scorp.isSalaryReasonable ? '✓ Yes' : '⚠ Below Recommendation'),
      scorp.warningMessage ?? '', '@')
    const ficaOnSalary = (sal: number) =>
      Math.min(sal, td.ssWageBase) * 0.062 * 2 + sal * 0.0145 * 2
    calc('Current FICA on Salary', 'corpCurrentFICA',
      fv(`=MIN(B${R.corpSalary},${TT}!$B$3)*0.124+B${R.corpSalary}*0.029`, ficaOnSalary(input.shareholderSalary)),
      '= (MIN(Salary, Wage Base) × 12.4%) + (Salary × 2.9%)  [both halves]', FMT_CCY)
    calc('FICA at Recommended Salary', 'corpRecFICA',
      fv(`=MIN(B${R.corpRecommended},${TT}!$B$3)*0.124+B${R.corpRecommended}*0.029`, scorp.recommendedFICA),
      '', FMT_CCY)
    calc('FICA Gap (Potential Savings vs. Sole-Prop)', 'corpFICAGap',
      fv(`=B${R.corpCurrentFICA}-B${R.corpRecFICA}`, scorp.ficaGap),
      'Difference between current FICA and recommended-level FICA', FMT_CCY)
    blank()
  }

  /* ── STATE TAX ── */
  const st = output.state
  sec(`STATE TAX — ${st.stateName.toUpperCase()}`)

  if (input.state === 'TN') {
    const entitySubjectToFE = input.companyType !== 'Sole-Prop'
    if (entitySubjectToFE) {
      calc('Business Net Income (Full)', 'tnNetIncome',
        fv(`=B${R.businessNetIncome}`, input.businessNetIncome),
        'Full business net income (before owner allocation)', FMT_CCY)
      calc('Shareholder Wages Offset', 'tnWages',
        fv(`=B${R.shareholderSalary}`, input.shareholderSalary),
        'Deductible wages reduce the excise tax base', FMT_CCY)
      calc('Excise Tax Base (Net Earnings After Wages)', 'tnExciseBase',
        fv(`=MAX(0,B${R.tnNetIncome}-B${R.tnWages})`, Math.max(0, input.businessNetIncome - input.shareholderSalary)),
        '= Business Net Income − Shareholder Wages', FMT_CCY)
      calc('Excise Tax (6.5%)', 'tnExcise',
        fv(`=B${R.tnExciseBase}*0.065`, st.exciseTax),
        '= Excise Base × 6.5%', FMT_CCY)
      calc('Franchise Tax (min. $100/year)', 'tnFranchise',
        100,
        '0.25% of net worth — minimum $100; update if net worth known', FMT_CCY)
      calc('Annual F&E Total', 'tnAnnualFE',
        fv(`=B${R.tnExcise}+B${R.tnFranchise}`, st.exciseTax + st.franchiseTax),
        '', FMT_CCY)
      calc('Prior F&E Payments This Year', 'tnPriorFE',
        fv(`=B${R.priorFEPaid}`, input.priorFEPaid),
        '', FMT_CCY)
      subtot(`State Tax Owed — ${input.quarter} ${input.taxYear}`, 'stateOwed',
        fv(`=MAX(0,B${R.tnAnnualFE}-B${R.tnPriorFE})`, output.totalStateOwed),
        'Annual F&E total minus prior payments made', FMT_CCY)
    } else {
      calc('State Income Tax', 'stateIncomeTax',
        0, 'TN has no individual income tax', FMT_CCY)
      calc('F&E Tax', 'stateFE',
        0, 'Sole proprietorships are not subject to TN Franchise & Excise Tax', FMT_CCY)
      subtot(`State Tax Owed — ${input.quarter} ${input.taxYear}`, 'stateOwed',
        0, '', FMT_CCY)
    }
  } else if (input.state === 'TX' || input.state === 'FL') {
    calc('State Income Tax', 'stateIncomeTax',
      0, `${st.stateName} has no individual state income tax`, FMT_CCY)
    subtot(`State Tax Owed — ${input.quarter} ${input.taxYear}`, 'stateOwed',
      0, '', FMT_CCY)
  } else {
    // States with income tax — use output values (bracket tables vary by state)
    calc('State Income Tax', 'stateIncomeTax',
      st.stateIncomeTax,
      `Effective rate: ${(st.effectiveStateRate * 100).toFixed(2)}% — see state bracket schedule`, FMT_CCY)
    subtot(`State Tax Owed — ${input.quarter} ${input.taxYear}`, 'stateOwed',
      fv(`=B${R.stateIncomeTax}`, output.totalStateOwed),
      '', FMT_CCY)
  }
  blank()

  /* ── QUARTERLY ESTIMATE SUMMARY ── */
  sec(`QUARTERLY ESTIMATE SUMMARY — ${input.quarter} ${input.taxYear}`)

  tot(`Federal Tax Owed (${input.quarter})`, 'summaryFederal',
    fv(`=B${R.federalOwed}`, output.totalFederalOwed), FMT_CCY)

  tot(`State Tax — ${st.stateName} (${input.quarter})`, 'summaryState',
    fv(`=B${R.stateOwed}`, output.totalStateOwed), FMT_CCY)

  tot('Total Estimated Tax Owed', 'summaryTotal',
    fv(`=B${R.summaryFederal}+B${R.summaryState}`, output.totalTaxOwed), FMT_CCY)

  tot('Less: Prior Estimated Payments', 'summaryPrior',
    fv(`=B${R.priorEstimatesPaid}`, input.priorEstimatesPaid), FMT_CCY)

  blank()
  netdue(`NET AMOUNT DUE — ${input.quarter} ${input.taxYear}`, 'netAmountDue',
    fv(`=MAX(0,B${R.summaryTotal}-B${R.summaryPrior})`, output.netAmountDue))

  /* ── Notes / Disclaimer ── */
  blank()
  blank()
  {
    const row = ws.getRow(r++)
    ws.mergeCells(`A${r - 1}:C${r - 1}`)
    row.getCell(1).value =
      'DISCLAIMER: This estimate is for tax planning purposes only and does not constitute tax advice. ' +
      'Consult a qualified tax professional for filing decisions. Formulas are live — update inputs in ' +
      'column B to recalculate. Tax bracket data is on the "TaxData" sheet.'
    row.getCell(1).font = { size: 8, italic: true, color: { argb: C_SLATE } }
    row.getCell(1).alignment = { wrapText: true }
    row.height = 32
    row.commit()
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN EXPORT FUNCTION
═══════════════════════════════════════════════════════════════════════════ */
export async function exportTaxPlanToExcel(input: TaxInput, output: TaxOutput): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator  = 'BriBiz Tax Calculator'
  wb.created  = new Date()
  wb.modified = new Date()

  const planSheet = wb.addWorksheet('Tax Plan')
  const dataSheet = wb.addWorksheet('TaxData')

  buildTaxDataSheet(dataSheet, input)
  buildTaxPlanSheet(planSheet, input, output)

  // Make Tax Plan the active sheet
  planSheet.state = 'visible'
  dataSheet.state = 'visible'
  wb.views = [{ activeTab: 0, x: 0, y: 0, width: 10000, height: 20000, firstSheet: 0, visibility: 'visible' }]

  const buffer  = await wb.xlsx.writeBuffer()
  const blob    = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url     = URL.createObjectURL(blob)
  const anchor  = document.createElement('a')
  anchor.href   = url
  anchor.download = `${input.ownerName} ${input.quarter} ${input.taxYear} Tax Plan.xlsx`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
