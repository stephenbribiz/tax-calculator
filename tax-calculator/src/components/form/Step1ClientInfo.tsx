import { useForm } from 'react-hook-form'
import type { Step1Data } from '@/types'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { COMPANY_TYPE_OPTIONS } from '@/constants/companyTypes'

interface Step1Props {
  defaultValues: Step1Data
  onSubmit: (data: Step1Data) => void
}

export function Step1ClientInfo({ defaultValues, onSubmit }: Step1Props) {
  const { register, handleSubmit, formState: { errors } } = useForm<Step1Data>({ defaultValues })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Company Name"
          error={errors.companyName?.message}
          {...register('companyName', { required: 'Required' })}
        />
        <Input
          label="Owner / Individual Name"
          error={errors.ownerName?.message}
          {...register('ownerName', { required: 'Required' })}
        />
      </div>

      <Select
        label="Company Type"
        options={COMPANY_TYPE_OPTIONS}
        error={errors.companyType?.message}
        {...register('companyType', { required: 'Required' })}
      />

      <div className="flex justify-end pt-2">
        <Button type="submit">Continue →</Button>
      </div>
    </form>
  )
}
