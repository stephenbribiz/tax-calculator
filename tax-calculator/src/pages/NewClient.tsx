import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { COMPANY_TYPE_OPTIONS } from '@/constants/companyTypes'
import { STATE_OPTIONS } from '@/constants/states'
import { FILING_STATUS_OPTIONS } from '@/constants/quarters'
import type { CompanyType, FilingStatus, StateCode } from '@/types'

interface ClientFormData {
  companyName: string
  ownerName: string
  companyType: CompanyType
  state: StateCode
  filingStatus: FilingStatus
  ownershipPct: number
  numDependents: number
}

export default function NewClient() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<ClientFormData>({
    defaultValues: {
      companyName: '',
      ownerName: '',
      companyType: 'S-Corp',
      state: 'TN',
      filingStatus: 'Single',
      ownershipPct: 100,
      numDependents: 0,
    },
  })

  async function onSubmit(data: ClientFormData) {
    if (!user) return
    setSaving(true)
    setError(null)

    const { data: client, error: insertError } = await supabase
      .from('clients')
      .upsert({
        company_name:   data.companyName,
        company_type:   data.companyType,
        owner_name:     data.ownerName,
        state:          data.state,
        filing_status:  data.filingStatus,
        ownership_pct:  data.ownershipPct,
        num_dependents: data.numDependents,
        created_by:     user.id,
      }, { onConflict: 'company_name,created_by' })
      .select('id')
      .single()

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    navigate(`/clients/${client.id}`)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">New Client</h1>
        <p className="text-sm text-slate-500 mt-1">
          Set up the client profile. This info carries over to every quarterly estimate.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="State of Residence"
              options={STATE_OPTIONS}
              {...register('state')}
            />
            <Select
              label="Filing Status"
              options={FILING_STATUS_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
              {...register('filingStatus')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <Input
              label="Number of Dependent Children"
              type="number"
              min="0"
              hint="Qualifying children under 17 for Child Tax Credit"
              {...register('numDependents', { valueAsNumber: true, min: 0 })}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end pt-2">
            <Button type="submit" loading={saving}>Save Client</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
