import { ETA_SECONDS_PER_LEG } from '../context/RideContext'
import { DRIVER_BASE_COORDS, DRIVER_BASE_GPS, DRIVER_BASE_LABEL } from '../mock/data'
import { interpolateGps } from './liveTracking'
import { pointAlongRoute, type RouteInfo } from './routing'
import type { Driver, GeoCoords, Ride } from '../types'

export function getLegInfo(ride: Ride) {
  const isOngoing = ride.status === 'ongoing'
  const origin = isOngoing ? ride.pickup.coords : DRIVER_BASE_COORDS
  const destination = isOngoing ? ride.dropoff.coords : ride.pickup.coords
  const originLabel = isOngoing ? ride.pickup.label : DRIVER_BASE_LABEL
  const destinationLabel = isOngoing ? ride.dropoff.label : ride.pickup.label
  const etaSeconds = Math.round((1 - ride.legProgress) * ETA_SECONDS_PER_LEG)

  return { origin, destination, originLabel, destinationLabel, etaSeconds, arrived: ride.legProgress >= 1 }
}

// The driver's real-map position: their actual live GPS if they've opted in
// to sharing it for this ride; otherwise walked along the real OSRM road
// route (if one was fetched — see lib/routing.ts's useRoute) using the same
// legProgress that already drives the abstract simulation grid, so the
// simulated pace is unchanged but the marker now follows actual streets
// instead of cutting a straight line through them. Falls further back to
// straight-line interpolation if no route is available yet (still loading,
// or the routing server failed) — the real map is never empty either way.
export function getDriverMapGps(ride: Ride, route?: RouteInfo | null): { gps: GeoCoords; isLive: boolean } | null {
  if (ride.status !== 'driver_arriving' && ride.status !== 'ongoing') return null
  if (ride.driverLiveGps) return { gps: ride.driverLiveGps, isLive: true }
  const isOngoing = ride.status === 'ongoing'
  const origin = isOngoing ? ride.pickup.gps : DRIVER_BASE_GPS
  const destination = isOngoing ? ride.dropoff.gps : ride.pickup.gps
  // Defensive: a MockLocation from before `gps` existed (stale localStorage)
  // has no real coordinate to interpolate from — fall back to live-only.
  if (!origin || !destination) return null
  if (route && route.points.length > 1) {
    return { gps: pointAlongRoute(route.points, ride.legProgress), isLive: false }
  }
  return { gps: interpolateGps(origin, destination, ride.legProgress), isLive: false }
}

// The passenger's real-map position while waiting for pickup: their live-
// shared GPS if they've opted in, else the one-time exact pin captured at
// booking, else nothing (no marker rather than a guess).
export function getPassengerMapGps(ride: Ride): { gps: GeoCoords; isLive: boolean } | null {
  if (ride.status !== 'driver_arriving') return null
  if (ride.passengerLiveGps) return { gps: ride.passengerLiveGps, isLive: true }
  if (ride.pickupGps) return { gps: ride.pickupGps, isLive: false }
  return null
}

// Admin sets how many days back the Trip History lists (Passenger, Driver)
// show — older rides stay in state (earnings totals, ratings, admin reports
// all still see them) but drop out of that display list. See
// RideContext's tripHistoryRetentionDays/SET_TRIP_HISTORY_RETENTION_DAYS.
export function isWithinRetentionDays(dateIso: string, retentionDays: number): boolean {
  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  return new Date(dateIso).getTime() >= cutoffMs
}

export function formatEta(seconds: number): string {
  if (seconds <= 0) return 'Arriving now'
  if (seconds < 60) return `${seconds}s away`
  return `${Math.ceil(seconds / 60)} min away`
}

export function buildTimeline(ride: Ride): { label: string; ts: string }[] {
  const events: { label: string; ts: string }[] = [{ label: 'Ride booked', ts: ride.requestedAt }]
  if (ride.acceptedAt) events.push({ label: `Driver assigned: ${ride.driverName}`, ts: ride.acceptedAt })
  if (ride.startedAt) events.push({ label: 'Ride started', ts: ride.startedAt })
  if (ride.completedAt) events.push({ label: 'Ride completed', ts: ride.completedAt })
  return events
}

// Priority TODA dispatch: the ride's own TODA terminal queue gets first
// crack at accepting it (one driver at a time, in queue order — see
// isRideVisibleToDriver); everyone else (other TODAs, freelancers) only
// sees it once the priority window elapses or the queue runs out. A special
// pickup (driver detours from the terminal to the passenger's exact spot —
// see Ride.specialPickupRequested) is a harder ask, so it gets the longer
// specialPickupEscalationMs window instead of the general todaQueueWindowMs
// before falling open to everyone.
export function getDispatchWindow(ride: Ride, todaQueueWindowMs: number, specialPickupEscalationMs: number) {
  const effectiveWindowMs = ride.specialPickupRequested ? specialPickupEscalationMs : todaQueueWindowMs
  const elapsedMs = Date.now() - new Date(ride.requestedAt).getTime()
  const remainingMs = Math.max(0, effectiveWindowMs - elapsedMs)
  // The queue can also run dry before the timer does — e.g. an empty
  // terminal, or everyone in it already passed on this ride — in which
  // case there's no reason to keep making everyone else wait.
  const queueExhausted = ride.priorityTodaOrgId !== null && ride.priorityQueueOfferedDriverId === null
  return { openToAll: remainingMs <= 0 || queueExhausted, remainingSeconds: Math.ceil(remainingMs / 1000) }
}

export function isRideVisibleToDriver(
  ride: Ride,
  driver: Driver,
  todaQueueWindowMs: number,
  specialPickupEscalationMs: number,
): boolean {
  // Paused/terminated drivers never receive ride offers, regardless of
  // queue position or the open-to-all fallback — only the App Admin can
  // restore this.
  if (driver.accessStatus !== 'active') return false
  const { openToAll } = getDispatchWindow(ride, todaQueueWindowMs, specialPickupEscalationMs)
  if (openToAll) return true
  // Sequential terminal-queue dispatch: only the driver currently "up" can
  // see/accept it — not a broadcast to the whole TODA.
  return ride.priorityQueueOfferedDriverId === driver.id
}
