import { useState } from 'react'
import type { ActivityLogEntry } from '../types'

const MAX_VISIBLE = 8

// Reusable "Log History" card — dropped into AdminPage (Admin), AdminAccounting
// (Super Admin), and TodaAdminPage (each TODA's own Admin) to show a running
// audit trail of the changes made on that page. Entries are already
// newest-first (see RideContext's ADD_ACTIVITY_LOG_ENTRY reducer case), so
// this component only slices/renders — it never re-sorts.
export function ActivityLogPanel({
  title,
  entries,
  emptyMessage = 'No changes logged yet.',
}: {
  title: string
  entries: ActivityLogEntry[]
  emptyMessage?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? entries : entries.slice(0, MAX_VISIBLE)

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">📜 {title}</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
          {entries.length} logged
        </span>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Who changed what, and when — a running record, not something anyone here can edit or delete.
      </p>

      {entries.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">{emptyMessage}</p>
      ) : (
        <div className="space-y-2">
          {visible.map((entry) => (
            <div key={entry.id} className="rounded-lg border border-slate-200 p-2.5 text-xs">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-slate-700">{entry.action}</p>
                <span className="shrink-0 whitespace-nowrap text-[11px] text-slate-400">
                  {new Date(entry.at).toLocaleString()}
                </span>
              </div>
              <p className="mt-0.5 text-slate-500">{entry.summary}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">by {entry.actorName}</p>
            </div>
          ))}
        </div>
      )}

      {entries.length > MAX_VISIBLE && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 w-full rounded-lg border border-slate-300 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          {expanded ? 'Show fewer' : `Show all ${entries.length}`}
        </button>
      )}
    </section>
  )
}
