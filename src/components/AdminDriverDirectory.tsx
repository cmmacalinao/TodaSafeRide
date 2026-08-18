import { useState } from 'react'
import { useRides } from '../context/RideContext'
import { StatusBadge } from './StatusBadge'

const STATUS_STYLES: Record<string, string> = {
  approved: 'bg-brand-100 text-brand-700',
  pending: 'bg-amber-100 text-amber-800',
  rejected: 'bg-rose-100 text-rose-700',
}

const ACCESS_STYLES: Record<string, string> = {
  active: 'bg-brand-100 text-brand-700',
  paused: 'bg-amber-100 text-amber-800',
  terminated: 'bg-rose-100 text-rose-700',
}

const FREELANCE_FILTER = 'freelance'
const ALL_FILTER = 'all'

export function AdminDriverDirectory() {
  const { drivers, rides, todaOrganizations, duesRecords, duesGracePeriodDays, setDriverAccess, logActivity } =
    useRides()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [todaFilter, setTodaFilter] = useState(ALL_FILTER)
  const [search, setSearch] = useState('')

  function handleSetDriverAccess(
    driverId: string,
    driverName: string,
    accessStatus: 'active' | 'paused' | 'terminated',
    note: string | null,
  ) {
    setDriverAccess(driverId, accessStatus, note)
    logActivity({
      actorRole: 'admin',
      actorName: 'Admin',
      todaOrgId: null,
      action: accessStatus === 'active' ? 'Restored driver access' : accessStatus === 'paused' ? 'Paused driver access' : 'Terminated driver',
      summary: `${driverName}'s access set to "${accessStatus}"${note ? ` — "${note}"` : ''}.`,
    })
  }

  function maxOverdueDays(driverId: string): number {
    const unpaid = duesRecords.filter((d) => d.driverId === driverId && !d.paidAt)
    if (unpaid.length === 0) return 0
    const oldestDueDate = Math.min(...unpaid.map((d) => new Date(d.dueDate).getTime()))
    return Math.max(0, Math.floor((Date.now() - oldestDueDate) / (24 * 60 * 60 * 1000)))
  }

  const query = search.trim().toLowerCase()
  const filteredDrivers = drivers.filter((d) => {
    if (todaFilter === ALL_FILTER) {
      // no-op, every org (and freelance) passes
    } else if (todaFilter === FREELANCE_FILTER) {
      if (d.todaOrgId !== null) return false
    } else if (d.todaOrgId !== todaFilter) {
      return false
    }
    if (!query) return true
    return (
      d.name.toLowerCase().includes(query) ||
      d.plateNumber.toLowerCase().includes(query) ||
      d.phone.toLowerCase().includes(query) ||
      d.licenseNo.toLowerCase().includes(query)
    )
  })

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">Driver directory</h2>
        <select
          value={todaFilter}
          onChange={(e) => setTodaFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
        >
          <option value={ALL_FILTER}>All TODAs</option>
          {todaOrganizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
          <option value={FREELANCE_FILTER}>Freelance</option>
        </select>
      </div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, plate, phone, or license no."
        className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
      />
      <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
        {filteredDrivers.length === 0 && (
          <p className="text-sm text-slate-400">
            {query ? `No drivers match "${search.trim()}".` : 'No drivers in this group.'}
          </p>
        )}
        {filteredDrivers.map((d) => {
          const driverRides = rides
            .filter((r) => r.driverId === d.id)
            .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
          const completed = driverRides.filter((r) => r.status === 'completed')
          const isExpanded = expandedId === d.id
          const overdueDays = maxOverdueDays(d.id)
          const pauseEligible = overdueDays > duesGracePeriodDays

          return (
            <div key={d.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : d.id)}
                className="flex w-full items-center justify-between text-left"
              >
                <div>
                  <p className="font-medium text-slate-700">
                    {d.name} · {d.plateNumber}
                  </p>
                  <p className="text-xs text-slate-400">
                    {todaOrganizations.find((o) => o.id === d.todaOrgId)?.name ?? 'Freelance'} ·{' '}
                    {driverRides.length} ride(s) · {completed.length} completed · ★{' '}
                    {d.ratingCount > 0 ? `${d.rating} (${d.ratingCount})` : '—'}
                    {d.online && <span className="ml-1 text-brand-600">· online</span>}
                    {pauseEligible && <span className="ml-1 font-medium text-rose-600">· {overdueDays}d dues overdue</span>}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[d.verificationStatus]}`}
                  >
                    {d.verificationStatus}
                  </span>
                  {d.accessStatus !== 'active' && (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ACCESS_STYLES[d.accessStatus]}`}>
                      {d.accessStatus}
                    </span>
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                  {d.accessNote && (
                    <p className="rounded-lg bg-rose-50 p-2 text-xs text-rose-700">
                      <span className="font-semibold">Access note: </span>
                      {d.accessNote}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 pb-1">
                    {d.accessStatus === 'active' ? (
                      <>
                        <button
                          onClick={() =>
                            handleSetDriverAccess(
                              d.id,
                              d.name,
                              'paused',
                              pauseEligible ? `Paused for unpaid dues (${overdueDays} days overdue).` : 'Paused by Admin.',
                            )
                          }
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                            pauseEligible
                              ? 'bg-amber-600 text-white hover:bg-amber-700'
                              : 'border border-amber-300 text-amber-700 hover:bg-amber-50'
                          }`}
                        >
                          Pause access{pauseEligible ? ' (unpaid dues)' : ''}
                        </button>
                        <button
                          onClick={() => handleSetDriverAccess(d.id, d.name, 'terminated', 'Terminated by Admin.')}
                          className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                        >
                          Terminate
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleSetDriverAccess(d.id, d.name, 'active', null)}
                        className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                      >
                        Restore full access
                      </button>
                    )}
                  </div>

                  {driverRides.length === 0 && <p className="text-xs text-slate-400">No rides yet.</p>}
                  {driverRides.map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-xs text-slate-500">
                      <span className="truncate pr-2">
                        {r.passengerName} · {r.pickup.label} → {r.dropoff.label}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span>₱{r.payment?.driverPayout ?? r.fareEstimate}</span>
                        <StatusBadge status={r.status} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
