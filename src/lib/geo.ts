import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import type { GeoCoords } from '../types'

// A driver must be roughly at the terminal to join its queue — this is the
// radius we treat as "at the terminal." Real GPS on a phone is typically
// accurate to 5-20m outdoors, so 150m comfortably covers a terminal plus
// normal signal drift without being so loose it's meaningless.
export const TERMINAL_PROXIMITY_METERS = 150

const EARTH_RADIUS_METERS = 6371000

export function haversineDistanceMeters(a: GeoCoords, b: GeoCoords): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h))
}

// The device's actual GPS/network location, not a simulated coordinate like
// everything else location-related in this app. Goes through Capacitor's
// Geolocation plugin when running inside the wrapped native app — that gets
// a real native permission prompt and a WebView-independent GPS read,
// instead of relying on the WebView's own (sometimes flaky/unimplemented)
// navigator.geolocation. Falls straight back to the browser API on the web,
// where that's the only option and already works fine.
export function getCurrentGeoPosition(): Promise<GeoCoords> {
  if (Capacitor.isNativePlatform()) {
    return Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 }).then((position) => ({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    }))
  }
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location services are not available on this device/browser.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  })
}
