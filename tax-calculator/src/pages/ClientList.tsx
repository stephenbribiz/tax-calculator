import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useClients } from '@/hooks/useClients'
import { Button } from '@/components/ui/Button'
import type { DbClient } from '@/lib/supabase'

type SortField = 'owner' | 'company'

/**
 * Extract the last name from a free-text owner name for sorting purposes.
 *
 * Handles formats like:
 *   "John Smith"              → "Smith"
 *   "John & Jane Smith"       → "Smith"
 *   "John Smith & Jane Smith" → "Smith"
 *   "Smith, John"             → "Smith"
 *   "Mary-Jane O'Brien"       → "O'Brien"
 */
function getLastName(ownerName: string): string {
  // Take only the primary owner (before "&" or "and")
  const primary = ownerName.split(/\s+[&]\s+|\s+and\s+/i)[0].trim()

  // Handle "Lastname, Firstname" format
  if (primary.includes(',')) {
    return primary.split(',')[0].trim()
  }

  // Take the last word as the surname
  const words = primary.split(/\s+/).filter(Boolean)
  return words[words.length - 1] ?? primary
}

function sortClients(clients: DbClient[], sortField: SortField): DbClient[] {
  return [...clients].sort((a, b) => {
    if (sortField === 'company') {
      return a.company_name.toLowerCase().localeCompare(b.company_name.toLowerCase())
    }
    // owner: sort by last name, then full name
    const lastA = getLastName(a.owner_name).toLowerCase()
    const lastB = getLastName(b.owner_name).toLowerCase()
    if (lastA !== lastB) return lastA.localeCompare(lastB)
    return a.owner_name.toLowerCase().localeCompare(b.owner_name.toLowerCase())
  })
}

export default function ClientList() {
  const { clients, loading } = useClients()
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('owner')

  function toggleSort(field: SortField) {
    setSortField(field)
  }

  const sortedClients = useMemo(() => sortClients(clients, sortField), [clients, sortField])

  const filteredClients = sortedClients.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.owner_name.toLowerCase().includes(q) ||
      c.company_name.toLowerCase().includes(q) ||
      (c.client_code ?? '').toLowerCase().includes(q)
    )
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
        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
      />

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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.length === 0
                  ? (
                    <tr>
                      <td colSpan={6} className="text-center text-slate-400 py-8">
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
                          {client.owner_name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{client.company_name}</td>
                      <td className="px-5 py-3 text-slate-500">{client.company_type}</td>
                      <td className="px-5 py-3 text-slate-500">{client.state}</td>
                      <td className="px-5 py-3 text-slate-500">{client.filing_status}</td>
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
