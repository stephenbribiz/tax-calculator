import type { CompanyType } from '@/types'
import { getTaxDataByYear } from '../constants'

export interface SETaxResult {
  seTax: number
  deductibleHalf: number
}

// SE tax applies to sole props, single-member LLCs, partnerships, and regular LLCs.
// S-Corp shareholders pay FICA only on their W-2 salary (handled separately in fica.ts).
export function calculateSETax(netSelfEmploymentIncome: number, year: number, companyType: CompanyType): SETaxResult {
  const isScorp = companyType === 'S-Corp'
  if (isScorp || netSelfEmploymentIncome <= 0) {
    return { seTax: 0, deductibleHalf: 0 }
  }

  const { ssWageBase } = getTaxDataByYear(year)

  // SE income = 92.35% of net (IRS Form SE)
  const seIncome = netSelfEmploymentIncome * 0.9235

  // Social security (12.4%) up to wage base + Medicare (2.9%) on all
  const ssIncome = Math.min(seIncome, ssWageBase)
  const ssTax = ssIncome * 0.124
  const medicareTax = seIncome * 0.029

  // Additional 0.9% Medicare on high earners (over $200k single / $250k MFJ)
  // We apply conservatively at $200k threshold for estimate purposes
  const additionalMedicare = seIncome > 200000 ? (seIncome - 200000) * 0.009 : 0

  const seTax = ssTax + medicareTax + additionalMedicare
  const deductibleHalf = (ssTax + medicareTax) / 2

  return { seTax, deductibleHalf }
}
