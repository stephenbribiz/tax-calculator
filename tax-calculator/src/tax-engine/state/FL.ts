import type { StateResult, FilingStatus } from '@/types'

// Florida has no individual state income tax.
// S-Corps and LLCs taxed as pass-throughs are not subject to Florida corporate income tax.
// C-Corps and LLCs electing C-Corp treatment: 5.5% corporate income tax.
export function calculateFL(
  _allocatedBusinessIncome: number,
  _taxableIncome: number,
  _filingStatus: FilingStatus,
  _year: number,
): StateResult {
  return {
    stateName: 'Florida',
    stateCode: 'FL',
    stateIncomeTax: 0,
    franchiseTax: 0,
    stateDeduction: 0,
    effectiveStateRate: 0,
    notes: [
      'Florida has no individual state income tax.',
      'S-Corps and pass-through LLCs are not subject to Florida corporate income tax.',
      'Florida requires an annual report (due May 1) with a $150 filing fee — not a tax.',
    ],
  }
}
