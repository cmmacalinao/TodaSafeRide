import { useState } from 'react'
import { useRides } from '../context/RideContext'
import { DATE_RANGE_PRESET_LABELS, inRange, resolveDateRange, type DateRangePreset } from '../lib/incomePromotion'
import type { ReferralStatus } from '../types'

const STATUS_OPTIONS: ReferralStatus[] = ['pending', 'qualified', 'rewarded', 'rejected', 'fraud_review']
const STATUS_LABELS: Record<ReferralStatus, string> = {
  pending: 'PENDING',
  qualified: 'QUALIFIED',
  rewarded: 'REWARDED',
  rejected: 'REJECTED',
  fraud_review: 'FRAUD REVIEW',
}
const STATUS_BADGE_CLASSES: Record<ReferralStatus, string> = {
  pending: 'bg-slate-100 text-slate-600',
  qualified: 'bg-sky-100 text-sky-700',
  rewarded: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  fraud_review: 'bg-amber-100 text-amber-800',
}
const PRESETS: DateRangePreset[] = ['today', '7d', '30d', 'this_month', 'this_quarter', 'this_year', 'custom']

function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
}

export function IncomePromotionReferrals() {
  const { passengers, drivers, referrals, rewardRules, incomePromotionSettings, addReferral, setReferralStatus, removeReferral, logActivity } = useRides()

  const [referrerType, setReferrerType] = useState<'passenger' | 'driver'>('passenger')
  const [referrerId, setReferrerId] = useState('')
  const [referredName, setReferredName] = useState('')
  const [code, setCode] = useState('')
  const [formError, setFormError] = useState('')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ReferralStatus | 'all'>('all')
  const [preset, setPreset] = useState<DateRangePreset>('30d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const { start, end } = resolveDateRange(preset, customStart, customEnd)
  const referrerOptions = referrerType === 'passenger' ? passengers : drivers

  const query = search.trim().toLowerCase()
  const filtered = referrals.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    if (!inRange(r.createdAt, start, end)) return false
    if (!query) return true
    return (
      r.code.toLowerCase().includes(query) ||
      r.referrerName.toLowerCase().includes(query) ||
      r.referredName.toLowerCase().includes(query)
    )
  })

  function referralsTodayFor(referrerIdToCheck: string): number {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    return referrals.filter((r) => r.referrerId === referrerIdToCheck && new Date(r.createdAt) >= todayStart).length
  }

  function handleAddReferral() {
    if (!referrerId) {
      setFormError('Choose a referrer.')
      return
    }
    if (!referredName.trim()) {
      setFormError('Enter who was referred.')
      return
    }
    const referrer = referrerOptions.find((r) => r.id === referrerId)
    if (!referrer) {
      setFormError('Referrer not found.')
      return
    }
    setFormError('')
    const referralCode = code.trim() || `REF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    addReferral({
      code: referralCode,
      referrerId,
      referrerName: referrer.name,
      referrerType,
      referredName: referredName.trim(),
    })
    logActivity({ actorRole: 'admin', actorName: 'Admin', todaOrgId: null, action: 'IP · Added referral', summary: `${referralCode} — ${referrer.name} referred ${referredName.trim()}.` })
    setReferrerId('')
    setReferredName('')
    setCode('')
  }

  function handleSetStatus(referralId: string, status: ReferralStatus) {
    const referral = referrals.find((r) => r.id === referralId)
    if (!referral) return
    const coinsAwarded = status === 'rewarded' ? rewardRules.referral : referral.coinsAwarded
    setReferralStatus(referralId, status, coinsAwarded)
    logActivity({
      actorRole: 'admin',
      actorName: 'Admin',
      todaOrgId: null,
      action: `IP · Set referral to ${STATUS_LABELS[status]}`,
      summary: `${referral.code} (${referral.referrerName} → ${referral.referredName})${status === 'rewarded' ? ` — ${coinsAwarded} coins` : ''}.`,
    })
  }

  function handleExport() {
    const rows = [
      ['Code', 'Referrer', 'Referred', 'Registered', 'Verified', 'First ride', 'Status', 'Coins awarded'],
      ...filtered.map((r) => [
        r.code,
        r.referrerName,
        r.referredName,
        r.registeredAt ?? '',
        r.verifiedAt ?? '',
        r.firstRideAt ?? '',
        STATUS_LABELS[r.status],
        String(r.coinsAwarded),
      ]),
    ]
    const csv = toCsv(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `referrals-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-slate-700">Record a referral</h3>
        <div className="space-y-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={referrerType}
              onChange={(e) => {
                setReferrerType(e.target.value as 'passenger' | 'driver')
                setReferrerId('')
              }}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
            >
              <option value="passenger">Passenger referrer</option>
              <option value="driver">Driver referrer</option>
            </select>
            <select value={referrerId} onChange={(e) => setReferrerId(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs">
              <option value="">Select referrer</option>
              {referrerOptions.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={referredName} onChange={(e) => setReferredName(e.target.value)} placeholder="Referred person's name" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Code (auto if blank)" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          </div>
          {referrerId && referralsTodayFor(referrerId) >= incomePromotionSettings.fraudReferralThreshold && (
            <p className="rounded-lg bg-amber-50 p-2 text-[11px] font-medium text-amber-800">
              ⚠️ This referrer already has {referralsTodayFor(referrerId)} referral(s) today — at or above the fraud
              review threshold ({incomePromotionSettings.fraudReferralThreshold}/day). Consider Fraud Review instead
              of Qualified.
            </p>
          )}
          {formError && <p className="text-xs font-medium text-rose-600">{formError}</p>}
          <button onClick={handleAddReferral} className="w-full rounded-lg bg-brand-600 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
            Add referral
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Referrals ({filtered.length})</h3>
          <button onClick={handleExport} className="rounded-lg border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50">
            Export CSV
          </button>
        </div>

        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by code, referrer, or referred name" className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs" />

        <div className="mb-2 flex flex-wrap gap-1.5">
          <button
            onClick={() => setStatusFilter('all')}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${statusFilter === 'all' ? 'bg-brand-600 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-50'}`}
          >
            All
          </button>
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${statusFilter === s ? 'bg-brand-600 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-50'}`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${preset === p ? 'bg-slate-700 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-50'}`}
            >
              {DATE_RANGE_PRESET_LABELS[p]}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="mb-3 grid grid-cols-2 gap-2">
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          </div>
        )}

        {filtered.length === 0 && <p className="text-xs text-slate-400">No referrals match.</p>}
        <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-lg border border-slate-200 p-2.5 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-700">
                    {r.code} · {r.referrerName} → {r.referredName}
                  </p>
                  <p className="mt-0.5 text-slate-500">
                    Registered {r.registeredAt ? new Date(r.registeredAt).toLocaleDateString() : '—'} · Verified{' '}
                    {r.verifiedAt ? new Date(r.verifiedAt).toLocaleDateString() : '—'} · First ride{' '}
                    {r.firstRideAt ? new Date(r.firstRideAt).toLocaleDateString() : '—'}
                  </p>
                  {r.coinsAwarded > 0 && <p className="mt-0.5 text-slate-400">{r.coinsAwarded} coins awarded</p>}
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE_CLASSES[r.status]}`}>{STATUS_LABELS[r.status]}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {r.status !== 'qualified' && r.status !== 'rewarded' && (
                  <button onClick={() => handleSetStatus(r.id, 'qualified')} className="rounded-md px-2 py-1 font-medium text-sky-600 underline hover:bg-sky-50">
                    Qualify
                  </button>
                )}
                {r.status === 'qualified' && (
                  <button onClick={() => handleSetStatus(r.id, 'rewarded')} className="rounded-md px-2 py-1 font-medium text-emerald-600 underline hover:bg-emerald-50">
                    Reward ({rewardRules.referral} coins)
                  </button>
                )}
                {r.status !== 'rejected' && (
                  <button onClick={() => handleSetStatus(r.id, 'rejected')} className="rounded-md px-2 py-1 font-medium text-rose-600 underline hover:bg-rose-50">
                    Reject
                  </button>
                )}
                {r.status !== 'fraud_review' && (
                  <button onClick={() => handleSetStatus(r.id, 'fraud_review')} className="rounded-md px-2 py-1 font-medium text-amber-700 underline hover:bg-amber-50">
                    Flag fraud review
                  </button>
                )}
                <button
                  onClick={() => {
                    removeReferral(r.id)
                    logActivity({ actorRole: 'admin', actorName: 'Admin', todaOrgId: null, action: 'IP · Deleted referral', summary: `Removed ${r.code}.` })
                  }}
                  className="rounded-md px-2 py-1 font-medium text-slate-500 underline hover:bg-slate-100"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
