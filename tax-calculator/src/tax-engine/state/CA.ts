import type { StateResult, FilingStatus } from '@/types'
import { applyProgressiveBrackets } from '../federal/brackets'

interface CABracket { upTo: number; rate: number }

const CA_BRACKETS_2025: Record<FilingStatus, CABracket[]> = {
  Single: [
    { upTo: 10756,    rate: 0.01 },
    { upTo: 25499,    rate: 0.02 },
    { upTo: 40245,    rate: 0.04 },
    { upTo: 55866,    rate: 0.06 },
    { upTo: 70606,    rate: 0.08 },
    { upTo: 360659,   rate: 0.093 },
    { upTo: 432787,   rate: 0.103 },
    { upTo: 721314,   rate: 0.113 },
    { upTo: 1000000,  rate: 0.123 },
    { upTo: Infinity, rate: 0.133 },
  ],
  MFJ: [
    { upTo: 21512,    rate: 0.01 },
    { upTo: 50998,    rate: 0.02 },
    { upTo: 80490,    rate: 0.04 },
    { upTo: 111732,   rate: 0.06 },
    { upTo: 141212,   rate: 0.08 },
    { upTo: 721318,   rate: 0.093 },
    { upTo: 865574,   rate: 0.103 },
    { upTo: 1000000,  rate: 0.113 },
    { upTo: 1442628,  rate: 0.123 },
    { upTo: Infinity, rate: 0.133 },
  ],
  HOH: [
    { upTo: 21527,    rate: 0.01 },
    { upTo: 51000,    rate: 0.02 },
    { upTo: 65744,    rate: 0.04 },
    { upTo: 81364,    rate: 0.06 },
    { upTo: 96107,    rate: 0.08 },
    { upTo: 490493,   rate: 0.093 },
    { upTo: 588593,   rate: 0.103 },
    { upTo: 980988,   rate: 0.113 },
    { upTo: 1000000,  rate: 0.123 },
    { upTo: Infinity, rate: 0.133 },
  ],
  MFS: [
    { upTo: 10756,    rate: 0.01 },
    { upTo: 25499,    rate: 0.02 },
    { upTo: 40245,    rate: 0.04 },
    { upTo: 55866,    rate: 0.06 },
    { upTo: 70606,    rate: 0.08 },
    { upTo: 360659,   rate: 0.093 },
    { upTo: 432787,   rate: 0.103 },
    { upTo: 721314,   rate: 0.113 },
    { upTo: 1000000,  rate: 0.123 },
    { upTo: Infinity, rate: 0.133 },
  ],
}

const CA_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  Single: 5706,
  MFJ:    11412,
  HOH:    5706,
  MFS:    5706,
}

export function calculateCA(
  allocatedBusinessIncome: number,
  taxableIncome: number,
  filingStatus: FilingStatus,
  _year: number,
): StateResult {
  const stateDeduction = CA_STANDARD_DEDUCTION[filingStatus]
  const brackets = CA_BRACKETS_2025[filingStatus]

  // CA taxable income uses CA standard deduction (much lower than federal)
  const caTaxableIncome = Math.max(0, taxableIncome + CA_STANDARD_DEDUCTION['Single'] - stateDeduction)
  const { tax: stateIncomeTax, effectiveRate } = applyProgressiveBrackets(caTaxableIncome, brackets)

  // Business ratio for estimating quarterly portion
  const businessRatio = taxableIncome > 0 ? Math.min(1, allocatedBusinessIncome / Math.max(allocatedBusinessIncome, taxableIncome)) : 1
  const businessStateTax = stateIncomeTax * businessRatio

  return {
    stateName: 'California',
    stateCode: 'CA',
    stateIncomeTax: businessStateTax,
    franchiseTax: 0,
    stateDeduction,
    effectiveStateRate: effectiveRate,
    notes: [
      'CA standard deduction is significantly lower than federal ($5,706 Single / $11,412 MFJ for 2025).',
      'Entity-level: $800 minimum annual franchise tax for LLCs and S-Corps (paid separately on entity return).',
      'LLCs with gross revenue over $250K owe additional LLC fees on the entity return.',
    ],
  }
}
