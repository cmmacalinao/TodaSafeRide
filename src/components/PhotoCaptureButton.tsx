import { useRef, useState } from 'react'
import { captureNativePhoto, compressImageFile } from '../lib/photo'

export function PhotoCaptureButton({ onCapture }: { onCapture: (dataUrl: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  // Tries the native camera first (real app only — see captureNativePhoto);
  // on the web (or if that returns null, meaning "not native") falls back
  // to the file input's own capture="environment" prompt below.
  async function handleTap() {
    setBusy(true)
    try {
      const native = await captureNativePhoto({ source: 'camera' })
      if (native) {
        onCapture(native)
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
      const dataUrl = await compressImageFile(file)
      onCapture(dataUrl)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
      <button
        type="button"
        onClick={handleTap}
        disabled={busy}
        aria-label="Take photo of tricycle and driver"
        className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white py-3 text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
      >
        <span className="text-2xl leading-none">{busy ? '⏳' : '📷'}</span>
        <span className="text-[11px] font-semibold">{busy ? 'Processing…' : 'Photo'}</span>
      </button>
    </>
  )
}
