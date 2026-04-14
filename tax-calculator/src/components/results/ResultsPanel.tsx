import type { TaxInput, TaxOutput } from '@/types'
import { IncomeSummary } from './IncomeSummary'
import { FederalBreakdown } from './FederalBreakdown'
import { SCorpAnalysis } from './SCorpAnalysis'
import { StateBreakdown } from './StateBreakdown'
import { TaxSummary } from './TaxSummary'

interface Props {
  input: TaxInput
  output: TaxOutput
  onAdjustedSalaryChange?: (value: number) => void
}

export function ResultsPanel({ input, output, onAdjustedSalaryChange }: Props) {
  return (
    <div className="space-y-5">
      <TaxSummary input={input} output={output} />
      <IncomeSummary input={input} output={output} />
      <FederalBreakdown input={input} output={output} />
      {output.scorp && (
        <SCorpAnalysis scorp={output.scorp} onAdjustedSalaryChange={onAdjustedSalaryChange} />
      )}
      <StateBreakdown input={input} output={output} />
    </div>
  )
}
