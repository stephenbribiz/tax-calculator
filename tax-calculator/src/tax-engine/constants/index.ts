import type { FederalTaxData } from '@/types'
import { TAX_DATA_2024 } from './2024'
import { TAX_DATA_2025 } from './2025'
import { TAX_DATA_2026 } from './2026'

const TAX_DATA: Record<number, FederalTaxData> = {
  2024: TAX_DATA_2024,
  2025: TAX_DATA_2025,
  2026: TAX_DATA_2026,
}

export function getTaxDataByYear(year: number): FederalTaxData {
  const data = TAX_DATA[year]
  if (!data) throw new Error(`No tax data available for year ${year}`)
  return data
}

export { TAX_DATA_2024, TAX_DATA_2025, TAX_DATA_2026 }
