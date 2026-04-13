import type { StateResult, FilingStatus } from '@/types'

const NC_RATE: Record<number, number> = {
  2024: 0.045,
  2025: 0.0425,
  2026: 0.0399,
}

const NC_STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  Single: 12750,
  MFJ:    25500,
  HOH:    19125,
  MFS:    12750,
}

export function calculateNC(
  allocatedBusinessIncome: number,
  _taxableIncome: number,
  filingStatus: FilingStatus,
  year: number,
): StateResult {
  const rate = NC_RATE[year] ?? NC_RATE[2025]
  const stateDeduction = NC_STANDARD_DEDUCTION[filingStatus]

  const ncBusinessTaxableIncome = Math.max(0, allocatedBusinessIncome - stateDeduction)
  const stateIncomeTax = ncBusinessTaxableIncome * rate

  return {
    stateName: 'North Carolina',
    stateCode: 'NC',
    stateIncomeTax,
    exciseTax: 0,
    franchiseTax: 0,
    stateDeduction,
    effectiveStateRate: rate,
    notes: [
      `North Carolina flat income tax rate: ${(rate * 100).toFixed(2)}% for ${year}.`,
      'NC rate schedule: 4.5% (2024) → 4.25% (2025) → 3.99% (2026).',
      'NC S-Corp franchise tax ($200 minimum, $1.50 per $1,000 of tax base) is an entity-level obligation.',
    ],
  }
}
