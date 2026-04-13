import { useEffect } from 'react'

/**
 * Warns the user before leaving the page when there are unsaved changes.
 * Uses the browser's beforeunload event (covers tab close, refresh, external navigation).
 */
export function useUnsavedChangesWarning(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }

    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])
}
