import { useState } from 'react'
import type { RidePhoto } from '../types'

export function PhotoGallery({ photos }: { photos: RidePhoto[] }) {
  const [preview, setPreview] = useState<string | null>(null)

  if (photos.length === 0) return null

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-slate-600">Safety photos</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {photos.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreview(p.dataUrl)}
            className="shrink-0 overflow-hidden rounded-lg border border-slate-200"
          >
            <img src={p.dataUrl} alt="Safety record" className="h-14 w-14 object-cover" />
          </button>
        ))}
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setPreview(null)}
        >
          <img src={preview} alt="Safety record enlarged" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  )
}
