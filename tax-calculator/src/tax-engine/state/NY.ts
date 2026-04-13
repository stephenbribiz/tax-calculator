import type { StateResult, FilingStatus } from '@/types'
import { applyProgressiveBrackets } from '../federal/brackets'

interface NYBracket { upTo: number; rate: number }

const NY_BRACKETS: Record<FilingStatus, NYBracket[]> = {
  Single: [
    { upTo: 8500,     rate: 0.04 },
    { upTo: 11700,    rate: 0.045 },
    { upTo: 13900,    rate: 0.0525 },
    { upTo: 80650,    rate: 0.055 },
    { upTo: 215400,   rate: 0.06 },
    { upTo: 1077550,  rate: 0.0685 },
    { upTo: 5000000,  rate: 0.0965 },
    { upTo: 25000000, rate: 0.103 },
    { upTo: Infinity, rate: 0.109 },
  ],
  MFJ: [
    { upTo: 17150,    rate: 0.04 },
    { upTo: 23600,    rate: 0.045 },
    { upTo: 27900,    rate: 0.0525 },
    { upTo: 161550,   rate: 0.055 },
    { upTo: 323200,   rate: 0.06 },
    { upTo: 2155350,  rate: 0.0685 },
    { upTo: 5000000,  rate: 0.0965 },
    { upTo: 25000000, rate: 0.103 },
    { upTo: Infinity, rate: 0.109 },
  ],
  HOH: [
    { upTo: 12800,    rate: 0.04 },
    { upTo: 17650,    rate: 0.045 },
    { upTo: 20900,    rate: 0.0525 },
    { upTo: 107650,   rate: 0.055 },
    { upTo: 269300,   rate: 0.06 },
    { upTo: 1616450,  rate: 0.0685 },
    { upTo: 5000000,  rate: 0.0965 },
    { upTo: 25000000, rate: 0.103 },
    { upTo: Infinity, rate: 0.109 },
  ],
  MFS: [
    { upTo: 8500,     rate: 0.04 },
    { upTo: 11700,    rate: 0.045 },
    { upTo: 13900,    rate: 0.0525 },
    { upTo: 80650,    rate: 0.055 },
    { upTo: 215400,   rate: 0.06 },
    { upTo: 1077550,  rate: 0.0685 },
    { upTo: 5000000,  rate: 0.0965 },
    { upTo: 25000000, rate: 0.103 },
    { upTo: Infinity, rate: 0.109 },
  ],
}

const NY_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  Single: 8000,
  MFJ:    16050,
  HOH:    11200,
  MFS:    8000,
}

export function calculateNY(
  allocatedBusinessIncome: number,
  _taxableIncome: number,
  filingStatus: FilingStatus,
  _year: number,
): StateResult {
  const stateDeduction = NY_STANDARD_DEDUCTION[filingStatus]
  const brackets = NY_BRACKETS[filingStatus]

  const nyBusinessTaxableIncome = Math.max(0, allocatedBusinessIncome - stateDeduction)
  const { tax: stateIncomeTax, effectiveRate } = applyProgressiveBrackets(nyBusinessTaxableIncome, brackets)

  return {
    stateName: 'New York',
    stateCode: 'NY',
    stateIncomeTax,
    exciseTax: 0,
    franchiseTax: 0,
    stateDeduction,
    effectiveStateRate: effectiveRate,
    notes: [
      'NYC residents owe an additional NYC income tax (3.078%–3.876%) — not included in this estimate.',
      'New York City clients should add approximately 3.5% to this state estimate or consult NYC tax tables.',
    ],
  }
}
