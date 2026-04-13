import { cn } from '@/lib/utils'

const STEPS = [
  { number: 1, label: 'Client Info' },
  { number: 2, label: 'Tax Profile' },
  { number: 3, label: 'Financials' },
]

interface FormStepperProps {
  currentStep: 1 | 2 | 3 | 'results'
}

export function FormStepper({ currentStep }: FormStepperProps) {
  const numericStep = currentStep === 'results' ? 4 : currentStep

  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const isCompleted = numericStep > step.number
        const isActive    = numericStep === step.number
        const isLast      = i === STEPS.length - 1

        return (
          <div key={step.number} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
                isCompleted ? 'bg-blue-600 text-white' :
                isActive    ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
                              'bg-slate-200 text-slate-500',
              )}>
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : step.number}
              </div>
              <span className={cn(
                'text-xs mt-1 font-medium',
                isActive ? 'text-blue-600' : isCompleted ? 'text-slate-600' : 'text-slate-400',
              )}>
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div className={cn(
                'w-16 h-0.5 mb-4 mx-1',
                isCompleted ? 'bg-blue-600' : 'bg-slate-200',
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}
