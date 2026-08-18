import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ETA_SECONDS_PER_LEG, useRides } from '../context/RideContext'
import { useSession } from '../context/SessionContext'
import { StatusBadge } from '../components/StatusBadge'
import { RealLiveMap, type MapPoint } from '../components/RealLiveMap'
import { DriverAuthGate } from '../components/DriverAuthGate'
import { GoogleAdSlot } from '../components/GoogleAdSlot'
import { DRIVER_BASE_GPS, getTodaQueue, PAYMENT_METHODS } from '../mock/data'
import {
  formatEta,
  getDispatchWindow,
  getDriverMapGps,
  getLegInfo,
  getPassengerMapGps,
  isRideVisibleToDriver,
  isWithinRetentionDays,
} from '../lib/tracking'
import { TERMINAL_PROXIMITY_METERS, getCurrentGeoPosition, haversineDistanceMeters } from '../lib/geo'
import { useWatchPosition } from '../lib/liveTracking'
import { useRoute } from '../lib/routing'
import { TodaAdminPage } from './TodaAdminPage'
import type { Ride } from '../types'

type EarningsFilter = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all'

const EARNINGS_FILTER_LABELS: Record<EarningsFilter, string> = {
  daily: 'Today',
  weekly: 'This week',
  monthly: 'This month',
  yearly: 'This year',
  all: 'All time',
}

function matchesEarningsFilter(ride: Ride, filter: EarningsFilter): boolean {
  if (filter === 'all') return true
  if (!ride.completedAt) return false
  const completed = new Date(ride.completedAt)
  const now = new Date()
  if (filter === 'daily') return completed.toDateString() === now.toDateString()
  if (filter === 'weekly') {
    const weekStart = new Date(now)
    weekStart.setHours(0, 0, 0, 0)
    const dayOfWeek = (weekStart.getDay() + 6) % 7 // Monday = 0
    weekStart.setDate(weekStart.getDate() - dayOfWeek)
    return completed >= weekStart
  }
  if (filter === 'monthly') {
    return completed.getFullYear() === now.getFullYear() && completed.getMonth() === now.getMonth()
  }
  return completed.getFullYear() === now.getFullYear()
}

