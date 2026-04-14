import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useClients } from '@/hooks/useClients'
import { Button } from '@/components/ui/Button'

export default function ClientList() {
  const { clients, loading } = useClients()
  const [search, setSearch] = useState('')

  const filteredClients = clients.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return c.owner_name.toLowerCase().includes(q) || c.company_name.toLowerCase().includes(q)
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
        placeholder="Search clients..."
        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
      />

      {loading
        ? <p className="text-sm text-slate-400">Loading…</p>
        : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Owner</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Company</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Type</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">State</th>
                  <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">Filing Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.length === 0
                  ? (
                    <tr>
                      <td colSpan={5} className="text-center text-slate-400 py-8">
                        {clients.length === 0
                          ? <>No clients yet. <Link to="/clients/new" className="text-orange-600 hover:underline">Add your first client →</Link></>
                          : 'No clients match your search.'
                        }
                      </td>
                    </tr>
                  )
                  : filteredClients.map(client => (
                    <tr key={client.id} className="hover:bg-slate-50">
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
