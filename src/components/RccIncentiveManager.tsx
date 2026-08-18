import { useState } from 'react'
import { useRides } from '../context/RideContext'
import { useSession } from '../context/SessionContext'
import type { RccIncentive, RccIncentiveBasis, RccIncentiveStatus } from '../types'

const BASIS_OPTIONS: RccIncentiveBasis[] = [
  'Per qualified driver recruited',
  'Per active driver',
  'Passenger acquisition',
  'Local revenue incentive',
  'Approved community campaign',
  'Approved social-impact program',
]

const STATUS_LABELS: Record<RccIncentiveStatus, string> = {
  proposed: 'Proposed',
  approved: 'Approved',
  paid: 'Paid',
  cancelled: 'Cancelled',
}

const STATUS_BADGE_CLASSES: Record<RccIncentiveStatus, string> = {
  proposed: 'bg-slate-100 text-slate-600',
  approved: 'bg-sky-100 text-sky-700',
  paid: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-rose-100 text-rose-700',
}

const DEFAULT_PARTNER = ''
const todayIso = () => new Date().toISOString().slice(0, 10)

// A TODA Partner (community marketing/promotion partner — driver
// recruitment, barangay outreach, safety campaigns) holds 0% corporate
// equity, same as a Community Partner/NGO. The organization's name is
// entered per incentive since it can differ per TODA/city — never
// hard-coded. Every incentive here is tied to a specific configured basis
// and needs its own approval — never paid automatically just because the
// partnership exists.
export function RccIncentiveManager() {
  const { rccIncentives, addRccIncentive, updateRccIncentive, removeRccIncentive, logActivity } = useRides()
  const { accountingOfficerName } = useSession()

  function logSuperAdmin(action: string, summary: string) {
    logActivity({
      actorRole: 'super_admin',
      actorName: `Super Admin${accountingOfficerName ? ` - ${accountingOfficerName}` : ''}`,
      todaOrgId: null,
      action,
      summary,
    })
  }

  const [editingId, setEditingId] = useState<string | null>(null)
  const [partner, setPartner] = useState(DEFAULT_PARTNER)
  const [basis, setBasis] = useState<RccIncentiveBasis>('Per qualified driver recruited')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayIso())
  const [status, setStatus] = useState<RccIncentiveStatus>('proposed')
  const [error, setError] = useState('')

  const totalPaid = rccIncentives.filter((r) => r.status === 'paid').reduce((sum, r) => sum + r.amount, 0)
  const totalPending = rccIncentives
    .filter((r) => r.status === 'proposed' || r.status === 'approved')
    .reduce((sum, r) => sum + r.amount, 0)

  function resetForm() {
    setEditingId(null)
    setPartner(DEFAULT_PARTNER)
    setBasis('Per qualified driver recruited')
    setDescription('')
    setAmount('')
    setDate(todayIso())
    setStatus('proposed')
    setError('')
  }

  function handleStartEdit(r: RccIncentive) {
    setEditingId(r.id)
    setPartner(r.partner)
    setBasis(r.basis)
    setDescription(r.description)
    setAmount(String(r.amount))
    setDate(r.date)
    setStatus(r.status)
    setError('')
  }

  function handleSave() {
    const amt = Number(amount)
    if (!partner.trim()) {
      setError('Enter the partner organization.')
      return
    }
    if (!description.trim()) {
      setError('Describe what earned this incentive.')
      return
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a valid amount greater than 0.')
      return
    }
    const args = {
      partner: partner.trim(),
      basis,
      description: description.trim(),
      amount: amt,
      date,
      status,
      approvedBy: status === 'proposed' ? null : accountingOfficerName ?? 'Officer',
    }
    if (editingId) {
      updateRccIncentive(editingId, args)
      logSuperAdmin('Updated TODA Partner incentive', `${args.partner} — ₱${args.amount.toLocaleString()}, ${args.status}.`)
    } else {
      addRccIncentive(args)
      logSuperAdmin('Logged TODA Partner incentive', `${args.partner} — ₱${args.amount.toLocaleString()}, ${args.status}.`)
    }
    resetForm()
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-1 text-sm font-semibold text-slate-700">TODA Partner incentives</h3>
      <p className="mb-3 text-xs text-slate-500">
        A TODA Partner is a community marketing/promotion partner (driver recruitment, barangay outreach, safety
        campaigns) — 0% corporate equity, same as a Community Partner/NGO. Enter the organization's name below — it
        can be a different TODA Partner per city. Each incentive follows a specific basis and needs its own approval.
      </p>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Paid out</p>
          <p className="text-lg font-semibold text-emerald-700">₱{totalPaid.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Pending (proposed/approved)</p>
          <p className="text-lg font-semibold text-amber-700">₱{totalPending.toLocaleString()}</p>
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        {editingId && <p className="text-xs font-medium text-brand-700">Editing incentive</p>}
        <input
          value={partner}
          onChange={(e) => setPartner(e.target.value)}
          placeholder="TODA Partner organization name"
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
        />
        <select
          value={basis}
          onChange={(e) => setBasis(e.target.value as RccIncentiveBasis)}
          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
        >
          {BASIS_OPTIONS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What earned this incentive"
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
        />
        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-500">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-500">Amount</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">₱</span>
              <input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-500">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as RccIncentiveStatus)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
            >
              {(Object.keys(STATUS_LABELS) as RccIncentiveStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            {editingId ? 'Save changes' : 'Log incentive'}
          </button>
          {editingId && (
            <button
              onClick={resetForm}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {rccIncentives.length > 0 && (
        <div className="mt-3 space-y-2">
          {rccIncentives.map((r) => (
            <div key={r.id} className="rounded-lg border border-slate-200 p-2.5 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-700">
                    {r.partner} <span className="font-normal text-slate-400">· {r.basis}</span>
                  </p>
                  <p className="mt-0.5 text-slate-500">{r.description}</p>
                  <p className="mt-0.5 text-slate-400">
                    ₱{r.amount.toLocaleString()} · {new Date(r.date).toLocaleDateString()}
                    {r.approvedBy ? ` · Approved by ${r.approvedBy}` : ''}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE_CLASSES[r.status]}`}>
                  {STATUS_LABELS[r.status]}
                </span>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => handleStartEdit(r)}
                  className="rounded-md px-2 py-1 font-medium text-brand-600 underline hover:bg-brand-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    removeRccIncentive(r.id)
                    logSuperAdmin('Deleted TODA Partner incentive', `Removed ${r.partner} — ₱${r.amount.toLocaleString()}.`)
                  }}
                  className="rounded-md px-2 py-1 font-medium text-rose-600 underline hover:bg-rose-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
