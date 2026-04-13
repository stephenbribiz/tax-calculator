import type { Quarter } from '@/types'

export const QUARTER_OPTIONS: { value: Quarter; label: string; months: string }[] = [
  { value: 'Q1', label: 'Q1', months: 'Jan – Mar' },
  { value: 'Q2', label: 'Q2', months: 'Jan – Jun' },
  { value: 'Q3', label: 'Q3', months: 'Jan – Sep' },
  { value: 'Q4', label: 'Q4', months: 'Full Year' },
]

export const PRORATION_MAP: Record<Quarter, number> = {
  Q1: 0.25,
  Q2: 0.50,
  Q3: 0.75,
  Q4: 1.00,
}

export const FILING_STATUS_OPTIONS = [
  { value: 'Single', label: 'Single' },
  { value: 'MFJ',    label: 'Married Filing Jointly' },
  { value: 'HOH',    label: 'Head of Household' },
  { value: 'MFS',    label: 'Married Filing Separately' },
] as const
