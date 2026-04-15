import type { DbProfile } from '@/lib/supabase'

interface UserFilterProps {
  profiles: DbProfile[]
  selected: string[]          // selected user IDs; empty = "All"
  onToggle: (userId: string) => void
  onClear: () => void
  currentUserId?: string      // highlight "Mine" shortcut
}

function initials(profile: DbProfile): string {
  const name = profile.full_name || profile.email || '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function displayName(profile: DbProfile): string {
  if (profile.full_name?.trim()) return profile.full_name.trim()
  return profile.email?.split('@')[0] ?? 'Unknown'
}

export function UserFilter({ profiles, selected, onToggle, onClear, currentUserId }: UserFilterProps) {
  if (profiles.length === 0) return null

  const isAll = selected.length === 0

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-slate-400 font-medium mr-0.5">Staff:</span>

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

      {profiles.map(profile => {
        const active = selected.includes(profile.id)
        const isMe = profile.id === currentUserId
        return (
          <button
            key={profile.id}
            onClick={() => onToggle(profile.id)}
            title={profile.email}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              active
                ? 'bg-orange-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${
              active ? 'bg-orange-500 text-white' : 'bg-slate-300 text-slate-700'
            }`}>
              {initials(profile)}
            </span>
            {displayName(profile)}
            {isMe && <span className="opacity-60">(me)</span>}
          </button>
        )
      })}
    </div>
  )
}
