import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { ASSIGNEE_GROUPS, assigneeInitials } from '@/lib/assignees'
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

  // Assignee state — same collapsible UI as NewClient.tsx
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([])
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Stephen: false,
    Brian: false,
  })

  function toggleAssignee(name: string) {
    setSelectedAssignees(prev => {
      if (prev.includes(name)) {
        // Removing a parent cascades to remove all its sub-members
        const group = ASSIGNEE_GROUPS.find(g => g.lead === name)
        return prev.filter(n => n !== name && !group?.members.includes(n))
      }
      // Adding a sub-member also adds the parent lead
      const next = [...prev, name]
      const parentGroup = ASSIGNEE_GROUPS.find(g => g.members.includes(name))
      if (parentGroup && !next.includes(parentGroup.lead)) {
        next.push(parentGroup.lead)
      }
      return next
    })
  }

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
        assignees:      selectedAssignees,
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
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

          {/* Staff Assignment */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Assign to Staff
              <span className="text-xs font-normal text-slate-400 ml-2">Optional</span>
            </label>
            <div className="flex items-start gap-3 flex-wrap">
              {ASSIGNEE_GROUPS.map(group => {
                const leadActive = selectedAssignees.includes(group.lead)
                const activeMembers = group.members.filter(m => selectedAssignees.includes(m))
                const isOpen = expandedGroups[group.lead] ?? false

                return (
                  <div key={group.lead} className="flex flex-col gap-1.5">
                    {/* Lead chip + chevron */}
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => toggleAssignee(group.lead)}
                        className={`inline-flex items-center gap-1.5 rounded-l-full pl-1.5 pr-2.5 py-1 text-xs font-semibold transition-colors ${
                          leadActive
                            ? 'bg-orange-500 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${
                          leadActive ? 'bg-orange-400 text-white' : 'bg-slate-300 text-slate-600'
                        }`}>
                          {assigneeInitials(group.lead)}
                        </span>
                        {group.lead}
                        {!isOpen && activeMembers.length > 0 && (
                          <span className="ml-0.5 bg-orange-300 text-orange-900 rounded-full text-[9px] font-bold px-1">
                            +{activeMembers.length}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedGroups(prev => ({ ...prev, [group.lead]: !isOpen }))}
                        title={isOpen ? 'Collapse' : `Expand ${group.lead}'s team`}
                        className={`rounded-r-full px-1.5 py-1 transition-colors border-l ${
                          leadActive
                            ? 'bg-orange-500 text-orange-100 border-orange-400 hover:bg-orange-600'
                            : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        <svg
                          className={`w-3 h-3 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {/* Sub-members — stacked vertically */}
                    {isOpen && (
                      <div className="flex flex-col gap-1 ml-2">
                        {group.members.map(name => {
                          const active = selectedAssignees.includes(name)
                          return (
                            <button
                              key={name}
                              type="button"
                              onClick={() => toggleAssignee(name)}
                              className={`inline-flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-0.5 text-xs font-medium transition-colors ${
                                active
                                  ? 'bg-orange-400 text-white'
                                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                              }`}
                            >
                              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0 ${
                                active ? 'bg-orange-300 text-white' : 'bg-slate-200 text-slate-500'
                              }`}>
                                {assigneeInitials(name)}
                              </span>
                              {name}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
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
