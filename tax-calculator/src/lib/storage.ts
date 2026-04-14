import { supabase } from '@/lib/supabase'

const BUCKET = 'client-documents'

/**
 * Upload a document to Supabase Storage.
 * Path: {userId}/{clientId}/{taxYear}/{filename}
 * Returns the storage path on success.
 */
export async function uploadDocument(
  userId: string,
  clientId: string,
  taxYear: number,
  file: File,
): Promise<string> {
  const path = `${userId}/${clientId}/${taxYear}/${file.name}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true, // overwrite if same filename re-uploaded
    })

  if (error) throw new Error(`Upload failed: ${error.message}`)
  return path
}

/**
 * Get a signed URL for viewing a document (1 hour expiry).
 */
export async function getDocumentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600)

  if (error || !data?.signedUrl) throw new Error(`Could not create signed URL: ${error?.message}`)
  return data.signedUrl
}

/**
 * Delete a document from Supabase Storage.
 */
export async function deleteDocumentFile(storagePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([storagePath])

  if (error) throw new Error(`Delete failed: ${error.message}`)
}
