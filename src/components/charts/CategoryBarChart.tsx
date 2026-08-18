import { useState } from 'react'
import { categoricalColor } from './palette'
import type { CategoryDatum } from '../../lib/insights'

interface CategoryBarChartProps {
  title: string
  data: CategoryDatum[]
  // e.g. "₱" to render "₱1,240" instead of "1,240" — values otherwise
  // render as plain counts.
  valuePrefix?: string
  emptyMessage?: string
}

// Horizontal categorical bar chart — one bar per category, fixed color per
// array position (never re-sorted/re-colored by value, so a category keeps
// its identity across re-renders). Each bar already carries its own visible
// label + value, so no separate legend box is needed (dataviz skill:
// "never make the reader rely on color-matching alone" — satisfied here by
// the on-axis label itself, not a color key).
export function CategoryBarChart({ title, data, valuePrefix = '', emptyMessage }: CategoryBarChartProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.value))
  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      {total === 0 ? (
        <p className="py-4 text-center text-xs text-slate-400">{emptyMessage ?? 'No data yet.'}</p>
      ) : (
        <div className="space-y-2.5">
          {data.map((d, i) => {
            const widthPct = Math.max(2, (d.value / max) * 100)
            const color = categoricalColor(i)
            const isHovered = hovered === i
            return (
              <div
                key={d.label}
                className="group"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered(null)}
                tabIndex={0}
                role="img"
                aria-label={`${d.label}: ${valuePrefix}${d.value.toLocaleString()}`}
              >
                <div className="mb-0.5 flex items-center justify-between text-xs">
                  <span className="text-slate-600">{d.label}</span>
                  <span className={`font-semibold ${isHovered ? 'text-slate-900' : 'text-slate-700'}`}>
                    {valuePrefix}
                    {d.value.toLocaleString()}
                  </span>
                </div>
                <div className="h-4 w-full rounded-sm bg-slate-100">
                  <div
                    className="h-4 rounded-r-[4px] transition-all"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: color,
                      opacity: hovered === null || isHovered ? 1 : 0.55,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
