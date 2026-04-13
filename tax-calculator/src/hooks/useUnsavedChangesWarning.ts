import { useEffect } from 'react'
import { useBlocker } from 'react-router-dom'

/**
 * Warns the user before leaving the page when there are unsaved changes.
 * Handles both browser-level navigation (beforeunload) and in-app navigation (react-router blocker).
 */
export function useUnsavedChangesWarning(isDirty: boolean) {
  // Browser-level: tab close, refresh, external navigation
  useEffect(() => {
    if (!isDirty) return

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }

    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // In-app navigation via react-router
  const blocker = useBlocker(isDirty)

  useEffect(() => {
    if (blocker.state === 'blocked') {
      const proceed = window.confirm(
        'You have unsaved changes. Are you sure you want to leave?'
      )
      if (proceed) {
        blocker.proceed()
      } else {
        blocker.reset()
      }
    }
  }, [blocker])
}
