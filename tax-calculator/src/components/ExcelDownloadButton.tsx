import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { TaxInput, TaxOutput } from '@/types'

interface Props {
  input: TaxInput
  output: TaxOutput
}

export function ExcelDownloadButton({ input, output }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const { exportTaxPlanToExcel } = await import('@/lib/exportToExcel')
      await exportTaxPlanToExcel(input, output)
    } catch (err) {
      console.error('Excel export failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="secondary" onClick={handleClick} loading={loading}>
      ↓ Excel
    </Button>
  )
}
