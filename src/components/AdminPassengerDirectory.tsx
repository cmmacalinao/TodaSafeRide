import { useState } from 'react'
import { useRides } from '../context/RideContext'
import { StatusBadge } from './StatusBadge'

export function AdminPassengerDirectory() {
  const { rides, alerts, passengers, parentLinks, parents } = useRides()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const query = search.trim().toLowerCase()
  const filteredPassengers = passengers.filter((p) => {
    if (!query) return true
    const link = parentLinks.find((l) => l.studentPassengerId === p.id)
    const guardian = link ? parents.find((pr) => pr.id === link.parentId) : null
    return p.name.toLowerCase().includes(query) || (guardian?.name.toLowerCase().includes(query) ?? false)
  })

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-slate-700">Passenger records</h2>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by passenger or guardian name"
        className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
      />
      <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
        {filteredPassengers.length === 0 && (
          <p className="text-sm text-slate-400">
            {query ? `No passengers match "${search.trim()}".` : 'No passengers registered yet.'}
          </p>
        )}
        {filteredPassengers.map((p) => {
          const passengerRides = rides
            .filter((r) => r.passengerId === p.id)
            .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
          const isExpanded = expandedId === p.id
          const link = parentLinks.find((l) => l.studentPassengerId === p.id)
          const guardian = link ? parents.find((pr) => pr.id === link.parentId) : null

          return (
            <div key={p.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : p.id)}
                className="flex w-full items-center justify-between text-left"
              >
                <div>
                  <p className="font-medium text-slate-700">
                    {p.name} · Age {p.age}
                  </p>
                  <p className="text-xs text-slate-400">
                    {passengerRides.length} ride(s) on record
                    {guardian && ` · guardian: ${guardian.name} (${link!.relationship})`}
                  </p>
                </div>
                {p.isStudent && (
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                    Student
                  </span>
                )}
              </button>

              {isExpanded && (
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  {passengerRides.length === 0 && <p className="text-xs text-slate-400">No trips yet.</p>}
                  {passengerRides.map((r) => {
                    const rideAlerts = alerts.filter((a) => a.rideId === r.id)
                    return (
                      <div key={r.id} className="rounded-lg bg-slate-50 p-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="truncate pr-2 font-medium text-slate-700">
                            {r.pickup.label} → {r.dropoff.label}
                          </span>
                          <StatusBadge status={r.status} />
                        </div>
                        <p className="mt-0.5 text-slate-400">
                          {r.driverName ?? 'No driver'} · ₱{r.payment?.amount ?? r.fareEstimate} ·{' '}
                          {new Date(r.requestedAt).toLocaleString()}
                        </p>
                        {r.safetyPhotos.length > 0 && (
                          <p className="mt-0.5 text-slate-400">📷 {r.safetyPhotos.length} safety photo(s)</p>
                        )}
                        {rideAlerts.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {rideAlerts.map((a) => (
                              <p key={a.id} className="text-rose-600">
                                ⚠ {a.type === 'sos' ? 'SOS' : 'Route deviation'} · {a.status}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
