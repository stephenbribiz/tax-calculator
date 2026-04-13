import type { CompanyType, FilingStatus, Quarter, StateCode } from './engine'

export interface Step1Data {
  companyName: string
  companyType: CompanyType
  ownerName: string
}

export interface Step2Data {
  quarter: Quarter
  taxYear: number
  dateCompleted: string
  filingStatus: FilingStatus
  ownershipPct: number
  numDependentChildren: number
  state: StateCode
}

export interface Step3Data {
  businessNetIncome: number
  shareholderSalary: number
  adjustedSalary: number        // S-Corp: target salary for reasonable comp (0 = no adjustment)
  federalWithholding: number    // S-Corp: federal income tax already withheld via payroll
  mealExpense: number
  shareholderDraw: number
  otherIncome: number
  spousalIncome: number
  priorEstimatesPaid: number
  deductionOverride: number | null
  annualizeIncome: boolean
}

export interface FormState {
  step: 1 | 2 | 3 | 'results'
  step1: Step1Data
  step2: Step2Data
  step3: Step3Data
}

export type FormAction =
  | { type: 'SET_STEP1'; payload: Step1Data }
  | { type: 'SET_STEP2'; payload: Step2Data }
  | { type: 'SET_STEP3'; payload: Step3Data }
  | { type: 'GO_TO_STEP'; payload: 1 | 2 | 3 | 'results' }
  | { type: 'LOAD_CLIENT'; payload: Partial<Step1Data & Step2Data> }
  | { type: 'RESET' }
  | { type: 'CLEAR_DRAFT' }
  | { type: 'LOAD_DRAFT'; payload: { step1: Step1Data; step2: Step2Data; step3: Step3Data } }
