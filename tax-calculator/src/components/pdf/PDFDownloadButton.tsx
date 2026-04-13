import { useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import type { TaxInput, TaxOutput } from '@/types'
import { TaxReportDocument } from './TaxReportDocument'
import { Button } from '@/components/ui/Button'

interface Props {
  input: TaxInput
  output: TaxOutput
}

export function PDFDownloadButton({ input, output }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      const blob = await pdf(<TaxReportDocument input={input} output={output} />).toBlob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      const filename = `TaxPlan_${input.ownerName.replace(/\s+/g, '_')}_${input.quarter}_${input.taxYear}.pdf`
      a.href     = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="secondary" loading={loading} onClick={handleDownload}>
      {loading ? 'Generating PDF…' : '↓ Download PDF'}
    </Button>
  )
}
