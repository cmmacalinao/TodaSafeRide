import { useState } from 'react'
import { useRides } from '../context/RideContext'
import { useSession } from '../context/SessionContext'
import type { Distribution, DistributionStatus, DistributionType } from '../types'

const TYPE_OPTIONS: DistributionType[] = [
  'Investor Distribution',
  'Shareholder Dividend',
  'Founder Distribution',
  'Reinvestment',
  'Social Impact Allocation',
  'TODA Partner Incentive',
  'Other Approved Distribution',
]

const STATUS_LABELS: Record<DistributionStatus, string> = {
  proposed: 'Proposed',
  approved: 'Approved',
  paid: 'Paid',
  cancelled: 'Cancelled',
}

const STATUS_BADGE_CLASSES: Record<DistributionStatus, string> = {
  proposed: 'bg-slate-100 text-slate-600',
  approved: 'bg-sky-100 text-sky-700',
  paid: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-rose-100 text-rose-700',
}

// Shareholder-type payouts, distinct from Community Partner/NGO and TODA
// Partner organizations (both 0% equity — see RotaryProject/RccIncentive).
// "recipient" is free text and beneficiary org names are user-entered (they
// differ per city), so there's no fixed keyword to match on — instead this
// checks the recipient against the actual registered partner names already
// on file (from Community Partner/NGO projects and TODA Partner incentives)
// and only warns, never blocks; the officer is the one who knows if it's a
// genuine mistake.
const SHAREHOLDER_TYPES: DistributionType[] = ['Investor Distribution', 'Shareholder Dividend']

const todayIso = () => new Date().toISOString().slice(0, 10)

export function DistributionManager() {
  const {
    distributions,
    rotaryProjects,
    rccIncentives,
    addDistribution,
    updateDistribution,
    removeDistribution,
    logActivity,
  } = useRides()
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
  const [recipient, setRecipient] = useState('')
  const [distributionType, setDistributionType] = useState<DistributionType>('Investor Distribution')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayIso())
  const [source, setSource] = useState('')
  const [reference, setReference] = useState('')
  const [status, setStatus] = useState<DistributionStatus>('proposed')
  const [error, setError] = useState('')

  const totalPaid = distributions.filter((d) => d.status === 'paid').reduce((sum, d) => sum + d.amount, 0)
  const totalPending = distributions
    .filter((d) => d.status === 'proposed' || d.status === 'approved')
    .reduce((sum, d) => sum + d.amount, 0)

  const knownPartnerNames = new Set(
    [...rotaryProjects.map((p) => p.partner), ...rccIncentives.map((r) => r.partner)]
      .map((n) => n.trim().toLowerCase())
      .filter(Boolean),
  )
  const partnerRecipientWarning =
    SHAREHOLDER_TYPES.includes(distributionType) && knownPartnerNames.has(recipient.trim().toLowerCase())

  function resetForm() {
    setEditingId(null)
    setRecipient('')
    setDistributionType('Investor Distribution')
    setAmount('')
    setDate(todayIso())
    setSource('')
    setReference('')
    setStatus('proposed')
    setError('')
  }

  function handleStartEdit(d: Distribution) {
    setEditingId(d.id)
    setRecipient(d.recipient)
    setDistributionType(d.distributionType)
    setAmount(String(d.amount))
    setDate(d.date)
    setSource(d.source)
    setReference(d.reference ?? '')
    setStatus(d.status)
    setError('')
  }

  function handleSave() {
    const amt = Number(amount)
    if (!recipient.trim()) {
      setError('Enter the recipient.')
      return
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a valid amount greater than 0.')
      return
    }
    if (!source.trim()) {
      setError('Describe the source (e.g. "Net distributable profit Q3 2026").')
      return
    }
    const args = {
      recipient: recipient.trim(),
      distributionType,
      amount: amt,
      date,
      source: source.trim(),
      reference: reference.trim() || null,
      status,
      approvedBy: status === 'proposed' ? null : accountingOfficerName ?? 'Officer',
    }
    if (editingId) {
      updateDistribution(editingId, args)
      logSuperAdmin('Updated distribution', `${args.recipient} — ${args.distributionType}, ₱${args.amount.toLocaleString()}, ${args.status}.`)
    } else {
      addDistribution(args)
      logSuperAdmin('Logged distribution', `${args.recipient} — ${args.distributionType}, ₱${args.amount.toLocaleString()}, ${args.status}.`)
    }
    resetForm()
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-1 text-sm font-semibold text-slate-700">Distributions</h3>
      <p className="mb-3 text-xs text-slate-500">
        Payouts from the business — investor/shareholder distributions, founder distributions, reinvestment, or
        transfers into the Social Impact Fund / TODA Partner incentives. A Community Partner/NGO or TODA Partner is
        a social-impact partner, not a shareholder — they should never receive a Shareholder Dividend or Investor
        Distribution here.
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
        {editingId && <p className="text-xs font-medium text-brand-700">Editing distribution</p>}
        <div className="grid grid-cols-2 gap-2">
          <input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Recipient"
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
          <select
            value={distributionType}
            onChange={(e) => setDistributionType(e.target.value as DistributionType)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        {partnerRecipientWarning && (
          <p className="rounded-lg bg-amber-50 p-2 text-[11px] font-medium text-amber-800">
            ⚠️ This recipient is a registered Community Partner/NGO or TODA Partner — those hold 0% equity and
            shouldn't receive a shareholder-type distribution. Double check this is intentional (e.g. an Other
            Approved Distribution or Social Impact Allocation may fit better).
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
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
        </div>
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Source (e.g. Net distributable profit Q3 2026)"
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Reference (optional)"
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as DistributionStatus)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
          >
            {(Object.keys(STATUS_LABELS) as DistributionStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            {editingId ? 'Save changes' : 'Log distribution'}
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

      {distributions.length > 0 && (
        <div className="mt-3 space-y-2">
          {distributions.map((d) => (
            <div key={d.id} className="rounded-lg border border-slate-200 p-2.5 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-700">
                    {d.recipient} <span className="font-normal text-slate-400">· {d.distributionType}</span>
                  </p>
                  <p className="mt-0.5 text-slate-500">
                    ₱{d.amount.toLocaleString()} · {new Date(d.date).toLocaleDateString()}
                  </p>
                  <p className="mt-0.5 text-slate-400">
                    {d.source}
                    {d.reference ? ` · Ref: ${d.reference}` : ''}
                  </p>
                  {d.approvedBy && <p className="mt-0.5 text-slate-400">Approved by {d.approvedBy}</p>}
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE_CLASSES[d.status]}`}>
                  {STATUS_LABELS[d.status]}
                </span>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => handleStartEdit(d)}
                  className="rounded-md px-2 py-1 font-medium text-brand-600 underline hover:bg-brand-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    removeDistribution(d.id)
                    logSuperAdmin('Deleted distribution', `Removed ${d.recipient} — ₱${d.amount.toLocaleString()} (${d.distributionType}).`)
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
