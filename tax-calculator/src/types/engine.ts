export type FilingStatus = 'Single' | 'MFJ' | 'HOH' | 'MFS'
export type CompanyType = 'S-Corp' | 'LLC' | 'Partnership' | 'Single-Member-LLC' | 'Sole-Prop'
export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4'
export type StateCode = 'TN' | 'CA' | 'GA' | 'NC' | 'NY' | 'TX' | 'AZ' | 'FL'

/** Per-company financial row used when a client has multiple businesses */
export interface BusinessRow {
  businessId: string        // 'primary' for the main client company, or businesses.id from DB
  companyName: string
  companyType: CompanyType
  netIncome: number
  mealExpense: number
  shareholderSalary: number    // S-Corp only, 0 otherwise
  federalWithholding: number   // S-Corp only, 0 otherwise
}

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
  adjustedSalary: number     // S-Corp: user-set target salary for reasonable comp (0 = no adjustment)
  federalWithholding: number // S-Corp: federal income tax already withheld via payroll
  mealExpense: number        // 50% deductible
  shareholderDraw: number    // informational only (not deductible)
  otherIncome: number
  spousalIncome: number
  priorEstimatesPaid: number
  priorFEPaid: number              // TN F&E estimates already paid this year
  deductionOverride: number | null  // null = use standard deduction
  annualizeIncome: boolean
  feUsesAdjustedSalary: boolean  // TN S-Corp: use feAdjustedSalary as excise tax wage deduction
  feAdjustedSalary: number       // TN S-Corp: raw adjusted salary for F&E (always set, independent of FICA confirmation)
  tnApportionmentPct: number     // % of business net income subject to TN F&E (0–100, default 100)

  // Input overrides — user-set values that replace calculated inputs before the engine runs
  taxableIncomeOverride: number | null  // replaces calculated taxable income entering the federal brackets
  federalRateOverride: number | null    // flat federal rate (0–1) applied instead of bracket lookup

  // Present when client has multiple businesses — stored in snapshot for display only.
  // The engine always receives the summed totals in the fields above.
  businessBreakdown?: BusinessRow[]

  // Manual overrides applied on top of the calculated output before saving.
  // Stored in the input snapshot so they can be restored when editing a saved plan.
  outputOverrides?: OutputOverrides
}

/** Values the user can manually override on top of the calculated TaxOutput */
export interface OutputOverrides {
  qbiDeduction?: number
  totalFederalOwed?: number
  totalStateOwed?: number
  netAmountDue?: number
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
  exciseTax: number           // TN: 6.5% excise on net earnings
  franchiseTax: number        // TN: 0.25% franchise on net worth (estimated)
  stateDeduction: number
  effectiveStateRate: number
  notes: string[]
}

export interface SCorpAnalysis {
  currentSalary: number
  recommendedMinSalary: number
  adjustedSalary: number          // user-chosen target salary (may differ from recommended)
  currentFICA: number
  recommendedFICA: number
  adjustedFICA: number            // FICA at adjusted salary
  additionalFICA: number          // adjustedFICA - currentFICA (added to tax total)
  ficaGap: number                 // recommendedFICA - currentFICA (informational)
  isSalaryReasonable: boolean
  warningMessage: string | null
}

export interface TaxOutput {
  // Derived intermediate values
  annualizedBusinessIncome: number | null
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
