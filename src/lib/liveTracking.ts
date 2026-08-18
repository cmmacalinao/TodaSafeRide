import { useEffect, useRef, useState } from 'react'
import type { GeoCoords } from '../types'

// Continuously watches the device's real GPS while enabled — the driver/
// passenger opt-in toggles this on, at which point their actual movement
// (not a simulation) drives their marker on the real map.
export function useWatchPosition(enabled: boolean): { position: GeoCoords | null; error: string | null } {
  const [position, setPosition] = useState<GeoCoords | null>(null)
  const [error, setError] = useState<string | null>(null)
  const watchIdRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) {
      setPosition(null)
      return
    }
    if (!navigator.geolocation) {
      setError('Location services are not available on this device/browser.')
      return
    }
    setError(null)
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setError(null)
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      (err) => setError(err.message || 'Could not get your location.'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    )
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [enabled])

  return { position, error }
}

// Straight-line interpolation between two real coordinates — used as the map
// fallback for whichever side (driver/passenger) hasn't opted in to live GPS
// sharing, driven by the same legProgress that already animates the abstract
// simulation grid.
export function interpolateGps(a: GeoCoords, b: GeoCoords, t: number): GeoCoords {
  const clamped = Math.max(0, Math.min(1, t))
  return { lat: a.lat + (b.lat - a.lat) * clamped, lng: a.lng + (b.lng - a.lng) * clamped }
}
