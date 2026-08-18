import { DRIVER_BASE_COORDS } from '../mock/data'
import type { Coords } from '../types'

interface ActiveMarker {
  id: string
  label: string
  position: Coords
  flagged: boolean
}

export function AdminLiveMap({ markers }: { markers: ActiveMarker[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
      <svg viewBox="0 0 100 100" className="block h-52 w-full" role="img" aria-label="Live map of all active rides">
        <rect x="0" y="0" width="100" height="100" fill="#eef2f7" />
        <circle cx={DRIVER_BASE_COORDS.x} cy={DRIVER_BASE_COORDS.y} r="1.6" fill="#94a3b8" />

        {markers.map((m) => (
          <g key={m.id}>
            <circle
              cx={m.position.x}
              cy={m.position.y}
              r="4"
              fill={m.flagged ? '#e11d48' : '#0d9488'}
              fillOpacity="0.22"
            />
            <circle
              cx={m.position.x}
              cy={m.position.y}
              r="2"
              fill={m.flagged ? '#e11d48' : '#0d9488'}
              stroke="white"
              strokeWidth="0.6"
            />
            <text
              x={m.position.x}
              y={m.position.y - 5}
              textAnchor="middle"
              fontSize="3.2"
              fill={m.flagged ? '#be123c' : '#334155'}
            >
              {m.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
