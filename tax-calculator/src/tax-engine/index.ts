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

  // 1. Actual (non-annualized) allocated income — used for SE tax and display
  const actualAllocatedIncome = input.businessNetIncome * (input.ownershipPct / 100)

  // 2. Annualized income — only for bracket determination when annualizeIncome is on
  const isAnnualizing = input.annualizeIncome && proration > 0 && proration < 1
  const annualizedAllocatedIncome = isAnnualizing
    ? actualAllocatedIncome / proration
    : null

  // 3. Meal add-back (50% non-deductible)
  const mealAddBack = input.mealExpense * 0.5

  // 4. SE tax always on actual income
  const seNetIncome = Math.max(0, actualAllocatedIncome + mealAddBack)
  const seTaxResult = calculateSETax(seNetIncome, input.taxYear, input.companyType)

  // 5. FICA for S-Corp
  const ficaResult = calculateFICA(input.shareholderSalary, input.taxYear)

  // 6. Deduction — prorated by quarter
  const standardDeduction = taxData.standardDeduction[input.filingStatus]
  const fullDeduction = input.deductionOverride !== null ? input.deductionOverride : standardDeduction
  const proratedDeduction = fullDeduction * proration

  // 7. AGI and taxable income (actual — for display and non-annualized calc)
  const totalAGI = actualAllocatedIncome
    + input.otherIncome
    + input.spousalIncome
    + mealAddBack
    - seTaxResult.deductibleHalf

  const taxableIncome = Math.max(0, totalAGI - proratedDeduction)

  // 8. Business-only income
  const businessAdjustedIncome = Math.max(0,
    actualAllocatedIncome + mealAddBack - seTaxResult.deductibleHalf
  )
  const businessTaxableIncome = Math.max(0, businessAdjustedIncome - proratedDeduction)

  // 9. QBI deduction (prorated — it's an annual deduction)
  const fullQbiDeduction = calculateQBI(businessAdjustedIncome, taxableIncome, input.filingStatus, taxData)
  const qbiDeduction = fullQbiDeduction * proration

  const taxableIncomeWithQBI = Math.max(0, taxableIncome - qbiDeduction)
  const businessTaxableWithQBI = Math.max(0, businessTaxableIncome - qbiDeduction)

  // 10. S-Corp analysis — based on actual (not annualized) quarter income
  const scorp = input.companyType === 'S-Corp'
    ? analyzeReasonableComp(actualAllocatedIncome, input.shareholderSalary, input.adjustedSalary, input.taxYear)
    : null

  // Additional FICA from salary adjustment (added to tax total)
  const additionalFICA = scorp?.additionalFICA ?? 0

  // Federal withholding already paid (S-Corp only)
  const federalWithholding = input.companyType === 'S-Corp' ? input.federalWithholding : 0

  let federal
  let totalFederalOwed: number
  let totalStateOwed: number

  if (isAnnualizing) {
    // ── ANNUALIZED PATH ──
    // Calculate full-year tax on annualized income with full deduction/credit,
    // then take the quarterly share. This gives correct bracket placement.
    const annAllocated = annualizedAllocatedIncome!
    const annSENet = Math.max(0, annAllocated + mealAddBack)
    const annSETax = calculateSETax(annSENet, input.taxYear, input.companyType)

    const annAGI = annAllocated + input.otherIncome + input.spousalIncome + mealAddBack - annSETax.deductibleHalf
    const annTaxable = Math.max(0, annAGI - fullDeduction)
    const annBusinessAdj = Math.max(0, annAllocated + mealAddBack - annSETax.deductibleHalf)
    const annBusinessTaxable = Math.max(0, annBusinessAdj - fullDeduction)

    const annQBI = calculateQBI(annBusinessAdj, annTaxable, input.filingStatus, taxData)
    const annTaxableWithQBI = Math.max(0, annTaxable - annQBI)
    const annBusinessTaxableWithQBI = Math.max(0, annBusinessTaxable - annQBI)

    const annFederal = calculateFederal({
      taxableIncome: annTaxableWithQBI,
      totalAGI: annAGI,
      businessTaxableIncome: annBusinessTaxableWithQBI,
      filingStatus: input.filingStatus,
      companyType: input.companyType,
      shareholderSalary: input.shareholderSalary,
      seTax: annSETax.seTax,
      seSocialSecurity: annSETax.socialSecurity,
      seMedicare: annSETax.medicare,
      seAdditionalMedicare: annSETax.additionalMedicare,
      numDependentChildren: input.numDependentChildren,
      taxData,
    })

    // Prorate the full-year federal result to get the quarterly share
    federal = {
      ...annFederal,
      // Override SE tax breakdown with actual (not annualized) SE tax
      seTax: seTaxResult.seTax,
      seSocialSecurity: seTaxResult.socialSecurity,
      seMedicare: seTaxResult.medicare,
      seAdditionalMedicare: seTaxResult.additionalMedicare,
      // Prorate credits for display
      childTaxCredit: annFederal.childTaxCredit * proration,
    }

    // Federal: prorate income tax portion, use actual SE tax
    const proratedIncomeTax = annFederal.netIncomeTax * proration
    const businessRatio = annTaxableWithQBI > 0
      ? Math.min(1, annBusinessTaxableWithQBI / annTaxableWithQBI)
      : 1
    const proratedBusinessIncomeTax = proratedIncomeTax * businessRatio

    const federalBeforeProration = proratedBusinessIncomeTax + seTaxResult.seTax + additionalFICA
    const adjustedFederalTotal = Math.max(0, federalBeforeProration - ficaResult.totalFICA - federalWithholding)

    federal = {
      ...federal,
      grossIncomeTax: annFederal.grossIncomeTax * proration,
      netIncomeTax: proratedIncomeTax,
      ficaAlreadyPaid: ficaResult.totalFICA,
      totalFederalBeforeProration: adjustedFederalTotal,
    }

    totalFederalOwed = adjustedFederalTotal

    // State: prorate annualized state tax
    const annState = calculateStateTax({
      state: input.state,
      allocatedBusinessIncome: annBusinessAdj,
      taxableIncome: annTaxableWithQBI,
      filingStatus: input.filingStatus,
      year: input.taxYear,
      companyType: input.companyType,
      businessNetIncome: input.businessNetIncome,
      shareholderSalary: input.shareholderSalary,
    })
    totalStateOwed = annState.stateIncomeTax * proration

    // Use actual state calc for display (rates etc.)
    const state = calculateStateTax({
      state: input.state,
      allocatedBusinessIncome: businessAdjustedIncome,
      taxableIncome: taxableIncomeWithQBI,
      filingStatus: input.filingStatus,
      year: input.taxYear,
      companyType: input.companyType,
      businessNetIncome: input.businessNetIncome,
      shareholderSalary: input.shareholderSalary,
    })

    // Add entity-level taxes (excise + franchise) — not prorated, these are annual
    const entityLevelTax = state.exciseTax + state.franchiseTax
    totalStateOwed += entityLevelTax

    const totalTaxOwed = totalFederalOwed + totalStateOwed
    const netAmountDue = Math.max(0, totalTaxOwed - input.priorEstimatesPaid)

    return {
      annualizedBusinessIncome: annualizedAllocatedIncome,
      allocatedBusinessIncome: actualAllocatedIncome,
      mealAddBack,
      seTaxDeduction: seTaxResult.deductibleHalf,
      qbiDeduction,
      standardDeduction,
      effectiveDeduction: proratedDeduction,
      taxableIncome: taxableIncomeWithQBI,
      totalAGI,

      federal,
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

  // ── NON-ANNUALIZED PATH ──
  // Use actual income with prorated deduction/credit. No final proration.
  federal = calculateFederal({
    taxableIncome: taxableIncomeWithQBI,
    totalAGI,
    businessTaxableIncome: businessTaxableWithQBI,
    filingStatus: input.filingStatus,
    companyType: input.companyType,
    shareholderSalary: input.shareholderSalary,
    seTax: seTaxResult.seTax,
    seSocialSecurity: seTaxResult.socialSecurity,
    seMedicare: seTaxResult.medicare,
    seAdditionalMedicare: seTaxResult.additionalMedicare,
    numDependentChildren: input.numDependentChildren,
    taxData,
  })

  // Prorate the child tax credit
  federal = {
    ...federal,
    childTaxCredit: federal.childTaxCredit * proration,
    netIncomeTax: Math.max(0, federal.grossIncomeTax - federal.childTaxCredit * proration),
  }

  // Recalculate totals with prorated credit
  const businessRatio = taxableIncomeWithQBI > 0
    ? Math.min(1, businessTaxableWithQBI / taxableIncomeWithQBI)
    : 1
  const businessIncomeTax = federal.netIncomeTax * businessRatio
  const federalTotal = businessIncomeTax + seTaxResult.seTax + additionalFICA
  const adjustedFederalTotal = Math.max(0, federalTotal - ficaResult.totalFICA - federalWithholding)

  federal = {
    ...federal,
    ficaAlreadyPaid: ficaResult.totalFICA,
    totalFederalBeforeProration: adjustedFederalTotal,
  }

  totalFederalOwed = adjustedFederalTotal // no proration — already prorated via deduction/credit

  const state = calculateStateTax({
    state: input.state,
    allocatedBusinessIncome: businessAdjustedIncome,
    taxableIncome: taxableIncomeWithQBI,
    filingStatus: input.filingStatus,
    year: input.taxYear,
    companyType: input.companyType,
    businessNetIncome: input.businessNetIncome,
  })
  totalStateOwed = state.stateIncomeTax // no proration

  // Add entity-level taxes (excise + franchise)
  const entityLevelTax = state.exciseTax + state.franchiseTax
  totalStateOwed += entityLevelTax

  const totalTaxOwed = totalFederalOwed + totalStateOwed
  const netAmountDue = Math.max(0, totalTaxOwed - input.priorEstimatesPaid)

  return {
    annualizedBusinessIncome: null,
    allocatedBusinessIncome: actualAllocatedIncome,
    mealAddBack,
    seTaxDeduction: seTaxResult.deductibleHalf,
    qbiDeduction,
    standardDeduction,
    effectiveDeduction: proratedDeduction,
    taxableIncome: taxableIncomeWithQBI,
    totalAGI,

    federal,
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
