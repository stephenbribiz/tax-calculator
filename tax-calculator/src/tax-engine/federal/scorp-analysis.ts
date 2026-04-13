import type { SCorpAnalysis } from '@/types'
import { calculateFICA } from './fica'

// IRS requires "reasonable compensation" for S-Corp shareholder-employees.
// The 40% threshold is a commonly-used practice guideline, not an IRS-mandated number.
// The analysis surfaces a warning when salary falls below this threshold.
const REASONABLE_SALARY_THRESHOLD = 0.40

export function analyzeReasonableComp(
  allocatedNetProfit: number,
  currentSalary: number,
  year: number,
): SCorpAnalysis {
  const recommendedMinSalary = Math.max(0, allocatedNetProfit * REASONABLE_SALARY_THRESHOLD)
  const isSalaryReasonable = currentSalary >= recommendedMinSalary || allocatedNetProfit <= 0

  const currentFICAResult    = calculateFICA(currentSalary, year)
  const recommendedFICAResult = calculateFICA(recommendedMinSalary, year)

  const currentFICA     = currentFICAResult.totalFICA
  const recommendedFICA = recommendedFICAResult.totalFICA
  const ficaGap         = Math.max(0, recommendedFICA - currentFICA)

  let warningMessage: string | null = null
  if (!isSalaryReasonable) {
    warningMessage = `Current shareholder salary ($${currentSalary.toLocaleString()}) may be below IRS reasonable compensation guidelines. Consider increasing to at least $${Math.round(recommendedMinSalary).toLocaleString()}.`
  }

  return {
    currentSalary,
    recommendedMinSalary,
    currentFICA,
    recommendedFICA,
    ficaGap,
    isSalaryReasonable,
    warningMessage,
  }
}
