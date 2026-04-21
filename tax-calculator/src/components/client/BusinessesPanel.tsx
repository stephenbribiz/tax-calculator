import { useState } from 'react'
import { useBusinesses } from '@/hooks/useBusinesses'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/Toast'
import { COMPANY_TYPE_OPTIONS } from '@/constants/companyTypes'
import { STATE_OPTIONS } from '@/constants/states'

interface BusinessesProps {
  clientId: string
}

interface BusinessForm {
  company_name: string
  company_type: string
  company_code: string
  state: string
  notes: string
}

const emptyForm: BusinessForm = {
  company_name: '',
  company_type: 'S-Corp',
  company_code: '',
  state: 'TN',
  notes: '',
}

export function BusinessesPanel({ clientId }: BusinessesProps) {
  const { businesses, loading, addBusiness, updateBusiness, deleteBusiness } = useBusinesses(clientId)
  const { toast } = useToast()

  const [expanded, setExpanded] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState<BusinessForm>(emptyForm)
  const [addSaving, setAddSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<BusinessForm>(emptyForm)
  const [editSaving, setEditSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  async function handleAdd() {
    if (!addForm.company_name.trim()) return
    setAddSaving(true)
    const { error } = await addBusiness({
      company_name: addForm.company_name.trim(),
      company_type: addForm.company_type,
      company_code: addForm.company_code.trim().toUpperCase() || null,
      state:        addForm.state,
      notes:        addForm.notes.trim() || null,
    })
    if (error) {
      toast('Error: ' + error.message, 'error')
    } else {
      toast('Business added')
      setAddForm(emptyForm)
      setShowAddForm(false)
    }
    setAddSaving(false)
  }

  function startEdit(id: string) {
    const b = businesses.find(b => b.id === id)
    if (!b) return
    setEditingId(id)
    setEditForm({
      company_name: b.company_name,
      company_type: b.company_type,
      company_code: b.company_code ?? '',
      state:        b.state,
      notes:        b.notes ?? '',
    })
  }

  async function handleEditSave() {
    if (!editingId || !editForm.company_name.trim()) return
    setEditSaving(true)
    const { error } = await updateBusiness(editingId, {
      company_name: editForm.company_name.trim(),
      company_type: editForm.company_type,
      company_code: editForm.company_code.trim().toUpperCase() || null,
      state:        editForm.state,
      notes:        editForm.notes.trim() || null,
    })
    if (error) {
      toast('Error: ' + error.message, 'error')
    } else {
      toast('Business updated')
      setEditingId(null)
    }
    setEditSaving(false)
  }

  async function handleDelete(id: string) {
    const err = await deleteBusiness(id)
    if (err) toast('Error: ' + err.message, 'error')
    else toast('Business removed')
    setDeleteTarget(null)
  }

  return (
    <>
      <div className="mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center justify-between bg-slate-50 px-5 py-3 border-b border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-700">Businesses</h2>
            {!loading && businesses.length > 0 && (
              <Badge variant="neutral">{businesses.length}</Badge>
            )}
          </div>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {expanded && (
          <div>
            {/* Business list */}
            {!loading && businesses.length > 0 && (
              <div className="divide-y divide-slate-100">
                {businesses.map(b => (
                  <div key={b.id}>
                    {editingId === b.id ? (
                      /* Edit form row */
                      <div className="px-5 py-4 bg-orange-50 border-l-2 border-orange-400">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Company Name *</label>
                            <input
                              type="text"
                              value={editForm.company_name}
                              onChange={e => setEditForm(f => ({ ...f, company_name: e.target.value }))}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Company Type</label>
                            <select
                              value={editForm.company_type}
                              onChange={e => setEditForm(f => ({ ...f, company_type: e.target.value }))}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                            >
                              {COMPANY_TYPE_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">State</label>
                            <select
                              value={editForm.state}
                              onChange={e => setEditForm(f => ({ ...f, state: e.target.value }))}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                            >
                              {STATE_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Client Code</label>
                            <input
                              type="text"
                              value={editForm.company_code}
                              onChange={e => setEditForm(f => ({ ...f, company_code: e.target.value.replace(/[^A-Za-z]/g, '').slice(0, 6).toUpperCase() }))}
                              maxLength={6}
                              placeholder="e.g., GBG"
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                            />
                          </div>
                        </div>
                        <div className="mb-3">
                          <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                          <textarea
                            rows={2}
                            value={editForm.notes}
                            onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none resize-y"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleEditSave} loading={editSaving} disabled={editSaving || !editForm.company_name.trim()}>
                            Save
                          </Button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Read-only row */
                      <div className="px-5 py-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-slate-900">{b.company_name}</p>
                            <Badge variant="neutral">{b.company_type}</Badge>
                            {b.company_code && (
                              <span className="font-mono text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5">
                                {b.company_code}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {b.state}
                            {b.notes && <span className="ml-2 text-slate-400">· {b.notes}</span>}
                          </p>
                        </div>
                        <button
                          onClick={() => startEdit(b.id)}
                          className="text-xs text-orange-600 hover:text-orange-800 font-medium shrink-0"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ id: b.id, name: b.company_name })}
                          className="text-xs text-red-400 hover:text-red-600 shrink-0"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add form */}
            {showAddForm ? (
              <div className="px-5 py-4 border-t border-slate-100 bg-slate-50">
                <h4 className="text-xs font-semibold text-slate-600 mb-3">Add Business</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Company Name *</label>
                    <input
                      type="text"
                      value={addForm.company_name}
                      onChange={e => setAddForm(f => ({ ...f, company_name: e.target.value }))}
                      autoFocus
                      placeholder="e.g., Green Bay Group LLC"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Company Type</label>
                    <select
                      value={addForm.company_type}
                      onChange={e => setAddForm(f => ({ ...f, company_type: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                    >
                      {COMPANY_TYPE_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">State</label>
                    <select
                      value={addForm.state}
                      onChange={e => setAddForm(f => ({ ...f, state: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                    >
                      {STATE_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Client Code</label>
                    <input
                      type="text"
                      value={addForm.company_code}
                      onChange={e => setAddForm(f => ({ ...f, company_code: e.target.value.replace(/[^A-Za-z]/g, '').slice(0, 6).toUpperCase() }))}
                      maxLength={6}
                      placeholder="e.g., GBG"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
                  <textarea
                    rows={2}
                    value={addForm.notes}
                    onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional notes..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none resize-y"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAdd} loading={addSaving} disabled={addSaving || !addForm.company_name.trim()}>
                    Add Business
                  </Button>
                  <button
                    onClick={() => { setShowAddForm(false); setAddForm(emptyForm) }}
                    className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-5 py-3 border-t border-slate-100">
                <button
                  onClick={() => setShowAddForm(true)}
                  className="text-sm text-orange-600 hover:text-orange-800 font-medium flex items-center gap-1"
                >
                  <span className="text-base leading-none">+</span>
                  Add Business
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Remove Business"
        message={`Remove "${deleteTarget?.name}" from this client's profile? This cannot be undone.`}
        confirmLabel="Remove"
        variant="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget.id) }}
      />
    </>
  )
}
