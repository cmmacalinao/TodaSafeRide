import { useState } from 'react'
import { useRides } from '../context/RideContext'
import { useSession } from '../context/SessionContext'
import type { Investor, InvestorStatus, ShareClass } from '../types'

const SHARE_CLASS_LABELS: Record<ShareClass, string> = {
  common: 'Common',
  preferred: 'Preferred',
  other: 'Other',
}

const STATUS_LABELS: Record<InvestorStatus, string> = {
  proposed: 'Proposed',
  active: 'Active',
  exited: 'Exited',
}

const STATUS_BADGE_CLASSES: Record<InvestorStatus, string> = {
  proposed: 'bg-slate-100 text-slate-600',
  active: 'bg-emerald-100 text-emerald-700',
  exited: 'bg-amber-100 text-amber-700',
}

const todayIso = () => new Date().toISOString().slice(0, 10)

// Tracks investment rounds against the cap table's 30% Investor Pool
// (equityAllocations, category 'Investors') without automatically mutating
// it — per the master structure doc's "don't automatically issue equity"
// principle, mirroring a round into the cap table is a deliberate action
// (see handleAddToCapTable below), not a side effect of adding the record.
export function InvestorManager() {
  const { investors, equityAllocations, addInvestor, updateInvestor, removeInvestor, addEquityAllocation, logActivity } =
    useRides()
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
  const [investorName, setInvestorName] = useState('')
  const [investmentDate, setInvestmentDate] = useState(todayIso())
  const [investmentAmount, setInvestmentAmount] = useState('')
  const [investmentRound, setInvestmentRound] = useState('')
  const [preMoneyValuation, setPreMoneyValuation] = useState('')
  const [postMoneyValuation, setPostMoneyValuation] = useState('')
  const [sharePercentage, setSharePercentage] = useState('')
  const [shareClass, setShareClass] = useState<ShareClass>('common')
  const [agreementReference, setAgreementReference] = useState('')
  const [status, setStatus] = useState<InvestorStatus>('proposed')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const investorPoolPct = equityAllocations
    .filter((a) => a.category === 'Investors')
    .reduce((sum, a) => sum + a.percentage, 0)
  const totalInvested = investors.reduce((sum, inv) => sum + inv.investmentAmount, 0)
  const totalSharePct = investors.reduce((sum, inv) => sum + inv.sharePercentage, 0)

  const pre = Number(preMoneyValuation)
  const amount = Number(investmentAmount)
  const post = Number(postMoneyValuation)
  const suggestedPost = Number.isFinite(pre) && pre > 0 && Number.isFinite(amount) && amount > 0 ? pre + amount : null
  const effectivePost = Number.isFinite(post) && post > 0 ? post : suggestedPost
  const suggestedSharePct =
    effectivePost && effectivePost > 0 && Number.isFinite(amount) && amount > 0 ? (amount / effectivePost) * 100 : null

  function resetForm() {
    setEditingId(null)
    setInvestorName('')
    setInvestmentDate(todayIso())
    setInvestmentAmount('')
    setInvestmentRound('')
    setPreMoneyValuation('')
    setPostMoneyValuation('')
    setSharePercentage('')
    setShareClass('common')
    setAgreementReference('')
    setStatus('proposed')
    setNotes('')
    setError('')
  }

  function handleStartEdit(inv: Investor) {
    setEditingId(inv.id)
    setInvestorName(inv.investorName)
    setInvestmentDate(inv.investmentDate)
    setInvestmentAmount(String(inv.investmentAmount))
    setInvestmentRound(inv.investmentRound)
    setPreMoneyValuation(inv.preMoneyValuation != null ? String(inv.preMoneyValuation) : '')
    setPostMoneyValuation(inv.postMoneyValuation != null ? String(inv.postMoneyValuation) : '')
    setSharePercentage(String(inv.sharePercentage))
    setShareClass(inv.shareClass)
    setAgreementReference(inv.agreementReference ?? '')
    setStatus(inv.status)
    setNotes(inv.notes ?? '')
    setError('')
  }

  function handleSave() {
    const amt = Number(investmentAmount)
    const pct = Number(sharePercentage)
    if (!investorName.trim()) {
      setError('Enter the investor name.')
      return
    }
    if (!investmentRound.trim()) {
      setError('Enter the investment round (e.g. Seed, Series A).')
      return
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a valid investment amount greater than 0.')
      return
    }
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      setError('Enter a share percentage between 0 and 100.')
      return
    }
    const args = {
      investorName: investorName.trim(),
      investmentDate,
      investmentAmount: amt,
      investmentRound: investmentRound.trim(),
      preMoneyValuation: Number.isFinite(pre) && pre > 0 ? pre : null,
      postMoneyValuation: Number.isFinite(post) && post > 0 ? post : suggestedPost,
      sharePercentage: pct,
      shareClass,
      agreementReference: agreementReference.trim() || null,
      status,
      notes: notes.trim() || null,
    }
    if (editingId) {
      updateInvestor(editingId, args)
      logSuperAdmin('Updated investor', `${args.investorName} — ${args.investmentRound}, ₱${args.investmentAmount.toLocaleString()}, ${args.status}.`)
    } else {
      addInvestor(args)
      logSuperAdmin('Added investor', `${args.investorName} — ${args.investmentRound}, ₱${args.investmentAmount.toLocaleString()}, ${args.status}.`)
    }
    resetForm()
  }

  function handleAddToCapTable(inv: Investor) {
    addEquityAllocation({
      holderName: inv.investorName,
      category: 'Investors',
      percentage: inv.sharePercentage,
      notes: `${inv.investmentRound} round — ₱${inv.investmentAmount.toLocaleString()} invested ${new Date(inv.investmentDate).toLocaleDateString()}, added by ${accountingOfficerName ?? 'officer'}.`,
    })
    logSuperAdmin('Mirrored investor to cap table', `${inv.investorName} added to cap table at ${inv.sharePercentage}% (Investors).`)
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Investor management</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            totalSharePct <= investorPoolPct ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
          }`}
        >
          {totalSharePct.toFixed(1)}% of {investorPoolPct}% pool
        </span>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Tracks investment rounds against the cap table's Investor Pool — adding a record here doesn't touch the cap
        table by itself; use "Add to cap table" on an active investor to mirror it there deliberately.
      </p>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Total invested</p>
          <p className="text-lg font-semibold text-indigo-700">₱{totalInvested.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Rounds tracked</p>
          <p className="text-lg font-semibold text-slate-700">{investors.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Investor pool used</p>
          <p className="text-lg font-semibold text-slate-700">
            {totalSharePct.toFixed(1)}% / {investorPoolPct}%
          </p>
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        {editingId && <p className="text-xs font-medium text-brand-700">Editing investor</p>}
        <div className="grid grid-cols-2 gap-2">
          <input
            value={investorName}
            onChange={(e) => setInvestorName(e.target.value)}
            placeholder="Investor name"
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
          <input
            value={investmentRound}
            onChange={(e) => setInvestmentRound(e.target.value)}
            placeholder="Round (e.g. Seed)"
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-500">Investment date</span>
            <input
              type="date"
              value={investmentDate}
              onChange={(e) => setInvestmentDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-500">Investment amount</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">₱</span>
              <input
                type="number"
                min={0}
                value={investmentAmount}
                onChange={(e) => setInvestmentAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
              />
            </div>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-500">Pre-money valuation (optional)</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">₱</span>
              <input
                type="number"
                min={0}
                value={preMoneyValuation}
                onChange={(e) => setPreMoneyValuation(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-500">
              Post-money valuation{suggestedPost ? ` (≈₱${suggestedPost.toLocaleString()})` : ' (optional)'}
            </span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">₱</span>
              <input
                type="number"
                min={0}
                value={postMoneyValuation}
                onChange={(e) => setPostMoneyValuation(e.target.value)}
                placeholder={suggestedPost ? String(suggestedPost) : ''}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
              />
            </div>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-500">
              Share %{suggestedSharePct ? ` (≈${suggestedSharePct.toFixed(1)}%)` : ''}
            </span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={sharePercentage}
                onChange={(e) => setSharePercentage(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
              />
              <span className="text-xs text-slate-500">%</span>
              {suggestedSharePct && (
                <button
                  type="button"
                  onClick={() => setSharePercentage(suggestedSharePct.toFixed(1))}
                  className="shrink-0 rounded-md border border-slate-300 px-1.5 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-100"
                >
                  Use
                </button>
              )}
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-500">Share class</span>
            <select
              value={shareClass}
              onChange={(e) => setShareClass(e.target.value as ShareClass)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
            >
              {(Object.keys(SHARE_CLASS_LABELS) as ShareClass[]).map((c) => (
                <option key={c} value={c}>
                  {SHARE_CLASS_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={agreementReference}
            onChange={(e) => setAgreementReference(e.target.value)}
            placeholder="Agreement reference (optional)"
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as InvestorStatus)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
          >
            {(Object.keys(STATUS_LABELS) as InvestorStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          rows={2}
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
        />
        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            {editingId ? 'Save changes' : 'Add investor round'}
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

      {investors.length > 0 && (
        <div className="mt-3 space-y-2">
          {investors.map((inv) => {
            const inCapTable = equityAllocations.some(
              (a) => a.category === 'Investors' && a.holderName === inv.investorName,
            )
            return (
              <div key={inv.id} className="rounded-lg border border-slate-200 p-2.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-700">
                      {inv.investorName} <span className="font-normal text-slate-400">· {inv.investmentRound}</span>
                    </p>
                    <p className="mt-0.5 text-slate-500">
                      ₱{inv.investmentAmount.toLocaleString()} · {inv.sharePercentage}% ·{' '}
                      {SHARE_CLASS_LABELS[inv.shareClass]}
                      {inv.postMoneyValuation ? ` · post-money ₱${inv.postMoneyValuation.toLocaleString()}` : ''}
                    </p>
                    <p className="mt-0.5 text-slate-400">
                      {new Date(inv.investmentDate).toLocaleDateString()}
                      {inv.agreementReference ? ` · Ref: ${inv.agreementReference}` : ''}
                    </p>
                    {inv.notes && <p className="mt-0.5 text-slate-400">{inv.notes}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE_CLASSES[inv.status]}`}>
                    {STATUS_LABELS[inv.status]}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => handleStartEdit(inv)}
                    className="rounded-md px-2 py-1 font-medium text-brand-600 underline hover:bg-brand-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      removeInvestor(inv.id)
                      logSuperAdmin('Deleted investor', `Removed ${inv.investorName} — ${inv.investmentRound}, ₱${inv.investmentAmount.toLocaleString()}.`)
                    }}
                    className="rounded-md px-2 py-1 font-medium text-rose-600 underline hover:bg-rose-50"
                  >
                    Delete
                  </button>
                  {inv.status === 'active' && (
                    <button
                      onClick={() => handleAddToCapTable(inv)}
                      disabled={inCapTable}
                      className="rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {inCapTable ? '✓ In cap table' : 'Add to cap table'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
