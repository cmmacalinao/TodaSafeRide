import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps } from '../lib/googleMapsLoader'
import type { GoogleMap, GoogleMapClickEvent, GoogleMarker, GooglePolyline } from '../lib/googleMapsLoader'
import type { GeoCoords } from '../types'
import type { MapPoint } from './RealLiveMap'

interface GoogleLiveMapProps {
  points: MapPoint[]
  routeLine?: GeoCoords[]
  routeIsReal?: boolean
  routeVariant?: 'trip' | 'pickup'
  onMapClick?: (gps: GeoCoords) => void
  onPointClick?: (id: string) => void
  // Lets the caller (RealLiveMap.tsx) fall back to the OSM/Leaflet canvas
  // when the Google Maps script fails to load (bad key, network block, CSP)
  // instead of rendering nothing.
  onFailed?: () => void
  // See RealLiveMap's refitOnMove — re-fits on any coordinate change, not
  // just when points are added/removed.
  refitOnMove?: boolean
}

// Real Google Maps tiles/roads, used by RealLiveMap.tsx instead of the
// Leaflet/OSM canvas whenever a Google Maps API key is configured. Talks to
// the Maps JS SDK imperatively via refs (create the map once, then mutate
// markers/polyline in place) rather than pulling in a React wrapper library
// — matches the dependency-free pattern already used for the Google
// geocoding/routing swap in geocode.ts/routing.ts.
export function GoogleLiveMap({ points, routeLine, routeIsReal, routeVariant, onMapClick, onPointClick, onFailed, refitOnMove }: GoogleLiveMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<GoogleMap | null>(null)
  const markersRef = useRef<Map<string, GoogleMarker>>(new Map())
  const polylineRef = useRef<GooglePolyline | null>(null)
  const lastFitKeyRef = useRef<string>('')
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  // Kept current across renders so the one click listener (added once, on
  // map creation) always calls the latest callback instead of a stale one.
  const onMapClickRef = useRef(onMapClick)
  onMapClickRef.current = onMapClick
  const onPointClickRef = useRef(onPointClick)
  onPointClickRef.current = onPointClick

  useEffect(() => {
    const loading = loadGoogleMaps()
    if (!loading) {
      setStatus('failed')
      onFailed?.()
      return
    }
    let cancelled = false
    loading
      .then(() => {
        if (cancelled || !containerRef.current || !window.google?.maps) return
        mapRef.current = new window.google.maps.Map(containerRef.current, {
          center: { lat: points[0].gps.lat, lng: points[0].gps.lng },
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
        })
        mapRef.current.addListener('click', (e: GoogleMapClickEvent) => {
          if (e.latLng) onMapClickRef.current?.({ lat: e.latLng.lat(), lng: e.latLng.lng() })
        })
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('failed')
          onFailed?.()
        }
      })
    return () => {
      cancelled = true
    }
    // Map is created once on mount — later point updates move existing
    // markers instead of recreating the map (see the effect below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const google = window.google
    if (status !== 'ready' || !map || !google) return

    const seenIds = new Set(points.map((p) => p.id))
    for (const [id, marker] of markersRef.current) {
      if (!seenIds.has(id)) {
        marker.setMap(null)
        markersRef.current.delete(id)
      }
    }

    for (const p of points) {
      const position = { lat: p.gps.lat, lng: p.gps.lng }
      // An emoji marker (tricycle for the driver, pharmacy for a pharmacy
      // pin) uses a plain white backing circle (the emoji itself is drawn
      // via `label`, on top) instead of the solid color dot every other
      // point uses. Pharmacy pins render at ~75% of the tricycle marker's
      // size — see the matching comment in RealLiveMap.tsx's dotIcon.
      const icon = p.icon
        ? {
            path: google.maps.SymbolPath.CIRCLE,
            scale: p.icon === 'pharmacy' ? 10 : 13,
            fillColor: '#ffffff',
            fillOpacity: 1,
            strokeColor: p.color,
            strokeWeight: 2,
          }
        : {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: p.color,
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          }
      const label =
        p.icon === 'tricycle'
          ? { text: '🛺', fontSize: '14px' }
          : p.icon === 'pharmacy'
            ? { text: '💊', fontSize: '11px' }
            : null
      const existing = markersRef.current.get(p.id)
      if (existing) {
        existing.setPosition(position)
        existing.setIcon(icon)
        existing.setLabel(label)
      } else {
        const marker = new google.maps.Marker({
          position,
          map,
          title: p.label,
          icon,
          label: label ?? undefined,
          zIndex: p.pulse ? 10 : 1,
        })
        marker.addListener('click', () => onPointClickRef.current?.(p.id))
        markersRef.current.set(p.id, marker)
      }
    }

    if (routeLine && routeLine.length > 1) {
      const path = routeLine.map((c) => ({ lat: c.lat, lng: c.lng }))
      const options = !routeIsReal
        ? { strokeColor: '#94a3b8', strokeOpacity: 0.6, strokeWeight: 2 }
        : routeVariant === 'pickup'
          ? { strokeColor: '#f59e0b', strokeOpacity: 0.85, strokeWeight: 2.5 }
          : { strokeColor: '#2563eb', strokeOpacity: 0.7, strokeWeight: 4 }
      if (polylineRef.current) {
        polylineRef.current.setPath(path)
      } else {
        polylineRef.current = new google.maps.Polyline({ path, map, ...options })
      }
    } else if (polylineRef.current) {
      polylineRef.current.setMap(null)
      polylineRef.current = null
    }

    // Only re-fit the viewport when the *set* of points changes (e.g. a
    // driver marker appears) — not on every tiny GPS tick, so live tracking
    // doesn't jump-recenter the view each update. Callers that want a re-fit
    // on every coordinate change too (the address picker) opt in via
    // refitOnMove.
    const fitKey = refitOnMove
      ? points.map((p) => `${p.id}:${p.gps.lat.toFixed(5)},${p.gps.lng.toFixed(5)}`).join('|')
      : points.map((p) => p.id).join(',')
    if (fitKey !== lastFitKeyRef.current) {
      lastFitKeyRef.current = fitKey
      if (points.length === 1) {
        map.setCenter({ lat: points[0].gps.lat, lng: points[0].gps.lng })
      } else if (points.length > 1) {
        const bounds = new google.maps.LatLngBounds()
        for (const p of points) bounds.extend({ lat: p.gps.lat, lng: p.gps.lng })
        map.fitBounds(bounds, 30)
      }
    }
  }, [points, routeLine, routeIsReal, routeVariant, status, refitOnMove])

  if (status === 'failed') return null
  return <div ref={containerRef} style={{ height: '220px', width: '100%', cursor: onMapClick ? 'crosshair' : undefined }} />
}
