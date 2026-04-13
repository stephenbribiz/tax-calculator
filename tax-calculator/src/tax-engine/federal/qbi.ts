import type { FilingStatus, FederalTaxData } from '@/types'

// QBI deduction: 20% of qualified business income
// Subject to income-based phase-out above thresholds.
// Simplified: assumes the business is not an SSTB (specified service trade or business).
// For SSTBs (law, consulting, finance, health, etc.) fully phases out at the qbiPhaseOutEnd threshold.
export function calculateQBI(
  qualifiedBusinessIncome: number,
  totalTaxableIncome: number,
  filingStatus: FilingStatus,
  taxData: FederalTaxData,
): number {
  if (qualifiedBusinessIncome <= 0) return 0

  const key = filingStatus === 'MFJ' ? 'MFJ' : 'Single'
  const { qbiPhaseOutStart, qbiPhaseOutEnd } = taxData

  const phaseOutStart = qbiPhaseOutStart[key]
  const phaseOutEnd   = qbiPhaseOutEnd[key]

  const baseDeduction = qualifiedBusinessIncome * 0.20

  if (totalTaxableIncome <= phaseOutStart) {
    return baseDeduction
  }

  if (totalTaxableIncome >= phaseOutEnd) {
    return 0
  }

  // Linear phase-out between start and end thresholds
  const phaseOutRatio = (totalTaxableIncome - phaseOutStart) / (phaseOutEnd - phaseOutStart)
  return baseDeduction * (1 - phaseOutRatio)
}
