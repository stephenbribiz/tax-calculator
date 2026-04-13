import type { StateResult, FilingStatus, CompanyType } from '@/types'

// Tennessee has no individual income tax (Hall Tax fully repealed Jan 1, 2021).
// Business-level taxes apply to S-Corps, LLCs, and Partnerships:
//   - Excise Tax: 6.5% on net earnings
//   - Franchise Tax: 0.25% on net worth or book value of real/tangible property in TN (min $100)
// These are entity-level obligations but are real costs the business owner pays.

export function calculateTN(
  allocatedBusinessIncome: number,
  _taxableIncome: number,
  _filingStatus: FilingStatus,
  _year: number,
  companyType?: CompanyType,
  businessNetIncome?: number,
): StateResult {
  const fullBusinessIncome = businessNetIncome ?? allocatedBusinessIncome

  // Calculate excise tax for entity types subject to it
  const entitySubjectToExcise = companyType === 'S-Corp' || companyType === 'LLC'
    || companyType === 'Partnership' || companyType === 'Single-Member-LLC'
  const exciseTax = entitySubjectToExcise && fullBusinessIncome > 0
    ? fullBusinessIncome * 0.065
    : 0

  // Franchise tax requires net worth (we don't have it) — show minimum as estimate
  const franchiseTax = entitySubjectToExcise ? 100 : 0

  const notes: string[] = [
    'Tennessee has no individual state income tax.',
  ]

  if (entitySubjectToExcise) {
    notes.push(`Excise Tax: 6.5% on net earnings = estimated at entity level.`)
    notes.push(`Franchise Tax: 0.25% on net worth (minimum $100/year). Using minimum — actual depends on entity net worth.`)
    notes.push('These entity-level taxes are filed with the business return.')
  }

  return {
    stateName: 'Tennessee',
    stateCode: 'TN',
    stateIncomeTax: 0,
    exciseTax,
    franchiseTax,
    stateDeduction: 0,
    effectiveStateRate: 0,
    notes,
  }
}
