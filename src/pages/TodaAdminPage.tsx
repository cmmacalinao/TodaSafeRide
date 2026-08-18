import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useRides } from '../context/RideContext'
import {
  DOCUMENT_LABELS,
  DOCUMENT_TYPES,
  getTodaQueue,
  getActiveTodaCommission,
  estimatedMonthlyTodaFee,
  TODA_EXPENSE_CATEGORY_LABELS,
} from '../mock/data'
import { getCurrentGeoPosition } from '../lib/geo'
import { PhAddressFields, type PhAddressValue } from '../components/PhAddressFields'
import { ActivityLogPanel } from '../components/ActivityLogPanel'
import { DailyBarChart } from '../components/charts/DailyBarChart'
import { amountsByPeriod, REPORT_PERIOD_DEFAULT_COUNT, REPORT_PERIOD_LABELS, type ReportPeriod } from '../lib/insights'
import type { Driver, DuesType, MembershipRequestType, Operator, Ride, TodaExpenseCategory, TodaOrganization } from '../types'

const STATUS_STYLES: Record<string, string> = {
  approved: 'bg-brand-100 text-brand-700',
  pending: 'bg-amber-100 text-amber-800',
  rejected: 'bg-rose-100 text-rose-700',
}

const ACCESS_STYLES: Record<string, string> = {
  active: 'bg-brand-100 text-brand-700',
  paused: 'bg-amber-100 text-amber-800',
  terminated: 'bg-rose-100 text-rose-700',
}

