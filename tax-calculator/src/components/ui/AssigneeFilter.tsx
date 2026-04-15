import { useState } from 'react'
import { ASSIGNEE_GROUPS } from '@/lib/assignees'

interface AssigneeFilterProps {
  selected: string[]           // names currently toggled on; empty = "All"
  onToggle: (name: string) => void
  onClear: () => void
}

export function AssigneeFilter({ selected, onToggle, onClear }: AssigneeFilterProps) {
  // Track which groups are expanded
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const isAll = selected.length === 0

  function toggleExpand(lead: string) {
    setExpanded(prev => ({ ...prev, [lead]: !prev[lead] }))
  }

  return (
    <div className="flex items-start gap-2 flex-wrap">
      <span className="text-xs text-slate-400 font-medium mt-1.5">Staff:</span>

      {/* All */}
      <button
        onClick={onClear}
        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
          isAll
            ? 'bg-slate-800 text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
      >
        All
      </button>

      {/* Groups */}
      {ASSIGNEE_GROUPS.map(group => {
        const isOpen = expanded[group.lead] ?? false
        const leadActive = selected.includes(group.lead)
        const anySubActive = group.members.some(m => selected.includes(m))

        return (
          <div key={group.lead} className="flex flex-col gap-1">
            {/* Lead row */}
            <div className="flex items-center gap-0.5">
              {/* Lead toggle */}
              <button
                onClick={() => onToggle(group.lead)}
                className={`px-2.5 py-1 rounded-l-full text-xs font-semibold transition-colors ${
                  leadActive
                    ? 'bg-orange-600 text-white'
                    : anySubActive
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {group.lead}
              </button>
              {/* Expand chevron */}
              <button
                onClick={() => toggleExpand(group.lead)}
                title={isOpen ? 'Collapse' : 'Expand'}
                className={`px-1.5 py-1 rounded-r-full text-xs transition-colors border-l ${
                  leadActive
                    ? 'bg-orange-600 text-white border-orange-500'
                    : anySubActive
                      ? 'bg-orange-100 text-orange-600 border-orange-200'
                      : 'bg-slate-100 text-slate-400 hover:bg-slate-200 border-slate-200'
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

            {/* Sub-members (when expanded) */}
            {isOpen && (
              <div className="flex items-center gap-1 ml-1">
                {group.members.map(name => {
                  const active = selected.includes(name)
                  return (
                    <button
                      key={name}
                      onClick={() => onToggle(name)}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                        active
                          ? 'bg-orange-500 text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
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
  )
}
