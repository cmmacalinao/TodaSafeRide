import { useRides } from '../context/RideContext'
import { CategoryBarChart } from './charts/CategoryBarChart'
import { fundClosingBalance, fundTotalAllocations, fundTotalSpent, projectAmountSpent } from '../lib/socialImpact'
import type { EquityHolderCategory } from '../types'

const CATEGORY_ORDER: EquityHolderCategory[] = [
  'Founder',
  'Investors',
  'Developers & Key Personnel',
  'Strategic / Community Pool',
  'Future Investor / Employee Pool',
  'Other',
]

// The executive presentation/report — NOT the live accounting itself (that
// lives in the sections below). Everything here is read-only and derived
// from the same records those sections edit, so this can never show a
// number that disagrees with the operational data.
export function CorporateStructureReport() {
  const {
    equityAllocations,
    investors,
    founderContributions,
    socialImpactTransactions,
    rotaryProjects,
    rccIncentives,
    distributions,
  } = useRides()

  const totalAllocatedPct = equityAllocations.reduce((sum, a) => sum + a.percentage, 0)
  const capTableByCategory = CATEGORY_ORDER.map((cat) => ({
    label: cat,
    value: equityAllocations.filter((a) => a.category === cat).reduce((sum, a) => sum + a.percentage, 0),
  })).filter((d) => d.value > 0)

  const founderApprovedCash = founderContributions
    .filter((c) => c.kind === 'cash' && c.status === 'approved')
    .reduce((sum, c) => sum + (c.approvedValue ?? c.estimatedValue), 0)
  const founderApprovedNonCash = founderContributions
    .filter((c) => c.kind === 'non_cash' && c.status === 'approved')
    .reduce((sum, c) => sum + (c.approvedValue ?? c.estimatedValue), 0)
  const founderPendingCount = founderContributions.filter((c) => c.status === 'pending').length

  const investorPoolPct = equityAllocations
    .filter((a) => a.category === 'Investors')
    .reduce((sum, a) => sum + a.percentage, 0)
  const totalInvested = investors.reduce((sum, inv) => sum + inv.investmentAmount, 0)
  const activeInvestorPct = investors
    .filter((inv) => inv.status === 'active')
    .reduce((sum, inv) => sum + inv.sharePercentage, 0)

  const sifBalance = fundClosingBalance(socialImpactTransactions)
  const sifAllocated = fundTotalAllocations(socialImpactTransactions)
  const sifSpent = fundTotalSpent(socialImpactTransactions)

  const rotaryTotalBudget = rotaryProjects.reduce((sum, p) => sum + p.approvedBudget, 0)
  const rotaryTotalSpent = rotaryProjects.reduce((sum, p) => sum + projectAmountSpent(p.id, socialImpactTransactions), 0)
  const rotaryActiveCount = rotaryProjects.filter(
    (p) => p.status === 'approved' || p.status === 'in_progress',
  ).length

  const rccPaid = rccIncentives.filter((r) => r.status === 'paid').reduce((sum, r) => sum + r.amount, 0)
  const rccPending = rccIncentives
    .filter((r) => r.status === 'proposed' || r.status === 'approved')
    .reduce((sum, r) => sum + r.amount, 0)

  const distributionsPaid = distributions.filter((d) => d.status === 'paid').reduce((sum, d) => sum + d.amount, 0)
  const distributionsPending = distributions
    .filter((d) => d.status === 'proposed' || d.status === 'approved')
    .reduce((sum, d) => sum + d.amount, 0)

  return (
    <section className="rounded-xl border-2 border-indigo-200 bg-gradient-to-b from-indigo-50/60 to-white p-4 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-bold text-indigo-900">Corporate Structure &amp; Social Impact</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            totalAllocatedPct === 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {totalAllocatedPct}% cap table allocated
        </span>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Executive summary — a report view, not the live books (see the sections below for that). Every figure here
        is derived from the same records those sections edit.
      </p>

      <CategoryBarChart title="Cap table by category" data={capTableByCategory} emptyMessage="No cap table entries yet." />

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold text-slate-600">Founder</p>
          <p className="mt-1 text-[11px] text-slate-500">
            Approved cash: <span className="font-medium text-emerald-700">₱{founderApprovedCash.toLocaleString()}</span>
          </p>
          <p className="text-[11px] text-slate-500">
            Approved non-cash:{' '}
            <span className="font-medium text-indigo-700">₱{founderApprovedNonCash.toLocaleString()}</span>
          </p>
          {founderPendingCount > 0 && (
            <p className="text-[11px] text-amber-600">{founderPendingCount} contribution(s) pending review</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold text-slate-600">Investors</p>
          <p className="mt-1 text-[11px] text-slate-500">
            Total invested: <span className="font-medium text-indigo-700">₱{totalInvested.toLocaleString()}</span>
          </p>
          <p className="text-[11px] text-slate-500">
            Active share: {activeInvestorPct.toFixed(1)}% of {investorPoolPct}% pool
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold text-slate-600">Social Impact Fund</p>
          <p className="mt-1 text-[11px] text-slate-500">
            Balance: <span className="font-medium text-indigo-700">₱{sifBalance.toLocaleString()}</span>
          </p>
          <p className="text-[11px] text-slate-500">
            Allocated ₱{sifAllocated.toLocaleString()} · Spent ₱{sifSpent.toLocaleString()}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold text-slate-600">Community Partner/NGO projects</p>
          <p className="mt-1 text-[11px] text-slate-500">
            {rotaryProjects.length} project(s), {rotaryActiveCount} active
          </p>
          <p className="text-[11px] text-slate-500">
            Budget ₱{rotaryTotalBudget.toLocaleString()} · Spent ₱{rotaryTotalSpent.toLocaleString()}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold text-slate-600">TODA Partner incentives</p>
          <p className="mt-1 text-[11px] text-slate-500">
            Paid <span className="font-medium text-emerald-700">₱{rccPaid.toLocaleString()}</span>
          </p>
          <p className="text-[11px] text-slate-500">Pending ₱{rccPending.toLocaleString()}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold text-slate-600">Distributions</p>
          <p className="mt-1 text-[11px] text-slate-500">
            Paid <span className="font-medium text-emerald-700">₱{distributionsPaid.toLocaleString()}</span>
          </p>
          <p className="text-[11px] text-slate-500">Pending ₱{distributionsPending.toLocaleString()}</p>
        </div>
      </div>

      <p className="mt-3 rounded-lg bg-slate-100 p-2 text-[11px] leading-snug text-slate-500">
        This is an internal management and reporting summary — not a substitute for a CPA, auditor, corporate
        lawyer, tax adviser, or securities adviser. Corporate capitalization, founder contribution treatment, IP
        ownership, share issuance, investor agreements, and tax/accounting treatment should be reviewed before
        actual implementation. Community Partner/NGO and TODA Partner organizations are social-impact/community
        partners with 0% corporate equity — never shareholders in this cap table.
      </p>
    </section>
  )
}