export function DriverPage() {
  const {
    rides,
    drivers,
    alerts,
    todaQueueWindowMs,
    specialPickupEscalationMs,
    todaOrganizations,
    tripHistoryRetentionDays,
    acceptRide,
    declineRide,
    startRide,
    completeRide,
    joinTerminalQueue,
    leaveTerminalQueue,
    setDriverPabiliPriority,
    triggerDriverSos,
    resolveAlert,
  } = useRides()
  const { loggedInDriverId, setLoggedInDriverId, loggedInTodaAdminOrgId, setLoggedInTodaAdminOrgId } = useSession()
  const [queueError, setQueueError] = useState('')
  const [checkingLocation, setCheckingLocation] = useState(false)
  const [sosSending, setSosSending] = useState(false)
  const [sosNotes, setSosNotes] = useState('')
  // Starts collapsed, same as the passenger app's own "Trip history" — a
  // long, low-priority list that shouldn't push the active-trip card down.
  const [showTripHistory, setShowTripHistory] = useState(false)
  const [earningsFilter, setEarningsFilter] = useState<EarningsFilter>('all')
  const [dismissedPaidRideId, setDismissedPaidRideId] = useState<string | null>(null)
  const location = useLocation()
  const navigate = useNavigate()
  // Scroll targets for the hamburger drawer's menu items (see
  // NavBar.tsx/NavDrawer.tsx) — "Current Ride" and "Ride Requests" share one
  // ref since they're the same mutually-exclusive DOM slot (myActiveRide ?
  // ActiveTripCard : Incoming requests).
  const currentOrRequestsSectionRef = useRef<HTMLDivElement>(null)
  const earningsSectionRef = useRef<HTMLElement>(null)
  const tripHistorySectionRef = useRef<HTMLElement>(null)
  // Only rendered when homeToda is set (see below) — a freelance driver has
  // no terminal queue, so this ref just stays null and the 'queue' deep-link
  // silently no-ops for them instead of erroring.
  const queueSectionRef = useRef<HTMLElement>(null)

  // Hooks must run unconditionally before the early returns below (Rules of
  // Hooks) — this effect only touches state/refs declared above, so it's
  // safe to run even on renders that bail out to TodaAdminPage/DriverAuthGate
  // right after.
  useEffect(() => {
    const section = (location.state as { section?: string } | null)?.section
    if (!section) return
    navigate(location.pathname, { replace: true, state: {} })
    const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })
    switch (section) {
      case 'home':
        scrollTop()
        break
      case 'requests':
      case 'current':
        setTimeout(() => currentOrRequestsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
        break
      case 'earnings':
        setTimeout(() => earningsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
        break
      case 'queue':
        setTimeout(() => queueSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
        break
      case 'history':
        setShowTripHistory(true)
        setTimeout(() => tripHistorySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
        break
      default:
        break
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key])

  if (loggedInTodaAdminOrgId) {
    return <TodaAdminPage orgId={loggedInTodaAdminOrgId} onLogOut={() => setLoggedInTodaAdminOrgId(null)} />
  }

  const driver = drivers.find((d) => d.id === loggedInDriverId)

  if (!driver) {
    return <DriverAuthGate onLoggedIn={setLoggedInDriverId} onTodaAdminLoggedIn={setLoggedInTodaAdminOrgId} />
  }

  const currentDriverId = driver.id
  const myActiveRide = rides.find(
    (r) => r.driverId === currentDriverId && (r.status === 'driver_arriving' || r.status === 'ongoing'),
  )

  // Paused/terminated drivers can still log in to see why and finish a trip
  // already in progress, but get no dashboard beyond that — no new
  // requests, no queue. Only the App Admin can lift this.
  if (driver.accessStatus !== 'active' && !myActiveRide) {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center shadow-sm">
          <p className="text-sm font-semibold text-rose-800">
            Your account is currently {driver.accessStatus === 'terminated' ? 'terminated' : 'paused'}.
          </p>
          <p className="mt-2 text-xs text-rose-700">
            {driver.accessNote ?? 'Contact your TODA or Admin for details.'}
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Only the App Admin can restore your access — once any outstanding issue is resolved, ask them to
            reinstate your account.
          </p>
          <button
            onClick={() => setLoggedInDriverId(null)}
            className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Log out
          </button>
        </section>
      </div>
    )
  }

  const allRequested = rides.filter((r) => r.status === 'requested')
  const incoming = allRequested.filter((r) =>
    isRideVisibleToDriver(r, driver, todaQueueWindowMs, specialPickupEscalationMs),
  )
  const hiddenCount = allRequested.length - incoming.length
  // Admin-configurable — see AdminPage's "Trip history retention" setting.
  // Older rides aren't lost, they just drop out of this list (earnings
  // totals below still see the full history regardless).
  const myRides = rides
    .filter((r) => r.driverId === currentDriverId && isWithinRetentionDays(r.requestedAt, tripHistoryRetentionDays))
    .slice()
    .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
  const myCompletedRides = rides.filter((r) => r.driverId === currentDriverId && r.status === 'completed')
  const filteredCompletedRides = myCompletedRides.filter((r) => matchesEarningsFilter(r, earningsFilter))
  const totalEarnings = filteredCompletedRides.reduce((sum, r) => sum + (r.payment?.driverPayout ?? 0), 0)
  const lastCompletedRide =
    myCompletedRides.slice().sort((a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime())[0] ??
    null
  const showPaidBanner =
    !myActiveRide &&
    lastCompletedRide !== null &&
    lastCompletedRide.payment?.status === 'paid' &&
    lastCompletedRide.id !== dismissedPaidRideId

  const homeToda = driver.todaOrgId ? todaOrganizations.find((o) => o.id === driver.todaOrgId) : null
  const todaQueue = driver.todaOrgId ? getTodaQueue(driver.todaOrgId, drivers) : []
  const queuePosition = todaQueue.findIndex((d) => d.id === driver.id) + 1

  // My own most recent open SOS (if any) — disables/relabels the button and
  // shows a "help is on the way" banner instead of letting a second alert
  // stack on top of it.
  const myOpenSos = alerts.find((a) => a.triggeredBy === driver.id && a.triggeredByRole === 'driver' && a.status === 'open')
  // Fellow members' open alerts — same TODA, not mine — so a driver gets
  // situational awareness of a colleague in trouble even outside an active
  // ride. Only TODA Admin can resolve these (see TodaAdminPage.tsx); this is
  // read-only visibility, same "each level sees, but doesn't manage, one
  // another's stuff" boundary used everywhere else in this hierarchy.
  const fellowOpenAlerts = (driver.todaOrgId
    ? alerts.filter((a) => a.todaOrgId === driver.todaOrgId && a.triggeredByRole === 'driver' && a.status === 'open' && a.triggeredBy !== driver.id)
    : []
  ).map((a) => ({ alert: a, driver: drivers.find((d) => d.id === a.triggeredBy) }))

  async function handleJoinQueue() {
    if (!homeToda) return
    setQueueError('')
    // No terminal GPS registered for this TODA yet — nothing to check
    // presence against, so let the join go through as before.
    if (!homeToda.terminalGps) {
      joinTerminalQueue(currentDriverId, null)
      return
    }
    setCheckingLocation(true)
    try {
      const position = await getCurrentGeoPosition()
      const distance = haversineDistanceMeters(position, homeToda.terminalGps)
      if (distance <= TERMINAL_PROXIMITY_METERS) {
        joinTerminalQueue(currentDriverId, position)
      } else {
        setQueueError(
          `You're about ${Math.round(distance)}m from the terminal — you need to be within ${TERMINAL_PROXIMITY_METERS}m to join the queue.`,
        )
      }
    } catch {
      setQueueError('Could not get your location — check that location access is allowed for this app, then try again.')
    } finally {
      setCheckingLocation(false)
    }
  }

  // Fires whether or not there's an active ride — unlike the passenger SOS
  // in TripMonitor.tsx (which requires one), a driver spends most of their
  // time idle/in queue, so gating this on myActiveRide would leave them with
  // no way to call for help outside a trip. Best-effort GPS: if location
  // fails/is denied, the alert still fires with location: null — TODA admin
  // and fellow members can still see it and call the driver directly.
  async function handleTriggerSos() {
    setSosSending(true)
    let position = null
    try {
      position = await getCurrentGeoPosition()
    } catch {
      // No GPS — still send the alert below, just without a pin.
    }
    triggerDriverSos(currentDriverId, position, sosNotes)
    setSosNotes('')
    setSosSending(false)
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      <section className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-xs font-medium text-slate-500">Logged in as</p>
          <p className="text-sm font-semibold text-slate-800">
            {driver.name} · {driver.plateNumber}
          </p>
          <p className="mt-0.5 text-xs font-medium text-brand-600">{homeToda ? homeToda.name : 'Freelance'}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700">Online</span>
          <button
            onClick={() => setLoggedInDriverId(null)}
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Log out
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-rose-800">🆘 Emergency SOS</h2>
            <p className="mt-0.5 text-xs text-rose-700">
              {myOpenSos
                ? 'Sent — your TODA admin and fellow members have been alerted.'
                : homeToda
                  ? `Alerts ${homeToda.name}'s admin and every online member.`
                  : "You're not in a TODA yet — this still reaches the App Admin."}
            </p>
          </div>
          <button
            type="button"
            onClick={handleTriggerSos}
            disabled={sosSending || !!myOpenSos}
            className="shrink-0 rounded-full bg-rose-600 px-5 py-2.5 text-sm font-bold text-white shadow transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
          >
            {myOpenSos ? 'Sent' : sosSending ? 'Sending…' : 'SOS'}
          </button>
        </div>
        {!myOpenSos && (
          <textarea
            value={sosNotes}
            onChange={(e) => setSosNotes(e.target.value)}
            placeholder="What's the emergency? (optional — accident, hold-up, breakdown, etc.)"
            rows={2}
            className="mt-3 w-full rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs placeholder:text-rose-300"
          />
        )}
        {myOpenSos && (
          <div className="mt-3 rounded-lg border border-rose-300 bg-white p-2.5 text-xs">
            <p className="font-medium text-rose-700">
              Open since {new Date(myOpenSos.createdAt).toLocaleTimeString()}
              {myOpenSos.location ? ' · location shared' : ' · location not captured'}
            </p>
            <p className="mt-1 text-slate-600">{myOpenSos.notes}</p>
            <button
              type="button"
              onClick={() => resolveAlert(myOpenSos.id)}
              className="mt-2 w-full rounded-lg border border-rose-300 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
            >
              I'm safe now — cancel SOS
            </button>
          </div>
        )}
        {fellowOpenAlerts.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t border-rose-200 pt-3">
            <p className="text-[11px] font-semibold text-rose-700">Fellow member alerts — {homeToda?.name}</p>
            {fellowOpenAlerts.map(({ alert, driver: d }) => (
              <div key={alert.id} className="rounded-lg border border-rose-300 bg-white p-2 text-xs">
                <p className="font-medium text-rose-700">
                  {d ? `${d.name} · ${d.plateNumber}` : 'A fellow member'} — {new Date(alert.createdAt).toLocaleTimeString()}
                </p>
                <p className="mt-0.5 text-slate-500">
                  {alert.location ? `📍 ${alert.location.lat.toFixed(5)}, ${alert.location.lng.toFixed(5)}` : 'Location not captured — try calling them.'}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <GoogleAdSlot placement="driverTop" />

      {homeToda && (
        <section ref={queueSectionRef} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-700">Terminal queue — {homeToda.name}</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {driver.queueJoinedAt
                  ? `You're #${queuePosition} of ${todaQueue.length} in line. Ride requests near your terminal go to whoever's up first.`
                  : homeToda.terminalGps
                    ? "You'll need to be at the terminal (GPS-checked) to join the line."
                    : "Join the line to get first crack at ride requests near your terminal, in order."}
              </p>
            </div>
            <button
              onClick={() => (driver.queueJoinedAt ? leaveTerminalQueue(driver.id) : handleJoinQueue())}
              disabled={checkingLocation}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
                driver.queueJoinedAt
                  ? 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                  : 'bg-brand-600 text-white hover:bg-brand-700'
              }`}
            >
              {driver.queueJoinedAt ? 'Leave queue' : checkingLocation ? 'Checking location…' : 'Join queue'}
            </button>
          </div>
          {queueError && <p className="mt-2 text-xs font-medium text-rose-600">{queueError}</p>}
          <label className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <span>
              <span className="block text-xs font-medium text-slate-700">Prioritize Pabili errands</span>
              <span className="block text-xs text-slate-500">
                Get offered Pabili (bili/errand) requests before other drivers in the queue.
              </span>
            </span>
            <input
              type="checkbox"
              checked={driver.pabiliPriority}
              onChange={(e) => setDriverPabiliPriority(driver.id, e.target.checked)}
              className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600"
            />
          </label>
        </section>
      )}

      <section ref={earningsSectionRef} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Earnings</h2>
          <select
            value={earningsFilter}
            onChange={(e) => setEarningsFilter(e.target.value as EarningsFilter)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600"
          >
            {(Object.keys(EARNINGS_FILTER_LABELS) as EarningsFilter[]).map((key) => (
              <option key={key} value={key}>
                {EARNINGS_FILTER_LABELS[key]}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            {filteredCompletedRides.length} completed trip(s) · net of platform commission
          </p>
          <span className="text-lg font-semibold text-brand-700">₱{totalEarnings}</span>
        </div>
        {filteredCompletedRides.length > 0 ? (
          <div className="mt-2 space-y-1.5">
            {filteredCompletedRides.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs text-slate-500">
                <span className="truncate">
                  {r.passengerName} · {r.pickup.label} → {r.dropoff.label}
                </span>
                <span className="shrink-0 pl-2 text-right font-medium text-slate-700">
                  ₱{r.payment?.driverPayout ?? r.fareEstimate}
                  {r.payment && r.payment.platformFee > 0 && (
                    <span className="block text-[10px] font-normal text-slate-400">
                      fare ₱{r.payment.amount} − ₱{r.payment.platformFee} fee
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-400">No completed trips in this period.</p>
        )}
      </section>

      {showPaidBanner && lastCompletedRide && (
        <section className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 p-3">
          <p className="text-xs font-medium text-emerald-800">
            ✓ Paid ₱{lastCompletedRide.payment?.amount ?? lastCompletedRide.fareEstimate} —{' '}
            {PAYMENT_METHODS.find((m) => m.id === lastCompletedRide.paymentMethod)?.label ?? lastCompletedRide.paymentMethod}
          </p>
          <button
            onClick={() => setDismissedPaidRideId(lastCompletedRide.id)}
            className="shrink-0 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
          >
            Got it
          </button>
        </section>
      )}

      <div ref={currentOrRequestsSectionRef}>
      {myActiveRide ? (
        <ActiveTripCard
          rideId={myActiveRide.id}
          onStart={() => startRide(myActiveRide.id)}
          onComplete={() => completeRide(myActiveRide.id)}
        />
      ) : (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Incoming requests</h2>
          <div className="space-y-2">
            {incoming.length === 0 && (
              <p className="text-sm text-slate-400">
                {hiddenCount > 0
                  ? `${hiddenCount} request(s) waiting for their priority TODA driver to respond.`
                  : 'No pending requests right now.'}
              </p>
            )}
            {incoming.map((r) => {
              const { openToAll, remainingSeconds } = getDispatchWindow(r, todaQueueWindowMs, specialPickupEscalationMs)
              const priorityOrg = todaOrganizations.find((o) => o.id === r.priorityTodaOrgId)
              const isMyQueueTurn = !openToAll && r.priorityQueueOfferedDriverId === driver.id
              return (
                <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-700">
                      {r.serviceType === 'pabili' && '🛍️ '}
                      {r.serviceType === 'buy_medicine' && '💊 '}
                      {r.passengerName}
                    </span>
                    <span className="text-xs text-slate-400">
                      ₱{r.fareEstimate}
                      {r.pabiliTip > 0 && ` + ₱${r.pabiliTip} tip`}
                      {r.tipOffer > 0 && (
                        <span className="font-semibold text-emerald-600"> + ₱{r.tipOffer} tip offer</span>
                      )}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {r.pickup.label} → {r.dropoff.label}
                  </p>
                  {r.specialPickupRequested && (
                    <p className="mt-1 rounded-lg bg-amber-50 p-2 text-xs font-medium text-amber-700">
                      📍 Special pickup — go to the passenger's exact GPS pin, not the Terminal (+₱
                      {r.specialPickupFee} detour fee included in the fare)
                    </p>
                  )}
                  {(r.serviceType === 'pabili' || r.serviceType === 'buy_medicine') && r.pabiliItems && (
                    <p className="mt-1 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">🛒 {r.pabiliItems}</p>
                  )}
                  {r.passengerCount > 1 && (
                    <p className="mt-0.5 text-[11px] font-medium text-slate-500">👥 {r.passengerCount} passengers</p>
                  )}
                  {r.bookedByParentId && (
                    <p className="mt-0.5 text-[11px] font-medium text-slate-500">📋 Booked by parent</p>
                  )}
                  <p className="mt-1 text-[11px] font-medium text-brand-600">
                    {openToAll
                      ? 'Open to all TODAs'
                      : isMyQueueTurn
                        ? `Your turn — ${priorityOrg?.name ?? 'terminal'} queue · respond within ${remainingSeconds}s or it passes to the next driver`
                        : 'Waiting in queue'}
                  </p>
                  {r.priorityQueueLog.length > 0 && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      Already passed:{' '}
                      {r.priorityQueueLog
                        .map((entry) => `${entry.driverName} (${entry.outcome === 'declined' ? 'declined' : 'no response'})`)
                        .join(', ')}
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => acceptRide(r.id, driver.id)}
                      className="flex-1 rounded-lg bg-brand-600 py-2 text-xs font-semibold text-white hover:bg-brand-700"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => declineRide(r.id, driver.id)}
                      className="flex-1 rounded-lg border border-slate-300 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
      </div>

      <section ref={tripHistorySectionRef}>
        <button
          type="button"
          onClick={() => setShowTripHistory((v) => !v)}
          className="mb-2 flex w-full items-center justify-between text-sm font-semibold text-slate-700"
        >
          Trip history
          <span className="text-xs text-slate-400">{showTripHistory ? '▲ Hide' : '▼ Show'}</span>
        </button>
        {showTripHistory && (
        <div className="space-y-2">
          {myRides.length === 0 && <p className="text-sm text-slate-400">No trips yet.</p>}
          {myRides.map((r) => (
            <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate font-medium text-slate-700">
                  {r.serviceType === 'pabili' && '🛍️ '}
                  {r.serviceType === 'buy_medicine' && '💊 '}
                  {r.passengerName}
                </span>
                <StatusBadge status={r.status} />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {r.pickup.label} → {r.dropoff.label}
              </p>
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                <span>{new Date(r.requestedAt).toLocaleString()}</span>
                {r.payment && (
                  <span className="font-medium text-slate-700">
                    You earned ₱{r.payment.driverPayout} · {PAYMENT_METHODS.find((m) => m.id === r.payment!.method)?.label}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        )}
      </section>

      <GoogleAdSlot placement="driverBottom" />
    </div>
  )
}

function ActiveTripCard({
  rideId,
  onStart,
  onComplete,
}: {
  rideId: string
  onStart: () => void
  onComplete: () => void
}) {
  const { rides, passengers, parents, parentLinks, updateDriverLiveGps } = useRides()
  const [confirmingCash, setConfirmingCash] = useState(false)
  const [shareLiveGps, setShareLiveGps] = useState(false)
  const { position: liveDriverGps, error: liveGpsError } = useWatchPosition(shareLiveGps)
  const ride = rides.find((r) => r.id === rideId)

  // Real road-network route for the current leg, if the endpoints resolve —
  // must be called unconditionally before the early return below, so this
  // computes origin/destination defensively (null-safe) rather than after
  // confirming `ride` exists.
  const isOngoingLeg = ride?.status === 'ongoing'
  const routeLineOrigin = ride ? (isOngoingLeg ? ride.pickup.gps : DRIVER_BASE_GPS) : null
  const routeLineDestination = ride ? (isOngoingLeg ? ride.dropoff.gps : ride.pickup.gps) : null
  const route = useRoute(routeLineOrigin ?? null, routeLineDestination ?? null)
  // Independent of which leg is current — always the pickup→destination
  // trip itself, so the driver can see how long the actual ride will take
  // even while still en route to pick the passenger up.
  const tripRoute = useRoute(ride?.pickup.gps ?? null, ride?.dropoff.gps ?? null)
  const tripDurationSeconds = tripRoute?.durationSeconds ?? ETA_SECONDS_PER_LEG

  useEffect(() => {
    if (!ride) return
    updateDriverLiveGps(ride.id, shareLiveGps ? liveDriverGps : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveDriverGps, shareLiveGps, ride?.id])

  if (!ride) return null

  const leg = getLegInfo(ride)
  const passenger = passengers.find((p) => p.id === ride.passengerId)
  const parentLink = parentLinks.find((l) => l.studentPassengerId === ride.passengerId)
  const parent = parentLink ? parents.find((p) => p.id === parentLink.parentId) : null
  const contacts = [
    ...(passenger?.phone ? [{ label: `Call ${passenger.name}`, phone: passenger.phone }] : []),
    ...(parent?.phone ? [{ label: `Call ${parent.name} (${parentLink?.relationship})`, phone: parent.phone }] : []),
    // "Book for someone else" rides have no Passenger/Parent record to look
    // a phone up from — the number typed at booking is carried on the ride
    // itself instead.
    ...(!passenger && !parent && ride.passengerPhone
      ? [{ label: `Call ${ride.passengerName}`, phone: ride.passengerPhone }]
      : []),
  ]

  const driverGpsInfo = getDriverMapGps(ride, route)
  const passengerGpsInfo = getPassengerMapGps(ride)
  // Defensive: a MockLocation from before `gps` existed (stale localStorage)
  // has no real coordinate to plot — skip that point rather than crash.
  const mapPoints: MapPoint[] = [
    ...(ride.pickup.gps ? [{ id: 'pickup', gps: ride.pickup.gps, color: '#0d9488', label: ride.pickup.label }] : []),
    ...(ride.dropoff.gps ? [{ id: 'dropoff', gps: ride.dropoff.gps, color: '#e11d48', label: ride.dropoff.label }] : []),
    ...(driverGpsInfo
      ? [
          {
            id: 'driver',
            gps: driverGpsInfo.gps,
            color: '#2563eb',
            label: driverGpsInfo.isLive ? 'You — live GPS' : 'You — estimated',
            pulse: true,
            icon: 'tricycle' as const,
          },
        ]
      : []),
    ...(passengerGpsInfo
      ? [
          {
            id: 'passenger',
            gps: passengerGpsInfo.gps,
            color: '#4f46e5',
            label: `${ride.passengerName} — ${passengerGpsInfo.isLive ? 'live GPS' : 'shared pin'}`,
            pulse: passengerGpsInfo.isLive,
          },
        ]
      : []),
  ]
  const routeLine =
    route && route.points.length > 1
      ? route.points
      : routeLineOrigin && routeLineDestination
        ? [routeLineOrigin, routeLineDestination]
        : undefined

  return (
    <section className="space-y-3 rounded-xl border border-brand-200 bg-brand-50 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-brand-800">Current trip</h2>
        <StatusBadge status={ride.status} />
      </div>
      <p className="text-sm text-slate-700">
        Passenger: <span className="font-medium">{ride.passengerName}</span>
        {ride.bookedByParentId && <span className="ml-2 text-xs text-slate-500">📋 Booked by parent</span>}
      </p>
      <p className="text-sm text-slate-700">
        {ride.serviceType === 'pabili' && '🛍️ Pabili · '}
        {ride.serviceType === 'buy_medicine' && '💊 Buy Medicine · '}
        {ride.pickup.label} → {ride.dropoff.label}
      </p>
      {(ride.serviceType === 'pabili' || ride.serviceType === 'buy_medicine') && ride.pabiliItems && (
        <p className="rounded-lg bg-white p-2 text-xs text-slate-600">🛒 {ride.pabiliItems}</p>
      )}
      {ride.serviceType === 'buy_medicine' &&
        (ride.prescriptionDataUrls.length > 0 || ride.seniorIdDataUrl || ride.otherDocDataUrl) && (
          <div className="space-y-1 rounded-lg bg-white p-2">
            <p className="text-[11px] font-medium text-slate-500">Passenger's documents for the pharmacy</p>
            <div className="flex flex-wrap gap-2">
              {ride.prescriptionDataUrls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt={`Prescription page ${i + 1}`} className="h-14 w-14 rounded-md object-cover" />
                </a>
              ))}
              {ride.seniorIdDataUrl && (
                <a href={ride.seniorIdDataUrl} target="_blank" rel="noreferrer">
                  <img src={ride.seniorIdDataUrl} alt="Senior Citizen ID" className="h-14 w-14 rounded-md object-cover" />
                </a>
              )}
              {ride.otherDocDataUrl && (
                <a href={ride.otherDocDataUrl} target="_blank" rel="noreferrer">
                  <img src={ride.otherDocDataUrl} alt="Other document" className="h-14 w-14 rounded-md object-cover" />
                </a>
              )}
            </div>
          </div>
        )}
      <p className="text-xs text-slate-500">
        Fare: ₱{ride.fareEstimate}
        {ride.pabiliTip > 0 && <span className="ml-2">· +₱{ride.pabiliTip} tip</span>}
        {ride.tipOffer > 0 && <span className="ml-2 font-medium text-emerald-600">· +₱{ride.tipOffer} tip offer</span>}
        {ride.passengerCount > 1 && <span className="ml-2">· 👥 {ride.passengerCount} passengers</span>}
      </p>

      {ride.pickupGps && ride.status === 'driver_arriving' && (
        <a
          href={`https://www.google.com/maps?q=${ride.pickupGps.lat},${ride.pickupGps.lng}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
        >
          📍 Passenger shared their exact GPS location — open in Maps
        </a>
      )}

      {contacts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {contacts.map((c) => (
            <a
              key={c.phone}
              href={`tel:${c.phone}`}
              className="flex items-center gap-1.5 rounded-lg border border-brand-300 bg-white px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
            >
              📞 {c.label}
            </a>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShareLiveGps((v) => !v)}
        className={`w-full rounded-lg border py-1.5 text-xs font-medium transition ${
          shareLiveGps
            ? 'border-blue-300 bg-blue-50 text-blue-700'
            : 'border-slate-300 text-slate-600 hover:bg-slate-50'
        }`}
      >
        {shareLiveGps ? '📡 Sharing your live GPS location — tap to stop' : '📡 Share my live GPS location'}
      </button>
      {shareLiveGps && liveGpsError && <p className="text-[11px] text-rose-600">{liveGpsError}</p>}

      <RealLiveMap
        points={mapPoints}
        routeLine={routeLine}
        routeIsReal={!!route}
        routeVariant={ride.status === 'driver_arriving' ? 'pickup' : 'trip'}
      />
      {route && (
        <p className="text-center text-[11px] text-slate-400">
          🛣️ Real road route: {(route.distanceMeters / 1000).toFixed(1)} km · ~
          {Math.max(1, Math.round(route.durationSeconds / 60))} min drive
        </p>
      )}
      <div className="space-y-0.5 text-center">
        <p className="text-xs font-medium text-brand-700">
          🛺 {ride.status === 'driver_arriving' ? 'To pickup: ' : 'To destination: '}
          {formatEta(leg.etaSeconds)}
        </p>
        <p className="text-[11px] font-medium text-slate-500">
          🏁 Trip time (pickup → destination): ~{Math.max(1, Math.round(tripDurationSeconds / 60))} min
        </p>
      </div>

      {ride.status === 'driver_arriving' && (
        <button
          onClick={onStart}
          className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Start trip
        </button>
      )}
      {ride.status === 'ongoing' && ride.paymentMethod === 'cash' && confirmingCash && (
        <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-800">
            Confirm you've received ₱{ride.fareEstimate + ride.pabiliTip + ride.tipOffer} in cash from the passenger
            {ride.pabiliTip + ride.tipOffer > 0 &&
              ` (₱${ride.fareEstimate} fare + ₱${ride.pabiliTip + ride.tipOffer} tip)`}
            .
          </p>
          <div className="flex gap-2">
            <button
              onClick={onComplete}
              className="flex-1 rounded-lg bg-amber-600 py-2 text-xs font-semibold text-white hover:bg-amber-700"
            >
              Confirm & complete trip
            </button>
            <button
              onClick={() => setConfirmingCash(false)}
              className="flex-1 rounded-lg border border-slate-300 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Not yet
            </button>
          </div>
        </div>
      )}
      {ride.status === 'ongoing' && !(ride.paymentMethod === 'cash' && confirmingCash) && (
        <button
          onClick={() => (ride.paymentMethod === 'cash' ? setConfirmingCash(true) : onComplete())}
          className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Complete trip
        </button>
      )}
    </section>
  )
}
