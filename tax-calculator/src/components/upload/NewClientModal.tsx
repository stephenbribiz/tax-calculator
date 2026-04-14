import { useState } from 'react'
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
import type { DbClient } from '@/lib/supabase'

interface NewClientModalProps {
  clientCode: string
  onCreated: (client: DbClient) => void
  onCancel: () => void
}

interface ClientFormData {
  companyName: string
  ownerName: string
  companyType: CompanyType
  state: StateCode
  filingStatus: FilingStatus
  ownershipPct: number
  numDependents: number
}

export function NewClientModal({ clientCode, onCreated, onCancel }: NewClientModalProps) {
  const { user } = useAuth()
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
      .insert({
        company_name:   data.companyName,
        company_type:   data.companyType,
        owner_name:     data.ownerName,
        state:          data.state,
        filing_status:  data.filingStatus,
        ownership_pct:  data.ownershipPct,
        num_dependents: data.numDependents,
        client_code:    clientCode,
        created_by:     user.id,
      })
      .select('*')
      .single()

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    onCreated(client as DbClient)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-slate-900">New Client</h3>
          <p className="text-sm text-slate-500 mt-1">
            No client found with code <span className="font-mono font-bold text-orange-600">{clientCode}</span>. Create one now.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Company Name"
              error={errors.companyName?.message}
              {...register('companyName', { required: 'Required' })}
            />
            <Input
              label="Owner Name"
              error={errors.ownerName?.message}
              {...register('ownerName', { required: 'Required' })}
            />
          </div>

          <Select
            label="Company Type"
            options={COMPANY_TYPE_OPTIONS}
            {...register('companyType', { required: 'Required' })}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="State"
              options={STATE_OPTIONS}
              {...register('state')}
            />
            <Select
              label="Filing Status"
              options={FILING_STATUS_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
              {...register('filingStatus')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Ownership %"
              type="number"
              min="1"
              max="100"
              {...register('ownershipPct', { valueAsNumber: true, min: 1, max: 100 })}
            />
            <Input
              label="Dependent Children"
              type="number"
              min="0"
              {...register('numDependents', { valueAsNumber: true, min: 0 })}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onCancel}>Skip</Button>
            <Button type="submit" loading={saving}>Create Client</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
