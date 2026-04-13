export type FilingStatus = 'Single' | 'MFJ' | 'HOH' | 'MFS'
export type CompanyType = 'S-Corp' | 'LLC' | 'Partnership' | 'Single-Member-LLC' | 'Sole-Prop'
export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4'
export type StateCode = 'TN' | 'CA' | 'GA' | 'NC' | 'NY' | 'TX' | 'AZ' | 'FL'

export interface TaxInput {
  // Step 1 — Client Info
  companyName: string
  companyType: CompanyType
  ownerName: string
  taxYear: number
  dateCompleted: string

  // Step 2 — Tax Profile
  quarter: Quarter
  filingStatus: FilingStatus
  ownershipPct: number       // 0–100
  numDependentChildren: number
  state: StateCode

  // Step 3 — Financial Data
  businessNetIncome: number
  shareholderSalary: number  // S-Corp only, 0 otherwise
  mealExpense: number        // 50% deductible
  shareholderDraw: number    // informational only (not deductible)
  otherIncome: number
  spousalIncome: number
  priorEstimatesPaid: number
  deductionOverride: number | null  // null = use standard deduction
  annualizeIncome: boolean
}

export interface BracketTier {
  upTo: number
  rate: number
}

export interface FederalTaxData {
  brackets: Record<FilingStatus, BracketTier[]>
  standardDeduction: Record<FilingStatus, number>
  ssWageBase: number
  qbiPhaseOutStart: Record<'Single' | 'MFJ', number>
  qbiPhaseOutEnd: Record<'Single' | 'MFJ', number>
  childTaxCredit: {
    creditPerChild: number
    phaseOutStart: Record<'Single' | 'MFJ', number>
    phaseOutIncrement: number
  }
}

export interface FederalResult {
  grossIncomeTax: number
  childTaxCredit: number
  netIncomeTax: number
  seTax: number
  seSocialSecurity: number
  seMedicare: number
  seAdditionalMedicare: number
  ficaAlreadyPaid: number   // S-Corp payroll FICA already withheld
  totalFederalBeforeProration: number
  effectiveFederalRate: number
  marginalRate: number
}

export interface StateResult {
  stateName: string
  stateCode: StateCode
  stateIncomeTax: number
  franchiseTax: number
  stateDeduction: number
  effectiveStateRate: number
  notes: string[]
}

export interface SCorpAnalysis {
  currentSalary: number
  recommendedMinSalary: number
  currentFICA: number
  recommendedFICA: number
  ficaGap: number
  isSalaryReasonable: boolean
  warningMessage: string | null
}

export interface TaxOutput {
  // Derived intermediate values
  annualizedBusinessIncome: number
  allocatedBusinessIncome: number
  mealAddBack: number
  seTaxDeduction: number
  qbiDeduction: number
  standardDeduction: number
  effectiveDeduction: number
  taxableIncome: number
  totalAGI: number

  federal: FederalResult
  state: StateResult
  scorp: SCorpAnalysis | null

  quarterProration: number
  totalFederalOwed: number
  totalStateOwed: number
  totalTaxOwed: number
  priorEstimatesPaid: number
  netAmountDue: number
}
