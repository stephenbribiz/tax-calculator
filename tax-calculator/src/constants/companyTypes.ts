import type { CompanyType } from '@/types'

export const COMPANY_TYPE_OPTIONS: { value: CompanyType; label: string }[] = [
  { value: 'S-Corp',            label: 'S-Corporation' },
  { value: 'Single-Member-LLC', label: 'Single Member LLC' },
  { value: 'LLC',               label: 'Multi-Member LLC' },
  { value: 'Partnership',       label: 'Partnership' },
  { value: 'Sole-Prop',         label: 'Sole Proprietorship' },
]
