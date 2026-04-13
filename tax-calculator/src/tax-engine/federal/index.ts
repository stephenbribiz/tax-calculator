import type { FilingStatus, CompanyType, FederalResult, FederalTaxData } from '@/types'
import { applyProgressiveBrackets } from './brackets'
import { calculateFICA } from './fica'
import { calculateChildTaxCredit } from './child-tax-credit'

interface FederalCalcInput {
  taxableIncome: number          // includes all income minus all deductions/adjustments
  totalAGI: number               // for credit phase-out calculations
  businessTaxableIncome: number  // business portion only (for ratio calculation)
  filingStatus: FilingStatus
  companyType: CompanyType
  shareholderSalary: number
  seTax: number
  seSocialSecurity: number
  seMedicare: number
  seAdditionalMedicare: number
  numDependentChildren: number
  taxData: FederalTaxData
}

export function calculateFederal(input: FederalCalcInput): FederalResult {
  const {
    taxableIncome,
    totalAGI,
    businessTaxableIncome,
    filingStatus,
    companyType,
    shareholderSalary,
    seTax,
    numDependentChildren,
    taxData,
  } = input

  const brackets = taxData.brackets[filingStatus]
  const { tax: grossIncomeTax, marginalRate, effectiveRate } = applyProgressiveBrackets(taxableIncome, brackets)

  // Child tax credit applied against total tax
  const childTaxCredit = calculateChildTaxCredit(numDependentChildren, totalAGI, filingStatus, taxData)
  const netIncomeTax = Math.max(0, grossIncomeTax - childTaxCredit)

  // For S-Corp: FICA already paid via payroll (employee + employer portions)
  // Employer half is deductible as business expense; employee half comes from salary
  const ficaResult = calculateFICA(shareholderSalary, taxData.ssWageBase > 0 ? 2025 : 2025)
  const ficaAlreadyPaid = companyType === 'S-Corp' ? ficaResult.totalFICA : 0

  // Apportion tax to business income only using income ratio
  // This ensures spousal/other income affects the bracket but not the quarterly estimate
  const businessRatio = taxableIncome > 0 ? Math.min(1, businessTaxableIncome / taxableIncome) : 1
  const businessIncomeTax = netIncomeTax * businessRatio
  const businessSETax = seTax  // SE tax is already only on business income

  const totalFederalBeforeProration = businessIncomeTax + businessSETax

  return {
    grossIncomeTax,
    childTaxCredit,
    netIncomeTax,
    seTax,
    seSocialSecurity: input.seSocialSecurity,
    seMedicare: input.seMedicare,
    seAdditionalMedicare: input.seAdditionalMedicare,
    ficaAlreadyPaid,
    totalFederalBeforeProration,
    effectiveFederalRate: effectiveRate,
    marginalRate,
  }
}
