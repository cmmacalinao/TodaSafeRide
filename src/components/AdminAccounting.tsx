import { useMemo, useState } from 'react'
import { useRides } from '../context/RideContext'
import { useSession } from '../context/SessionContext'
import { ACCOUNTING_OFFICER_CREDENTIALS, COMPLIANCE_CHECKLIST, EXPENSE_CATEGORY_LABELS, isPastDeadline } from '../mock/data'
import { CategoryBarChart } from './charts/CategoryBarChart'
import { DailyBarChart } from './charts/DailyBarChart'
import { SimpleOtpStep } from './SimpleOtpStep'
import { InvestorManager } from './InvestorManager'
import { FounderContributionManager } from './FounderContributionManager'
import { SocialImpactFundManager } from './SocialImpactFundManager'
import { RotaryProjectManager } from './RotaryProjectManager'
import { RccIncentiveManager } from './RccIncentiveManager'
import { DistributionManager } from './DistributionManager'
import { CorporateStructureReport } from './CorporateStructureReport'
import { CapitalizationStockholdingPage } from './CapitalizationStockholdingPage'
import { ActivityLogPanel } from './ActivityLogPanel'
import { amountsByPeriod, REPORT_PERIOD_DEFAULT_COUNT, REPORT_PERIOD_LABELS, type ReportPeriod } from '../lib/insights'
import { buildLedger, LEDGER_TYPE_LABELS } from '../lib/ledger'
import type { AccountingOfficer, EquityHolderCategory, ExpenseCategory } from '../types'

const EXPENSE_CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]
const EQUITY_CATEGORIES: EquityHolderCategory[] = [
  'Founder',
  'Investors',
  'Developers & Key Personnel',
  'Strategic / Community Pool',
  'Future Investor / Employee Pool',
  'Other',
]

