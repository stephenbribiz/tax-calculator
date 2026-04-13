import type { StateResult, StateCode, FilingStatus } from '@/types'
import { calculateTN } from './TN'
import { calculateCA } from './CA'
import { calculateGA } from './GA'
import { calculateNC } from './NC'
import { calculateNY } from './NY'
import { calculateTX } from './TX'
import { calculateAZ } from './AZ'
import { calculateFL } from './FL'

export interface StateCalcInput {
  state: StateCode
  allocatedBusinessIncome: number
  taxableIncome: number
  filingStatus: FilingStatus
  year: number
}

export function calculateStateTax(input: StateCalcInput): StateResult {
  const { state, allocatedBusinessIncome, taxableIncome, filingStatus, year } = input

  switch (state) {
    case 'TN': return calculateTN(allocatedBusinessIncome, taxableIncome, filingStatus, year)
    case 'CA': return calculateCA(allocatedBusinessIncome, taxableIncome, filingStatus, year)
    case 'GA': return calculateGA(allocatedBusinessIncome, taxableIncome, filingStatus, year)
    case 'NC': return calculateNC(allocatedBusinessIncome, taxableIncome, filingStatus, year)
    case 'NY': return calculateNY(allocatedBusinessIncome, taxableIncome, filingStatus, year)
    case 'TX': return calculateTX(allocatedBusinessIncome, taxableIncome, filingStatus, year)
    case 'AZ': return calculateAZ(allocatedBusinessIncome, taxableIncome, filingStatus, year)
    case 'FL': return calculateFL(allocatedBusinessIncome, taxableIncome, filingStatus, year)
    default: {
      const _exhaustive: never = state
      throw new Error(`No state tax module for: ${_exhaustive}`)
    }
  }
}
