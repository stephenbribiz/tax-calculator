import type { TaxInput, TaxOutput } from '@/types'
import { IncomeSummary } from './IncomeSummary'
import { FederalBreakdown } from './FederalBreakdown'
import { SCorpAnalysis } from './SCorpAnalysis'
import { StateBreakdown } from './StateBreakdown'
import { TaxSummary } from './TaxSummary'

interface PayrollAdjState {
  adjustedSalary: number
  payrollAdjConfirmed: boolean
  shareholderSalary: number
}

interface Props {
  input: TaxInput
  output: TaxOutput
  /** Combined callback for salary change + confirm/unconfirm */
  onPayrollAdj?: (adjustedSalary: number, confirmed: boolean) => void
  /** The raw form-state values (unaffected by gating) for SCorpAnalysis preview */
  payrollAdjState?: PayrollAdjState
  /** Legacy: accepted but unused — ReportView passes nothing here */
  onAdjustedSalaryChange?: (value: number) => void
}

export function ResultsPanel({ input, output, onPayrollAdj, payrollAdjState }: Props) {
  return (
    <div className="space-y-5">
      <TaxSummary input={input} output={output} />
      <IncomeSummary input={input} output={output} />
      <FederalBreakdown input={input} output={output} />
      {output.scorp && (
        <SCorpAnalysis
          scorp={output.scorp}
          taxYear={input.taxYear}
          payrollAdjState={payrollAdjState}
          onPayrollAdj={onPayrollAdj}
        />
      )}
      <StateBreakdown input={input} output={output} />
    </div>
  )
}
