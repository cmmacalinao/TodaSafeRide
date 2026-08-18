import { useRef, useState } from 'react'
import { captureNativePhoto, compressImageFile } from '../lib/photo'

interface MultiImageUploadFieldProps {
  label: string
  dataUrls: string[]
  onChange: (dataUrls: string[]) => void
}

// Same file-picker mechanics as DocumentUploadField, but for a prescription
// that's often more than one page — keeps a row of thumbnails instead of a
// single slot, each individually removable, with an "Add page" button that
// stays available after the first upload instead of only offering "Replace".
export function MultiImageUploadField({ label, dataUrls, onChange }: MultiImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  // Same native Camera-or-Photo-Library prompt as DocumentUploadField —
  // prescription pages are just as often an existing photo as a fresh one.
  async function handleTap() {
    setBusy(true)
    try {
      const native = await captureNativePhoto({ source: 'prompt' })
      if (native) {
        onChange([...dataUrls, native])
        return
      }
      inputRef.current?.click()
    } finally {
      setBusy(false)
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const compressed = await compressImageFile(file)
      onChange([...dataUrls, compressed])
    } finally {
      setBusy(false)
    }
  }

  function handleRemove(index: number) {
    onChange(dataUrls.filter((_, i) => i !== index))
  }

  return (
    <div className="rounded-lg border border-slate-200 p-2.5">
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-700">{label}</p>
        <p className="text-[11px] text-slate-400">
          {dataUrls.length === 0 ? 'Not uploaded' : `${dataUrls.length} page${dataUrls.length > 1 ? 's' : ''}`}
        </p>
      </div>
      {dataUrls.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {dataUrls.map((url, i) => (
            <div key={i} className="relative">
              <img src={url} alt={`${label} page ${i + 1}`} className="h-14 w-14 rounded-md object-cover" />
              <button
                type="button"
                onClick={() => handleRemove(i)}
                aria-label={`Remove page ${i + 1}`}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-[11px] font-semibold text-rose-600 shadow-sm hover:bg-rose-50"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={handleTap}
        disabled={busy}
        className="mt-2 w-full rounded-lg border border-slate-300 bg-white py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
      >
        {busy ? '…' : dataUrls.length === 0 ? '+ Add page' : '+ Add another page'}
      </button>
    </div>
  )
}
