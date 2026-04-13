import type { StateResult, FilingStatus } from '@/types'

// Tennessee has no individual income tax (Hall Tax fully repealed Jan 1, 2021).
// Business-level: 6.5% excise tax on earnings >$50,000, 0.25% franchise tax on net worth.
// These are entity-level obligations, not personal quarterly estimates.
export function calculateTN(
  _allocatedBusinessIncome: number,
  _taxableIncome: number,
  _filingStatus: FilingStatus,
  _year: number,
): StateResult {
  return {
    stateName: 'Tennessee',
    stateCode: 'TN',
    stateIncomeTax: 0,
    franchiseTax: 0,
    stateDeduction: 0,
    effectiveStateRate: 0,
    notes: [
      'Tennessee has no individual state income tax.',
      'Entity-level: 6.5% excise tax on net earnings above $50,000.',
      'Entity-level: 0.25% franchise tax on net worth (minimum $100/year).',
      'These entity taxes are annual obligations filed with the business return, not personal quarterly estimates.',
    ],
  }
}
