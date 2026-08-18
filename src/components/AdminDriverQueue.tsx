import { useState } from 'react'
import { useRides } from '../context/RideContext'
import { DOCUMENT_LABELS, DOCUMENT_TYPES, isPastDeadline } from '../mock/data'

export function AdminDriverQueue() {
  const { drivers, approveDriver, rejectDriver, setDriverPendingNote, logActivity } = useRides()
  const [preview, setPreview] = useState<string | null>(null)
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [deadlineDrafts, setDeadlineDrafts] = useState<Record<string, string>>({})
  const pendingDrivers = drivers.filter((d) => d.verificationStatus === 'pending')

  function handleApprove(driverId: string, driverName: string) {
    approveDriver(driverId)
    logActivity({
      actorRole: 'admin',
      actorName: 'Admin',
      todaOrgId: null,
      action: 'Approved driver',
      summary: `Approved ${driverName}'s driver application.`,
    })
  }

  function handleReject(driverId: string, driverName: string) {
    const reason = (noteDrafts[driverId] ?? '').trim() || null
    rejectDriver(driverId, reason)
    logActivity({
      actorRole: 'admin',
      actorName: 'Admin',
      todaOrgId: null,
      action: 'Rejected driver',
      summary: `Rejected ${driverName}'s driver application${reason ? ` — "${reason}"` : ''}.`,
    })
  }

  function handleApproveAsNoted(driverId: string, driverName: string) {
    const note = (noteDrafts[driverId] ?? '').trim() || null
    const days = Number(deadlineDrafts[driverId])
    const deadline = Number.isFinite(days) && days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null
    setDriverPendingNote(driverId, note, deadline)
    logActivity({
      actorRole: 'admin',
      actorName: 'Admin',
      todaOrgId: null,
      action: 'Approved driver as noted',
      summary: `Approved ${driverName} as noted${note ? ` — "${note}"` : ''}${deadline ? `, resubmit by ${new Date(deadline).toLocaleDateString()}` : ''}.`,
    })
  }

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-slate-700">Driver verification queue</h2>
      <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
        {pendingDrivers.length === 0 && <p className="text-sm text-slate-400">No pending driver applications.</p>}
        {pendingDrivers.map((d) => (
          <div key={d.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-700">{d.name}</span>
              <span className="text-xs text-slate-400">Plate {d.plateNumber}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">License {d.licenseNo}</p>

            <div className="mt-2 grid grid-cols-2 gap-2">
              {DOCUMENT_TYPES.map((type) => {
                const doc = d.documents[type]
                return (
                  <div key={type} className="flex items-center gap-2 rounded-lg border border-slate-200 p-1.5">
                    {doc.dataUrl ? (
                      <button type="button" onClick={() => setPreview(doc.dataUrl)} className="shrink-0">
                        <img src={doc.dataUrl} alt={DOCUMENT_LABELS[type]} className="h-8 w-8 rounded object-cover" />
                      </button>
                    ) : (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-300">
                        📄
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-medium text-slate-600">{DOCUMENT_LABELS[type]}</p>
                      <p className={`text-[10px] ${doc.submitted ? 'text-brand-600' : 'text-rose-500'}`}>
                        {doc.submitted ? '✓ Submitted' : 'Missing'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            {d.appealMessage && (
              <p className="mt-2 rounded-lg bg-sky-50 p-2 text-xs text-sky-800">
                <span className="font-semibold">🔁 Appeal from applicant: </span>
                {d.appealMessage}
                {d.rejectionReason && (
                  <span className="mt-1 block text-sky-600">Original rejection reason: {d.rejectionReason}</span>
                )}
              </p>
            )}

            {d.pendingNote && (
              <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                <span className="font-semibold">Note sent to applicant: </span>
                {d.pendingNote}
              </p>
            )}

            {d.pendingNoteDeadline &&
              (isPastDeadline(d.pendingNoteDeadline) ? (
                <p className="mt-2 rounded-lg bg-rose-50 p-2 text-xs font-medium text-rose-700">
                  Deadline passed on {new Date(d.pendingNoteDeadline).toLocaleDateString()} — requirements were not
                  submitted. Reject this application or set a new deadline below.
                </p>
              ) : (
                <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-500">
                  Resubmission deadline: {new Date(d.pendingNoteDeadline).toLocaleDateString()}
                </p>
              ))}

            <div className="mt-2">
              <textarea
                value={noteDrafts[d.id] ?? d.pendingNote ?? ''}
                onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [d.id]: e.target.value }))}
                placeholder="Optional note to the applicant — what's missing/needs fixing, or why you're rejecting"
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
              />
            </div>

            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={deadlineDrafts[d.id] ?? ''}
                onChange={(e) => setDeadlineDrafts((prev) => ({ ...prev, [d.id]: e.target.value }))}
                placeholder="Days to resubmit"
                className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
              />
              <span className="text-[11px] text-slate-400">deadline for "Approve as noted" below</span>
            </div>

            <div className="mt-2 flex gap-2">
              <button
                onClick={() => handleApprove(d.id, d.name)}
                className="flex-1 rounded-lg bg-brand-600 py-2 text-xs font-semibold text-white hover:bg-brand-700"
              >
                Approve
              </button>
              <button
                onClick={() => handleApproveAsNoted(d.id, d.name)}
                className="flex-1 rounded-lg border border-amber-300 bg-amber-50 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100"
              >
                Approve as noted
              </button>
              <button
                onClick={() => handleReject(d.id, d.name)}
                className="flex-1 rounded-lg border border-slate-300 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setPreview(null)}
        >
          <img src={preview} alt="Document enlarged" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </section>
  )
}
