import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { ASSIGNEE_GROUPS, assigneeInitials } from '@/lib/assignees'
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

export default function NewClient() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Assignee state — mirrors ClientDetail
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([])
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Stephen: false,
    Brian: false,
  })
  const assigneeContainerRef = useRef<HTMLDivElement>(null)

  // Collapse groups when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (assigneeContainerRef.current && !assigneeContainerRef.current.contains(e.target as Node)) {
        setExpandedGroups({ Stephen: false, Brian: false })
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function toggleAssignee(name: string) {
    setSelectedAssignees(prev => {
      let next = prev.includes(name)
        ? prev.filter(n => n !== name)
        : [...prev, name]

      // Enforce: if any sub-member is selected the parent lead must also be selected.
      // This handles both the "add sub" and "remove lead while subs remain" cases.
      ASSIGNEE_GROUPS.forEach(g => {
        if (g.members.some(m => next.includes(m)) && !next.includes(g.lead)) {
          next = [...next, g.lead]
        }
      })

      return next
    })
  }

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
        assignees:      selectedAssignees,
        created_by:     user.id,
      }, { onConflict: 'company_name,created_by' })
      .select('id')
      .single()

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
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
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Assign to Staff
              <span className="text-xs font-normal text-slate-400 ml-2">Optional — can also be set later</span>
            </label>
            <div ref={assigneeContainerRef} className="flex items-start gap-3 flex-wrap">
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
