import type { TaxOutput, OutputOverrides } from '@/types'

/**
 * Merges manual overrides on top of a calculated TaxOutput.
 * Only the fields present in `overrides` are replaced — everything else
 * stays as calculated. Dependent totals (totalTaxOwed, netAmountDue) are
 * recomputed from the resolved federal/state figures so they remain consistent.
 */
export function applyOverrides(base: TaxOutput, overrides: OutputOverrides): TaxOutput {
  const totalFederalOwed = overrides.totalFederalOwed ?? base.totalFederalOwed
  const totalStateOwed   = overrides.totalStateOwed   ?? base.totalStateOwed
  const totalTaxOwed     = totalFederalOwed + totalStateOwed
  const netAmountDue     = overrides.netAmountDue ?? Math.max(0, totalTaxOwed - base.priorEstimatesPaid)

  return {
    ...base,
    qbiDeduction:    overrides.qbiDeduction ?? base.qbiDeduction,
    totalFederalOwed,
    totalStateOwed,
    totalTaxOwed,
    netAmountDue,
  }
}
