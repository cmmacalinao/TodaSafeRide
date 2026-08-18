import { useState } from 'react'
import { useRides } from '../context/RideContext'
import { AdminLiveMap } from '../components/AdminLiveMap'
import { AdminDriverQueue } from '../components/AdminDriverQueue'
import { AdminDriverDirectory } from '../components/AdminDriverDirectory'
import { AdminPassengerDirectory } from '../components/AdminPassengerDirectory'
import { AdminInsights } from '../components/AdminInsights'
import { AccountingOfficerManager } from '../components/AccountingOfficerManager'
import { ActivityLogPanel } from '../components/ActivityLogPanel'
import { DRIVER_REPORT_REASON_LABELS, getTodaQueue, isPastDeadline, SAAS_PLAN_FEES } from '../mock/data'
import { getDispatchWindow } from '../lib/tracking'
import type { SaasPlan } from '../types'

const ALERT_TYPE_LABELS = { sos: 'SOS', route_deviation: 'Route deviation' }

function alertLabel(a: { type: keyof typeof ALERT_TYPE_LABELS; triggeredByRole?: 'passenger' | 'driver' }): string {
  if (a.type === 'sos' && a.triggeredByRole === 'driver') return 'Driver SOS'
  return ALERT_TYPE_LABELS[a.type]
}

const TAAS_STATUS_STYLES: Record<string, string> = {
  approved: 'bg-brand-100 text-brand-700',
  pending: 'bg-amber-100 text-amber-800',
  rejected: 'bg-rose-100 text-rose-700',
}

type AdminTab = 'overview' | 'toda' | 'drivers' | 'passengers' | 'rides' | 'settings'

const ADMIN_TABS: { id: AdminTab; icon: string; label: string }[] = [
  { id: 'overview', icon: '📊', label: 'Overview' },
  { id: 'toda', icon: '🛺', label: 'TODA & Partners' },
  { id: 'drivers', icon: '🧑‍✈️', label: 'Drivers' },
  { id: 'passengers', icon: '🧑‍🤝‍🧑', label: 'Passengers' },
  { id: 'rides', icon: '🗺️', label: 'Rides & Safety' },
  { id: 'settings', icon: '⚙️', label: 'Settings & Fees' },
]

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-semibold text-brand-700">{value}</p>
    </div>
  )
}

