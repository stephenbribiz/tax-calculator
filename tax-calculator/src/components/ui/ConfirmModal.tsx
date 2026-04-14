import { useEffect, useRef, useState } from 'react'
import { Button } from './Button'

interface ConfirmModalProps {
  open: boolean
  onConfirm: () => void | Promise<void>
  onCancel: () => void
  title: string
  message: string
  confirmLabel?: string
  variant?: 'danger' | 'default'
}

export function ConfirmModal({
  open,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = 'Confirm',
  variant = 'default',
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirming) onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    confirmRef.current?.focus()
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel, confirming])

  // Reset loading state when modal closes
  useEffect(() => {
    if (!open) setConfirming(false)
  }, [open])

  if (!open) return null

  async function handleConfirm() {
    setConfirming(true)
    try {
      await onConfirm()
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => { if (!confirming) onCancel() }}
    >
      <div
        className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">{message}</p>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" size="md" onClick={onCancel} disabled={confirming}>
            Cancel
          </Button>
          <Button
            ref={confirmRef}
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="md"
            onClick={handleConfirm}
            loading={confirming}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
