import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: 'sm' | 'md' | 'lg'
}

export function Card({ children, className, padding = 'md' }: CardProps) {
  const padMap = { sm: 'p-3', md: 'p-5', lg: 'p-6' }
  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 shadow-sm', padMap[padding], className)}>
      {children}
    </div>
  )
}

interface SectionHeaderProps {
  title: string
  subtitle?: string
}

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <div className="mb-4">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  )
}
