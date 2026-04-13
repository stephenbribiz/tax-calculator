import type { FederalTaxData } from '@/types'

// 2026 figures are projected based on IRS inflation adjustments (~2.8% from 2025).
// Update these when IRS Rev Proc is published (typically October/November 2025).
export const TAX_DATA_2026: FederalTaxData = {
  brackets: {
    Single: [
      { upTo: 12250,   rate: 0.10 },
      { upTo: 49850,   rate: 0.12 },
      { upTo: 106250,  rate: 0.22 },
      { upTo: 202850,  rate: 0.24 },
      { upTo: 257550,  rate: 0.32 },
      { upTo: 643950,  rate: 0.35 },
      { upTo: Infinity, rate: 0.37 },
    ],
    MFJ: [
      { upTo: 24500,   rate: 0.10 },
      { upTo: 99700,   rate: 0.12 },
      { upTo: 212500,  rate: 0.22 },
      { upTo: 405700,  rate: 0.24 },
      { upTo: 515100,  rate: 0.32 },
      { upTo: 772650,  rate: 0.35 },
      { upTo: Infinity, rate: 0.37 },
    ],
    HOH: [
      { upTo: 17500,   rate: 0.10 },
      { upTo: 66700,   rate: 0.12 },
      { upTo: 106250,  rate: 0.22 },
      { upTo: 202850,  rate: 0.24 },
      { upTo: 257550,  rate: 0.32 },
      { upTo: 643950,  rate: 0.35 },
      { upTo: Infinity, rate: 0.37 },
    ],
    MFS: [
      { upTo: 12250,   rate: 0.10 },
      { upTo: 49850,   rate: 0.12 },
      { upTo: 106250,  rate: 0.22 },
      { upTo: 202850,  rate: 0.24 },
      { upTo: 257550,  rate: 0.32 },
      { upTo: 386325,  rate: 0.35 },
      { upTo: Infinity, rate: 0.37 },
    ],
  },
  standardDeduction: {
    Single: 15450,
    MFJ:    30900,
    HOH:    23150,
    MFS:    15450,
  },
  ssWageBase: 181200,
  qbiPhaseOutStart: { Single: 202850, MFJ: 405700 },
  qbiPhaseOutEnd:   { Single: 252850, MFJ: 455700 },
  childTaxCredit: {
    creditPerChild: 2000,
    phaseOutStart: { Single: 200000, MFJ: 400000 },
    phaseOutIncrement: 50,
  },
}
