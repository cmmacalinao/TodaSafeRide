import { useState } from 'react'
import { useRides } from '../context/RideContext'
import { useSession } from '../context/SessionContext'
import { DocumentUploadField } from './DocumentUploadField'
import { fundClosingBalance, fundTotalAllocations, fundTotalCommitted, fundTotalSpent } from '../lib/socialImpact'
import type { SocialImpactTransactionCategory, SocialImpactTransactionStatus } from '../types'

const CATEGORY_LABELS: Record<SocialImpactTransactionCategory, string> = {
  fund_allocation: 'Fund allocation',
  project_commitment: 'Project commitment',
  project_expense: 'Project expense',
  transfer: 'Transfer',
  adjustment: 'Adjustment',
}

const STATUS_LABELS: Record<SocialImpactTransactionStatus, string> = {
  proposed: 'Proposed',
  approved: 'Approved',
  allocated: 'Allocated',
  disbursed: 'Disbursed',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const todayIso = () => new Date().toISOString().slice(0, 10)

// Not a dividend to any Community Partner/NGO or TODA Partner — those
// beneficiary organizations hold 0% equity (see RotaryProject.partner in
// types). This is the platform's own fund; money only ever leaves it
// through a deliberately logged transaction (project_expense/transfer),
// never automatically, even when a period's allocation is calculated below.
export function SocialImpactFundManager() {
  const {
    rides,
    expenses,
    rotaryProjects,
    socialImpactFundPct,
    socialImpactTransactions,
    setSocialImpactFundPct,
    addSocialImpactTransaction,
    removeSocialImpactTransaction,
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

  const [pctInput, setPctInput] = useState(String(socialImpactFundPct))
  const [pctError, setPctError] = useState('')

  const [date, setDate] = useState(todayIso())
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<SocialImpactTransactionCategory>('fund_allocation')
  const [projectId, setProjectId] = useState('')
  const [status, setStatus] = useState<SocialImpactTransactionStatus>('approved')
  const [docDataUrl, setDocDataUrl] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Same formula as the "Net income" figure already shown elsewhere in this
  // page (totalIncome - totalExpenses) — reused here rather than redefined,
  // so this and the income summary above never disagree with each other.
  const totalIncome = rides.filter((r) => r.status === 'completed').reduce((sum, r) => sum + (r.payment?.amount ?? 0), 0)
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const netDistributableProfit = totalIncome - totalExpenses
  const suggestedAllocation = Math.max(0, netDistributableProfit * (socialImpactFundPct / 100))

  const closingBalance = fundClosingBalance(socialImpactTransactions)
  const totalAllocations = fundTotalAllocations(socialImpactTransactions)
  const totalCommitted = fundTotalCommitted(socialImpactTransactions)
  const totalSpent = fundTotalSpent(socialImpactTransactions)

  function handleSavePct() {
    const pct = Number(pctInput)
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setPctError('Enter a percentage between 0 and 100.')
      return
    }
    setPctError('')
    setSocialImpactFundPct(pct)
    logSuperAdmin('Updated Social Impact Fund %', `Fund allocation set to ${pct}% of net distributable profit.`)
  }

  function handlePrefillAllocation() {
    setCategory('fund_allocation')
    setDescription(`Social Impact Fund allocation — ${new Date().toLocaleDateString()}`)
    setAmount(String(Math.round(suggestedAllocation)))
    setProjectId('')
  }

  function resetForm() {
    setDate(todayIso())
    setDescription('')
    setAmount('')
    setCategory('fund_allocation')
    setProjectId('')
    setStatus('approved')
    setDocDataUrl(null)
    setError('')
  }

  function handleAdd() {
    const amt = Number(amount)
    if (!description.trim()) {
      setError('Add a short description.')
      return
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a valid amount greater than 0.')
      return
    }
    addSocialImpactTransaction({
      date,
      description: description.trim(),
      amount: amt,
      projectId: projectId || null,
      category,
      status,
      approvedBy: accountingOfficerName ?? 'Officer',
      supportingDocDataUrl: docDataUrl,
    })
    logSuperAdmin('Logged Social Impact Fund transaction', `${category} — ₱${amt.toLocaleString()}: "${description.trim()}".`)
    resetForm()
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-1 text-sm font-semibold text-slate-700">Social Impact Fund</h3>
      <p className="mb-3 text-xs text-slate-500">
        Not a dividend to any Community Partner/NGO or TODA Partner — those hold 0% equity. This is the platform's
        own fund, set aside as a % of net distributable profit; money only leaves it through a deliberately logged
        transaction below.
      </p>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Net distributable profit</p>
          <p className={`text-lg font-semibold ${netDistributableProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            ₱{netDistributableProfit.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
          <p className="text-xs text-slate-500">Suggested allocation ({socialImpactFundPct}%)</p>
          <p className="text-lg font-semibold text-indigo-700">₱{Math.round(suggestedAllocation).toLocaleString()}</p>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium text-slate-500">Fund % of net profit</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={100}
              value={pctInput}
              onChange={(e) => setPctInput(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />
            <span className="text-xs text-slate-500">%</span>
          </div>
        </label>
        <button
          onClick={handleSavePct}
          className="mt-4 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          Save %
        </button>
      </div>
      {pctError && <p className="mb-2 text-xs font-medium text-rose-600">{pctError}</p>}

      <div className="mb-3 grid grid-cols-4 gap-2">
        <div className="rounded-lg border border-slate-200 p-2 text-center">
          <p className="text-[10px] text-slate-500">Allocated</p>
          <p className="text-sm font-semibold text-emerald-700">₱{totalAllocations.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-2 text-center">
          <p className="text-[10px] text-slate-500">Committed</p>
          <p className="text-sm font-semibold text-amber-700">₱{totalCommitted.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-2 text-center">
          <p className="text-[10px] text-slate-500">Spent</p>
          <p className="text-sm font-semibold text-rose-700">₱{totalSpent.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-2 text-center">
          <p className="text-[10px] text-slate-500">Balance</p>
          <p className="text-sm font-semibold text-indigo-700">₱{closingBalance.toLocaleString()}</p>
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-slate-600">Log a fund transaction</p>
          <button
            type="button"
            onClick={handlePrefillAllocation}
            className="text-[11px] font-medium text-brand-600 hover:text-brand-700"
          >
            Use this period's suggested allocation
          </button>
        </div>
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
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as SocialImpactTransactionCategory)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
          >
            {(Object.keys(CATEGORY_LABELS) as SocialImpactTransactionCategory[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as SocialImpactTransactionStatus)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
          >
            {(Object.keys(STATUS_LABELS) as SocialImpactTransactionStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        {(category === 'project_commitment' || category === 'project_expense') && (
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
          >
            <option value="">No specific project</option>
            {rotaryProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.projectName}
              </option>
            ))}
          </select>
        )}
        <DocumentUploadField label="Supporting document (optional)" dataUrl={docDataUrl} onUpload={setDocDataUrl} />
        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
        <button
          onClick={handleAdd}
          className="w-full rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          Log transaction
        </button>
      </div>

      {socialImpactTransactions.length > 0 && (
        <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-2.5 py-1.5 text-left font-medium">Date</th>
                <th className="px-2.5 py-1.5 text-left font-medium">Category</th>
                <th className="px-2.5 py-1.5 text-left font-medium">Description</th>
                <th className="px-2.5 py-1.5 text-right font-medium">Amount</th>
                <th className="px-2.5 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {socialImpactTransactions.map((t) => (
                <tr key={t.id} className="border-t border-slate-200">
                  <td className="whitespace-nowrap px-2.5 py-1.5 text-slate-500">
                    {new Date(t.date).toLocaleDateString()}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 text-slate-600">{CATEGORY_LABELS[t.category]}</td>
                  <td className="px-2.5 py-1.5 text-slate-700">
                    {t.description}
                    <span className="ml-1 text-slate-400">({STATUS_LABELS[t.status]})</span>
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 text-right font-medium text-slate-700">
                    ₱{t.amount.toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 text-right">
                    <button
                      onClick={() => {
                        removeSocialImpactTransaction(t.id)
                        logSuperAdmin('Deleted Social Impact Fund transaction', `Removed "${t.description}" — ₱${t.amount.toLocaleString()}.`)
                      }}
                      className="text-rose-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
