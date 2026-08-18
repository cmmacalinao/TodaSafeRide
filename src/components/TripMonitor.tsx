import { useEffect, useState } from 'react'
import { ETA_SECONDS_PER_LEG, useRides } from '../context/RideContext'
import { DRIVER_BASE_GPS, MOCK_DRIVERS, PAYMENT_METHODS } from '../mock/data'
import { StatusBadge } from './StatusBadge'
import { RealLiveMap, type MapPoint } from './RealLiveMap'
import { AlertBanner } from './AlertBanner'
import { PhotoCaptureButton } from './PhotoCaptureButton'
import { PhotoGallery } from './PhotoGallery'
import { buildTimeline, formatEta, getDispatchWindow, getDriverMapGps, getLegInfo, getPassengerMapGps } from '../lib/tracking'
import { useWatchPosition } from '../lib/liveTracking'
import { useRoute } from '../lib/routing'
import type { Ride } from '../types'

interface CallContact {
  label: string
  phone: string
}

interface TripMonitorProps {
  title: string
  ride: Ride
  sosActorId: string
  sosLabel: string
  showCancel?: boolean
  onCancel?: () => void
  // Lets the caller stop showing this ride in the "current trip" slot once
  // it's completed, so the passenger can start a new booking without first
  // having to tap a payment method — see PassengerPage's dismissedRideId.
  // The ride itself isn't affected; it's still fully visible in Trip History
  // either way (ReceiptCard there doesn't depend on paymentAcknowledged).
  onDismiss?: () => void
  extraContacts?: CallContact[]
  // Only the passenger's own screen should be able to toggle live GPS
  // sharing for themselves — a parent viewing the same ride can see the map
  // but shouldn't get a share toggle for a location that isn't theirs.
  allowLiveGpsToggle?: boolean
}

