import type { StateResult, FilingStatus } from '@/types'

// Texas has no individual state income tax.
// Franchise ("margin") tax applies at the entity level: 0.75% of taxable margin
// (0.375% for qualifying retail/wholesale). No tax due if gross receipts < $2,470,000.
export function calculateTX(
  _allocatedBusinessIncome: number,
  _taxableIncome: number,
  _filingStatus: FilingStatus,
  _year: number,
): StateResult {
  return {
    stateName: 'Texas',
    stateCode: 'TX',
    stateIncomeTax: 0,
    exciseTax: 0,
    franchiseTax: 0,
    stateDeduction: 0,
    effectiveStateRate: 0,
    notes: [
      'Texas has no individual state income tax.',
      'Entity-level: Franchise (margin) tax at 0.75% of taxable margin (0.375% for retail/wholesale).',
      'No franchise tax due if gross receipts are below $2,470,000 (2025 threshold).',
      'Franchise tax is an annual entity-level obligation, not a personal quarterly estimate.',
    ],
  }
}
