import { useState, useEffect, useCallback } from 'react'
import { supabase, type DbDocument } from '@/lib/supabase'
import { deleteDocumentFile } from '@/lib/storage'

export function useDocuments(clientId?: string) {
  const [documents, setDocuments] = useState<DbDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    setError(null)

    let query = supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false })

    if (clientId) {
      query = query.eq('client_id', clientId)
    }

    const { data, error: fetchError } = await query

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setDocuments((data ?? []) as DbDocument[])
    }
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const deleteDocument = useCallback(async (id: string, storagePath: string) => {
    // Delete from storage first, then from database
    try {
      await deleteDocumentFile(storagePath)
    } catch {
      // Storage deletion may fail if file already gone — continue with DB cleanup
    }

    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', id)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setDocuments(prev => prev.filter(d => d.id !== id))
  }, [])

  const updateDocumentStatus = useCallback(async (
    id: string,
    status: 'pending' | 'applied' | 'skipped',
    reportId?: string,
  ) => {
    const updates: Partial<DbDocument> = { status }
    if (reportId) updates.report_id = reportId

    const { error: updateError } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', id)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setDocuments(prev =>
      prev.map(d => d.id === id ? { ...d, status, ...(reportId ? { report_id: reportId } : {}) } : d)
    )
  }, [])

  return { documents, loading, error, refetch: fetchDocuments, deleteDocument, updateDocumentStatus }
}
