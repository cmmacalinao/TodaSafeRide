import { loadGoogleMaps } from './googleMapsLoader'
import type { GeoCoords } from '../types'

export interface GeocodeResult {
  gps: GeoCoords
  // The comma-separated segment of the query that actually matched — equal
  // to the full input when the exact address resolved, or a broader
  // trailing chunk (city/province) when only that part was found in
  // OpenStreetMap's data. Lets the UI be honest about precision instead of
  // silently pretending a city-level match is the exact address.
  matchedText: string
  exact: boolean
}

// Tries Google's Geocoding API first (only when VITE_GOOGLE_MAPS_API_KEY is
// configured) — Google's PH address coverage is noticeably better than
// OSM's free data, especially for small barangays/sitios. Resolves null
// (never throws) on any failure so the Nominatim fallback below still runs.
async function geocodeOnceGoogle(query: string): Promise<GeoCoords | null> {
  const loading = loadGoogleMaps()
  if (!loading) return null
  try {
    await loading
  } catch {
    return null
  }
  if (!window.google?.maps) return null
  return new Promise((resolve) => {
    const geocoder = new window.google!.maps.Geocoder()
    geocoder.geocode({ address: query, componentRestrictions: { country: 'PH' } }, (results, status) => {
      if (status === 'OK' && results && results.length > 0) {
        const loc = results[0].geometry.location
        resolve({ lat: loc.lat(), lng: loc.lng() })
      } else {
        resolve(null)
      }
    })
  })
}

async function geocodeOnce(query: string, signal: AbortSignal): Promise<GeoCoords | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ph&q=${encodeURIComponent(query)}`
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal })
  if (!res.ok) return null
  const results = (await res.json()) as { lat: string; lon: string }[]
  if (results.length === 0) return null
  return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) }
}

async function reverseGeocodeOnceGoogle(gps: GeoCoords): Promise<string | null> {
  const loading = loadGoogleMaps()
  if (!loading) return null
  try {
    await loading
  } catch {
    return null
  }
  if (!window.google?.maps) return null
  return new Promise((resolve) => {
    const geocoder = new window.google!.maps.Geocoder()
    geocoder.geocode({ location: { lat: gps.lat, lng: gps.lng } }, (results, status) => {
      if (status === 'OK' && results && results.length > 0) resolve(results[0].formatted_address)
      else resolve(null)
    })
  })
}

// Turns a raw map-tap coordinate into a readable label — the inverse of
// geocodeAddress, used when the passenger drops a pin directly on the map
// instead of picking province/city/barangay. Google's reverse geocoder is
// tried first (same key-gated pattern as geocodeAddress), falling back to
// Nominatim's free reverse endpoint. Returns null (never throws) if both
// fail, so the caller can fall back to a generic "Pinned location" label.
export async function reverseGeocode(gps: GeoCoords): Promise<string | null> {
  const googleLabel = await reverseGeocodeOnceGoogle(gps)
  if (googleLabel) return googleLabel
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${gps.lat}&lon=${gps.lng}&zoom=18&addressdetails=0`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const data = (await res.json()) as { display_name?: string }
    return data.display_name ?? null
  } catch {
    return null
  }
}

// Free, keyless geocoding via OpenStreetMap's Nominatim search API — turns a
// typed address into a real lat/lng. Small informal Philippine subdivision/
// sitio names are frequently missing from OSM's free data even when the
// containing city/province is well-mapped, so this progressively drops the
// leading (most specific) comma-separated segment and retries — "Bosca, Sto.
// Tomas, San Jose City, Nueva Ecija" falling through to "San Jose City,
// Nueva Ecija" is a real, correct city-level placement, not a miss. Returns
// null only if nothing in the whole chain resolves (bad network, timeout, or
// a query with no recognizable Philippine place at all).
export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const fullQuery = query.trim()
  const parts = fullQuery
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) return null

  const googleGps = await geocodeOnceGoogle(fullQuery)
  if (googleGps) return { gps: googleGps, matchedText: fullQuery, exact: true }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    for (let i = 0; i < parts.length; i++) {
      const attempt = parts.slice(i).join(', ')
      const gps = await geocodeOnce(attempt, controller.signal)
      if (gps) return { gps, matchedText: attempt, exact: i === 0 }
      // Nominatim's usage policy caps free-tier use at ~1 request/second.
      if (i < parts.length - 1) await new Promise((r) => setTimeout(r, 1000))
    }
    return null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
