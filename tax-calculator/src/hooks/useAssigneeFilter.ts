/**
 * Persistent assignee filter — reads from / writes to localStorage so the
 * selected combination survives page navigation throughout the session.
 *
 * All pages that have an AssigneeFilter (Dashboard, ClientList,
 * QuarterlyPlans) share the same storage key, so toggling on one page
 * carries over to every other.
 */

import { useState } from 'react'

const STORAGE_KEY = 'tax-calc-assignee-filter'

function readFromStorage(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeToStorage(names: string[]) {
  try {
    if (names.length === 0) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(names))
  } catch {
    // storage unavailable — fail silently
  }
}

export function useAssigneeFilter() {
  // Initialise from localStorage so the filter is immediately correct on mount
  const [selected, setSelected] = useState<string[]>(readFromStorage)

  function toggle(name: string) {
    setSelected(prev => {
      const next = prev.includes(name)
        ? prev.filter(n => n !== name)
        : [...prev, name]
      writeToStorage(next)
      return next
    })
  }

  function clear() {
    setSelected([])
    writeToStorage([])
  }

  return { selected, toggle, clear }
}
