import { useState } from 'react'
import { useRides } from '../context/RideContext'
import { coinTotals, coinsToPesos } from '../lib/incomePromotion'
import type { CoinDirection, CoinSource } from '../types'

const REWARD_RULE_FIELDS: { key: keyof import('../types').RewardRules; label: string }[] = [
  { key: 'registration', label: 'Registration reward' },
  { key: 'verification', label: 'Verification reward' },
  { key: 'ride', label: 'Ride reward' },
  { key: 'rating', label: 'Rating reward' },
  { key: 'review', label: 'Review reward' },
  { key: 'referral', label: 'Referral reward' },
  { key: 'socialShare', label: 'Social share reward' },
  { key: 'safety', label: 'Safety reward' },
  { key: 'campaign', label: 'Campaign reward (base)' },
]

const SOURCE_OPTIONS: CoinSource[] = [
  'registration',
  'verification',
  'ride',
  'rating',
  'review',
  'referral',
  'social_share',
  'safety',
  'campaign',
  'admin_adjustment',
  'ride_credit_redemption',
]

const DIRECTION_LABELS: Record<CoinDirection, string> = {
  issued: 'Issue',
  redeemed: 'Redeem',
  adjusted: 'Adjust (+)',
  expired: 'Expire',
}

export function IncomePromotionRewards() {
  const {
    passengers,
    drivers,
    rewardRules,
    coinTransactions,
    rideCreditTiers,
    setRewardRules,
    addCoinTransaction,
    removeCoinTransaction,
    logActivity,
  } = useRides()

  const [ruleDrafts, setRuleDrafts] = useState<Record<string, string>>(
    Object.fromEntries(REWARD_RULE_FIELDS.map((f) => [f.key, String(rewardRules[f.key])])),
  )
  const [ruleError, setRuleError] = useState('')

  const [actorType, setActorType] = useState<'passenger' | 'driver'>('passenger')
  const [actorId, setActorId] = useState('')
  const [direction, setDirection] = useState<CoinDirection>('issued')
  const [source, setSource] = useState<CoinSource>('admin_adjustment')
  const [txAmount, setTxAmount] = useState('')
  const [note, setNote] = useState('')
  const [txError, setTxError] = useState('')

  const totals = coinTotals(coinTransactions)
  const rewardCostPesos = coinsToPesos(totals.issued, rideCreditTiers)
  const rideCreditsRedeemedPesos = coinsToPesos(
    coinTransactions.filter((t) => t.source === 'ride_credit_redemption' && t.direction === 'redeemed').reduce((s, t) => s + t.amount, 0),
    rideCreditTiers,
  )

  const actorOptions = actorType === 'passenger' ? passengers : drivers

  function handleSaveRules() {
    const parsed: Partial<import('../types').RewardRules> = {}
    for (const f of REWARD_RULE_FIELDS) {
      const n = Number(ruleDrafts[f.key])
      if (!Number.isFinite(n) || n < 0) {
        setRuleError(`${f.label} must be a number of 0 or more.`)
        return
      }
      parsed[f.key] = n
    }
    setRuleError('')
    setRewardRules(parsed as import('../types').RewardRules)
    logActivity({
      actorRole: 'admin',
      actorName: 'Admin',
      todaOrgId: null,
      action: 'IP · Updated reward rules',
      summary: REWARD_RULE_FIELDS.map((f) => `${f.label}: ${parsed[f.key]}`).join(', '),
    })
  }

  function handleAddTransaction() {
    const amt = Number(txAmount)
    if (!actorId) {
      setTxError('Choose a passenger or driver.')
      return
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setTxError('Enter a valid coin amount greater than 0.')
      return
    }
    const actor = actorOptions.find((a) => a.id === actorId)
    if (!actor) {
      setTxError('Selected actor not found.')
      return
    }
    setTxError('')
    addCoinTransaction({
      actorType,
      actorId,
      actorName: actor.name,
      direction,
      source,
      amount: amt,
      note: note.trim() || null,
      recordedBy: 'Admin',
    })
    logActivity({
      actorRole: 'admin',
      actorName: 'Admin',
      todaOrgId: null,
      action: `IP · ${DIRECTION_LABELS[direction]}d coins`,
      summary: `${actor.name} (${actorType}) — ${amt} coins, source: ${source}${note.trim() ? ` — "${note.trim()}"` : ''}.`,
    })
    setActorId('')
    setTxAmount('')
    setNote('')
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs text-slate-500">Total coins issued</p>
          <p className="text-lg font-semibold text-brand-700">{totals.issued.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs text-slate-500">Total coins redeemed</p>
          <p className="text-lg font-semibold text-brand-700">{totals.redeemed.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs text-slate-500">Outstanding coins</p>
          <p className="text-lg font-semibold text-brand-700">{totals.outstanding.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs text-slate-500">Ride credits redeemed</p>
          <p className="text-lg font-semibold text-brand-700">₱{rideCreditsRedeemedPesos.toLocaleString()}</p>
        </div>
        <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs text-slate-500">Reward cost (all issued coins, at current conversion rate)</p>
          <p className="text-lg font-semibold text-brand-700">₱{rewardCostPesos.toLocaleString()}</p>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-slate-700">Reward rules</h3>
        <p className="mb-3 text-xs text-slate-500">TODARIDE COINS awarded automatically for each action — a Campaign can still override its own reward amount.</p>
        <div className="grid grid-cols-2 gap-2">
          {REWARD_RULE_FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="mb-1 block text-[11px] text-slate-500">{f.label}</span>
              <input
                type="number"
                min={0}
                value={ruleDrafts[f.key]}
                onChange={(e) => setRuleDrafts((prev) => ({ ...prev, [f.key]: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
          ))}
        </div>
        {ruleError && <p className="mt-2 text-xs font-medium text-rose-600">{ruleError}</p>}
        <button onClick={handleSaveRules} className="mt-3 w-full rounded-lg bg-brand-600 py-2 text-xs font-semibold text-white hover:bg-brand-700">
          Save reward rules
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-slate-700">Issue, adjust, or redeem coins</h3>
        <p className="mb-3 text-xs text-slate-500">A manual entry to the TODARIDE COINS ledger — for corrections, one-off rewards, or recording a redemption.</p>
        <div className="space-y-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={actorType}
              onChange={(e) => {
                setActorType(e.target.value as 'passenger' | 'driver')
                setActorId('')
              }}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
            >
              <option value="passenger">Passenger</option>
              <option value="driver">Driver</option>
            </select>
            <select value={actorId} onChange={(e) => setActorId(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs">
              <option value="">Select {actorType}</option>
              {actorOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select value={direction} onChange={(e) => setDirection(e.target.value as CoinDirection)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs">
              {(Object.keys(DIRECTION_LABELS) as CoinDirection[]).map((d) => (
                <option key={d} value={d}>
                  {DIRECTION_LABELS[d]}
                </option>
              ))}
            </select>
            <select value={source} onChange={(e) => setSource(e.target.value as CoinSource)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs">
              {SOURCE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input type="number" min={1} value={txAmount} onChange={(e) => setTxAmount(e.target.value)} placeholder="Coins" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          {txError && <p className="text-xs font-medium text-rose-600">{txError}</p>}
          <button onClick={handleAddTransaction} className="w-full rounded-lg bg-brand-600 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
            Record
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Reward transactions</h3>
        {coinTransactions.length === 0 && <p className="text-xs text-slate-400">No coin transactions yet.</p>}
        <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
          {coinTransactions.map((t) => (
            <div key={t.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 p-2.5 text-xs">
              <div>
                <p className="font-medium text-slate-700">
                  {t.actorName} ({t.actorType}) · {DIRECTION_LABELS[t.direction]} {t.amount} coins
                </p>
                <p className="mt-0.5 text-slate-500">
                  {t.source} · {new Date(t.at).toLocaleString()} · by {t.recordedBy}
                </p>
                {t.note && <p className="mt-0.5 text-slate-400">{t.note}</p>}
              </div>
              <button
                onClick={() => {
                  removeCoinTransaction(t.id)
                  logActivity({
                    actorRole: 'admin',
                    actorName: 'Admin',
                    todaOrgId: null,
                    action: 'IP · Removed coin transaction',
                    summary: `Removed ${t.direction} of ${t.amount} coins for ${t.actorName}.`,
                  })
                }}
                className="shrink-0 rounded-md px-2 py-1 text-rose-600 hover:bg-rose-50"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