// A second, independent access layer on top of the Admin login — gated by
// its own password (ACCOUNTING_OFFICER_CREDENTIALS, separate from
// APP_ADMIN_CREDENTIALS) so "can operate the platform" and "can see the
// books" stay different permissions, the way a real cooperative/TODA would
// restrict finances to a treasurer. Deliberately re-locks on every mount
// (component state, not persisted) rather than staying unlocked across
// reloads like the main admin session does — this is the extra-protected
// area, so it should ask again.
export function AdminAccounting() {
  const {
    rides,
    expenses,
    complianceChecked,
    complianceReview,
    capitalContributions,
    addExpense,
    deleteExpense,
    toggleComplianceItem,
    setComplianceNote,
    addCapitalContribution,
    deleteCapitalContribution,
    accountingOfficers,
    activityLog,
    logActivity,
  } = useRides()
  const { setAccountingOfficerName } = useSession()
  const [unlocked, setUnlocked] = useState(false)
  const [officerName, setOfficerName] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [error, setError] = useState('')
  const [loginStep, setLoginStep] = useState<'credentials' | 'otp'>('credentials')
  const [matchedOfficer, setMatchedOfficer] = useState<AccountingOfficer | null>(null)

  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>('other')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseDescription, setExpenseDescription] = useState('')
  const [expenseError, setExpenseError] = useState('')
  const [expenseSearch, setExpenseSearch] = useState('')

  const [complianceNoteDrafts, setComplianceNoteDrafts] = useState<Record<string, string>>({})
  const [complianceDeadlineDrafts, setComplianceDeadlineDrafts] = useState<Record<string, string>>({})

  // "Super Admin" — matches the NavBar badge shown once an officer unlocks
  // this page (see NavBar.tsx's location.pathname === '/admin/accounting'
  // check) vs. the plain "Admin" badge everywhere else under /admin.
  function logSuperAdmin(action: string, summary: string) {
    logActivity({
      actorRole: 'super_admin',
      actorName: `Super Admin${officerName ? ` - ${officerName}` : ''}`,
      todaOrgId: null,
      action,
      summary,
    })
  }

  function handleApproveComplianceAsNoted(itemId: string, itemLabel: string) {
    const note = (complianceNoteDrafts[itemId] ?? '').trim() || null
    const days = Number(complianceDeadlineDrafts[itemId])
    const deadlineAt =
      Number.isFinite(days) && days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null
    setComplianceNote(itemId, note, deadlineAt)
    logSuperAdmin(
      'Approved compliance item as noted',
      `"${itemLabel}" approved as noted${note ? ` — "${note}"` : ''}${deadlineAt ? `, due ${new Date(deadlineAt).toLocaleDateString()}` : ''}.`,
    )
  }

  const [stockholderName, setStockholderName] = useState('')
  const [shareCount, setShareCount] = useState('')
  const [capitalAmount, setCapitalAmount] = useState('')
  const [capitalError, setCapitalError] = useState('')

  function handleCheckCredentials() {
    if (!emailInput.trim()) {
      setError('Enter your registered email.')
      return
    }
    const officer = accountingOfficers.find((o) => o.email.toLowerCase() === emailInput.trim().toLowerCase())
    if (!officer) {
      setError('This email is not a registered accounting officer. Ask the App Admin to add you first.')
      return
    }
    if (passwordInput !== ACCOUNTING_OFFICER_CREDENTIALS.password) {
      setError('Incorrect access password.')
      return
    }
    setError('')
    setMatchedOfficer(officer)
    setLoginStep('otp')
  }

  function handleOtpVerified() {
    if (!matchedOfficer) return
    setOfficerName(matchedOfficer.name)
    setAccountingOfficerName(matchedOfficer.name)
    setUnlocked(true)
  }

  function handleLock() {
    setUnlocked(false)
    setLoginStep('credentials')
    setPasswordInput('')
    setEmailInput('')
    setMatchedOfficer(null)
    setOfficerName('')
    setAccountingOfficerName(null)
  }

  function handleAddExpense() {
    const amount = Number(expenseAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setExpenseError('Enter a valid amount greater than 0.')
      return
    }
    if (!expenseDescription.trim()) {
      setExpenseError('Add a short description for the record.')
      return
    }
    addExpense({
      category: expenseCategory,
      amount,
      description: expenseDescription.trim(),
      recordedBy: officerName.trim(),
    })
    logSuperAdmin('Recorded expense', `₱${amount} — ${EXPENSE_CATEGORY_LABELS[expenseCategory]}: "${expenseDescription.trim()}".`)
    setExpenseAmount('')
    setExpenseDescription('')
    setExpenseError('')
  }

  function handleAddCapital() {
    const shares = Number(shareCount)
    const amount = Number(capitalAmount)
    if (!stockholderName.trim()) {
      setCapitalError('Enter the stockholder name.')
      return
    }
    if (!Number.isFinite(shares) || shares <= 0) {
      setCapitalError('Enter a valid number of shares greater than 0.')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setCapitalError('Enter a valid amount invested greater than 0.')
      return
    }
    addCapitalContribution({
      stockholderName: stockholderName.trim(),
      shares,
      amount,
      recordedBy: officerName.trim(),
    })
    logSuperAdmin('Recorded capital contribution', `${stockholderName.trim()} — ${shares} shares, ₱${amount}.`)
    setStockholderName('')
    setShareCount('')
    setCapitalAmount('')
    setCapitalError('')
  }

  const completedRides = rides.filter((r) => r.status === 'completed')
  const totalIncome = completedRides.reduce((sum, r) => sum + (r.payment?.amount ?? 0), 0)
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const netIncome = totalIncome - totalExpenses
  const checkedCount = COMPLIANCE_CHECKLIST.filter((item) => complianceChecked[item.id]).length
  const totalCapitalRaised = capitalContributions.reduce((sum, c) => sum + c.amount, 0)
  const totalShares = capitalContributions.reduce((sum, c) => sum + c.shares, 0)

  const expenseQuery = expenseSearch.trim().toLowerCase()
  const filteredExpenses = expenses.filter((e) => {
    if (!expenseQuery) return true
    return (
      EXPENSE_CATEGORY_LABELS[e.category].toLowerCase().includes(expenseQuery) ||
      e.description.toLowerCase().includes(expenseQuery) ||
      e.recordedBy.toLowerCase().includes(expenseQuery)
    )
  })

  if (!unlocked) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-lg leading-none">🔒</span>
          <h2 className="text-sm font-semibold text-slate-700">Accounting &amp; Compliance — Restricted</h2>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Income/expense records and the regulatory checklist are limited to registered finance officers — only an
          email the App Admin has added to the officer roster can unlock this page, on top of the shared access
          password and a one-time code.
        </p>

        {loginStep === 'otp' && matchedOfficer ? (
          <div className="space-y-3">
            <p className="rounded-lg bg-brand-50 p-2 text-xs text-brand-800">
              Credentials confirmed for <span className="font-semibold">{matchedOfficer.name}</span> (
              {matchedOfficer.position === 'Other'
                ? matchedOfficer.otherPositionLabel || 'Other'
                : matchedOfficer.position}
              ) — verify with a one-time code to finish unlocking.
            </p>
            <SimpleOtpStep
              destination={matchedOfficer.email}
              onVerified={handleOtpVerified}
              onCancel={() => setLoginStep('credentials')}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Registered email</label>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="you@todaride.ph"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Access password</label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCheckCredentials()}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
            <button
              onClick={handleCheckCredentials}
              className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Continue
            </button>
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Accounting &amp; Compliance</h2>
          <p className="text-xs text-slate-400">
            Signed in as {officerName}
            {matchedOfficer &&
              ` (${matchedOfficer.position === 'Other' ? matchedOfficer.otherPositionLabel || 'Other' : matchedOfficer.position})`}
          </p>
        </div>
        <button
          onClick={handleLock}
          className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 underline hover:bg-slate-100"
        >
          Lock
        </button>
      </div>

      <CorporateStructureReport />

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs text-slate-500">Total income</p>
          <p className="text-lg font-semibold text-emerald-700">₱{totalIncome.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs text-slate-500">Total expenses</p>
          <p className="text-lg font-semibold text-rose-700">₱{totalExpenses.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs text-slate-500">Net income</p>
          <p className={`text-lg font-semibold ${netIncome >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            ₱{netIncome.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-indigo-50/60 p-3 shadow-sm">
          <p className="text-xs text-slate-500">Total capital raised</p>
          <p className="text-lg font-semibold text-indigo-700">₱{totalCapitalRaised.toLocaleString()}</p>
          <p className="mt-0.5 text-[10px] text-slate-400">Equity, not income — kept off the P&amp;L above</p>
        </div>
      </div>

      <CategoryBarChart
        title="Income vs. expenses"
        data={[
          { label: 'Income', value: totalIncome },
          { label: 'Expenses', value: totalExpenses },
        ]}
        valuePrefix="₱"
      />

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-slate-700">Shareholder capital</h3>
        <p className="mb-3 text-xs text-slate-500">
          Money stockholders put into the business in exchange for shares. This is equity, not revenue — it never
          counts toward Total income or Net income above; it's tracked here as its own "Total capital raised" figure.
        </p>
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Stockholder name</span>
              <input
                value={stockholderName}
                onChange={(e) => setStockholderName(e.target.value)}
                placeholder="e.g. Maria Santos"
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Shares</span>
              <input
                type="number"
                min={0}
                value={shareCount}
                onChange={(e) => setShareCount(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Amount invested</span>
              <div className="flex items-center gap-1">
                <span className="text-sm text-slate-500">₱</span>
                <input
                  type="number"
                  min={0}
                  value={capitalAmount}
                  onChange={(e) => setCapitalAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
            </label>
          </div>
          {capitalError && <p className="text-xs font-medium text-rose-600">{capitalError}</p>}
          <button
            onClick={handleAddCapital}
            className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Add capital contribution
          </button>
        </div>

        {capitalContributions.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-2.5 py-1.5 text-left font-medium">Stockholder</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">Shares</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">Ownership</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">Amount</th>
                  <th className="px-2.5 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {capitalContributions.map((c) => (
                  <tr key={c.id} className="border-t border-slate-200">
                    <td className="px-2.5 py-1.5 font-medium text-slate-700">{c.stockholderName}</td>
                    <td className="px-2.5 py-1.5 text-right text-slate-600">{c.shares.toLocaleString()}</td>
                    <td className="px-2.5 py-1.5 text-right text-slate-600">
                      {totalShares > 0 ? ((c.shares / totalShares) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td className="px-2.5 py-1.5 text-right text-slate-600">₱{c.amount.toLocaleString()}</td>
                    <td className="px-2.5 py-1.5 text-right">
                      <button
                        onClick={() => {
                          deleteCapitalContribution(c.id)
                          logSuperAdmin('Deleted capital contribution', `Removed ${c.stockholderName} — ${c.shares.toLocaleString()} shares, ₱${c.amount.toLocaleString()}.`)
                        }}
                        className="rounded-md px-1.5 py-0.5 text-rose-600 hover:bg-rose-50"
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

      <CapTableSection />

      <CapitalizationStockholdingPage />

      <InvestorManager />

      <FounderContributionManager />

      <SocialImpactFundManager />

      <RotaryProjectManager />

      <RccIncentiveManager />

      <DistributionManager />

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-slate-700">Log a business expense</h3>
        <p className="mb-3 text-xs text-slate-500">
          Costs that never touched a ride payment — fuel subsidies, marketing, the SMS/Maps API bills, permits, etc.
        </p>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Category</span>
              <select
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value as ExpenseCategory)}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {EXPENSE_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Amount</span>
              <div className="flex items-center gap-1">
                <span className="text-sm text-slate-500">₱</span>
                <input
                  type="number"
                  min={0}
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Description</span>
            <input
              value={expenseDescription}
              onChange={(e) => setExpenseDescription(e.target.value)}
              placeholder="e.g. August Google Maps API bill"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          {expenseError && <p className="text-xs font-medium text-rose-600">{expenseError}</p>}
          <button
            onClick={handleAddExpense}
            className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Add expense
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Expense log</h3>
        {expenses.length === 0 ? (
          <p className="text-xs text-slate-400">No expenses logged yet.</p>
        ) : (
          <>
            <input
              value={expenseSearch}
              onChange={(e) => setExpenseSearch(e.target.value)}
              placeholder="Search by category, description, or officer"
              className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
            />
            {filteredExpenses.length === 0 && (
              <p className="text-xs text-slate-400">No expenses match "{expenseSearch.trim()}".</p>
            )}
            <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
              {filteredExpenses.map((e) => (
              <div
                key={e.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 p-2.5 text-xs"
              >
                <div>
                  <p className="font-medium text-slate-700">
                    {EXPENSE_CATEGORY_LABELS[e.category]} · ₱{e.amount.toLocaleString()}
                  </p>
                  <p className="mt-0.5 text-slate-500">{e.description}</p>
                  <p className="mt-0.5 text-slate-400">
                    {new Date(e.recordedAt).toLocaleDateString()} · logged by {e.recordedBy}
                  </p>
                </div>
                <button
                  onClick={() => {
                    deleteExpense(e.id)
                    logSuperAdmin('Deleted expense', `Removed ₱${e.amount.toLocaleString()} — ${EXPENSE_CATEGORY_LABELS[e.category]}: "${e.description}".`)
                  }}
                  className="shrink-0 rounded-md px-2 py-1 text-rose-600 hover:bg-rose-50"
                >
                  Delete
                </button>
              </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Corporate &amp; regulatory compliance checklist</h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {checkedCount}/{COMPLIANCE_CHECKLIST.length}
          </span>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Common obligations for running this as a registered PH transport business — a starting checklist to track
          against an accountant/lawyer, not legal advice.
        </p>
        <div className="space-y-2">
          {COMPLIANCE_CHECKLIST.map((item) => {
            const done = !!complianceChecked[item.id]
            const review = complianceReview[item.id]
            const overdue = !done && !!review?.deadlineAt && isPastDeadline(review.deadlineAt)
            return (
              <div key={item.id} className="rounded-lg border border-slate-200 p-2.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span>
                    <span className={`block font-medium ${done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-slate-500">{item.detail}</span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      done ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {done ? 'Approved' : 'Pending'}
                  </span>
                </div>

                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => {
                      toggleComplianceItem(item.id, true)
                      logSuperAdmin('Approved compliance item', `"${item.label}" marked approved.`)
                    }}
                    className="flex-1 rounded-lg bg-brand-600 py-1.5 font-semibold text-white hover:bg-brand-700"
                  >
                    Approved
                  </button>
                  <button
                    onClick={() => handleApproveComplianceAsNoted(item.id, item.label)}
                    className="flex-1 rounded-lg border border-amber-300 bg-amber-50 py-1.5 font-medium text-amber-700 hover:bg-amber-100"
                  >
                    Approve as noted
                  </button>
                  <button
                    onClick={() => {
                      toggleComplianceItem(item.id, false)
                      logSuperAdmin('Reverted compliance item', `"${item.label}" marked pending.`)
                    }}
                    className="flex-1 rounded-lg border border-slate-300 py-1.5 font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Pending
                  </button>
                </div>

                {!done && review?.note && (
                  <p className="mt-2 rounded-lg bg-amber-50 p-2 text-amber-800">
                    <span className="font-semibold">Note: </span>
                    {review.note}
                  </p>
                )}
                {!done && review?.deadlineAt && (
                  <p className={`mt-2 rounded-lg p-2 ${overdue ? 'bg-rose-50 font-medium text-rose-700' : 'bg-slate-50 text-slate-500'}`}>
                    {overdue
                      ? `Deadline passed on ${new Date(review.deadlineAt).toLocaleDateString()} — requirements were not submitted. Mark rejected in your own records or set a new deadline below.`
                      : `Submission deadline: ${new Date(review.deadlineAt).toLocaleDateString()}`}
                  </p>
                )}

                {!done && (
                  <div className="mt-2 space-y-1.5">
                    <textarea
                      value={complianceNoteDrafts[item.id] ?? review?.note ?? ''}
                      onChange={(e) => setComplianceNoteDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      placeholder="Note on what's still missing"
                      rows={2}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5"
                    />
                    <input
                      type="number"
                      min={1}
                      value={complianceDeadlineDrafts[item.id] ?? ''}
                      onChange={(e) =>
                        setComplianceDeadlineDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      placeholder="Days to submit"
                      className="w-28 rounded-lg border border-slate-300 px-2 py-1.5"
                    />
                    <p className="text-[11px] text-slate-400">
                      Fill these in, then click "Approve as noted" above to save them.
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <TransactionLedgerSection />

      <FinancialReportSection />

      <ActivityLogPanel
        title="Super Admin — Log History"
        entries={activityLog.filter((e) => e.actorRole === 'super_admin')}
        emptyMessage="No Super Admin (Accounting) changes logged yet."
      />
    </section>
  )
}

const CAP_TABLE_CATEGORY_ORDER: EquityHolderCategory[] = [
  'Founder',
  'Investors',
  'Developers & Key Personnel',
  'Strategic / Community Pool',
  'Future Investor / Employee Pool',
  'Other',
]

function CapTableSection() {
  const { equityAllocations, addEquityAllocation, updateEquityAllocation, removeEquityAllocation, logActivity } =
    useRides()
  const { accountingOfficerName } = useSession()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [holderName, setHolderName] = useState('')
  const [category, setCategory] = useState<EquityHolderCategory>('Founder')
  const [otherCategoryLabel, setOtherCategoryLabel] = useState('')
  const [percentage, setPercentage] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const totalPct = equityAllocations.reduce((sum, a) => sum + a.percentage, 0)
  const sortedAllocations = [...equityAllocations].sort((a, b) => {
    const catDiff = CAP_TABLE_CATEGORY_ORDER.indexOf(a.category) - CAP_TABLE_CATEGORY_ORDER.indexOf(b.category)
    if (catDiff !== 0) return catDiff
    return b.percentage - a.percentage
  })

  function resetForm() {
    setEditingId(null)
    setHolderName('')
    setCategory('Founder')
    setOtherCategoryLabel('')
    setPercentage('')
    setNotes('')
    setError('')
  }

  function handleStartEdit(id: string) {
    const a = equityAllocations.find((x) => x.id === id)
    if (!a) return
    setEditingId(a.id)
    setHolderName(a.holderName)
    setCategory(a.category)
    setOtherCategoryLabel(a.otherCategoryLabel ?? '')
    setPercentage(String(a.percentage))
    setNotes(a.notes ?? '')
    setError('')
  }

  function handleSave() {
    const pct = Number(percentage)
    if (!holderName.trim()) {
      setError('Enter the holder name.')
      return
    }
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      setError('Enter a percentage between 0 and 100.')
      return
    }
    if (category === 'Other' && !otherCategoryLabel.trim()) {
      setError('Enter a label for this category.')
      return
    }
    const args = {
      holderName: holderName.trim(),
      category,
      otherCategoryLabel: category === 'Other' ? otherCategoryLabel.trim() : null,
      percentage: pct,
      notes: notes.trim() || null,
    }
    if (editingId) {
      updateEquityAllocation(editingId, args)
      logActivity({
        actorRole: 'super_admin',
        actorName: `Super Admin${accountingOfficerName ? ` - ${accountingOfficerName}` : ''}`,
        todaOrgId: null,
        action: 'Updated cap table allocation',
        summary: `${args.holderName} (${args.category === 'Other' ? args.otherCategoryLabel : args.category}) set to ${pct}%.`,
      })
    } else {
      addEquityAllocation(args)
      logActivity({
        actorRole: 'super_admin',
        actorName: `Super Admin${accountingOfficerName ? ` - ${accountingOfficerName}` : ''}`,
        todaOrgId: null,
        action: 'Added cap table allocation',
        summary: `${args.holderName} (${args.category === 'Other' ? args.otherCategoryLabel : args.category}) added at ${pct}%.`,
      })
    }
    resetForm()
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Cap table — proposed corporate structure</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            totalPct === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {totalPct}% allocated
        </span>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Internal management data, not issued/legal shares — a starting structure to track against actual
        corporate/legal documentation. Separate from "Shareholder capital" above, which tracks actual cash paid in;
        this tracks the agreed ownership split (founder, investor pool, developer pool, etc.).
      </p>

      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        {editingId && <p className="text-xs font-medium text-brand-700">Editing allocation</p>}
        <div className="grid grid-cols-2 gap-2">
          <input
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
            placeholder="Holder name"
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
              placeholder="Percentage"
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />
            <span className="text-xs text-slate-500">%</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as EquityHolderCategory)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
          >
            {EQUITY_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {category === 'Other' ? (
            <input
              value={otherCategoryLabel}
              onChange={(e) => setOtherCategoryLabel(e.target.value)}
              placeholder="Category label"
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />
          ) : (
            <div />
          )}
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
            {editingId ? 'Save changes' : 'Add allocation'}
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

      {equityAllocations.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-2.5 py-1.5 text-left font-medium">Holder</th>
                <th className="px-2.5 py-1.5 text-left font-medium">Category</th>
                <th className="px-2.5 py-1.5 text-right font-medium">%</th>
                <th className="px-2.5 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {sortedAllocations.map((a) => (
                <tr key={a.id} className="border-t border-slate-200 align-top">
                  <td className="px-2.5 py-1.5 font-medium text-slate-700">
                    {a.holderName}
                    {a.notes && <p className="mt-0.5 font-normal text-slate-400">{a.notes}</p>}
                  </td>
                  <td className="px-2.5 py-1.5 text-slate-600">
                    {a.category === 'Other' ? a.otherCategoryLabel || 'Other' : a.category}
                  </td>
                  <td className="px-2.5 py-1.5 text-right text-slate-600">{a.percentage}%</td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 text-right">
                    <button
                      onClick={() => handleStartEdit(a.id)}
                      className="rounded-md px-1.5 py-0.5 text-brand-600 hover:bg-brand-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        removeEquityAllocation(a.id)
                        logActivity({
                          actorRole: 'super_admin',
                          actorName: `Super Admin${accountingOfficerName ? ` - ${accountingOfficerName}` : ''}`,
                          todaOrgId: null,
                          action: 'Removed cap table allocation',
                          summary: `Removed ${a.holderName} (${a.percentage}%).`,
                        })
                      }}
                      className="rounded-md px-1.5 py-0.5 text-rose-600 hover:bg-rose-50"
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

function TransactionLedgerSection() {
  const { rides, expenses, capitalContributions } = useRides()
  const [search, setSearch] = useState('')
  const entries = useMemo(
    () => buildLedger(rides, expenses, capitalContributions),
    [rides, expenses, capitalContributions],
  )
  const query = search.trim().toLowerCase()
  const filtered = entries.filter(
    (e) => !query || e.description.toLowerCase().includes(query) || LEDGER_TYPE_LABELS[e.type].toLowerCase().includes(query),
  )

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-1 text-sm font-semibold text-slate-700">Financial transaction ledger</h3>
      <p className="mb-3 text-xs text-slate-500">
        Every completed ride's revenue/driver/TODA/platform split, plus expenses and capital contributions, in one
        chronological view — computed from the records above, not a separate record, so it can never drift out of
        sync or double-count.
      </p>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search description or type"
        className="mb-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
      />
      {filtered.length === 0 ? (
        <p className="text-xs text-slate-400">No transactions yet.</p>
      ) : (
        <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-2.5 py-1.5 text-left font-medium">Date</th>
                <th className="px-2.5 py-1.5 text-left font-medium">Type</th>
                <th className="px-2.5 py-1.5 text-left font-medium">Description</th>
                <th className="px-2.5 py-1.5 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-t border-slate-200">
                  <td className="whitespace-nowrap px-2.5 py-1.5 text-slate-500">
                    {new Date(e.date).toLocaleDateString()}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 text-slate-600">{LEDGER_TYPE_LABELS[e.type]}</td>
                  <td className="px-2.5 py-1.5 text-slate-700">{e.description}</td>
                  <td
                    className={`whitespace-nowrap px-2.5 py-1.5 text-right font-medium ${
                      e.amount >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {e.amount >= 0 ? '+' : '−'}₱{Math.abs(e.amount).toLocaleString()}
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

type ReportScope = 'platform' | string

function FinancialReportSection() {
  const { rides, expenses, drivers, todaOrganizations, todaContributions, todaExpenses } = useRides()
  const [scope, setScope] = useState<ReportScope>('platform')
  const [period, setPeriod] = useState<ReportPeriod>('monthly')

  const isPlatform = scope === 'platform'
  const org = isPlatform ? null : todaOrganizations.find((o) => o.id === scope) ?? null
  const orgMemberIds = org ? new Set(drivers.filter((d) => d.todaOrgId === org.id).map((d) => d.id)) : null

  const incomeEntries = isPlatform
    ? rides
        .filter((r) => r.status === 'completed' && r.completedAt && r.payment)
        .map((r) => ({ at: r.completedAt!, value: r.payment!.amount }))
    : [
        ...rides
          .filter((r) => r.status === 'completed' && r.completedAt && r.payment && orgMemberIds!.has(r.driverId ?? ''))
          .map((r) => ({ at: r.completedAt!, value: r.payment!.todaCommission })),
        ...todaContributions.filter((c) => c.todaOrgId === scope).map((c) => ({ at: c.contributedAt, value: c.amount })),
      ]
  const expenseEntries = isPlatform
    ? expenses.map((e) => ({ at: e.recordedAt, value: e.amount }))
    : todaExpenses.filter((e) => e.todaOrgId === scope).map((e) => ({ at: e.recordedAt, value: e.amount }))

  const totalIncome = incomeEntries.reduce((sum, e) => sum + e.value, 0)
  const totalExpenses = expenseEntries.reduce((sum, e) => sum + e.value, 0)
  const netIncome = totalIncome - totalExpenses

  const count = REPORT_PERIOD_DEFAULT_COUNT[period]
  const incomeTrend = amountsByPeriod(incomeEntries, period, count)
  const expenseTrend = amountsByPeriod(expenseEntries, period, count)

  function handleExportCsv() {
    const rows: (string | number)[][] = [
      ['Period', 'Income', 'Expenses', 'Net'],
      ...incomeTrend.map((bucket, i) => [
        bucket.label,
        incomeTrend[i].value,
        expenseTrend[i].value,
        incomeTrend[i].value - expenseTrend[i].value,
      ]),
      [],
      ['Total', totalIncome, totalExpenses, netIncome],
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `financial-report-${scope}-${period}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-1 text-sm font-semibold text-slate-700">Financial report</h3>
      <p className="mb-3 text-xs text-slate-500">
        Generate an income-vs-expenses report for the whole platform or a single TODA, trended daily, weekly,
        monthly, quarterly, or yearly.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Report</span>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          >
            <option value="platform">Platform-wide</option>
            {todaOrganizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Group by</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as ReportPeriod)}
            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          >
            {(Object.keys(REPORT_PERIOD_LABELS) as ReportPeriod[]).map((p) => (
              <option key={p} value={p}>
                {REPORT_PERIOD_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Income</p>
          <p className="text-lg font-semibold text-emerald-700">₱{totalIncome.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Expenses</p>
          <p className="text-lg font-semibold text-rose-700">₱{totalExpenses.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Net</p>
          <p className={`text-lg font-semibold ${netIncome >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            ₱{netIncome.toLocaleString()}
          </p>
        </div>
      </div>

      {period === 'all' ? (
        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          "All" collapses the whole report into the totals above, with no time breakdown — switch Group by to a
          period (daily/weekly/monthly/quarterly/yearly) to see a trend chart.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <DailyBarChart
            title={`Income — ${REPORT_PERIOD_LABELS[period].toLowerCase()}`}
            data={incomeTrend}
            valuePrefix="₱"
            emptyMessage="Not enough activity yet for a trend — check back after a few more periods."
          />
          <DailyBarChart
            title={`Expenses — ${REPORT_PERIOD_LABELS[period].toLowerCase()}`}
            data={expenseTrend}
            valuePrefix="₱"
            emptyMessage="Not enough activity yet for a trend — check back after a few more periods."
          />
        </div>
      )}

      <button
        onClick={handleExportCsv}
        className="mt-3 w-full rounded-lg border border-brand-300 bg-white py-2 text-xs font-medium text-brand-700 hover:bg-brand-50"
      >
        ⬇ Export report as CSV
      </button>
    </section>
  )
}
