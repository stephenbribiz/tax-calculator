import type { FilingStatus, FederalTaxData } from '@/types'

export function calculateChildTaxCredit(
  numChildren: number,
  agi: number,
  filingStatus: FilingStatus,
  taxData: FederalTaxData,
): number {
  if (numChildren <= 0) return 0

  const { creditPerChild, phaseOutStart, phaseOutIncrement } = taxData.childTaxCredit
  const key = filingStatus === 'MFJ' ? 'MFJ' : 'Single'

  const fullCredit = numChildren * creditPerChild
  const threshold = phaseOutStart[key]

  if (agi <= threshold) return fullCredit

  // $50 reduction per $1,000 (or fraction thereof) of AGI over threshold
  const excess = agi - threshold
  const reductions = Math.ceil(excess / 1000) * phaseOutIncrement
  return Math.max(0, fullCredit - reductions)
}
