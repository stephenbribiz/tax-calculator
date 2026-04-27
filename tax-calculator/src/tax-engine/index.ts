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

  // 1. Actual (non-annualized) allocated income — K-1 pass-through, used for SE tax and display
  const actualAllocatedIncome = input.businessNetIncome * (input.ownershipPct / 100)

  // For S-Corp: the shareholder is taxed on BOTH their K-1 pass-through income AND their W-2
  // salary. The salary is already deducted as an S-Corp business expense (which reduces the K-1),
  // so we add it back to get the full income tax base. A K-1 net loss can offset salary income,
  // but the combined effective income floors at $0.
  const isSCorp = input.companyType === 'S-Corp'
  const effectiveAllocatedIncome = isSCorp
    ? Math.max(0, actualAllocatedIncome + input.shareholderSalary)
    : actualAllocatedIncome

  // 2. Annualized income — only for bracket determination when annualizeIncome is on
  const isAnnualizing = input.annualizeIncome && proration > 0 && proration < 1
  const annualizedAllocatedIncome = isAnnualizing
    ? actualAllocatedIncome / proration
    : null

  // 3. Meal add-back (50% non-deductible)
  const mealAddBack = input.mealExpense * 0.5

  // 4. SE tax always on actual K-1 income (S-Corp SE tax = $0; salary uses FICA instead)
  // Salary used as TN excise wage deduction: when feUsesAdjustedSalary is on and there IS an
  // adjusted salary, use it to reduce the excise base (adjustedSalary already > shareholderSalary).
  // FE salary: when toggle is on and adjusted salary is larger, use it for TN excise base.
  // Uses feAdjustedSalary (always the raw form value) rather than adjustedSalary (gated by FICA confirmation).
  const feSalaryCandidate = input.feAdjustedSalary ?? input.adjustedSalary
  const feSalary = (input.feUsesAdjustedSalary && isSCorp && feSalaryCandidate > input.shareholderSalary)
    ? feSalaryCandidate
    : input.shareholderSalary

  const seNetIncome = Math.max(0, actualAllocatedIncome + mealAddBack)
  const seTaxResult = calculateSETax(seNetIncome, input.taxYear, input.companyType)

  // 5. FICA for S-Corp
  const ficaResult = calculateFICA(input.shareholderSalary, input.taxYear)

  // 6. Deduction — prorated by quarter
  const standardDeduction = taxData.standardDeduction[input.filingStatus]
  const fullDeduction = input.deductionOverride !== null ? input.deductionOverride : standardDeduction
  const proratedDeduction = fullDeduction * proration

  // 7. AGI and taxable income (actual — for display and non-annualized calc)
  // For S-Corp: use effectiveAllocatedIncome (K-1 + salary, floored at 0) as the income base
  const totalAGI = effectiveAllocatedIncome
    + input.otherIncome
    + input.spousalIncome
    + mealAddBack
    - seTaxResult.deductibleHalf

  const taxableIncome = Math.max(0, totalAGI - proratedDeduction)

  // 8. Business-only income
  const businessAdjustedIncome = Math.max(0,
    effectiveAllocatedIncome + mealAddBack - seTaxResult.deductibleHalf
  )
  const businessTaxableIncome = Math.max(0, businessAdjustedIncome - proratedDeduction)

  // 9. QBI deduction — phase-out always uses annualized income.
  // QBI phase-out thresholds are annual dollar amounts. Comparing prorated quarter
  // income against annual thresholds would incorrectly pass the phase-out test for
  // high earners (e.g. $200k Q1 = $800k annual but the prorated $200k < $191k threshold).
  // We annualize the income here to get the correct phase-out, then prorate the result.
  const annualBizAdjForQBI = proration > 0 ? businessAdjustedIncome / proration : businessAdjustedIncome
  const annualTaxableForQBI = proration > 0
    ? Math.max(0, totalAGI / proration - fullDeduction)
    : Math.max(0, totalAGI - fullDeduction)
  const fullQbiDeduction = calculateQBI(annualBizAdjForQBI, annualTaxableForQBI, input.filingStatus, taxData)
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
    // Annualize meal add-back to match income scale — using Q1 meal expense as-is
    // against an annualized income base would understate AGI by (1 - proration) × mealAddBack,
    // causing effectiveRate × taxableIncome ≠ grossTax.
    const annMealAddBack = mealAddBack / proration
    const annSENet = Math.max(0, annAllocated + annMealAddBack)
    const annSETax = calculateSETax(annSENet, input.taxYear, input.companyType)

    // For S-Corp: annualize salary the same way as K-1 income, then combine
    const annSalary = isSCorp ? input.shareholderSalary / proration : 0
    const effectiveAnnAllocated = isSCorp
      ? Math.max(0, annAllocated + annSalary)
      : annAllocated

    const annAGI = effectiveAnnAllocated + input.otherIncome + input.spousalIncome + annMealAddBack - annSETax.deductibleHalf
    const annTaxable = Math.max(0, annAGI - fullDeduction)
    const annBusinessAdj = Math.max(0, effectiveAnnAllocated + annMealAddBack - annSETax.deductibleHalf)
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
      shareholderSalary: feSalary,
      feUsesAdjustedSalary: input.feUsesAdjustedSalary,
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
      shareholderSalary: feSalary,
      feUsesAdjustedSalary: input.feUsesAdjustedSalary,
    })

    // Add entity-level taxes (excise + franchise) — full annual amount minus prior F&E payments
    const annualFE = state.exciseTax + state.franchiseTax
    const priorFEPaid = input.priorFEPaid ?? 0
    const netFEOwed = Math.max(0, annualFE - priorFEPaid)
    totalStateOwed += netFEOwed

    const totalTaxOwed = totalFederalOwed + totalStateOwed
    const netAmountDue = Math.max(0, totalTaxOwed - input.priorEstimatesPaid)

    return {
      annualizedBusinessIncome: annualizedAllocatedIncome,
      allocatedBusinessIncome: actualAllocatedIncome,
      mealAddBack,
      seTaxDeduction: seTaxResult.deductibleHalf,
      // Use the annualized-path QBI (correctly phase-tested against annual income),
      // prorated to the quarter for display.
      qbiDeduction: annQBI * proration,
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
    shareholderSalary: feSalary,
    feUsesAdjustedSalary: input.feUsesAdjustedSalary,
  })
  totalStateOwed = state.stateIncomeTax // no proration

  // Add entity-level taxes (excise + franchise) — full annual amount minus prior F&E payments
  const annualFE = state.exciseTax + state.franchiseTax
  const priorFEPaid = input.priorFEPaid ?? 0
  const netFEOwed = Math.max(0, annualFE - priorFEPaid)
  totalStateOwed += netFEOwed

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
