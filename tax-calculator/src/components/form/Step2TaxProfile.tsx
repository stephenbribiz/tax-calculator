import { useForm } from 'react-hook-form'
import type { Step2Data } from '@/types'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { STATE_OPTIONS } from '@/constants/states'
import { QUARTER_OPTIONS, FILING_STATUS_OPTIONS } from '@/constants/quarters'

const QUARTER_SELECT_OPTIONS = QUARTER_OPTIONS.map(q => ({
  value: q.value,
  label: `${q.label} (${q.months})`,
}))

interface Step2Props {
  defaultValues: Step2Data
  onSubmit: (data: Step2Data) => void
  onBack: () => void
}

export function Step2TaxProfile({ defaultValues, onSubmit, onBack }: Step2Props) {
  const { register, handleSubmit, formState: { errors } } = useForm<Step2Data>({ defaultValues })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Fiscal Quarter"
          options={QUARTER_SELECT_OPTIONS}
          {...register('quarter')}
        />
        <Select
          label="Filing Status"
          options={FILING_STATUS_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
          {...register('filingStatus')}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="State of Residence"
          options={STATE_OPTIONS}
          {...register('state')}
        />
        <Input
          label="Ownership Percentage (%)"
          type="number"
          min="1"
          max="100"
          hint="Owner's % share of the business"
          error={errors.ownershipPct?.message}
          {...register('ownershipPct', {
            valueAsNumber: true,
            required: 'Required',
            min: { value: 1, message: 'Must be at least 1%' },
            max: { value: 100, message: 'Cannot exceed 100%' },
          })}
        />
      </div>

      <Input
        label="Number of Dependent Children"
        type="number"
        min="0"
        hint="Qualifying children under age 17 for Child Tax Credit"
        {...register('numDependentChildren', { valueAsNumber: true, min: 0 })}
      />

      <div className="flex justify-between pt-2">
        <Button type="button" variant="secondary" onClick={onBack}>← Back</Button>
        <Button type="submit">Continue →</Button>
      </div>
    </form>
  )
}