export function AdminPage() {
  const {
    rides,
    drivers,
    alerts,
    commissionPerRide,
    todaQueueWindowMs,
    specialPickupEscalationMs,
    todaOrganizations,
    operators,
    approveOperator,
    rejectOperator,
    setOperatorFees,
    setOperatorFranchise,
    franchises,
    approveFranchise,
    rejectFranchise,
    setFranchiseFees,
    duesGracePeriodDays,
    tripHistoryRetentionDays,
    membershipRequests,
    tariffSettings,
    driverReports,
    pabiliServiceFee,
    activityLog,
    resolveAlert,
    setCommission,
    setTodaQueueWindowMs,
    setSpecialPickupEscalationMs,
    setTodaCommissionAdminApproval,
    setDuesGracePeriodDays,
    setTripHistoryRetentionDays,
    resolveMembershipRequest,
    approveTodaOrg,
    rejectTodaOrg,
    setTodaOrgPendingNote,
    setTodaSaasPlan,
    setTodaOperator,
    setTariffSettings,
    resolveDriverReport,
    setPabiliServiceFee,
    logActivity,
  } = useRides()
  const [commissionInput, setCommissionInput] = useState(String(commissionPerRide))
  const [todaNoteDrafts, setTodaNoteDrafts] = useState<Record<string, string>>({})
  const [todaDeadlineDrafts, setTodaDeadlineDrafts] = useState<Record<string, string>>({})
  const [todaPlanDrafts, setTodaPlanDrafts] = useState<Record<string, SaasPlan>>({})
  const [todaPerBookingDrafts, setTodaPerBookingDrafts] = useState<Record<string, string>>({})
  const [operatorFeeDrafts, setOperatorFeeDrafts] = useState<
    Record<string, { activation: string; monthly: string; perBooking: string }>
  >({})
  const [franchiseFeeDrafts, setFranchiseFeeDrafts] = useState<
    Record<string, { initial: string; monthly: string; royalty: string }>
  >({})
  const [adminTab, setAdminTab] = useState<'overview' | 'toda' | 'drivers' | 'passengers' | 'rides' | 'settings'>('overview')
  const [taasTab, setTaasTab] = useState<'operator' | 'franchise'>('operator')
  const [copiedLink, setCopiedLink] = useState<'operator' | 'franchise' | null>(null)
  // ?apply=1 tells AuthGate's OperatorAuth/FranchiseAuth to open straight on
  // the Sign-up sub-tab instead of Login — this is the link Admin shares
  // with a prospective applicant, distinct from the plain portal-login URL.
  const operatorApplyLink = typeof window !== 'undefined' ? `${window.location.origin}/operator?apply=1` : ''
  const franchiseApplyLink = typeof window !== 'undefined' ? `${window.location.origin}/franchise?apply=1` : ''

  function handleCopyLink(url: string, which: 'operator' | 'franchise') {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(which)
      setTimeout(() => setCopiedLink(null), 2000)
    })
  }
  const [queueWindowInput, setQueueWindowInput] = useState(String(Math.round(todaQueueWindowMs / 1000)))
  const [specialPickupWindowInput, setSpecialPickupWindowInput] = useState(
    String(Math.round(specialPickupEscalationMs / 1000)),
  )
  const [graceDaysInput, setGraceDaysInput] = useState(String(duesGracePeriodDays))
  const [tripHistoryDaysInput, setTripHistoryDaysInput] = useState(String(tripHistoryRetentionDays))
  const [standardRateInput, setStandardRateInput] = useState(String(tariffSettings.standardRate))
  const [studentRateInput, setStudentRateInput] = useState(String(tariffSettings.studentRate))
  const [pwdSeniorRateInput, setPwdSeniorRateInput] = useState(String(tariffSettings.pwdSeniorRate))
  const [perKmRateInput, setPerKmRateInput] = useState(String(tariffSettings.perKmRate))
  const [standardKmInput, setStandardKmInput] = useState(String(tariffSettings.standardKmCovered))
  const [extraPassengerFeeInput, setExtraPassengerFeeInput] = useState(String(tariffSettings.extraPassengerFee))
  const [groupDiscountInput, setGroupDiscountInput] = useState(String(tariffSettings.groupRideDiscountPct))
  const [tariffError, setTariffError] = useState('')
  const [pabiliFeeInput, setPabiliFeeInput] = useState(String(pabiliServiceFee))

  const activeRides = rides.filter(
    (r) => (r.status === 'driver_arriving' || r.status === 'ongoing') && r.driverPosition,
  )
  // Requested but not yet accepted by anyone — invisible everywhere else in
  // Admin (the live map only tracks driver_arriving/ongoing rides), so this
  // is the only place to spot a request nobody's picking up.
  const pendingRequests = [...rides.filter((r) => r.status === 'requested')].sort(
    (a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime(),
  )
  const completedRides = rides.filter((r) => r.status === 'completed')
  const grossFares = completedRides.reduce((sum, r) => sum + (r.payment?.amount ?? 0), 0)
  const platformRevenue = completedRides.reduce((sum, r) => sum + (r.payment?.platformFee ?? 0), 0)
  const driverPayouts = completedRides.reduce((sum, r) => sum + (r.payment?.driverPayout ?? 0), 0)
  const ridesToday = rides.filter(
    (r) => new Date(r.requestedAt).toDateString() === new Date().toDateString(),
  ).length
  const activeDrivers = drivers.filter((d) => d.verificationStatus === 'approved' && d.online).length

  // TaaS rollup — Business KPIs the roadmap calls out (monthly recurring
  // revenue, revenue per operator, franchise revenue), summed from each
  // tier's own billing fields. Estimate only: excludes per-booking usage
  // fees (those vary per org, see estimatedMonthlyTodaFee/OperatorFee in
  // each portal) and one-time activation/franchise fees.
  const approvedTodaCount = todaOrganizations.filter((o) => o.verificationStatus === 'approved').length
  const approvedOperatorCount = operators.filter((o) => o.verificationStatus === 'approved').length
  const approvedFranchiseCount = franchises.filter((f) => f.verificationStatus === 'approved').length
  const estimatedMonthlyRecurringRevenue =
    todaOrganizations.filter((o) => o.verificationStatus === 'approved').reduce((sum, o) => sum + o.monthlyPlatformFee, 0) +
    operators.filter((o) => o.verificationStatus === 'approved').reduce((sum, o) => sum + o.monthlyPlatformFee, 0) +
    franchises.filter((f) => f.verificationStatus === 'approved').reduce((sum, f) => sum + f.monthlyTechnologyFee, 0)

  const openAlerts = alerts.filter((a) => a.status === 'open')
  const resolvedAlerts = alerts.filter((a) => a.status === 'resolved')
  const openReports = driverReports.filter((r) => r.status === 'open')
  const reviewedReports = driverReports.filter((r) => r.status === 'reviewed')

  // "Admin" here (vs. the extra-gated "Super Admin" used by
  // AdminAccounting.tsx) — matches the same two badges NavBar already shows
  // for this role (see NavBar.tsx's role === 'admin' block).
  function logAdmin(action: string, summary: string) {
    logActivity({ actorRole: 'admin', actorName: 'Admin', todaOrgId: null, action, summary })
  }

  function handleSaveCommission() {
    const amount = Number(commissionInput)
    if (!Number.isFinite(amount) || amount < 0) return
    setCommission(amount)
    logAdmin('Updated commission', `Platform commission per ride set to ₱${amount}.`)
  }

  function handleSaveQueueWindow() {
    const seconds = Number(queueWindowInput)
    if (!Number.isFinite(seconds) || seconds <= 0) return
    setTodaQueueWindowMs(seconds * 1000)
    logAdmin('Updated terminal queue window', `Terminal priority queue window set to ${seconds}s.`)
  }

  function handleSaveSpecialPickupWindow() {
    const seconds = Number(specialPickupWindowInput)
    if (!Number.isFinite(seconds) || seconds <= 0) return
    setSpecialPickupEscalationMs(seconds * 1000)
    logAdmin('Updated special pickup escalation window', `Special pickup escalation window set to ${seconds}s.`)
  }

  function handleSaveGraceDays() {
    const days = Number(graceDaysInput)
    if (!Number.isFinite(days) || days <= 0) return
    setDuesGracePeriodDays(days)
    logAdmin('Updated dues grace period', `Dues grace period set to ${days} day(s).`)
  }

  function handleSaveTripHistoryDays() {
    const days = Number(tripHistoryDaysInput)
    if (!Number.isFinite(days) || days <= 0) return
    setTripHistoryRetentionDays(days)
    logAdmin('Updated trip history retention', `Trip history now shows the last ${days} day(s).`)
  }

  function handleSaveTariff() {
    const standardRate = Number(standardRateInput)
    const studentRate = Number(studentRateInput)
    const pwdSeniorRate = Number(pwdSeniorRateInput)
    const perKmRate = Number(perKmRateInput)
    const standardKmCovered = Number(standardKmInput)
    const extraPassengerFee = Number(extraPassengerFeeInput)
    const groupRideDiscountPct = Number(groupDiscountInput)
    if (
      ![standardRate, studentRate, pwdSeniorRate, perKmRate, standardKmCovered, extraPassengerFee].every(
        (n) => Number.isFinite(n) && n >= 0,
      )
    ) {
      setTariffError('All tariff fields must be numbers of 0 or more.')
      return
    }
    if (!Number.isFinite(groupRideDiscountPct) || groupRideDiscountPct < 0 || groupRideDiscountPct > 100) {
      setTariffError('Group ride discount must be a number between 0 and 100.')
      return
    }
    setTariffError('')
    setTariffSettings({
      standardRate,
      studentRate,
      pwdSeniorRate,
      perKmRate,
      standardKmCovered,
      extraPassengerFee,
      groupRideDiscountPct,
    })
    logAdmin(
      'Updated fare tariff',
      `Standard ₱${standardRate}, student ₱${studentRate}, PWD/Senior ₱${pwdSeniorRate}, covers ${standardKmCovered} km then ₱${perKmRate}/km, group discount ${groupRideDiscountPct}%.`,
    )
  }

  function handleSavePabiliFee() {
    const amount = Number(pabiliFeeInput)
    if (!Number.isFinite(amount) || amount < 0) return
    setPabiliServiceFee(amount)
    logAdmin('Updated Pabili service fee', `Pabili service fee set to ₱${amount}.`)
  }

  function handleApproveTodaOrg(orgId: string, orgName: string) {
    approveTodaOrg(orgId)
    logActivity({ actorRole: 'admin', actorName: 'Admin', todaOrgId: orgId, action: 'Approved TODA org', summary: `Approved "${orgName}"'s registration.` })
  }

  function handleRejectTodaOrg(orgId: string, orgName: string) {
    rejectTodaOrg(orgId)
    logActivity({ actorRole: 'admin', actorName: 'Admin', todaOrgId: orgId, action: 'Rejected TODA org', summary: `Rejected "${orgName}"'s registration.` })
  }

  function handleApproveTodaOrgAsNoted(todaOrgId: string, orgName: string) {
    const note = (todaNoteDrafts[todaOrgId] ?? '').trim() || null
    const days = Number(todaDeadlineDrafts[todaOrgId])
    const deadline = Number.isFinite(days) && days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null
    setTodaOrgPendingNote(todaOrgId, note, deadline)
    logActivity({
      actorRole: 'admin',
      actorName: 'Admin',
      todaOrgId,
      action: 'Approved TODA org as noted',
      summary: `Approved "${orgName}" as noted${note ? ` — "${note}"` : ''}${deadline ? `, resubmit by ${new Date(deadline).toLocaleDateString()}` : ''}.`,
    })
  }

  function handleSaveTodaPlan(orgId: string, orgName: string) {
    const plan = todaPlanDrafts[orgId]
    if (!plan) return
    const perBookingFee = Number(todaPerBookingDrafts[orgId] ?? 0)
    if (!Number.isFinite(perBookingFee) || perBookingFee < 0) return
    setTodaSaasPlan(orgId, plan, perBookingFee)
    logActivity({
      actorRole: 'admin',
      actorName: 'Admin',
      todaOrgId: orgId,
      action: 'Updated SaaS plan',
      summary: `Set "${orgName}" to the ${plan} plan (₱${SAAS_PLAN_FEES[plan]}/mo${perBookingFee > 0 ? ` + ₱${perBookingFee}/booking` : ''}).`,
    })
  }

  function handleApproveOperator(operatorId: string, operatorName: string) {
    const draft = operatorFeeDrafts[operatorId]
    const activationFee = draft?.activation.trim() ? Number(draft.activation) : null
    const monthlyPlatformFee = Number(draft?.monthly ?? 0)
    const perBookingFee = Number(draft?.perBooking ?? 0)
    if (
      (activationFee !== null && (!Number.isFinite(activationFee) || activationFee < 0)) ||
      !Number.isFinite(monthlyPlatformFee) ||
      monthlyPlatformFee < 0 ||
      !Number.isFinite(perBookingFee) ||
      perBookingFee < 0
    ) {
      return
    }
    setOperatorFees(operatorId, activationFee, monthlyPlatformFee, perBookingFee)
    approveOperator(operatorId)
    logAdmin(
      'Approved Operator',
      `Approved "${operatorName}" (₱${monthlyPlatformFee}/mo${activationFee !== null ? `, ₱${activationFee} activation` : ''}).`,
    )
  }

  function handleRejectOperator(operatorId: string, operatorName: string) {
    rejectOperator(operatorId)
    logAdmin('Rejected Operator', `Rejected "${operatorName}"'s application.`)
  }

  function handleApproveFranchise(franchiseId: string, franchiseName: string) {
    const draft = franchiseFeeDrafts[franchiseId]
    const initialFranchiseFee = draft?.initial.trim() ? Number(draft.initial) : null
    const monthlyTechnologyFee = Number(draft?.monthly ?? 0)
    const royaltyPct = draft?.royalty.trim() ? Number(draft.royalty) : null
    if (
      (initialFranchiseFee !== null && (!Number.isFinite(initialFranchiseFee) || initialFranchiseFee < 0)) ||
      !Number.isFinite(monthlyTechnologyFee) ||
      monthlyTechnologyFee < 0 ||
      (royaltyPct !== null && (!Number.isFinite(royaltyPct) || royaltyPct < 0))
    ) {
      return
    }
    setFranchiseFees(franchiseId, initialFranchiseFee, monthlyTechnologyFee, royaltyPct)
    approveFranchise(franchiseId)
    logAdmin(
      'Approved Franchise',
      `Approved "${franchiseName}" (₱${monthlyTechnologyFee}/mo${initialFranchiseFee !== null ? `, ₱${initialFranchiseFee} franchise fee` : ''}).`,
    )
  }

  function handleRejectFranchise(franchiseId: string, franchiseName: string) {
    rejectFranchise(franchiseId)
    logAdmin('Rejected Franchise', `Rejected "${franchiseName}"'s application.`)
  }

  function handleSetOperatorFranchise(operatorId: string, operatorName: string, franchiseId: string | null) {
    setOperatorFranchise(operatorId, franchiseId)
    const franchiseName = franchiseId ? franchises.find((f) => f.id === franchiseId)?.name ?? franchiseId : 'TODASafeRide HQ (direct)'
    logAdmin('Reassigned Operator franchise', `"${operatorName}" now reports to ${franchiseName}.`)
  }

  function handleSetTodaOperator(orgId: string, orgName: string, operatorId: string | null) {
    setTodaOperator(orgId, operatorId)
    const operatorName = operatorId ? operators.find((o) => o.id === operatorId)?.name ?? operatorId : 'TODASafeRide HQ (direct)'
    logActivity({
      actorRole: 'admin',
      actorName: 'Admin',
      todaOrgId: orgId,
      action: 'Reassigned TODA operator',
      summary: `"${orgName}" now reports to ${operatorName}.`,
    })
  }

  const pendingMembershipRequests = membershipRequests.filter((r) => r.status === 'pending')
  const pendingTodaOrgs = todaOrganizations.filter((o) => o.verificationStatus === 'pending')

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
          {ADMIN_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAdminTab(tab.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                adminTab === tab.id ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
      </div>

      <a
        href="https://claude.ai/code/artifact/00130839-9ecc-4550-b254-7dc4e06f7473"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        <span>📘 Platform Playbook — full app overview</span>
        <span className="text-slate-400">↗</span>
      </a>

      {adminTab === 'overview' && (
      <>
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Reporting</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Rides today" value={String(ridesToday)} />
          <StatTile label="Total rides" value={String(rides.length)} />
          <StatTile label="Gross fares" value={`₱${grossFares}`} />
          <StatTile label="Active drivers" value={String(activeDrivers)} />
          <StatTile label="Platform revenue" value={`₱${platformRevenue}`} />
          <StatTile label="Driver payouts" value={`₱${driverPayouts}`} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">TaaS partners</h2>
        <p className="mb-3 text-xs text-slate-500">
          SaaS Partner → Authorized Operator → Franchise, per the TODASafeRide-as-a-Service roadmap. Estimated MRR
          excludes per-booking usage fees and one-time activation/franchise fees.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Level 1 — TODAs" value={String(approvedTodaCount)} />
          <StatTile label="Level 2 — Operators" value={String(approvedOperatorCount)} />
          <StatTile label="Level 3 — Franchises" value={String(approvedFranchiseCount)} />
          <StatTile label="Estimated MRR" value={`₱${estimatedMonthlyRecurringRevenue}`} />
        </div>
      </section>

      <AdminInsights />
      </>
      )}

      {adminTab === 'settings' && (
      <>
      <AccountingOfficerManager />

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">Commission settings</h2>
        <p className="mb-3 text-xs text-slate-500">
          Flat platform fee deducted from each completed ride's fare before the driver is paid out. The
          remainder credits the driver's account balance automatically on completion.
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">₱</span>
          <input
            type="number"
            min={0}
            value={commissionInput}
            onChange={(e) => setCommissionInput(e.target.value)}
            className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
          <span className="text-xs text-slate-500">per ride</span>
          <button
            onClick={handleSaveCommission}
            className="ml-auto rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
          >
            Save
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">Current: ₱{commissionPerRide} per ride</p>
      </section>
      </>
      )}

      {adminTab === 'toda' && (
      <>
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">TODA terminal queue settings</h2>
        <p className="mb-3 text-xs text-slate-500">
          A new ride is first offered only to the front of the pickup's nearest TODA terminal queue. If that driver
          doesn't accept, it passes down the line one at a time. Once this whole window elapses — or the terminal
          queue is empty or exhausted — the ride opens to freelance drivers and other TODAs nearby.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={queueWindowInput}
            onChange={(e) => setQueueWindowInput(e.target.value)}
            className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
          <span className="text-xs text-slate-500">seconds</span>
          <button
            onClick={handleSaveQueueWindow}
            className="ml-auto rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
          >
            Save
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Current: {Math.round(todaQueueWindowMs / 1000)}s (real terminals run this on a ~2-minute cycle — this app
          compresses simulated time so it's demoable, but the number itself is exactly what's configured here)
        </p>

        <div className="mt-4 border-t border-slate-100 pt-4">
          <h3 className="mb-1 text-xs font-semibold text-slate-700">Special pickup escalation window</h3>
          <p className="mb-3 text-xs text-slate-500">
            A special pickup (passenger asked to be picked up at their exact spot instead of the Terminal) is a
            harder ask for a driver — it gets its own, longer window before opening up. If no one from the
            passenger's TODA accepts within this time, it opens to any active TODA member and freelance driver.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={specialPickupWindowInput}
              onChange={(e) => setSpecialPickupWindowInput(e.target.value)}
              className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
            <span className="text-xs text-slate-500">seconds</span>
            <button
              onClick={handleSaveSpecialPickupWindow}
              className="ml-auto rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
            >
              Save
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Current: {Math.round(specialPickupEscalationMs / 1000)}s (defaults to a literal 5 real minutes — not
            compressed like the general queue window above, since a special pickup deserves more patience)
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">TODA registration queue</h2>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            {pendingTodaOrgs.length} pending
          </span>
        </div>
        {pendingTodaOrgs.length === 0 && <p className="text-sm text-slate-400">No pending TODA applications.</p>}
        <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
          {pendingTodaOrgs.map((org) => (
            <div key={org.id} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
              <p className="font-medium text-slate-700">{org.name}</p>
              <p className="mt-1 text-slate-500">
                Officers: {org.officers.map((o) => `${o.name} (${o.role})`).join(', ')}
              </p>
              <p className="mt-1 text-slate-500">
                {org.addressDetail}, Barangay {org.barangay}, {org.city}, {org.province}
              </p>
              <p className="mt-1 text-slate-500">
                Terminal GPS:{' '}
                {org.terminalGps
                  ? `${org.terminalGps.lat.toFixed(6)}, ${org.terminalGps.lng.toFixed(6)}`
                  : 'not captured yet'}
              </p>

              {org.registrationNote && (
                <p className="mt-2 rounded-lg bg-amber-50 p-2 text-amber-800">
                  <span className="font-semibold">Note sent to applicant: </span>
                  {org.registrationNote}
                </p>
              )}
              {org.registrationNoteDeadline &&
                (isPastDeadline(org.registrationNoteDeadline) ? (
                  <p className="mt-2 rounded-lg bg-rose-50 p-2 font-medium text-rose-700">
                    Deadline passed on {new Date(org.registrationNoteDeadline).toLocaleDateString()} — requirements
                    were not submitted. Reject this application or set a new deadline below.
                  </p>
                ) : (
                  <p className="mt-2 rounded-lg bg-slate-50 p-2 text-slate-500">
                    Resubmission deadline: {new Date(org.registrationNoteDeadline).toLocaleDateString()}
                  </p>
                ))}

              <textarea
                value={todaNoteDrafts[org.id] ?? org.registrationNote ?? ''}
                onChange={(e) => setTodaNoteDrafts((prev) => ({ ...prev, [org.id]: e.target.value }))}
                placeholder="Optional note to the applicant — e.g. what's missing or needs fixing"
                rows={2}
                className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
              />
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={todaDeadlineDrafts[org.id] ?? ''}
                  onChange={(e) => setTodaDeadlineDrafts((prev) => ({ ...prev, [org.id]: e.target.value }))}
                  placeholder="Days to resubmit"
                  className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                />
                <span className="text-[11px] text-slate-400">deadline for "Approve as noted" below</span>
              </div>

              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => handleApproveTodaOrg(org.id, org.name)}
                  className="flex-1 rounded-lg bg-brand-600 py-1.5 font-semibold text-white hover:bg-brand-700"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleApproveTodaOrgAsNoted(org.id, org.name)}
                  className="flex-1 rounded-lg border border-amber-300 bg-amber-50 py-1.5 font-medium text-amber-700 hover:bg-amber-100"
                >
                  Approve as noted
                </button>
                <button
                  onClick={() => handleRejectTodaOrg(org.id, org.name)}
                  className="flex-1 rounded-lg border border-slate-300 py-1.5 font-medium text-slate-600 hover:bg-slate-50"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Terminal queues (top 10 each)</h2>
        <div className="space-y-2">
          {todaOrganizations
            .filter((org) => org.verificationStatus === 'approved')
            .map((org) => {
            const queue = getTodaQueue(org.id, drivers)
            return (
              <div key={org.id} className="rounded-lg border border-slate-200 p-2.5 text-xs">
                <p className="font-medium text-slate-700">{org.name}</p>
                {queue.length === 0 ? (
                  <p className="mt-0.5 text-slate-400">No drivers currently in queue.</p>
                ) : (
                  <p className="mt-0.5 text-slate-500">
                    {queue
                      .slice(0, 10)
                      .map((d, i) => `${i + 1}. ${d.name}`)
                      .join(' · ')}
                    {queue.length > 10 && ` · +${queue.length - 10} more`}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">TODA commission approvals</h2>
        <p className="mb-3 text-xs text-slate-500">
          A TODA's own per-ride commission only takes effect once both its members and you have signed off.
        </p>
        <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
          {todaOrganizations
            .filter((o) => o.proposedCommissionPerRide !== null)
            .map((org) => (
              <div key={org.id} className="rounded-lg border border-slate-200 p-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">{org.name}</span>
                  <span className="font-semibold text-slate-800">₱{org.proposedCommissionPerRide} / ride</span>
                </div>
                <p className="mt-1 text-slate-500">
                  Members: {org.commissionApprovedByMembers ? '✓ approved' : 'not yet approved'}
                </p>
                <button
                  onClick={() => setTodaCommissionAdminApproval(org.id, !org.commissionApprovedByAdmin)}
                  className={`mt-2 w-full rounded-lg py-1.5 text-xs font-semibold ${
                    org.commissionApprovedByAdmin
                      ? 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                      : 'bg-brand-600 text-white hover:bg-brand-700'
                  }`}
                >
                  {org.commissionApprovedByAdmin ? 'Withdraw approval' : 'Approve commission'}
                </button>
              </div>
            ))}
          {todaOrganizations.every((o) => o.proposedCommissionPerRide === null) && (
            <p className="text-sm text-slate-400">No TODA has proposed a commission yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">TaaS Applications</h2>
        <p className="mb-3 text-xs text-slate-500">
          Share a direct application link with a prospective Operator or Franchisee — it opens straight to the
          sign-up form instead of the login form. Once approved, the same account logs in from that org's own
          portal (<code className="text-[11px]">/operator</code> or <code className="text-[11px]">/franchise</code>).
        </p>

        <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setTaasTab('operator')}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
              taasTab === 'operator' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'
            }`}
          >
            Operators (Level 2)
          </button>
          <button
            type="button"
            onClick={() => setTaasTab('franchise')}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
              taasTab === 'franchise' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'
            }`}
          >
            Franchises (Level 3)
          </button>
        </div>

        {taasTab === 'operator' && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="mb-1 text-xs font-medium text-slate-600">Operator application link</p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={operatorApplyLink}
                  onFocus={(e) => e.target.select()}
                  className="w-full truncate rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={() => handleCopyLink(operatorApplyLink, 'operator')}
                  className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                >
                  {copiedLink === 'operator' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Send this to a prospective TODA cooperative or organization — it opens straight to the Operator
                sign-up form.
              </p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-700">Pending applications</h3>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                  {operators.filter((o) => o.verificationStatus === 'pending').length} pending
                </span>
              </div>
              <p className="mb-2 text-[11px] text-slate-500">
                Set the activation fee and monthly/per-booking fees before approving — these become the Operator's
                billing plan immediately on approval.
              </p>
              {operators.filter((o) => o.verificationStatus === 'pending').length === 0 && (
                <p className="text-sm text-slate-400">No pending Operator applications.</p>
              )}
              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {operators
                  .filter((o) => o.verificationStatus === 'pending')
                  .map((operator) => (
                    <div key={operator.id} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                      <p className="font-medium text-slate-700">{operator.name}</p>
                      <p className="mt-1 text-slate-500">
                        {operator.contactPerson} · {operator.contactPhone}
                      </p>
                      <p className="mt-1 text-slate-500">
                        {operator.city}, {operator.province}
                      </p>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <div>
                          <label className="mb-1 block text-[11px] text-slate-500">Activation ₱</label>
                          <input
                            type="number"
                            min={0}
                            value={operatorFeeDrafts[operator.id]?.activation ?? ''}
                            onChange={(e) =>
                              setOperatorFeeDrafts((prev) => ({
                                ...prev,
                                [operator.id]: { activation: e.target.value, monthly: prev[operator.id]?.monthly ?? '', perBooking: prev[operator.id]?.perBooking ?? '' },
                              }))
                            }
                            placeholder="e.g. 45000"
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] text-slate-500">Monthly ₱</label>
                          <input
                            type="number"
                            min={0}
                            value={operatorFeeDrafts[operator.id]?.monthly ?? ''}
                            onChange={(e) =>
                              setOperatorFeeDrafts((prev) => ({
                                ...prev,
                                [operator.id]: { activation: prev[operator.id]?.activation ?? '', monthly: e.target.value, perBooking: prev[operator.id]?.perBooking ?? '' },
                              }))
                            }
                            placeholder="e.g. 8000"
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] text-slate-500">₱/booking</label>
                          <input
                            type="number"
                            min={0}
                            value={operatorFeeDrafts[operator.id]?.perBooking ?? ''}
                            onChange={(e) =>
                              setOperatorFeeDrafts((prev) => ({
                                ...prev,
                                [operator.id]: { activation: prev[operator.id]?.activation ?? '', monthly: prev[operator.id]?.monthly ?? '', perBooking: e.target.value },
                              }))
                            }
                            placeholder="optional"
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                          />
                        </div>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => handleApproveOperator(operator.id, operator.name)}
                          className="flex-1 rounded-lg bg-brand-600 py-1.5 font-semibold text-white hover:bg-brand-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectOperator(operator.id, operator.name)}
                          className="flex-1 rounded-lg border border-slate-300 py-1.5 font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold text-slate-700">All Operators — status</h3>
              <div className="max-h-[300px] space-y-1.5 overflow-y-auto pr-1">
                {operators.length === 0 && <p className="text-sm text-slate-400">No Operators have applied yet.</p>}
                {operators.map((operator) => (
                  <div key={operator.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-700">{operator.name}</p>
                      <p className="truncate text-[11px] text-slate-400">{operator.city}, {operator.province}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${TAAS_STATUS_STYLES[operator.verificationStatus]}`}>
                      {operator.verificationStatus}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {taasTab === 'franchise' && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="mb-1 text-xs font-medium text-slate-600">Franchise application link</p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={franchiseApplyLink}
                  onFocus={(e) => e.target.select()}
                  className="w-full truncate rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={() => handleCopyLink(franchiseApplyLink, 'franchise')}
                  className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                >
                  {copiedLink === 'franchise' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Send this to a prospective transportation entrepreneur or investor — it opens straight to the
                Franchise sign-up form.
              </p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-700">Pending applications</h3>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                  {franchises.filter((f) => f.verificationStatus === 'pending').length} pending
                </span>
              </div>
              <p className="mb-2 text-[11px] text-slate-500">
                Set the initial franchise fee, monthly technology fee, and optional royalty share before approving.
              </p>
              {franchises.filter((f) => f.verificationStatus === 'pending').length === 0 && (
                <p className="text-sm text-slate-400">No pending Franchise applications.</p>
              )}
              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {franchises
                  .filter((f) => f.verificationStatus === 'pending')
                  .map((franchise) => (
                    <div key={franchise.id} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                      <p className="font-medium text-slate-700">{franchise.name}</p>
                      <p className="mt-1 text-slate-500">
                        {franchise.contactPerson} · {franchise.contactPhone}
                      </p>
                      <p className="mt-1 text-slate-500">
                        {franchise.city}, {franchise.province}
                      </p>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <div>
                          <label className="mb-1 block text-[11px] text-slate-500">Franchise fee ₱</label>
                          <input
                            type="number"
                            min={0}
                            value={franchiseFeeDrafts[franchise.id]?.initial ?? ''}
                            onChange={(e) =>
                              setFranchiseFeeDrafts((prev) => ({
                                ...prev,
                                [franchise.id]: {
                                  initial: e.target.value,
                                  monthly: prev[franchise.id]?.monthly ?? '',
                                  royalty: prev[franchise.id]?.royalty ?? '',
                                },
                              }))
                            }
                            placeholder="e.g. 150000"
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] text-slate-500">Monthly ₱</label>
                          <input
                            type="number"
                            min={0}
                            value={franchiseFeeDrafts[franchise.id]?.monthly ?? ''}
                            onChange={(e) =>
                              setFranchiseFeeDrafts((prev) => ({
                                ...prev,
                                [franchise.id]: {
                                  initial: prev[franchise.id]?.initial ?? '',
                                  monthly: e.target.value,
                                  royalty: prev[franchise.id]?.royalty ?? '',
                                },
                              }))
                            }
                            placeholder="e.g. 10000"
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] text-slate-500">Royalty %</label>
                          <input
                            type="number"
                            min={0}
                            value={franchiseFeeDrafts[franchise.id]?.royalty ?? ''}
                            onChange={(e) =>
                              setFranchiseFeeDrafts((prev) => ({
                                ...prev,
                                [franchise.id]: {
                                  initial: prev[franchise.id]?.initial ?? '',
                                  monthly: prev[franchise.id]?.monthly ?? '',
                                  royalty: e.target.value,
                                },
                              }))
                            }
                            placeholder="optional"
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                          />
                        </div>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => handleApproveFranchise(franchise.id, franchise.name)}
                          className="flex-1 rounded-lg bg-brand-600 py-1.5 font-semibold text-white hover:bg-brand-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectFranchise(franchise.id, franchise.name)}
                          className="flex-1 rounded-lg border border-slate-300 py-1.5 font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div>
              <h3 className="mb-1 text-xs font-semibold text-slate-700">Operators — assign to Franchise</h3>
              <p className="mb-2 text-[11px] text-slate-500">
                Which territory each approved Operator reports to. Unaffiliated Operators report directly to
                TODASafeRide HQ.
              </p>
              <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
                {operators
                  .filter((o) => o.verificationStatus === 'approved')
                  .map((operator) => (
                    <div key={operator.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2.5 text-xs">
                      <span className="font-medium text-slate-700">{operator.name}</span>
                      <select
                        value={operator.franchiseId ?? ''}
                        onChange={(e) => handleSetOperatorFranchise(operator.id, operator.name, e.target.value || null)}
                        className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                      >
                        <option value="">TODASafeRide HQ (direct)</option>
                        {franchises
                          .filter((f) => f.verificationStatus === 'approved')
                          .map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  ))}
                {operators.every((o) => o.verificationStatus !== 'approved') && (
                  <p className="text-sm text-slate-400">No approved Operators yet.</p>
                )}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold text-slate-700">All Franchises — status</h3>
              <div className="max-h-[300px] space-y-1.5 overflow-y-auto pr-1">
                {franchises.length === 0 && <p className="text-sm text-slate-400">No Franchises have applied yet.</p>}
                {franchises.map((franchise) => (
                  <div key={franchise.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-700">{franchise.name}</p>
                      <p className="truncate text-[11px] text-slate-400">{franchise.city}, {franchise.province}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${TAAS_STATUS_STYLES[franchise.verificationStatus]}`}>
                      {franchise.verificationStatus}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">SaaS subscriptions (Level 1)</h2>
        <p className="mb-3 text-xs text-slate-500">
          Every TODA is a Level-1 "SaaS Partner" by default — set its pricing plan and (optionally) which Level-2
          Operator it reports to. This is a separate B2B billing relationship, not part of the per-ride commission
          above.
        </p>
        <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
          {todaOrganizations
            .filter((o) => o.verificationStatus === 'approved')
            .map((org) => (
              <div key={org.id} className="rounded-lg border border-slate-200 p-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">{org.name}</span>
                  <span className="text-slate-400">
                    ₱{org.monthlyPlatformFee}/mo{org.perBookingFee > 0 ? ` + ₱${org.perBookingFee}/booking` : ''}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <select
                    value={todaPlanDrafts[org.id] ?? org.saasPlan}
                    onChange={(e) => setTodaPlanDrafts((prev) => ({ ...prev, [org.id]: e.target.value as SaasPlan }))}
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                  >
                    <option value="starter">Starter (₱{SAAS_PLAN_FEES.starter}/mo)</option>
                    <option value="standard">Standard (₱{SAAS_PLAN_FEES.standard}/mo)</option>
                    <option value="premium">Premium (₱{SAAS_PLAN_FEES.premium}/mo)</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    value={todaPerBookingDrafts[org.id] ?? String(org.perBookingFee)}
                    onChange={(e) => setTodaPerBookingDrafts((prev) => ({ ...prev, [org.id]: e.target.value }))}
                    placeholder="₱/booking"
                    className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                  />
                  <button
                    onClick={() => handleSaveTodaPlan(org.id, org.name)}
                    className="ml-auto rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                  >
                    Save
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-slate-500">Reports to</span>
                  <select
                    value={org.operatorId ?? ''}
                    onChange={(e) => handleSetTodaOperator(org.id, org.name, e.target.value || null)}
                    className="ml-auto rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                  >
                    <option value="">TODASafeRide HQ (direct)</option>
                    {operators
                      .filter((o) => o.verificationStatus === 'approved')
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            ))}
          {todaOrganizations.every((o) => o.verificationStatus !== 'approved') && (
            <p className="text-sm text-slate-400">No approved TODAs yet.</p>
          )}
        </div>
      </section>
      </>
      )}

      {adminTab === 'settings' && (
      <>
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">Dues grace period</h2>
        <p className="mb-3 text-xs text-slate-500">
          How many days an unpaid dues charge can go overdue before a driver is flagged as eligible to have their
          access paused in the driver directory below.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={graceDaysInput}
            onChange={(e) => setGraceDaysInput(e.target.value)}
            className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
          <span className="text-xs text-slate-500">days</span>
          <button
            onClick={handleSaveGraceDays}
            className="ml-auto rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
          >
            Save
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">Current: {duesGracePeriodDays} day(s)</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">Trip history retention</h2>
        <p className="mb-3 text-xs text-slate-500">
          How many days back the "Trip history" list shows on the Passenger and Driver apps. Older rides aren't
          deleted — they still count toward earnings and admin reports — they just drop out of that list.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={tripHistoryDaysInput}
            onChange={(e) => setTripHistoryDaysInput(e.target.value)}
            className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
          <span className="text-xs text-slate-500">days</span>
          <button
            onClick={handleSaveTripHistoryDays}
            className="ml-auto rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
          >
            Save
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">Current: {tripHistoryRetentionDays} day(s)</p>
      </section>
      </>
      )}

      {adminTab === 'toda' && (
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">TODA hold/terminate requests</h2>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            {pendingMembershipRequests.length} pending
          </span>
        </div>
        {pendingMembershipRequests.length === 0 && (
          <p className="text-sm text-slate-400">No pending requests from any TODA.</p>
        )}
        <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
          {pendingMembershipRequests.map((r) => {
            const driver = drivers.find((d) => d.id === r.driverId)
            const org = todaOrganizations.find((o) => o.id === r.todaOrgId)
            return (
              <div key={r.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">
                <p className="font-medium text-slate-700">
                  {org?.name ?? 'TODA'} requests to {r.requestType === 'terminate' ? 'terminate' : 'hold'}{' '}
                  {driver?.name ?? 'a member'}
                </p>
                <p className="mt-1 text-slate-600">{r.reason}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => resolveMembershipRequest(r.id, true)}
                    className="flex-1 rounded-lg bg-rose-600 py-1.5 font-semibold text-white hover:bg-rose-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => resolveMembershipRequest(r.id, false)}
                    className="flex-1 rounded-lg border border-slate-300 py-1.5 font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>
      )}

      {adminTab === 'rides' && (
      <>
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Pending requests</h2>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            {pendingRequests.length} waiting
          </span>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Ride and Pabili requests nobody has accepted yet — invisible everywhere else in Admin, so this is where to
          spot one that's been sitting too long.
        </p>
        {pendingRequests.length === 0 && <p className="text-sm text-slate-400">No pending requests right now.</p>}
        <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
          {pendingRequests.map((r) => {
            const { openToAll } = getDispatchWindow(r, todaQueueWindowMs, specialPickupEscalationMs)
            const priorityOrg = r.priorityTodaOrgId ? todaOrganizations.find((o) => o.id === r.priorityTodaOrgId) : null
            const offeredDriver = r.priorityQueueOfferedDriverId
              ? drivers.find((d) => d.id === r.priorityQueueOfferedDriverId)
              : null
            const waitingMinutes = Math.floor((Date.now() - new Date(r.requestedAt).getTime()) / 60000)
            return (
              <div key={r.id} className="rounded-lg border border-slate-200 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">
                    {r.serviceType === 'pabili' && '🛍️ '}
                    {r.serviceType === 'buy_medicine' && '💊 '}
                    {r.passengerName}
                  </span>
                  <span className="text-slate-400">{waitingMinutes <= 0 ? 'just now' : `${waitingMinutes}m ago`}</span>
                </div>
                <p className="mt-1 text-slate-500">
                  {r.pickup.label} → {r.dropoff.label}
                </p>
                {r.specialPickupRequested && (
                  <p className="mt-1 rounded-lg bg-amber-50 p-2 font-medium text-amber-700">
                    📍 Special pickup — pick up at exact GPS, not the Terminal (+₱{r.specialPickupFee})
                  </p>
                )}
                {r.tipOffer > 0 && (
                  <p className="mt-1 rounded-lg bg-emerald-50 p-2 font-medium text-emerald-700">
                    💸 Passenger raised the tip offer to ₱{r.tipOffer} to attract a driver
                  </p>
                )}
                {(r.serviceType === 'pabili' || r.serviceType === 'buy_medicine') && r.pabiliItems && (
                  <p className="mt-1 rounded-lg bg-slate-50 p-2 text-slate-600">🛒 {r.pabiliItems}</p>
                )}
                <p className="mt-1.5 font-medium text-slate-600">
                  {openToAll
                    ? '✓ Open to all TODAs'
                    : offeredDriver
                      ? `Waiting on ${offeredDriver.name}${priorityOrg ? ` (${priorityOrg.name})` : ''}`
                      : `Waiting on ${priorityOrg?.name ?? 'priority TODA'}`}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Live map — active rides</h2>
        {activeRides.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-400">
            No rides in progress right now.
          </div>
        ) : (
          <AdminLiveMap
            markers={activeRides.map((r) => ({
              id: r.id,
              label: r.driverName ?? 'Driver',
              position: r.driverPosition!,
              flagged: r.routeAlert,
            }))}
          />
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Incident feed</h2>
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
            {openAlerts.length} open
          </span>
        </div>

        {alerts.length === 0 && <p className="text-sm text-slate-400">No incidents reported.</p>}

        <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
          {openAlerts.map((a) => (
            <div key={a.id} className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold text-rose-700">{alertLabel(a)}</span>
                <span className="text-rose-400">{new Date(a.createdAt).toLocaleTimeString()}</span>
              </div>
              <p className="mb-2 text-slate-600">{a.notes}</p>
              <button
                onClick={() => {
                  resolveAlert(a.id)
                  logAdmin('Resolved incident', `Marked ${alertLabel(a)} alert resolved — "${a.notes}".`)
                }}
                className="rounded-lg border border-rose-300 bg-white px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
              >
                Mark resolved
              </button>
            </div>
          ))}

          {resolvedAlerts.map((a) => (
            <div key={a.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs opacity-70">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold text-slate-600">{alertLabel(a)} · Resolved</span>
                <span className="text-slate-400">{new Date(a.createdAt).toLocaleTimeString()}</span>
              </div>
              <p className="text-slate-500">{a.notes}</p>
            </div>
          ))}
        </div>
      </section>
      </>
      )}

      {adminTab === 'drivers' && (
      <>
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Driver reports</h2>
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
            {openReports.length} open
          </span>
        </div>

        {driverReports.length === 0 && <p className="text-sm text-slate-400">No reports filed.</p>}

        <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
          {openReports.map((r) => (
            <div key={r.id} className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold text-rose-700">
                  {r.driverName} · {DRIVER_REPORT_REASON_LABELS[r.reason]}
                </span>
                <span className="text-rose-400">{new Date(r.createdAt).toLocaleTimeString()}</span>
              </div>
              <p className="mb-1 text-slate-500">Reported by {r.passengerName}</p>
              {r.details && <p className="mb-2 text-slate-600">{r.details}</p>}
              <button
                onClick={() => {
                  resolveDriverReport(r.id)
                  logAdmin(
                    'Reviewed driver report',
                    `Marked report against ${r.driverName} (${DRIVER_REPORT_REASON_LABELS[r.reason]}) reviewed.`,
                  )
                }}
                className="rounded-lg border border-rose-300 bg-white px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
              >
                Mark reviewed
              </button>
            </div>
          ))}

          {reviewedReports.map((r) => (
            <div key={r.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs opacity-70">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold text-slate-600">
                  {r.driverName} · {DRIVER_REPORT_REASON_LABELS[r.reason]} · Reviewed
                </span>
                <span className="text-slate-400">{new Date(r.createdAt).toLocaleTimeString()}</span>
              </div>
              <p className="text-slate-500">Reported by {r.passengerName}</p>
              {r.details && <p className="text-slate-500">{r.details}</p>}
            </div>
          ))}
        </div>
      </section>

      <AdminDriverQueue />

      <AdminDriverDirectory />
      </>
      )}

      {adminTab === 'passengers' && (
      <AdminPassengerDirectory />
      )}

      {adminTab === 'settings' && (
      <>
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">LGU tariff rate</h2>
        <p className="mb-3 text-xs text-slate-500">
          Standard LGU-style tricycle fare: a flat base rate (student, PWD/Senior, or standard) covers the first
          few kilometers, then a per-km rate applies beyond that, plus a flat surcharge per rider when 2 or more
          book together. Fare is computed from the real distance between pickup and destination.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Standard rate</span>
            <div className="flex items-center gap-1">
              <span className="text-sm text-slate-500">₱</span>
              <input
                type="number"
                min={0}
                value={standardRateInput}
                onChange={(e) => setStandardRateInput(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Student rate</span>
            <div className="flex items-center gap-1">
              <span className="text-sm text-slate-500">₱</span>
              <input
                type="number"
                min={0}
                value={studentRateInput}
                onChange={(e) => setStudentRateInput(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">PWD/Senior rate</span>
            <div className="flex items-center gap-1">
              <span className="text-sm text-slate-500">₱</span>
              <input
                type="number"
                min={0}
                value={pwdSeniorRateInput}
                onChange={(e) => setPwdSeniorRateInput(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Additional cost per km</span>
            <div className="flex items-center gap-1">
              <span className="text-sm text-slate-500">₱</span>
              <input
                type="number"
                min={0}
                value={perKmRateInput}
                onChange={(e) => setPerKmRateInput(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Standard km covered</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                value={standardKmInput}
                onChange={(e) => setStandardKmInput(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
              <span className="text-xs text-slate-500">km</span>
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Extra fee per rider (2+)</span>
            <div className="flex items-center gap-1">
              <span className="text-sm text-slate-500">₱</span>
              <input
                type="number"
                min={0}
                value={extraPassengerFeeInput}
                onChange={(e) => setExtraPassengerFeeInput(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
          </label>
        </div>
        <label className="mb-1 mt-3 block">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Ride-sharing group discount (2-4 passengers, standard fare only)
          </span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={100}
              value={groupDiscountInput}
              onChange={(e) => setGroupDiscountInput(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
            <span className="text-sm text-slate-500">%</span>
          </div>
        </label>
        {(() => {
          const previewStandardRate = Number(standardRateInput)
          const previewDiscount = Number(groupDiscountInput)
          const validPreview = Number.isFinite(previewStandardRate) && Number.isFinite(previewDiscount)
          const groupPrice = (count: number) =>
            validPreview ? Math.round(previewStandardRate * count * (1 - previewDiscount / 100)) : '—'
          return (
            <div className="grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-2 text-center text-xs text-slate-500">
              <div>
                2 passengers
                <div className="font-semibold text-slate-700">₱{groupPrice(2)}</div>
              </div>
              <div>
                3 passengers
                <div className="font-semibold text-slate-700">₱{groupPrice(3)}</div>
              </div>
              <div>
                4 passengers
                <div className="font-semibold text-slate-700">₱{groupPrice(4)}</div>
              </div>
            </div>
          )
        })()}
        {tariffError && <p className="mt-2 text-xs font-medium text-rose-600">{tariffError}</p>}
        <button
          onClick={handleSaveTariff}
          className="mt-3 w-full rounded-lg bg-brand-600 py-2 text-xs font-semibold text-white hover:bg-brand-700"
        >
          Save tariff
        </button>
        <p className="mt-2 text-xs text-slate-400">
          Current: ₱{tariffSettings.standardRate} standard / ₱{tariffSettings.studentRate} student / ₱
          {tariffSettings.pwdSeniorRate} PWD-Senior, covering the first {tariffSettings.standardKmCovered}km, then
          ₱{tariffSettings.perKmRate}/km after that, +₱{tariffSettings.extraPassengerFee} per rider beyond the
          first. Standard group rides get {tariffSettings.groupRideDiscountPct}% off standardRate×passengers.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">Pabili service fee</h2>
        <p className="mb-3 text-xs text-slate-500">
          Flat charge added on top of the standard fare for a Pabili (errand/delivery) request — separate from the
          items themselves, which the passenger settles with the driver directly.
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">₱</span>
          <input
            type="number"
            min={0}
            value={pabiliFeeInput}
            onChange={(e) => setPabiliFeeInput(e.target.value)}
            className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
          <span className="text-xs text-slate-500">per Pabili order</span>
          <button
            onClick={handleSavePabiliFee}
            className="ml-auto rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
          >
            Save
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">Current: ₱{pabiliServiceFee} per Pabili order</p>
      </section>
      </>
      )}

      {adminTab === 'overview' && (
      <ActivityLogPanel
        title="Admin — Log History"
        entries={activityLog.filter((e) => e.actorRole === 'admin')}
        emptyMessage="No Admin changes logged yet."
      />
      )}
    </div>
  )
}