export function TripMonitor({
  title,
  ride,
  sosActorId,
  sosLabel,
  showCancel,
  onCancel,
  onDismiss,
  extraContacts,
  allowLiveGpsToggle,
}: TripMonitorProps) {
  const {
    alerts,
    drivers,
    todaOrganizations,
    todaQueueWindowMs,
    specialPickupEscalationMs,
    triggerSos,
    addSafetyPhoto,
    updatePassengerLiveGps,
    addTipOffer,
    acknowledgeRidePayment,
  } = useRides()
  const [shareLiveGps, setShareLiveGps] = useState(false)
  const [customTipInput, setCustomTipInput] = useState('')
  const { position: livePassengerGps, error: liveGpsError } = useWatchPosition(shareLiveGps)

  useEffect(() => {
    updatePassengerLiveGps(ride.id, shareLiveGps ? livePassengerGps : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livePassengerGps, shareLiveGps, ride.id])

  const driver = ride.driverId ? MOCK_DRIVERS.find((d) => d.id === ride.driverId) : null
  const leg = getLegInfo(ride)
  const timeline = buildTimeline(ride)
  const isTerminal = ride.status === 'completed' || ride.status === 'declined' || ride.status === 'cancelled'
  const openSos = alerts.find((a) => a.rideId === ride.id && a.type === 'sos' && a.status === 'open')
  const hasDriver = ride.status === 'driver_arriving' || ride.status === 'ongoing'
  const contacts: CallContact[] = [
    ...(hasDriver && driver?.phone ? [{ label: `Call ${driver.name}`, phone: driver.phone }] : []),
    ...(hasDriver ? (extraContacts ?? []).filter((c) => c.phone) : []),
  ]

  const isOngoingLeg = ride.status === 'ongoing'
  // DRIVER_BASE_GPS only makes sense as a route endpoint once a driver is
  // actually assigned (driver_arriving) — getDriverMapGps then walks a
  // marker along this exact line, so the two stay visually connected. While
  // still 'requested' there's no driver yet and nothing plots at
  // DRIVER_BASE_GPS, so that line would dead-end at an unmarked point;
  // previewing the trip's own pickup→dropoff route instead keeps the line
  // anchored to the two pins actually shown on the map.
  const routeLineOriginForRoute = isOngoingLeg ? ride.pickup.gps : hasDriver ? DRIVER_BASE_GPS : ride.pickup.gps
  const routeLineDestinationForRoute = isOngoingLeg ? ride.dropoff.gps : hasDriver ? ride.pickup.gps : ride.dropoff.gps
  const route = useRoute(routeLineOriginForRoute ?? null, routeLineDestinationForRoute ?? null)
  // Independent of ride status/leg — always the pickup→destination trip
  // itself, so "how long will the actual ride take" stays visible even
  // while still waiting for a driver, alongside the driver's own ETA to
  // reach you. Falls back to the same simulated per-leg duration the ETA
  // countdown itself uses whenever a real route isn't available yet.
  const tripRoute = useRoute(ride.pickup.gps ?? null, ride.dropoff.gps ?? null)
  const tripDurationSeconds = tripRoute?.durationSeconds ?? ETA_SECONDS_PER_LEG

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
            label: `${ride.driverName ?? 'Driver'} — ${driverGpsInfo.isLive ? 'live GPS' : 'estimated'}`,
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
            label: passengerGpsInfo.isLive ? 'You — live GPS' : 'You — shared pin',
            pulse: passengerGpsInfo.isLive,
          },
        ]
      : []),
  ]
  const routeLine =
    route && route.points.length > 1
      ? route.points
      : routeLineOriginForRoute && routeLineDestinationForRoute
        ? [routeLineOriginForRoute, routeLineDestinationForRoute]
        : undefined

  return (
    <section className="space-y-3 rounded-xl border border-brand-200 bg-brand-50 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-brand-800">{title}</h2>
        <StatusBadge status={ride.status} />
      </div>
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
            <p className="text-[11px] font-medium text-slate-500">Documents to show the pharmacy</p>
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
        {ride.pabiliTip > 0 && <> · +₱{ride.pabiliTip} tip</>}
        {ride.tipOffer > 0 && <> · +₱{ride.tipOffer} tip offer</>}
        {ride.passengerCount > 1 && <> · 👥 {ride.passengerCount} passengers</>}
      </p>

      <div>
        <div className="mb-1 flex items-center gap-2">
          <p className="text-xs font-medium text-slate-500">Payment method</p>
          {ride.status === 'completed' && ride.payment?.status === 'paid' && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              ✓ Paid
            </span>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {PAYMENT_METHODS.map((m) => {
            const isCompleted = ride.status === 'completed'
            const isSelected = ride.paymentMethod === m.id
            return (
              <button
                key={m.id}
                type="button"
                disabled={!isCompleted}
                onClick={() => acknowledgeRidePayment(ride.id, m.id)}
                className={`rounded-lg border py-2 text-xs font-medium transition ${
                  isSelected ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 text-slate-600'
                } ${isCompleted ? 'hover:bg-slate-50' : 'cursor-not-allowed opacity-60'}`}
              >
                {m.label}
              </button>
            )
          })}
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          {ride.status === 'completed'
            ? 'Trip complete — tap to confirm how you paid.'
            : 'Locked in until the trip is completed.'}
        </p>
        {ride.status === 'completed' && onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="mt-2 w-full rounded-lg bg-brand-600 py-2 text-xs font-semibold text-white hover:bg-brand-700"
          >
            Book a new ride →
          </button>
        )}
      </div>

      {ride.bookedByParentId && <p className="text-xs text-slate-500">📋 Booked by parent</p>}
      {ride.pickupGps && ride.status === 'driver_arriving' && (
        <p className="text-xs text-emerald-700">✓ Your exact GPS location was shared with the driver.</p>
      )}
      {ride.specialPickupRequested && (
        <p className="rounded-lg bg-amber-50 p-2 text-xs font-medium text-amber-700">
          📍 Special pickup requested — the driver comes to your exact spot instead of the Terminal (+₱
          {ride.specialPickupFee} included in the fare above).
        </p>
      )}

      {openSos && (
        <div className="animate-pulse rounded-lg border-2 border-rose-500 bg-rose-100 p-3">
          <p className="text-sm font-bold text-rose-800">🚨 EMERGENCY — SOS triggered</p>
          <p className="mt-0.5 text-xs text-rose-700">{openSos.notes}</p>
          {openSos.guardianNotifiedPhone && (
            <a
              href={`tel:${openSos.guardianNotifiedPhone}`}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-rose-400 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
            >
              📞 Call guardian {openSos.guardianNotifiedPhone}
            </a>
          )}
        </div>
      )}

      {ride.routeAlert && (
        <AlertBanner message="Route deviation detected — the tricycle has drifted off the expected path." />
      )}

      {hasDriver &&
        (driver ? (
          <div className="flex items-center gap-3 rounded-lg bg-white p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {driver.name.charAt(0)}
            </div>
            <div className="text-sm">
              <p className="font-medium text-slate-800">{driver.name}</p>
              <p className="text-xs text-slate-500">
                Plate {driver.plateNumber} · ★ {driver.rating}
              </p>
            </div>
          </div>
        ) : null)}

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

      {!driver && !isTerminal && ride.status === 'requested' && (
        <div className="space-y-1">
          <p className="text-xs text-slate-500">
            Looking for a nearby driver…{' '}
            {(() => {
              const { openToAll, remainingSeconds } = getDispatchWindow(ride, todaQueueWindowMs, specialPickupEscalationMs)
              if (openToAll) return 'open to all nearby TODAs.'
              const org = todaOrganizations.find((o) => o.id === ride.priorityTodaOrgId)
              const offeredDriver = drivers.find((d) => d.id === ride.priorityQueueOfferedDriverId)
              const escalationNote = ride.specialPickupRequested
                ? `${Math.ceil(remainingSeconds / 60)}m left before it opens to any of ${org?.name ?? 'the TODA'}'s members and freelance drivers`
                : `${remainingSeconds}s left before it opens to other TODAs/freelancers`
              return `currently offered to ${offeredDriver?.name ?? 'the next driver'} at ${
                org?.name ?? 'the nearest TODA'
              }'s terminal queue — ${escalationNote}.`
            })()}
          </p>
          {ride.priorityQueueLog.length > 0 && (
            <p className="text-[11px] text-slate-400">
              Already passed:{' '}
              {ride.priorityQueueLog
                .map((entry) => `${entry.driverName} (${entry.outcome === 'declined' ? 'declined' : 'no response'})`)
                .join(', ')}
            </p>
          )}

          <div className="rounded-lg border border-dashed border-brand-300 bg-white p-2.5">
            <p className="text-xs font-medium text-slate-700">
              {ride.tipOffer > 0 ? `Tip offer: ₱${ride.tipOffer}` : 'No driver yet? Add a tip to get noticed.'}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {[10, 20, 50].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => addTipOffer(ride.id, amount)}
                  className="rounded-full border border-brand-300 px-2.5 py-1 text-[11px] font-medium text-brand-700 hover:bg-brand-50"
                >
                  +₱{amount}
                </button>
              ))}
              <input
                type="number"
                min={1}
                value={customTipInput}
                onChange={(e) => setCustomTipInput(e.target.value)}
                placeholder="Custom"
                className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-[11px]"
              />
              <button
                type="button"
                onClick={() => {
                  const amount = Math.round(Number(customTipInput))
                  if (!Number.isFinite(amount) || amount <= 0) return
                  addTipOffer(ride.id, amount)
                  setCustomTipInput('')
                }}
                className="rounded-full border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {!isTerminal && (
        <div className="space-y-1.5">
          {allowLiveGpsToggle && ride.status === 'driver_arriving' && (
            <>
              <button
                type="button"
                onClick={() => setShareLiveGps((v) => !v)}
                className={`w-full rounded-lg border py-1.5 text-xs font-medium transition ${
                  shareLiveGps
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {shareLiveGps
                  ? '📡 Sharing your live GPS location — tap to stop'
                  : '📡 Share my live GPS location while I wait'}
              </button>
              {shareLiveGps && liveGpsError && <p className="text-[11px] text-rose-600">{liveGpsError}</p>}
            </>
          )}
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
          {hasDriver ? (
            <div className="space-y-0.5 text-center">
              <p className="text-xs font-medium text-brand-700">
                🛺 {ride.status === 'driver_arriving' ? 'Driver arriving: ' : 'To destination: '}
                {formatEta(leg.etaSeconds)}
              </p>
              <p className="text-[11px] font-medium text-slate-500">
                🏁 Trip time (pickup → destination): ~{Math.max(1, Math.round(tripDurationSeconds / 60))} min
              </p>
            </div>
          ) : (
            <p className="text-center text-xs font-medium text-slate-400">
              Map will show your driver's live position once someone accepts.
            </p>
          )}
        </div>
      )}

      {!isTerminal && (
        <div className="flex gap-2">
          {hasDriver && (
            <PhotoCaptureButton onCapture={(dataUrl) => addSafetyPhoto(ride.id, dataUrl, sosActorId)} />
          )}
          <button
            type="button"
            onClick={() => triggerSos(ride.id, sosActorId)}
            disabled={!!openSos}
            aria-label={sosLabel}
            title={sosLabel}
            className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-xl border py-3 transition disabled:cursor-not-allowed ${
              openSos
                ? 'animate-pulse border-rose-600 bg-rose-600 text-white'
                : 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            <span className="text-2xl leading-none">🆘</span>
            <span className="text-[11px] font-semibold">{openSos ? 'Sent' : 'SOS'}</span>
          </button>
        </div>
      )}

      {hasDriver && <PhotoGallery photos={ride.safetyPhotos} />}

      <div className="space-y-1 rounded-lg bg-white p-3">
        <p className="mb-1 text-xs font-semibold text-slate-600">Notifications</p>
        {timeline.map((e) => (
          <div key={e.label} className="flex items-center justify-between text-xs text-slate-500">
            <span>{e.label}</span>
            <span>{new Date(e.ts).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>

      {showCancel && ride.status === 'requested' && onCancel && (
        <button
          onClick={onCancel}
          className="w-full rounded-lg border border-rose-200 bg-white py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
        >
          Cancel request
        </button>
      )}
    </section>
  )
}
