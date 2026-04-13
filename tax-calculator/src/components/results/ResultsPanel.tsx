import type { TaxInput, TaxOutput } from '@/types'
import { IncomeSummary } from './IncomeSummary'
import { FederalBreakdown } from './FederalBreakdown'
import { SCorpAnalysis } from './SCorpAnalysis'
import { StateBreakdown } from './StateBreakdown'
import { TaxSummary } from './TaxSummary'

interface Props {
  input: TaxInput
  output: TaxOutput
}

export function ResultsPanel({ input, output }: Props) {
  return (
    <div className="space-y-4">
      <TaxSummary input={input} output={output} />
      <IncomeSummary input={input} output={output} />
      <FederalBreakdown input={input} output={output} />
      {output.scorp && <SCorpAnalysis scorp={output.scorp} />}
      <StateBreakdown input={input} output={output} />
    </div>
  )
}
