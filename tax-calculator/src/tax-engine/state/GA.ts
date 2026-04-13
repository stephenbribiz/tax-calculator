import type { StateResult, FilingStatus } from '@/types'

// Georgia: flat income tax rate, phasing down annually
const GA_RATE: Record<number, number> = {
  2024: 0.0549,
  2025: 0.0519,
  2026: 0.0499,
}

const GA_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  Single: 12000,
  MFJ:    24000,
  HOH:    12000,
  MFS:    12000,
}

export function calculateGA(
  allocatedBusinessIncome: number,
  _taxableIncome: number,
  filingStatus: FilingStatus,
  year: number,
): StateResult {
  const rate = GA_RATE[year] ?? GA_RATE[2025]
  const stateDeduction = GA_STANDARD_DEDUCTION[filingStatus]

  // GA uses its own standard deduction; recalculate state taxable income
  // We use the business income portion for the quarterly estimate
  const gaBusinessTaxableIncome = Math.max(0, allocatedBusinessIncome - stateDeduction)
  const stateIncomeTax = gaBusinessTaxableIncome * rate

  return {
    stateName: 'Georgia',
    stateCode: 'GA',
    stateIncomeTax,
    exciseTax: 0,
    franchiseTax: 0,
    stateDeduction,
    effectiveStateRate: rate,
    notes: [
      `Georgia flat income tax rate: ${(rate * 100).toFixed(2)}% for ${year}.`,
      'GA rate is phasing down annually: 5.49% (2024) → 5.19% (2025) → 4.99% (2026).',
      'S-Corps with net worth over $100,000 owe GA Net Worth Tax — filed on the entity return.',
    ],
  }
}
