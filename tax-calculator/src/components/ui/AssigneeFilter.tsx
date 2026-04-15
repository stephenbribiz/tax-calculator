import { ASSIGNEE_GROUPS } from '@/lib/assignees'

interface AssigneeFilterProps {
  selected: string[]           // names currently checked; empty = "All"
  onToggle: (name: string) => void
  onClear: () => void
}

export function AssigneeFilter({ selected, onToggle, onClear }: AssigneeFilterProps) {
  const isAll = selected.length === 0

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-xs text-slate-400 font-medium">Staff:</span>

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

      {/* One group per lead */}
      {ASSIGNEE_GROUPS.map(group => {
        const allNames = [group.lead, ...group.members]
        const groupActive = allNames.some(n => selected.includes(n))

        return (
          <div key={group.lead} className="flex items-center gap-1">
            {/* Lead / group toggle — clicking selects/deselects the whole group */}
            <button
              onClick={() => {
                const allSelected = allNames.every(n => selected.includes(n))
                if (allSelected) {
                  // deselect the whole group
                  allNames.forEach(n => {
                    if (selected.includes(n)) onToggle(n)
                  })
                } else {
                  // select any that aren't already on
                  allNames.forEach(n => {
                    if (!selected.includes(n)) onToggle(n)
                  })
                }
              }}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                allNames.every(n => selected.includes(n))
                  ? 'bg-orange-600 text-white'
                  : groupActive
                    ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {group.lead}
            </button>

            {/* Members */}
            {group.members.map(name => {
              const active = selected.includes(name)
              return (
                <button
                  key={name}
                  onClick={() => onToggle(name)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
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
        )
      })}
    </div>
  )
}
