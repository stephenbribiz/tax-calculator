import { forwardRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label?: string
  hint?: string
  error?: string
  value: number
  onChange: (value: number) => void
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(function CurrencyInput(
  { label, hint, error, value, onChange, className, id, ...props },
  ref,
) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  const [focused, setFocused] = useState(false)

  // Show raw number while focused, formatted on blur
  const displayValue = focused
    ? (value === 0 ? '' : String(value))
    : (value === 0 ? '' : value.toLocaleString('en-US'))

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9.-]/g, '')
    const num = parseFloat(raw)
    onChange(isNaN(num) ? 0 : num)
  }

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">$</span>
        <input
          ref={ref}
          id={inputId}
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="0"
          className={cn(
            'w-full pl-7 pr-3 py-2 text-sm border rounded-lg transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent',
            error
              ? 'border-red-400 bg-red-50'
              : 'border-slate-300 bg-white hover:border-slate-400',
            className,
          )}
          {...props}
        />
      </div>
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
})
