import type { BracketTier } from '@/types'

export interface BracketResult {
  tax: number
  marginalRate: number
  effectiveRate: number
}

export function applyProgressiveBrackets(income: number, brackets: BracketTier[]): BracketResult {
  if (income <= 0) return { tax: 0, marginalRate: brackets[0].rate, effectiveRate: 0 }

  let tax = 0
  let prev = 0
  let marginalRate = brackets[0].rate

  for (const bracket of brackets) {
    if (income <= prev) break
    const taxableInBracket = Math.min(income, bracket.upTo) - prev
    tax += taxableInBracket * bracket.rate
    marginalRate = bracket.rate
    prev = bracket.upTo
    if (income <= bracket.upTo) break
  }

  return {
    tax,
    marginalRate,
    effectiveRate: income > 0 ? tax / income : 0,
  }
}
