/**
 * Static assignee hierarchy.
 * Update this file when staff changes — no DB migration needed.
 */

export interface AssigneeGroup {
  lead: string
  members: string[]
}

export const ASSIGNEE_GROUPS: AssigneeGroup[] = [
  { lead: 'Stephen', members: ['Sunnie', 'Blake'] },
  { lead: 'Brian',   members: ['Amanda', 'Anthony', 'Jason'] },
]

/** Flat list of every assignable name, in display order. */
export const ALL_ASSIGNEES: string[] = ASSIGNEE_GROUPS.flatMap(g => [g.lead, ...g.members])

/** Two-letter initials for a name (e.g. "Sunnie" → "SU", "Stephen" → "ST"). */
export function assigneeInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}
