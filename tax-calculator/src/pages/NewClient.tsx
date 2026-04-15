import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '@/hooks/useAuth'
import { useProfiles } from '@/hooks/useProfiles'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { COMPANY_TYPE_OPTIONS } from '@/constants/companyTypes'
import { STATE_OPTIONS } from '@/constants/states'
import { FILING_STATUS_OPTIONS } from '@/constants/quarters'
import type { CompanyType, FilingStatus, StateCode } from '@/types'

interface ClientFormData {
  companyName: string
  ownerName: string
  clientCode: string
  companyType: CompanyType
  state: StateCode
  filingStatus: FilingStatus
  ownershipPct: number
  numDependents: number
  notes: string
}

function displayName(profile: { full_name: string; email: string }): string {
  return profile.full_name?.trim() || profile.email?.split('@')[0] || 'Unknown'
}

function initials(profile: { full_name: string; email: string }): string {
  const name = displayName(profile)
  const parts = name.split(' ')
  return (parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)).toUpperCase()
}

export default function NewClient() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { profiles } = useProfiles()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedStaff, setSelectedStaff] = useState<string[]>([])

  const { register, handleSubmit, formState: { errors } } = useForm<ClientFormData>({
    defaultValues: {
      companyName: '',
      ownerName: '',
      clientCode: '',
      companyType: 'S-Corp',
      state: 'TN',
      filingStatus: 'Single',
      ownershipPct: 100,
      numDependents: 0,
      notes: '',
    },
  })

  function toggleStaff(userId: string) {
    setSelectedStaff(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

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
        client_code:    data.clientCode ? data.clientCode.toUpperCase() : null,
        notes:          data.notes || null,
        created_by:     user.id,
      }, { onConflict: 'company_name,created_by' })
      .select('id')
      .single()

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    // Insert staff assignments
    if (selectedStaff.length > 0 && client) {
      await supabase.from('client_assignments').insert(
        selectedStaff.map(userId => ({
          client_id:   client.id,
          user_id:     userId,
          assigned_by: user.id,
        }))
      )
    }

    toast('Client saved')
    navigate(`/clients/${client!.id}`)
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Company Type"
              options={COMPANY_TYPE_OPTIONS}
              error={errors.companyType?.message}
              {...register('companyType', { required: 'Required' })}
            />
            <Input
              label="Client Code"
              placeholder="e.g., GBG"
              hint="2–6 letter code for bulk upload matching"
              maxLength={6}
              style={{ textTransform: 'uppercase' }}
              error={errors.clientCode?.message}
              {...register('clientCode', {
                pattern: {
                  value: /^[A-Za-z]{0,6}$/,
                  message: '2–6 letters only',
                },
                validate: v => !v || v.length >= 2 || 'Must be 2–6 letters',
              })}
            />
          </div>

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

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              placeholder="Optional notes about this client..."
              {...register('notes')}
            />
          </div>

          {/* Staff Assignment */}
          {profiles.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Assign to Staff
                <span className="text-xs font-normal text-slate-400 ml-2">Optional — can also be set later</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {profiles.map(p => {
                  const selected = selectedStaff.includes(p.id)
                  const isMe = p.id === user?.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleStaff(p.id)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        selected
                          ? 'bg-orange-600 border-orange-600 text-white'
                          : 'bg-white border-slate-300 text-slate-700 hover:border-orange-400 hover:text-orange-600'
                      }`}
                    >
                      <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold ${
                        selected ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {initials(p)}
                      </span>
                      {displayName(p)}
                      {isMe && <span className="opacity-60 text-xs">(me)</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

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
