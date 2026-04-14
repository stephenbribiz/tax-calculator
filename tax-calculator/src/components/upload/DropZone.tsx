import { useCallback, useState } from 'react'

interface DropZoneProps {
  onFiles: (files: File[]) => void
  disabled?: boolean
  label?: string
  hint?: string
}

export function DropZone({ onFiles, disabled, label, hint }: DropZoneProps) {
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf')
    if (files.length > 0) onFiles(files)
  }, [onFiles, disabled])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter(f => f.type === 'application/pdf')
    if (files.length > 0) onFiles(files)
    e.target.value = ''
  }, [onFiles])

  return (
    <div
      onDragEnter={e => { e.preventDefault(); if (!disabled) setDragging(true) }}
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && document.getElementById('bulk-upload-input')?.click()}
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
        disabled
          ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-60'
          : dragging
            ? 'border-orange-400 bg-orange-50 cursor-pointer'
            : 'border-slate-300 bg-slate-50 hover:border-slate-400 cursor-pointer'
      }`}
    >
      <input
        id="bulk-upload-input"
        type="file"
        accept=".pdf"
        multiple
        className="hidden"
        onChange={handleFileInput}
        disabled={disabled}
      />
      <svg className="w-10 h-10 mx-auto mb-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
      </svg>
      <p className="text-sm font-medium text-slate-700">{label ?? 'Upload PDF Documents'}</p>
      <p className="text-xs text-slate-500 mt-1">
        {hint ?? 'Drag & drop multiple PDFs or click to browse'}
      </p>
    </div>
  )
}
