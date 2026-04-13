import type { TaxInput, TaxOutput } from '@/types'
import { getTaxDataByYear } from './constants'
import { calculateSETax } from './federal/se-tax'
import { calculateQBI } from './federal/qbi'
import { calculateFederal } from './federal/index'
import { calculateFICA } from './federal/fica'
import { analyzeReasonableComp } from './federal/scorp-analysis'
import { calculateStateTax } from './state/index'

const PRORATION_MAP: Record<string, number> = {
  Q1: 0.25,
  Q2: 0.50,
  Q3: 0.75,
  Q4: 1.00,
}

export function calculateTax(input: TaxInput): TaxOutput {
  const taxData = getTaxDataByYear(input.taxYear)
  const proration = PRORATION_MAP[input.quarter]

  // 1. Annualize business income if requested (project one quarter to full year)
  const effectiveBusinessIncome = input.annualizeIncome && proration > 0
    ? input.businessNetIncome / proration
    : input.businessNetIncome

  // 2. Apply ownership percentage
  const allocatedBusinessIncome = effectiveBusinessIncome * (input.ownershipPct / 100)

  // 3. Meal add-back: net income already has 100% of meals deducted; only 50% is deductible,
  //    so add the non-deductible 50% back to income.
  const mealAddBack = input.mealExpense * 0.5

  // 4. Adjusted net income for SE tax purposes
  const seNetIncome = Math.max(0, allocatedBusinessIncome + mealAddBack)

  // 5. SE tax (non-S-Corp only) + above-the-line deduction (50%)
  const seTaxResult = calculateSETax(seNetIncome, input.taxYear, input.companyType)

  // 6. For S-Corp: FICA already paid via payroll
  const ficaResult = calculateFICA(input.shareholderSalary, input.taxYear)

  // 7. Effective deduction (standard or itemized override)
  const standardDeduction = taxData.standardDeduction[input.filingStatus]
  const effectiveDeduction = input.deductionOverride !== null
    ? input.deductionOverride
    : standardDeduction

  // 8. Total AGI (all income sources — used for bracket placement)
  const totalAGI = allocatedBusinessIncome
    + input.otherIncome
    + input.spousalIncome
    + mealAddBack
    - seTaxResult.deductibleHalf

  // 9. Total taxable income (including spousal/other — for correct bracket assignment)
  const taxableIncome = Math.max(0, totalAGI - effectiveDeduction)

  // 10. Business-only taxable income (for ratio calculation — drives quarterly estimate)
  const businessAdjustedIncome = Math.max(0,
    allocatedBusinessIncome
    + mealAddBack
    - seTaxResult.deductibleHalf
  )
  const businessTaxableIncome = Math.max(0, businessAdjustedIncome - effectiveDeduction)

  // 11. QBI deduction (on business income, limited by total taxable income)
  const qbiDeduction = calculateQBI(businessAdjustedIncome, taxableIncome, input.filingStatus, taxData)

  // Re-derive taxable income with QBI applied
  const taxableIncomeWithQBI = Math.max(0, taxableIncome - qbiDeduction)
  const businessTaxableWithQBI = Math.max(0, businessTaxableIncome - qbiDeduction)

  // 12. Federal income tax calculation
  const federal = calculateFederal({
    taxableIncome: taxableIncomeWithQBI,
    totalAGI,
    businessTaxableIncome: businessTaxableWithQBI,
    filingStatus: input.filingStatus,
    companyType: input.companyType,
    shareholderSalary: input.shareholderSalary,
    seTax: seTaxResult.seTax,
    numDependentChildren: input.numDependentChildren,
    taxData,
  })

  // For S-Corp: reduce federal owed by FICA already paid
  const adjustedFederalTotal = Math.max(0,
    federal.totalFederalBeforeProration - ficaResult.totalFICA
  )
  const adjustedFederal = {
    ...federal,
    ficaAlreadyPaid: ficaResult.totalFICA,
    totalFederalBeforeProration: adjustedFederalTotal,
  }

  // 13. State tax (on business income + allocations)
  const state = calculateStateTax({
    state: input.state,
    allocatedBusinessIncome: businessAdjustedIncome,
    taxableIncome: taxableIncomeWithQBI,
    filingStatus: input.filingStatus,
    year: input.taxYear,
  })

  // 14. S-Corp salary analysis
  const scorp = input.companyType === 'S-Corp'
    ? analyzeReasonableComp(allocatedBusinessIncome, input.shareholderSalary, input.taxYear)
    : null

  // 15. Prorate and compute totals
  const totalFederalOwed = adjustedFederal.totalFederalBeforeProration * proration
  const totalStateOwed = state.stateIncomeTax * proration
  const totalTaxOwed = totalFederalOwed + totalStateOwed
  const netAmountDue = Math.max(0, totalTaxOwed - input.priorEstimatesPaid)

  return {
    annualizedBusinessIncome: effectiveBusinessIncome,
    allocatedBusinessIncome,
    mealAddBack,
    seTaxDeduction: seTaxResult.deductibleHalf,
    qbiDeduction,
    standardDeduction,
    effectiveDeduction,
    taxableIncome: taxableIncomeWithQBI,
    totalAGI,

    federal: adjustedFederal,
    state,
    scorp,

    quarterProration: proration,
    totalFederalOwed,
    totalStateOwed,
    totalTaxOwed,
    priorEstimatesPaid: input.priorEstimatesPaid,
    netAmountDue,
  }
}

export { PRORATION_MAP }
