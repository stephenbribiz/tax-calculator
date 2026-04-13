import { cn } from '@/lib/utils'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  hint?: string
}

export function Toggle({ checked, onChange, label, hint }: ToggleProps) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative mt-0.5 flex-shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          className="sr-only"
        />
        <div className={cn(
          'w-10 h-6 rounded-full transition-colors',
          checked ? 'bg-blue-600' : 'bg-slate-300 group-hover:bg-slate-400',
        )}>
          <div className={cn(
            'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-1',
          )} />
        </div>
      </div>
      <div>
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
      </div>
    </label>
  )
}
