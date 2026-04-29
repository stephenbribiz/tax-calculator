import type { StateResult, FilingStatus, CompanyType } from '@/types'

// Tennessee has no individual income tax (Hall Tax fully repealed Jan 1, 2021).
//
// Business-level F&E taxes by entity type:
//   S-Corp:           Subject to Excise (6.5% net earnings after wages) + Franchise (0.25% net worth, min $100)
//   LLC:              Subject to Excise + Franchise
//   Partnership:      Subject to Excise + Franchise
//   Single-Member LLC: Subject to Excise + Franchise (treated as disregarded entity but still owes F&E)
//   Sole Prop:        NOT subject to F&E (no separate entity filing)
//
// Excise Tax base = net earnings AFTER deductible shareholder wages (S-Corp).
// Franchise Tax base = greater of net worth or book value of real/tangible property in TN (min $100/year).

export function calculateTN(
  _allocatedBusinessIncome: number,
  _taxableIncome: number,
  _filingStatus: FilingStatus,
  _year: number,
  companyType?: CompanyType,
  businessNetIncome?: number,
  shareholderSalary?: number,
  feUsesAdjustedSalary?: boolean,
): StateResult {
  const fullBusinessIncome = businessNetIncome ?? 0
  const salary = shareholderSalary ?? 0

  // Entities subject to TN Franchise Tax (minimum $100/year)
  const entitySubjectToFranchise = companyType === 'S-Corp' || companyType === 'LLC'
    || companyType === 'Partnership' || companyType === 'Single-Member-LLC'

  // Only S-Corp and Partnership owe Excise Tax (6.5% of net earnings).
  // LLCs and Single-Member LLCs in TN are subject only to the Franchise Tax.
  const entitySubjectToExcise = companyType === 'S-Corp' || companyType === 'Partnership'

  // feUsesAdjustedSalary controls whether the salary is deducted from the excise base.
  // undefined/true → deduct salary (default; preserves behaviour for plans created before toggle existed).
  // false → no deduction; excise is on the full net income.
  const deductSalary = feUsesAdjustedSalary !== false
  const exciseBase = deductSalary
    ? Math.max(0, fullBusinessIncome - salary)
    : Math.max(0, fullBusinessIncome)
  const exciseTax = entitySubjectToExcise && exciseBase > 0
    ? exciseBase * 0.065
    : 0
  console.log('[TN] fullBusinessIncome=', fullBusinessIncome, 'feSalary=', salary, 'deductSalary=', deductSalary, 'exciseBase=', exciseBase, 'exciseTax=', exciseTax)

  // Franchise tax: 0.25% of net worth (minimum $100/year)
  // We don't have net worth data, so use the minimum as an estimate
  const franchiseTax = entitySubjectToFranchise ? 100 : 0

  const notes: string[] = [
    'Tennessee has no individual state income tax.',
  ]

  if (entitySubjectToFranchise) {
    const entityLabel = companyType ?? 'Entity'
    if (entitySubjectToExcise) {
      notes.push(`${entityLabel} is subject to TN Franchise & Excise Tax.`)
      if (exciseTax > 0) {
        if (deductSalary && salary > 0) {
          notes.push(`Excise Tax: 6.5% × $${exciseBase.toLocaleString()} (net earnings of $${fullBusinessIncome.toLocaleString()} minus wages of $${salary.toLocaleString()}).`)
        } else if (!deductSalary && salary > 0) {
          notes.push(`Excise Tax: 6.5% × $${exciseBase.toLocaleString()} net earnings (salary deduction not applied).`)
        } else {
          notes.push(`Excise Tax: 6.5% × $${exciseBase.toLocaleString()} net earnings.`)
        }
      } else if (fullBusinessIncome <= 0) {
        notes.push('No Excise Tax owed — business has no positive net earnings.')
      } else if (deductSalary && salary >= fullBusinessIncome) {
        notes.push('No Excise Tax owed — shareholder wages offset net earnings.')
      }
    } else {
      notes.push(`${entityLabel} is subject to TN Franchise Tax only (not Excise Tax).`)
    }
    notes.push(`Franchise Tax: 0.25% on net worth (minimum $100/year). Using minimum — actual depends on entity net worth.`)
  } else if (companyType === 'Sole-Prop') {
    notes.push('Sole proprietorships are not subject to TN Franchise & Excise Tax.')
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
