import type { FederalTaxData } from '@/types'

export const TAX_DATA_2024: FederalTaxData = {
  brackets: {
    Single: [
      { upTo: 11600,   rate: 0.10 },
      { upTo: 47150,   rate: 0.12 },
      { upTo: 100525,  rate: 0.22 },
      { upTo: 191950,  rate: 0.24 },
      { upTo: 243725,  rate: 0.32 },
      { upTo: 609350,  rate: 0.35 },
      { upTo: Infinity, rate: 0.37 },
    ],
    MFJ: [
      { upTo: 23200,   rate: 0.10 },
      { upTo: 94300,   rate: 0.12 },
      { upTo: 201050,  rate: 0.22 },
      { upTo: 383900,  rate: 0.24 },
      { upTo: 487450,  rate: 0.32 },
      { upTo: 731200,  rate: 0.35 },
      { upTo: Infinity, rate: 0.37 },
    ],
    HOH: [
      { upTo: 16550,   rate: 0.10 },
      { upTo: 63100,   rate: 0.12 },
      { upTo: 100500,  rate: 0.22 },
      { upTo: 191950,  rate: 0.24 },
      { upTo: 243700,  rate: 0.32 },
      { upTo: 609350,  rate: 0.35 },
      { upTo: Infinity, rate: 0.37 },
    ],
    MFS: [
      { upTo: 11600,   rate: 0.10 },
      { upTo: 47150,   rate: 0.12 },
      { upTo: 100525,  rate: 0.22 },
      { upTo: 191950,  rate: 0.24 },
      { upTo: 243725,  rate: 0.32 },
      { upTo: 365600,  rate: 0.35 },
      { upTo: Infinity, rate: 0.37 },
    ],
  },
  standardDeduction: {
    Single: 14600,
    MFJ:    29200,
    HOH:    21900,
    MFS:    14600,
  },
  ssWageBase: 168600,
  qbiPhaseOutStart: { Single: 191950, MFJ: 383900 },
  qbiPhaseOutEnd:   { Single: 241950, MFJ: 483900 },
  childTaxCredit: {
    creditPerChild: 2000,
    phaseOutStart: { Single: 200000, MFJ: 400000 },
    phaseOutIncrement: 50,
  },
}
