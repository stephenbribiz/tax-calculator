import type { FederalTaxData } from '@/types'

export const TAX_DATA_2025: FederalTaxData = {
  brackets: {
    Single: [
      { upTo: 11925,   rate: 0.10 },
      { upTo: 48475,   rate: 0.12 },
      { upTo: 103350,  rate: 0.22 },
      { upTo: 197300,  rate: 0.24 },
      { upTo: 250525,  rate: 0.32 },
      { upTo: 626350,  rate: 0.35 },
      { upTo: Infinity, rate: 0.37 },
    ],
    MFJ: [
      { upTo: 23850,   rate: 0.10 },
      { upTo: 96950,   rate: 0.12 },
      { upTo: 206700,  rate: 0.22 },
      { upTo: 394600,  rate: 0.24 },
      { upTo: 501050,  rate: 0.32 },
      { upTo: 751600,  rate: 0.35 },
      { upTo: Infinity, rate: 0.37 },
    ],
    HOH: [
      { upTo: 17000,   rate: 0.10 },
      { upTo: 64850,   rate: 0.12 },
      { upTo: 103350,  rate: 0.22 },
      { upTo: 197300,  rate: 0.24 },
      { upTo: 250500,  rate: 0.32 },
      { upTo: 626350,  rate: 0.35 },
      { upTo: Infinity, rate: 0.37 },
    ],
    MFS: [
      { upTo: 11925,   rate: 0.10 },
      { upTo: 48475,   rate: 0.12 },
      { upTo: 103350,  rate: 0.22 },
      { upTo: 197300,  rate: 0.24 },
      { upTo: 250525,  rate: 0.32 },
      { upTo: 375800,  rate: 0.35 },
      { upTo: Infinity, rate: 0.37 },
    ],
  },
  standardDeduction: {
    Single: 15000,
    MFJ:    30000,
    HOH:    22500,
    MFS:    15000,
  },
  ssWageBase: 176100,
  qbiPhaseOutStart: { Single: 197300, MFJ: 394600 },
  qbiPhaseOutEnd:   { Single: 247300, MFJ: 444600 },
  childTaxCredit: {
    creditPerChild: 2000,
    phaseOutStart: { Single: 200000, MFJ: 400000 },
    phaseOutIncrement: 50,
  },
}