// readOnly (Super Admin oversight, via SuperAdminPage.tsx's "TODAs (Lvl 1)"
// tab) blocks every interaction with a single pointer-events-none wrapper
// around the whole page rather than threading a read-only prop through each
// of the ~8 editable sub-sections below (Terminal/Commission/Members/Dues/
// Contributions/Expenses each have their own buttons and inputs) — much
// smaller surface area to get right, and just as effective: nothing in this
// tree is clickable while it's set.
export function TodaAdminPage({
  orgId,
  onLogOut,
  readOnly = false,
}: {
  orgId: string
  onLogOut?: () => void
  readOnly?: boolean
}) {
  const {
    drivers,
    rides,
    todaOrganizations,
    operators,
    duesRecords,
    membershipRequests,
    todaContributions,
    todaExpenses,
    activityLog,
    alerts,
    resolveAlert,
  } = useRides()
  const location = useLocation()
  const navigate = useNavigate()
  // Scroll targets for the hamburger drawer's menu items (see
  // NavBar.tsx/NavDrawer.tsx) — hooks must run before the "org not found"
  // early return below (Rules of Hooks).
  const membersSectionRef = useRef<HTMLDivElement>(null)
  const duesSectionRef = useRef<HTMLDivElement>(null)
  const reportSectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = (location.state as { section?: string } | null)?.section
    if (!section) return
    navigate(location.pathname, { replace: true, state: {} })
    const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })
    if (section === 'home') {
      scrollTop()
    } else if (section === 'members') {
      setTimeout(() => membersSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    } else if (section === 'dues') {
      setTimeout(() => duesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    } else if (section === 'report') {
      setTimeout(() => reportSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key])

  const org = todaOrganizations.find((o) => o.id === orgId)
  const members = drivers.filter((d) => d.todaOrgId === orgId)
  const queue = getTodaQueue(orgId, drivers)
  const orgDuesRecords = duesRecords.filter((d) => d.todaOrgId === orgId)
  const orgRequests = membershipRequests.filter((r) => r.todaOrgId === orgId)
  const orgContributions = todaContributions.filter((c) => c.todaOrgId === orgId)
  const orgExpenses = todaExpenses.filter((e) => e.todaOrgId === orgId)
  const orgAlerts = alerts.filter((a) => a.todaOrgId === orgId && a.triggeredByRole === 'driver')
  const openOrgAlerts = orgAlerts.filter((a) => a.status === 'open')
  const resolvedOrgAlerts = orgAlerts.filter((a) => a.status === 'resolved')
  const activeCommission = getActiveTodaCommission(org)
  const treasury = rides
    .filter((r) => r.status === 'completed' && members.some((m) => m.id === r.driverId))
    .reduce((sum, r) => sum + (r.payment?.todaCommission ?? 0), 0)
  const memberIds = new Set(members.map((m) => m.id))
  const incomeEntries = [
    ...rides
      .filter((r) => r.status === 'completed' && r.completedAt && r.payment && memberIds.has(r.driverId ?? ''))
      .map((r) => ({ at: r.completedAt!, value: r.payment!.todaCommission })),
    ...orgContributions.map((c) => ({ at: c.contributedAt, value: c.amount })),
  ]
  const expenseEntries = orgExpenses.map((e) => ({ at: e.recordedAt, value: e.amount }))

  if (!org) {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
        <p className="text-sm text-slate-400">TODA organization not found.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-1 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">{readOnly ? 'Viewing (Super Admin)' : 'Logged in as'}</p>
            <h1 className="text-sm font-semibold text-slate-700">{org.name} Admin</h1>
            <p className="mt-0.5 text-xs text-slate-400">
              ★ {org.ratingCount > 0 ? `${org.rating} (${org.ratingCount} rating${org.ratingCount === 1 ? '' : 's'})` : 'No ratings yet'}
            </p>
          </div>
          {!readOnly && (
            <button
              onClick={onLogOut}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Log out
            </button>
          )}
        </div>
        <p className="mb-2 text-xs text-slate-500">
          {readOnly
            ? "Super Admin view — read-only. Nothing here is editable on this TODA's behalf."
            : `Exclusive access to ${org.name} only — you can't view or manage any other TODA's members, dues, or commission from here. Anything that affects a member's ability to work — pausing, terminating, or an approved commission — still needs the App Admin's sign-off; this page can only propose and request those changes.`}
        </p>
      </section>

      <div className={`space-y-6 ${readOnly ? 'pointer-events-none opacity-90' : ''}`}>
      {openOrgAlerts.length > 0 && (
        <section className="rounded-xl border border-rose-300 bg-rose-50 p-4 shadow-sm">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-rose-800">🆘 Emergency Alerts</h2>
            <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-medium text-white">
              {openOrgAlerts.length} open
            </span>
          </div>
          <p className="mb-2 text-xs text-rose-700">A member of {org.name} triggered an SOS. Call them directly if possible.</p>
          <div className="space-y-2">
            {openOrgAlerts.map((a) => {
              const d = members.find((m) => m.id === a.triggeredBy)
              return (
                <div key={a.id} className="rounded-lg border border-rose-300 bg-white p-2.5 text-xs">
                  <p className="font-medium text-rose-700">
                    {d ? `${d.name} · ${d.plateNumber}` : 'Unknown member'} — {new Date(a.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-0.5 text-slate-600">{a.notes}</p>
                  {d?.phone && <p className="mt-0.5 text-slate-500">📞 {d.phone}</p>}
                  <p className="mt-0.5 text-slate-500">
                    {a.location ? `📍 ${a.location.lat.toFixed(5)}, ${a.location.lng.toFixed(5)}` : 'Location not captured.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => resolveAlert(a.id)}
                    className="mt-2 w-full rounded-lg bg-rose-600 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                  >
                    Mark resolved
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {resolvedOrgAlerts.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Past emergency alerts</h2>
          <div className="max-h-[300px] space-y-1.5 overflow-y-auto pr-1">
            {resolvedOrgAlerts.map((a) => {
              const d = members.find((m) => m.id === a.triggeredBy)
              return (
                <div key={a.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs opacity-70">
                  <p className="font-medium text-slate-600">
                    {d ? `${d.name} · ${d.plateNumber}` : 'Unknown member'} · Resolved
                  </p>
                  <p className="text-slate-400">{new Date(a.createdAt).toLocaleString()}</p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <TerminalLocationSection org={org} />

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Terminal queue (live) — top 10</h2>
        {queue.length === 0 ? (
          <p className="text-sm text-slate-400">No drivers currently in queue.</p>
        ) : (
          <>
            <ol className="space-y-1 text-sm text-slate-600">
              {queue.slice(0, 10).map((d, i) => (
                <li key={d.id}>
                  {i + 1}. {d.name} · {d.plateNumber}
                </li>
              ))}
            </ol>
            {queue.length > 10 && (
              <p className="mt-1 text-xs text-slate-400">+{queue.length - 10} more waiting behind them.</p>
            )}
          </>
        )}
        <p className="mt-2 text-[11px] text-slate-400">
          Drivers join or leave the queue themselves from their own Driver page — this is a read-only view of what's
          currently happening.
        </p>
      </section>

      <CommissionSection orgId={org.id} orgName={org.name} treasury={treasury} activeCommission={activeCommission} />

      <SubscriptionSection org={org} operators={operators} drivers={drivers} rides={rides} />

      <DriverInviteSection orgId={org.id} orgName={org.name} />

      <div ref={membersSectionRef}>
        <MembersSection
          members={members}
          orgId={orgId}
          orgName={org.name}
          pendingRequestDriverIds={new Set(orgRequests.filter((r) => r.status === 'pending').map((r) => r.driverId))}
        />
      </div>

      <div ref={duesSectionRef}>
        <DuesSection orgId={orgId} members={members} duesRecords={orgDuesRecords} />
      </div>

      <ContributionsSection orgId={orgId} contributions={orgContributions} />

      <ExpensesSection orgId={orgId} expenses={orgExpenses} />

      <div ref={reportSectionRef}>
        <FinancialReportSection treasury={treasury} incomeEntries={incomeEntries} expenseEntries={expenseEntries} />
      </div>

      <RequestsHistorySection requests={orgRequests} members={members} />

      <ActivityLogPanel
        title={`${org.name} Admin — Log History`}
        entries={activityLog.filter((e) => e.actorRole === 'toda_admin' && e.todaOrgId === orgId)}
        emptyMessage="No changes logged for this TODA yet."
      />
      </div>
    </div>
  )
}

function TerminalLocationSection({ org }: { org: import('../types').TodaOrganization }) {
  const { setTodaTerminalGps, setTodaTerminalAddress, logActivity } = useRides()
  function logToda(action: string, summary: string) {
    logActivity({ actorRole: 'toda_admin', actorName: `${org.name} Admin`, todaOrgId: org.id, action, summary })
  }
  const [status, setStatus] = useState('')
  const [updating, setUpdating] = useState(false)
  const [editingAddress, setEditingAddress] = useState(false)
  const [addressDraft, setAddressDraft] = useState<PhAddressValue>({
    province: org.province,
    city: org.city,
    barangay: org.barangay,
    addressDetail: org.addressDetail,
  })
  const [addressError, setAddressError] = useState('')

  async function handleUpdateGps() {
    setUpdating(true)
    setStatus('Getting your current location…')
    try {
      const coords = await getCurrentGeoPosition()
      setTodaTerminalGps(org.id, coords)
      logToda('Updated terminal GPS', 'Captured a new live terminal location.')
      setStatus('Terminal location updated.')
    } catch {
      setStatus('Could not get your location — check location permissions and try again.')
    } finally {
      setUpdating(false)
    }
  }

  function handleStartEditAddress() {
    setAddressDraft({
      province: org.province,
      city: org.city,
      barangay: org.barangay,
      addressDetail: org.addressDetail,
    })
    setAddressError('')
    setEditingAddress(true)
  }

  function handleSaveAddress() {
    if (!addressDraft.province || !addressDraft.city || !addressDraft.barangay || !addressDraft.addressDetail.trim()) {
      setAddressError('Fill in the full terminal address (province/city/barangay/detail).')
      return
    }
    setTodaTerminalAddress(org.id, {
      province: addressDraft.province,
      city: addressDraft.city,
      barangay: addressDraft.barangay,
      addressDetail: addressDraft.addressDetail.trim(),
    })
    logToda('Updated terminal address', `${addressDraft.addressDetail.trim()}, Barangay ${addressDraft.barangay}, ${addressDraft.city}.`)
    setEditingAddress(false)
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Terminal location</h2>
        {!editingAddress && (
          <button
            type="button"
            onClick={handleStartEditAddress}
            className="text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            Edit address
          </button>
        )}
      </div>

      {editingAddress ? (
        <div className="space-y-2">
          <PhAddressFields
            value={addressDraft}
            onChange={setAddressDraft}
            addressDetailLabel="Detailed terminal address (zone, street, notes)"
            addressDetailPlaceholder="e.g. Public Market Terminal, Zone 1"
          />
          {addressError && <p className="text-xs font-medium text-rose-600">{addressError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSaveAddress}
              className="flex-1 rounded-lg bg-brand-600 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
            >
              Save address
            </button>
            <button
              onClick={() => setEditingAddress(false)}
              className="flex-1 rounded-lg border border-slate-300 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          {org.addressDetail}, Barangay {org.barangay}, {org.city}, {org.province}
        </p>
      )}

      <p className="mt-1 text-xs text-slate-500">
        Officers: {org.officers.map((o) => `${o.name} (${o.role})`).join(', ')}
      </p>
      <p className="mt-2 text-xs font-medium text-slate-600">
        GPS:{' '}
        {org.terminalGps
          ? `${org.terminalGps.lat.toFixed(6)}, ${org.terminalGps.lng.toFixed(6)}`
          : 'Not set — drivers can join the queue from anywhere until this is captured.'}
      </p>
      <button
        onClick={handleUpdateGps}
        disabled={updating}
        className="mt-2 w-full rounded-lg border border-brand-300 bg-white py-2 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        📍 {org.terminalGps ? 'Update to my current GPS location' : 'Set terminal GPS to my current location'}
      </button>
      {status && <p className="mt-2 text-[11px] text-slate-500">{status}</p>}
      <p className="mt-2 text-[11px] text-slate-400">
        Stand at the actual terminal when you tap this — once set, drivers must be within range of this exact spot
        to join the terminal queue.
      </p>
    </section>
  )
}

function CommissionSection({
  orgId,
  orgName,
  treasury,
  activeCommission,
}: {
  orgId: string
  orgName: string
  treasury: number
  activeCommission: number
}) {
  const { todaOrganizations, proposeTodaCommission, setTodaCommissionMemberApproval, logActivity } = useRides()
  const org = todaOrganizations.find((o) => o.id === orgId)!
  const [amountInput, setAmountInput] = useState(String(org.proposedCommissionPerRide ?? ''))

  function logToda(action: string, summary: string) {
    logActivity({ actorRole: 'toda_admin', actorName: `${orgName} Admin`, todaOrgId: orgId, action, summary })
  }

  function handlePropose() {
    const amount = amountInput.trim() === '' ? null : Number(amountInput)
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) return
    proposeTodaCommission(orgId, amount)
    logToda('Proposed TODA commission', amount === null ? 'Cleared the proposed commission.' : `Proposed ₱${amount} per ride.`)
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-slate-700">{orgName} commission</h2>
      <p className="mb-3 text-xs text-slate-500">
        An optional extra per-ride cut on top of the platform's own commission, credited to {orgName}'s treasury
        instead of the platform's. Only takes effect once both your members and the App Admin have signed off —
        propose an amount, then attest that your members approved it below.
      </p>
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">₱</span>
        <input
          type="number"
          min={0}
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          placeholder="no commission"
          className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        />
        <span className="text-xs text-slate-500">per ride</span>
        <button
          onClick={handlePropose}
          className="ml-auto rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          Propose
        </button>
      </div>

      <div className="mt-3 space-y-1.5 rounded-lg bg-slate-50 p-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Proposed rate</span>
          <span className="font-medium text-slate-700">
            {org.proposedCommissionPerRide === null ? '—' : `₱${org.proposedCommissionPerRide}`}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Members approved</span>
          <button
            onClick={() => {
              const next = !org.commissionApprovedByMembers
              setTodaCommissionMemberApproval(orgId, next)
              logToda('Set member commission approval', next ? 'Attested members approved the proposed commission.' : 'Withdrew member approval attestation.')
            }}
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              org.commissionApprovedByMembers ? 'bg-brand-100 text-brand-700' : 'bg-slate-200 text-slate-500'
            }`}
          >
            {org.commissionApprovedByMembers ? '✓ Yes' : 'Not yet — click to attest'}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">App Admin approved</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              org.commissionApprovedByAdmin ? 'bg-brand-100 text-brand-700' : 'bg-slate-200 text-slate-500'
            }`}
          >
            {org.commissionApprovedByAdmin ? '✓ Approved' : 'Pending Admin review'}
          </span>
        </div>
        {org.proposedCommissionPerRide !== null && !org.commissionApprovedByAdmin && (
          <p className="text-[11px] text-slate-400">
            Nothing to do here — the App Admin approves this from their own Admin page, under "TODA commission
            approvals."
          </p>
        )}
        <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
          <span className="font-medium text-slate-600">Currently charged</span>
          <span className="font-semibold text-slate-800">₱{activeCommission} per ride</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium text-slate-600">Treasury collected</span>
          <span className="font-semibold text-slate-800">₱{treasury}</span>
        </div>
      </div>
    </section>
  )
}

const SAAS_PLAN_LABELS: Record<string, string> = { starter: 'Starter', standard: 'Standard', premium: 'Premium' }

// TaaS Level 1 — every TODA is a "SaaS Partner" by default. This is a
// read-only summary: the App Admin sets the plan/fees (see AdminPage.tsx's
// "SaaS subscription" control), same division of control as Commission
// approval above. The "Estimated this month" figure is purely informational
// — it is never subtracted from driver payouts (see COMPLETE_RIDE).
function SubscriptionSection({
  org,
  operators,
  drivers,
  rides,
}: {
  org: TodaOrganization
  operators: Operator[]
  drivers: Driver[]
  rides: Ride[]
}) {
  const operator = org.operatorId ? operators.find((o) => o.id === org.operatorId) : null
  const estimatedThisMonth = estimatedMonthlyTodaFee(org, drivers, rides)

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-slate-700">My Subscription</h2>
      <p className="mb-3 text-xs text-slate-500">
        TODASafeRide's Level 1 "SaaS Partner" plan — a separate billing relationship with TODASafeRide HQ, not part of
        your members' per-ride commission above.
      </p>
      <div className="space-y-1.5 rounded-lg bg-slate-50 p-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Plan</span>
          <span className="font-medium text-slate-700">{SAAS_PLAN_LABELS[org.saasPlan] ?? org.saasPlan}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Monthly platform fee</span>
          <span className="font-medium text-slate-700">₱{org.monthlyPlatformFee}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Per-booking fee</span>
          <span className="font-medium text-slate-700">{org.perBookingFee > 0 ? `₱${org.perBookingFee}` : 'Not enabled'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Reports to</span>
          <span className="font-medium text-slate-700">{operator ? operator.name : 'TODASafeRide HQ (direct)'}</span>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
          <span className="font-medium text-slate-600">Estimated this month</span>
          <span className="font-semibold text-slate-800">₱{estimatedThisMonth}</span>
        </div>
      </div>
    </section>
  )
}

// TaaS Level 1 — lets a TODA grow its own membership with a shareable
// self-service link/QR, same "Grow your..." pattern as OperatorPortalPage.tsx
// (TODA invites) and FranchisePage.tsx (Operator/TODA invites) one and two
// levels up. Unlike those, there's no "add directly" shortcut here — driver
// registration requires document uploads (NBI clearance, license, LTO/LGU
// registration) that only the driver themselves can provide, so self-service
// is the only path; the TODA officer just pre-scopes which org it lands
// under.
function DriverInviteSection({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [copied, setCopied] = useState(false)
  const inviteLink = typeof window !== 'undefined' ? `${window.location.origin}/drive?todaOrgId=${orgId}` : ''

  function handleCopyLink() {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-slate-700">Grow your TODA</h2>
      <p className="mb-3 text-xs text-slate-500">
        Send this to a driver you want to join {orgName} — it opens straight to driver registration with your TODA
        already selected, so all they fill in is their own details and documents.
      </p>
      <div className="rounded-lg bg-slate-50 p-3">
        <p className="mb-1 text-xs font-medium text-slate-600">Driver sign-up link</p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={inviteLink}
            onFocus={(e) => e.target.select()}
            className="w-full truncate rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={handleCopyLink}
            className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          Send via Messenger/SMS, or let them scan the QR code below. Their application still goes to the App Admin
          for document review, same as any driver.
        </p>
        <div className="mt-3 flex justify-center rounded-lg border border-slate-200 bg-white p-3">
          <QRCodeSVG value={inviteLink || ' '} size={144} level="M" marginSize={2} />
        </div>
      </div>
    </section>
  )
}

function MembersSection({
  members,
  orgId,
  orgName,
  pendingRequestDriverIds,
}: {
  members: Driver[]
  orgId: string
  orgName: string
  pendingRequestDriverIds: Set<string>
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [requestDriverId, setRequestDriverId] = useState<string | null>(null)
  const [requestType, setRequestType] = useState<MembershipRequestType>('hold')
  const [reason, setReason] = useState('')
  const [search, setSearch] = useState('')
  const { requestMembershipAction, logActivity } = useRides()

  function submitRequest() {
    if (!requestDriverId || !reason.trim()) return
    requestMembershipAction({ todaOrgId: orgId, driverId: requestDriverId, requestType, reason: reason.trim() })
    const driverName = members.find((m) => m.id === requestDriverId)?.name ?? 'driver'
    logActivity({
      actorRole: 'toda_admin',
      actorName: `${orgName} Admin`,
      todaOrgId: orgId,
      action: 'Requested membership action',
      summary: `Requested "${requestType}" for ${driverName} — "${reason.trim()}".`,
    })
    setRequestDriverId(null)
    setReason('')
  }

  const query = search.trim().toLowerCase()
  const filteredMembers = members.filter(
    (d) => !query || d.name.toLowerCase().includes(query) || d.plateNumber.toLowerCase().includes(query),
  )

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold text-slate-700">{orgName} members</h2>
      {members.length === 0 && <p className="text-sm text-slate-400">No registered members yet.</p>}
      {members.length > 0 && (
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or plate number"
          className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
        />
      )}
      {members.length > 0 && filteredMembers.length === 0 && (
        <p className="text-sm text-slate-400">No members match "{search.trim()}".</p>
      )}
      <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
        {filteredMembers.map((d) => {
          const isExpanded = expandedId === d.id
          // "Active" here just means currently participating (queued or on
          // a trip) — informational only, distinct from accessStatus which
          // is the actual on/off switch for receiving rides.
          const isActive = d.queueJoinedAt !== null
          return (
            <div key={d.id} className="rounded-lg border border-slate-200 p-3 text-sm">
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : d.id)}
                className="flex w-full items-center justify-between text-left"
              >
                <div>
                  <p className="font-medium text-slate-700">
                    {d.name} · {d.plateNumber}
                  </p>
                  <p className="text-xs text-slate-400">
                    {d.phone} · ★ {d.rating || '—'} ·{' '}
                    <span className={isActive ? 'text-brand-600' : 'text-slate-400'}>
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[d.verificationStatus]}`}>
                    {d.verificationStatus}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ACCESS_STYLES[d.accessStatus]}`}>
                    {d.accessStatus}
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  <p className="text-xs text-slate-500">License {d.licenseNo} · expires {d.licenseExpiry}</p>
                  <p className="text-xs text-slate-500">
                    {d.addressDetail}, Barangay {d.barangay}, {d.city}, {d.province}
                  </p>
                  {d.accessNote && (
                    <p className="rounded-lg bg-rose-50 p-2 text-xs text-rose-700">
                      <span className="font-semibold">Access note: </span>
                      {d.accessNote}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {DOCUMENT_TYPES.map((type) => {
                      const doc = d.documents[type]
                      return (
                        <div key={type} className="flex items-center gap-2 rounded-lg border border-slate-200 p-1.5">
                          {doc.dataUrl ? (
                            <img src={doc.dataUrl} alt={DOCUMENT_LABELS[type]} className="h-8 w-8 rounded object-cover" />
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

                  {d.accessStatus === 'active' &&
                    (pendingRequestDriverIds.has(d.id) ? (
                      <p className="text-xs font-medium text-amber-600">
                        A hold/terminate request for this member is awaiting App Admin review.
                      </p>
                    ) : requestDriverId === d.id ? (
                      <div className="space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setRequestType('hold')}
                            className={`flex-1 rounded-lg py-1.5 text-xs font-medium ${
                              requestType === 'hold' ? 'bg-rose-600 text-white' : 'border border-rose-300 text-rose-700'
                            }`}
                          >
                            Temporary hold
                          </button>
                          <button
                            onClick={() => setRequestType('terminate')}
                            className={`flex-1 rounded-lg py-1.5 text-xs font-medium ${
                              requestType === 'terminate' ? 'bg-rose-600 text-white' : 'border border-rose-300 text-rose-700'
                            }`}
                          >
                            Terminate
                          </button>
                        </div>
                        <textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Reason for this request — sent to the App Admin for review"
                          rows={2}
                          className="w-full rounded-lg border border-rose-300 px-2 py-1.5 text-xs"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={submitRequest}
                            className="flex-1 rounded-lg bg-rose-600 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                          >
                            Send request to App Admin
                          </button>
                          <button
                            onClick={() => setRequestDriverId(null)}
                            className="flex-1 rounded-lg border border-slate-300 py-1.5 text-xs font-medium text-slate-600"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setRequestDriverId(d.id)
                          setRequestType('hold')
                          setReason('')
                        }}
                        className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                      >
                        Request hold / terminate
                      </button>
                    ))}
                  <p className="text-[11px] text-slate-400">
                    Only the App Admin can actually pause or terminate a member — this only sends a request.
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

const DUES_TYPE_LABELS: Record<DuesType, string> = {
  monthly_dues: 'Monthly dues',
  contribution: 'Contribution',
}

function DuesSection({
  orgId,
  members,
  duesRecords,
}: {
  orgId: string
  members: Driver[]
  duesRecords: import('../types').DuesRecord[]
}) {
  const { addDuesRecord, markDuesPaid, logActivity } = useRides()
  const ALL_MEMBERS = 'all'
  const [targetDriverId, setTargetDriverId] = useState(ALL_MEMBERS)
  const [duesType, setDuesType] = useState<DuesType>('monthly_dues')
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')

  function logToda(action: string, summary: string) {
    logActivity({ actorRole: 'toda_admin', actorName: 'TODA Admin', todaOrgId: orgId, action, summary })
  }

  function handleAdd() {
    const amt = Number(amount)
    if (!label.trim() || !Number.isFinite(amt) || amt <= 0 || !dueDate) return
    const driverIds = targetDriverId === ALL_MEMBERS ? members.map((m) => m.id) : [targetDriverId]
    if (driverIds.length === 0) return
    addDuesRecord({ todaOrgId: orgId, driverIds, duesType, label: label.trim(), amount: amt, dueDate })
    logToda('Added dues record', `"${label.trim()}" — ₱${amt} for ${driverIds.length} member(s), due ${dueDate}.`)
    setLabel('')
    setAmount('')
    setDueDate('')
  }

  const sorted = [...duesRecords].sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-slate-700">Dues & contributions</h2>
      <p className="mb-3 text-xs text-slate-500">
        Record monthly dues or one-off contributions and track who's paid. This is bookkeeping only — no real
        payment is collected here; mark a record paid once you've received it by whatever means your TODA uses.
      </p>

      <div className="space-y-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
        <div className="grid grid-cols-2 gap-2">
          <select
            value={targetDriverId}
            onChange={(e) => setTargetDriverId(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          >
            <option value={ALL_MEMBERS}>All members</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <select
            value={duesType}
            onChange={(e) => setDuesType(e.target.value as DuesType)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          >
            <option value="monthly_dues">Monthly dues</option>
            <option value="contribution">Contribution</option>
          </select>
        </div>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label, e.g. 'August dues' or 'Fiesta contribution'"
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="₱ amount"
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
        </div>
        <button
          onClick={handleAdd}
          className="w-full rounded-lg bg-brand-600 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          Add charge
        </button>
      </div>

      <div className="mt-3 max-h-96 space-y-1.5 overflow-y-auto pr-1">
        {sorted.length === 0 && <p className="text-xs text-slate-400">No dues or contributions recorded yet.</p>}
        {sorted.map((record) => {
          const member = members.find((m) => m.id === record.driverId)
          const overdueDays = record.paidAt
            ? 0
            : Math.floor((Date.now() - new Date(record.dueDate).getTime()) / (24 * 60 * 60 * 1000))
          return (
            <div key={record.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2 text-xs">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-700">
                  {member?.name ?? 'Unknown'} · {DUES_TYPE_LABELS[record.type]} — {record.label}
                </p>
                <p className="text-slate-400">
                  ₱{record.amount} · due {record.dueDate}
                  {!record.paidAt && overdueDays > 0 && (
                    <span className="ml-1 font-medium text-rose-600">· {overdueDays}d overdue</span>
                  )}
                </p>
              </div>
              {record.paidAt ? (
                <span className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 font-medium text-brand-700">Paid</span>
              ) : (
                <button
                  onClick={() => {
                    markDuesPaid(record.id)
                    logToda('Marked dues paid', `${member?.name ?? 'Unknown'} — ${record.label}, ₱${record.amount}.`)
                  }}
                  className="shrink-0 rounded-lg border border-brand-300 px-2 py-1 font-medium text-brand-700 hover:bg-brand-50"
                >
                  Mark paid
                </button>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function ContributionsSection({
  orgId,
  contributions,
}: {
  orgId: string
  contributions: import('../types').TodaContribution[]
}) {
  const { addTodaContribution, deleteTodaContribution, logActivity } = useRides()
  const [contributorName, setContributorName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')

  function logToda(action: string, summary: string) {
    logActivity({ actorRole: 'toda_admin', actorName: 'TODA Admin', todaOrgId: orgId, action, summary })
  }

  function handleAdd() {
    const amt = Number(amount)
    if (!contributorName.trim()) {
      setError('Enter who this contribution is from.')
      return
    }
    if (!purpose.trim()) {
      setError('Add a short purpose, e.g. "Fiesta pot" or "Officer donation".')
      return
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a valid amount greater than 0.')
      return
    }
    addTodaContribution({ todaOrgId: orgId, contributorName: contributorName.trim(), purpose: purpose.trim(), amount: amt, recordedBy: 'TODA Admin' })
    logToda('Added contribution', `${contributorName.trim()} — ₱${amt.toLocaleString()}: "${purpose.trim()}".`)
    setContributorName('')
    setPurpose('')
    setAmount('')
    setError('')
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-slate-700">Other contributions</h2>
      <p className="mb-3 text-xs text-slate-500">
        Money into the TODA's treasury that isn't a member's dues charge — an officer's own contribution, a
        sponsor/donor gift, a fiesta pot, etc.
      </p>
      <div className="space-y-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
        <div className="grid grid-cols-2 gap-2">
          <input
            value={contributorName}
            onChange={(e) => setContributorName(e.target.value)}
            placeholder="Contributor name"
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="₱ amount"
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
        </div>
        <input
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="Purpose, e.g. 'Fiesta pot' or 'Officer donation'"
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
        />
        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
        <button
          onClick={handleAdd}
          className="w-full rounded-lg bg-brand-600 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          Add contribution
        </button>
      </div>

      <div className="mt-3 max-h-96 space-y-1.5 overflow-y-auto pr-1">
        {contributions.length === 0 && <p className="text-xs text-slate-400">No other contributions recorded yet.</p>}
        {contributions.map((c) => (
          <div key={c.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 p-2 text-xs">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-700">
                {c.contributorName} · ₱{c.amount.toLocaleString()}
              </p>
              <p className="text-slate-500">{c.purpose}</p>
              <p className="text-slate-400">{new Date(c.contributedAt).toLocaleDateString()}</p>
            </div>
            <button
              onClick={() => {
                deleteTodaContribution(c.id)
                logToda('Deleted contribution', `Removed ${c.contributorName} — ₱${c.amount.toLocaleString()}.`)
              }}
              className="shrink-0 rounded-md px-2 py-1 text-rose-600 hover:bg-rose-50"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function ExpensesSection({
  orgId,
  expenses,
}: {
  orgId: string
  expenses: import('../types').TodaExpenseRecord[]
}) {
  const { addTodaExpense, deleteTodaExpense, logActivity } = useRides()
  const CATEGORIES = Object.keys(TODA_EXPENSE_CATEGORY_LABELS) as TodaExpenseCategory[]
  const [category, setCategory] = useState<TodaExpenseCategory>('other')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  function logToda(action: string, summary: string) {
    logActivity({ actorRole: 'toda_admin', actorName: 'TODA Admin', todaOrgId: orgId, action, summary })
  }

  function handleAdd() {
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a valid amount greater than 0.')
      return
    }
    if (!description.trim()) {
      setError('Add a short description for the record.')
      return
    }
    addTodaExpense({ todaOrgId: orgId, category, amount: amt, description: description.trim(), recordedBy: 'TODA Admin' })
    logToda('Added TODA expense', `${TODA_EXPENSE_CATEGORY_LABELS[category]} — ₱${amt.toLocaleString()}: "${description.trim()}".`)
    setAmount('')
    setDescription('')
    setError('')
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-slate-700">TODA expenses</h2>
      <p className="mb-3 text-xs text-slate-500">
        Costs the TODA itself pays for — fuel subsidies for members, terminal upkeep, officer honoraria, event
        costs, etc. Bookkeeping only, no real payment collected here.
      </p>
      <div className="space-y-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
        <div className="grid grid-cols-2 gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as TodaExpenseCategory)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {TODA_EXPENSE_CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="₱ amount"
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
        </div>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description, e.g. 'August fuel subsidy'"
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
        />
        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
        <button
          onClick={handleAdd}
          className="w-full rounded-lg bg-brand-600 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          Add expense
        </button>
      </div>

      <div className="mt-3 max-h-96 space-y-1.5 overflow-y-auto pr-1">
        {expenses.length === 0 && <p className="text-xs text-slate-400">No expenses logged yet.</p>}
        {expenses.map((e) => (
          <div key={e.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 p-2 text-xs">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-700">
                {TODA_EXPENSE_CATEGORY_LABELS[e.category]} · ₱{e.amount.toLocaleString()}
              </p>
              <p className="text-slate-500">{e.description}</p>
              <p className="text-slate-400">{new Date(e.recordedAt).toLocaleDateString()}</p>
            </div>
            <button
              onClick={() => {
                deleteTodaExpense(e.id)
                logToda('Deleted TODA expense', `Removed ${TODA_EXPENSE_CATEGORY_LABELS[e.category]} — ₱${e.amount.toLocaleString()}.`)
              }}
              className="shrink-0 rounded-md px-2 py-1 text-rose-600 hover:bg-rose-50"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function FinancialReportSection({
  treasury,
  incomeEntries,
  expenseEntries,
}: {
  treasury: number
  incomeEntries: { at: string; value: number }[]
  expenseEntries: { at: string; value: number }[]
}) {
  const [period, setPeriod] = useState<ReportPeriod>('monthly')

  const totalIncome = incomeEntries.reduce((sum, e) => sum + e.value, 0)
  const totalContributions = totalIncome - treasury
  const totalExpenses = expenseEntries.reduce((sum, e) => sum + e.value, 0)
  const netIncome = totalIncome - totalExpenses

  const count = REPORT_PERIOD_DEFAULT_COUNT[period]
  const incomeTrend = amountsByPeriod(incomeEntries, period, count)
  const expenseTrend = amountsByPeriod(expenseEntries, period, count)

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-slate-700">Financial report</h2>
      <p className="mb-3 text-xs text-slate-500">
        Commission treasury and other contributions vs. expenses — a quick snapshot of where the TODA's own money
        stands.
      </p>

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

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Commission treasury</p>
          <p className="text-lg font-semibold text-slate-700">₱{treasury.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Other contributions</p>
          <p className="text-lg font-semibold text-slate-700">₱{totalContributions.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Total expenses</p>
          <p className="text-lg font-semibold text-rose-700">₱{totalExpenses.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Net income</p>
          <p className={`text-lg font-semibold ${netIncome >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            ₱{netIncome.toLocaleString()}
          </p>
        </div>
      </div>

      {period === 'all' ? (
        <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          "All" collapses the whole report into the totals above, with no time breakdown — switch Group by to a
          period to see a trend chart.
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
    </section>
  )
}

function RequestsHistorySection({
  requests,
  members,
}: {
  requests: import('../types').MembershipRequest[]
  members: Driver[]
}) {
  const [showHistory, setShowHistory] = useState(false)
  if (requests.length === 0) return null
  const sorted = [...requests].sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setShowHistory((v) => !v)}
        className="mb-2 flex w-full items-center justify-between text-sm font-semibold text-slate-700"
      >
        Hold / terminate requests
        <span className="text-xs text-slate-400">{showHistory ? '▲ Hide' : '▼ Show'}</span>
      </button>
      {showHistory && (
      <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
        {sorted.map((r) => {
          const member = members.find((m) => m.id === r.driverId)
          return (
            <div key={r.id} className="rounded-lg border border-slate-200 p-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700">
                  {member?.name ?? 'Unknown'} · {r.requestType === 'terminate' ? 'Terminate' : 'Hold'}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 font-medium ${
                    r.status === 'pending'
                      ? 'bg-amber-100 text-amber-800'
                      : r.status === 'approved'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {r.status}
                </span>
              </div>
              <p className="mt-1 text-slate-500">{r.reason}</p>
            </div>
          )
        })}
      </div>
      )}
    </section>
  )
}
