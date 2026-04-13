import type { StateResult, FilingStatus } from '@/types'

// Arizona: flat 2.5% income tax (effective since 2023)
const AZ_RATE = 0.025

// AZ standard deduction conforms to federal
const AZ_STANDARD_DEDUCTION: Record<number, Record<FilingStatus, number>> = {
  2024: { Single: 13850, MFJ: 27700, HOH: 20800, MFS: 13850 },
  2025: { Single: 15000, MFJ: 30000, HOH: 22500, MFS: 15000 },
  2026: { Single: 15450, MFJ: 30900, HOH: 23150, MFS: 15450 },
}

export function calculateAZ(
  allocatedBusinessIncome: number,
  _taxableIncome: number,
  filingStatus: FilingStatus,
  year: number,
): StateResult {
  const deductions = AZ_STANDARD_DEDUCTION[year] ?? AZ_STANDARD_DEDUCTION[2025]
  const stateDeduction = deductions[filingStatus]

  const azBusinessTaxableIncome = Math.max(0, allocatedBusinessIncome - stateDeduction)
  const stateIncomeTax = azBusinessTaxableIncome * AZ_RATE

  return {
    stateName: 'Arizona',
    stateCode: 'AZ',
    stateIncomeTax,
    franchiseTax: 0,
    stateDeduction,
    effectiveStateRate: AZ_RATE,
    notes: [
      'Arizona flat income tax rate: 2.5% (effective 2023).',
      'Arizona standard deduction conforms to federal amounts.',
    ],
  }
}
