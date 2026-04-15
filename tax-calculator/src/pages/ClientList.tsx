import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useClients } from '@/hooks/useClients'
import { Button } from '@/components/ui/Button'
import { AssigneeFilter } from '@/components/ui/AssigneeFilter'
import { assigneeInitials } from '@/lib/assignees'
import type { DbClient } from '@/lib/supabase'

type SortField = 'owner' | 'company'

/**
 * Parse a free-text owner name into sortable and displayable parts.
 *
 * Input formats handled:
 *   "John Smith"              → { last: "Smith",   first: "John",  spouse: "" }
 *   "John & Jane Smith"       → { last: "Smith",   first: "John",  spouse: "Jane" }
 *   "John Smith & Jane Smith" → { last: "Smith",   first: "John",  spouse: "Jane" }
 *   "John Smith & Jane Jones" → { last: "Smith",   first: "John",  spouse: "Jane" }
 *   "Smith, John"             → { last: "Smith",   first: "John",  spouse: "" }
 *   "Smith, John & Jane"      → { last: "Smith",   first: "John",  spouse: "Jane" }
 *   "Mary-Jane O'Brien"       → { last: "O'Brien", first: "Mary-Jane", spouse: "" }
 */
function parseName(ownerName: string): { last: string; first: string; spouse: string } {
  const [primaryRaw, spouseRaw = ''] = ownerName.split(/\s+[&]\s+|\s+and\s+/i).map(s => s.trim())

  let last = ''
  let first = ''

  if (primaryRaw.includes(',')) {
    // "Last, First" format
    const [l, f = ''] = primaryRaw.split(',').map(s => s.trim())
    last  = l
    first = f
  } else {
    // "First [Middle] Last" format
    const words = primaryRaw.split(/\s+/).filter(Boolean)
    last  = words[words.length - 1] ?? primaryRaw
    first = words.slice(0, -1).join(' ')
  }

  // Spouse: just the first word (first name) of the second segment
  const spouse = spouseRaw.split(/\s+/)[0] ?? ''

  return { last, first, spouse }
}

/**
 * Format an owner name for display as "Last, First [& SpouseFirst]".
 *
 * Examples:
 *   "John Smith"        → "Smith, John"
 *   "John & Jane Smith" → "Smith, John & Jane"
 *   "Smith, John"       → "Smith, John"  (already correct)
 */
export function formatOwnerName(ownerName: string): string {
  const { last, first, spouse } = parseName(ownerName)
  if (!last) return ownerName  // fallback: couldn't parse, show as-is
  const base = first ? `${last}, ${first}` : last
  return spouse ? `${base} & ${spouse}` : base
}

function sortClients(clients: DbClient[], sortField: SortField): DbClient[] {
  return [...clients].sort((a, b) => {
    if (sortField === 'company') {
      return a.company_name.toLowerCase().localeCompare(b.company_name.toLowerCase())
    }
    // Sort: last name → first name → spouse first name
    const na = parseName(a.owner_name)
    const nb = parseName(b.owner_name)
    const lastCmp = na.last.toLowerCase().localeCompare(nb.last.toLowerCase())
    if (lastCmp !== 0) return lastCmp
    const firstCmp = na.first.toLowerCase().localeCompare(nb.first.toLowerCase())
    if (firstCmp !== 0) return firstCmp
    return na.spouse.toLowerCase().localeCompare(nb.spouse.toLowerCase())
  })
}

function AssignedAvatars({ assignees }: { assignees: string[] }) {
  if (assignees.length === 0) return <span className="text-xs text-slate-300">—</span>
  return (
    <div className="flex items-center gap-1">
      {assignees.slice(0, 4).map(name => (
        <span
          key={name}
          title={name}
          className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-[9px] font-bold border border-white ring-1 ring-orange-200"
        >
          {assigneeInitials(name)}
        </span>
      ))}
      {assignees.length > 4 && (
        <span className="text-xs text-slate-400">+{assignees.length - 4}</span>
      )}
    </div>
  )
}

export default function ClientList() {
  const { clients, loading } = useClients()
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('owner')
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([])

  function toggleSort(field: SortField) {
    setSortField(field)
  }

  function toggleAssignee(name: string) {
    setSelectedAssignees(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  const sortedClients = useMemo(() => sortClients(clients, sortField), [clients, sortField])

  const filteredClients = sortedClients.filter(c => {
    // Text search
    if (search) {
      const q = search.toLowerCase()
      const matchesText = (
        c.owner_name.toLowerCase().includes(q) ||
        c.company_name.toLowerCase().includes(q) ||
        (c.client_code ?? '').toLowerCase().includes(q)
      )
      if (!matchesText) return false
    }
    // Assignee filter — show client if any of its assignees are selected
    if (selectedAssignees.length > 0) {
      const clientAssignees = c.assignees ?? []
      return selectedAssignees.some(name => clientAssignees.includes(name))
    }
    return true
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
        <Link to="/clients/new">
          <Button size="sm">+ New Client</Button>
        </Link>
      </div>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by name, company, or code..."
        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
      />
      <div className="mb-4">
        <AssigneeFilter
          selected={selectedAssignees}
          onToggle={toggleAssignee}
          onClear={() => setSelectedAssignees([])}
        />
      </div>

      {loading
        ? <p className="text-sm text-slate-400">Loading…</p>
        : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Code</th>
                  <th className="text-left text-xs font-semibold px-5 py-3">
                    <button
                      onClick={() => toggleSort('owner')}
                      className={`flex items-center gap-1 hover:text-slate-800 transition-colors ${sortField === 'owner' ? 'text-orange-600' : 'text-slate-500'}`}
                    >
                      Owner
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        {sortField === 'owner'
                          ? <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          : <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4M8 15l4 4 4-4" />
                        }
                      </svg>
                    </button>
                  </th>
                  <th className="text-left text-xs font-semibold px-5 py-3">
                    <button
                      onClick={() => toggleSort('company')}
                      className={`flex items-center gap-1 hover:text-slate-800 transition-colors ${sortField === 'company' ? 'text-orange-600' : 'text-slate-500'}`}
                    >
                      Company
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        {sortField === 'company'
                          ? <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          : <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4M8 15l4 4 4-4" />
                        }
                      </svg>
                    </button>
                  </th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Type</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">State</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Filing Status</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Assigned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.length === 0
                  ? (
                    <tr>
                      <td colSpan={7} className="text-center text-slate-400 py-8">
                        {clients.length === 0
                          ? <>No clients yet. <Link to="/clients/new" className="text-orange-600 hover:underline">Add your first client →</Link></>
                          : 'No clients match your search.'
                        }
                      </td>
                    </tr>
                  )
                  : filteredClients.map(client => (
                    <tr key={client.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-mono text-xs text-orange-600 font-bold">
                        {client.client_code || '—'}
                      </td>
                      <td className="px-5 py-3">
                        <Link to={`/clients/${client.id}`} className="font-medium text-orange-600 hover:underline">
                          {formatOwnerName(client.owner_name)}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{client.company_name}</td>
                      <td className="px-5 py-3 text-slate-500">{client.company_type}</td>
                      <td className="px-5 py-3 text-slate-500">{client.state}</td>
                      <td className="px-5 py-3 text-slate-500">{client.filing_status}</td>
                      <td className="px-5 py-3">
                        <AssignedAvatars assignees={client.assignees ?? []} />
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )
      }
    </div>
  )
}
