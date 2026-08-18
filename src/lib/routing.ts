import { useEffect, useState } from 'react'
import { haversineDistanceMeters } from './geo'
import { loadGoogleMaps } from './googleMapsLoader'
import type { GeoCoords } from '../types'

export interface RouteInfo {
  // The actual road-network path as a sequence of real waypoints — not just
  // the two endpoints — so a polyline drawn through them follows real
  // streets instead of cutting through buildings/rivers.
  points: GeoCoords[]
  distanceMeters: number
  durationSeconds: number
}

// Same-session cache, keyed by endpoint coordinates — avoids re-fetching the
// same leg's route on every re-render/tick, and avoids hammering the free
// public routing server.
const routeCache = new Map<string, RouteInfo | null>()

function cacheKey(origin: GeoCoords, destination: GeoCoords): string {
  return `${origin.lat},${origin.lng}|${destination.lat},${destination.lng}`
}

// Tries Google's Directions API first (only when VITE_GOOGLE_MAPS_API_KEY is
// configured) — same rationale as geocode.ts's Google-first path: better PH
// road coverage than OSRM's free public instance. Resolves null (never
// throws) on any failure so the OSRM fallback below still runs.
async function getRouteFromGoogle(origin: GeoCoords, destination: GeoCoords): Promise<RouteInfo | null> {
  const loading = loadGoogleMaps()
  if (!loading) return null
  try {
    await loading
  } catch {
    return null
  }
  if (!window.google?.maps) return null
  return new Promise((resolve) => {
    const service = new window.google!.maps.DirectionsService()
    service.route(
      {
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: destination.lat, lng: destination.lng },
        travelMode: window.google!.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        const route = result?.routes?.[0]
        const leg = route?.legs?.[0]
        if (status !== 'OK' || !route || !leg) {
          resolve(null)
          return
        }
        resolve({
          points: route.overview_path.map((p) => ({ lat: p.lat(), lng: p.lng() })),
          distanceMeters: leg.distance?.value ?? 0,
          durationSeconds: leg.duration?.value ?? 0,
        })
      },
    )
  })
}

// Free, keyless road-network routing via OSRM's public demo server — the
// same "free tier, no API key" pattern already used for OpenStreetMap tiles
// (Leaflet) and address geocoding (Nominatim) elsewhere in this app. It's a
// shared public instance, not meant for heavy production traffic, but fine
// for this prototype. Returns null (never throws) on any failure so callers
// can fall back to straight-line interpolation.
export async function getRoute(origin: GeoCoords, destination: GeoCoords): Promise<RouteInfo | null> {
  const key = cacheKey(origin, destination)
  if (routeCache.has(key)) return routeCache.get(key)!

  const googleRoute = await getRouteFromGoogle(origin, destination)
  if (googleRoute) {
    routeCache.set(key, googleRoute)
    return googleRoute
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      routeCache.set(key, null)
      return null
    }
    const data = await res.json()
    if (data.code !== 'Ok' || !data.routes?.length) {
      routeCache.set(key, null)
      return null
    }
    const route = data.routes[0]
    const points: GeoCoords[] = route.geometry.coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng }))
    const info: RouteInfo = { points, distanceMeters: route.distance, durationSeconds: route.duration }
    routeCache.set(key, info)
    return info
  } catch {
    routeCache.set(key, null)
    return null
  } finally {
    clearTimeout(timeout)
  }
}

// Fetches (and caches) the real road route between two points whenever they
// change; null while loading or if routing failed, in which case callers
// should fall back to straight-line behavior.
export function useRoute(origin: GeoCoords | null, destination: GeoCoords | null): RouteInfo | null {
  const [route, setRoute] = useState<RouteInfo | null>(null)
  const key = origin && destination ? cacheKey(origin, destination) : null

  useEffect(() => {
    if (!origin || !destination) {
      setRoute(null)
      return
    }
    let cancelled = false
    getRoute(origin, destination).then((result) => {
      if (!cancelled) setRoute(result)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return route
}

// Walks a fraction t (0-1) along a multi-point route by cumulative real
// distance rather than by point-index, so progress along a route with
// unevenly-spaced points still reads as constant-speed travel.
export function pointAlongRoute(points: GeoCoords[], t: number): GeoCoords {
  if (points.length === 0) throw new Error('pointAlongRoute: empty route')
  if (points.length === 1) return points[0]
  const clamped = Math.max(0, Math.min(1, t))

  const segmentLengths: number[] = []
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    const len = haversineDistanceMeters(points[i], points[i + 1])
    segmentLengths.push(len)
    total += len
  }
  if (total === 0) return points[0]

  const targetDist = clamped * total
  let accumulated = 0
  for (let i = 0; i < segmentLengths.length; i++) {
    const segLen = segmentLengths[i]
    if (accumulated + segLen >= targetDist || i === segmentLengths.length - 1) {
      const segT = segLen === 0 ? 0 : (targetDist - accumulated) / segLen
      const a = points[i]
      const b = points[i + 1]
      return { lat: a.lat + (b.lat - a.lat) * segT, lng: a.lng + (b.lng - a.lng) * segT }
    }
    accumulated += segLen
  }
  return points[points.length - 1]
}
