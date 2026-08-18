import { useState } from 'react'
import { categoricalColor } from './palette'
import { distinctActiveDays } from '../../lib/insights'
import type { DayDatum } from '../../lib/insights'

interface DailyBarChartProps {
  title: string
  data: DayDatum[]
  valuePrefix?: string
  emptyMessage?: string
}

const CHART_HEIGHT = 96

// Vertical single-series time-trend chart (one bar per calendar day). A
// single series needs no legend (dataviz skill) — the title already says
// what's plotted, so this uses slot 1 of the categorical palette
// throughout rather than one color per bar. Below 2 active days this isn't
// really a trend yet (a 1-bar "chart" is just a stat tile wearing a chart's
// clothes), so the caller sees a plain message instead.
export function DailyBarChart({ title, data, valuePrefix = '', emptyMessage }: DailyBarChartProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.value))
  const color = categoricalColor(0)
  const hasEnoughData = distinctActiveDays(data) >= 2

  const maxIndex = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0)
  const lastIndex = data.length - 1
  // Thin out x-axis labels so ~14 short day labels don't collide at this
  // card's width — always keep the first and last tick.
  const labelEvery = Math.max(1, Math.ceil(data.length / 6))

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      {!hasEnoughData ? (
        <p className="py-4 text-center text-xs text-slate-400">
          {emptyMessage ?? 'Not enough days of activity yet for a trend — check back after a few more days.'}
        </p>
      ) : (
        <div>
          <div className="flex items-end gap-[3px]" style={{ height: CHART_HEIGHT }}>
            {data.map((d, i) => {
              const heightPct = d.value === 0 ? 0 : Math.max(4, (d.value / max) * 100)
              const isHovered = hovered === i
              const showDirectLabel = i === maxIndex || i === lastIndex
              return (
                <div
                  key={d.key}
                  className="group relative flex-1"
                  style={{ height: CHART_HEIGHT }}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(i)}
                  onBlur={() => setHovered(null)}
                  tabIndex={0}
                  role="img"
                  aria-label={`${d.label}: ${valuePrefix}${d.value.toLocaleString()}`}
                >
                  {isHovered && (
                    <div className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-white shadow">
                      {valuePrefix}
                      {d.value.toLocaleString()} · {d.label}
                    </div>
                  )}
                  {showDirectLabel && d.value > 0 && !isHovered && (
                    <div className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold text-slate-500">
                      {valuePrefix}
                      {d.value.toLocaleString()}
                    </div>
                  )}
                  <div
                    className="absolute bottom-0 w-full rounded-t-[4px] transition-opacity"
                    style={{
                      height: `${heightPct}%`,
                      backgroundColor: color,
                      opacity: hovered === null || isHovered ? 1 : 0.6,
                    }}
                  />
                </div>
              )
            })}
          </div>
          <div className="mt-1 flex gap-[3px] border-t border-slate-200 pt-1">
            {data.map((d, i) => (
              <div key={d.key} className="flex-1 text-center text-[9px] text-slate-400">
                {(i % labelEvery === 0 || i === lastIndex) && d.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
