import type { StateResult, FilingStatus, CompanyType } from '@/types'

// Tennessee has no individual income tax (Hall Tax fully repealed Jan 1, 2021).
// Business-level taxes apply to S-Corps, LLCs, and Partnerships:
//   - Excise Tax: 6.5% on net earnings AFTER shareholder wages
//   - Franchise Tax: 0.25% on net worth or book value of real/tangible property in TN (min $100)
// These are entity-level obligations but are real costs the business owner pays.

export function calculateTN(
  _allocatedBusinessIncome: number,
  _taxableIncome: number,
  _filingStatus: FilingStatus,
  _year: number,
  companyType?: CompanyType,
  businessNetIncome?: number,
  shareholderSalary?: number,
): StateResult {
  const fullBusinessIncome = businessNetIncome ?? 0
  const salary = shareholderSalary ?? 0

  // Calculate excise tax for entity types subject to it
  const entitySubjectToExcise = companyType === 'S-Corp' || companyType === 'LLC'
    || companyType === 'Partnership' || companyType === 'Single-Member-LLC'

  // Excise tax is on net earnings AFTER shareholder wages (wages are a deductible expense)
  const netEarningsAfterWages = Math.max(0, fullBusinessIncome - salary)
  const exciseTax = entitySubjectToExcise && netEarningsAfterWages > 0
    ? netEarningsAfterWages * 0.065
    : 0

  // Franchise tax requires net worth (we don't have it) — show minimum as estimate
  const franchiseTax = entitySubjectToExcise ? 100 : 0

  const notes: string[] = [
    'Tennessee has no individual state income tax.',
  ]

  if (entitySubjectToExcise) {
    if (salary > 0) {
      notes.push(`Excise Tax: 6.5% on net earnings after shareholder wages ($${netEarningsAfterWages.toLocaleString()}).`)
    } else {
      notes.push(`Excise Tax: 6.5% on net earnings.`)
    }
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
