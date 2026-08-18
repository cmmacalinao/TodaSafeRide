import { useEffect, useState } from 'react'
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { googleMapsApiKey } from '../lib/googleMapsLoader'
import { GoogleLiveMap } from './GoogleLiveMap'
import type { GeoCoords } from '../types'

export interface MapPoint {
  id: string
  gps: GeoCoords
  color: string
  label: string
  // Adds a soft pulsing halo — used for markers that are moving/live, so a
  // real GPS ping visually reads differently from a fixed pin.
  pulse?: boolean
  // Renders an emoji instead of the plain color dot, same white-backed-circle
  // treatment either way — 'tricycle' for the driver's own live marker,
  // 'pharmacy' for a pharmacy pin (so it reads as "a pharmacy is here" at a
  // glance instead of just another colored dot indistinguishable from a
  // pickup/dropoff point).
  icon?: 'tricycle' | 'pharmacy'
}

interface RealLiveMapProps {
  points: MapPoint[]
  // Either a real OSRM/Google road-network path (many points, follows actual
  // streets) or just the two leg endpoints as a fallback — routeIsReal picks
  // the line style so the two read differently (solid road path vs. dashed
  // "as the crow flies" placeholder).
  routeLine?: GeoCoords[]
  routeIsReal?: boolean
  // 'pickup' draws a thinner, differently-colored line for the "driver en
  // route to you" leg so it reads as distinct from the main trip route
  // (pickup→dropoff, or the booking-form preview) — defaults to 'trip'.
  routeVariant?: 'trip' | 'pickup'
  // Lets the caller turn the map into a pin-drop picker — fires with the
  // tapped coordinate instead of (or alongside) the read-only live-tracking
  // display. Absent for plain tracking views (TripMonitor).
  onMapClick?: (gps: GeoCoords) => void
  // Lets a marker itself be the "pick this one" control (e.g. tapping a
  // pharmacy pin selects it, same as tapping its row in the list below) —
  // fires with that point's id. Independent of onMapClick, which fires for
  // taps on the bare map background instead of a specific marker.
  onPointClick?: (id: string) => void
  // Re-fits the viewport whenever an existing point's coordinates change,
  // not just when points are added/removed — used by the booking-flow
  // address picker so choosing a new barangay (or dropping a pin) pans the
  // map there. Left off for live-tracking views (TripMonitor, driver maps),
  // where re-centering on every GPS tick would fight the viewer's own
  // pan/zoom.
  refitOnMove?: boolean
}

function routeLineStyle(routeIsReal: boolean | undefined, routeVariant: 'trip' | 'pickup' | undefined) {
  if (!routeIsReal) return { color: '#94a3b8', dashArray: '4 4', weight: 2 }
  return routeVariant === 'pickup'
    ? { color: '#f59e0b', weight: 2.5, opacity: 0.85 }
    : { color: '#2563eb', weight: 4, opacity: 0.7 }
}

const EMOJI_MARKER_ICONS: Record<'tricycle' | 'pharmacy', string> = {
  tricycle: '🛺',
  pharmacy: '💊',
}

// Pharmacy pins render at ~75% of the driver/tricycle marker's size — a
// pharmacy is one of several static reference points on a browsing map, not
// the one live thing the eye should be drawn to (the driver's own position
// during tracking), so it doesn't need the same visual weight.
const EMOJI_MARKER_SIZES: Record<'tricycle' | 'pharmacy', { box: number; font: number }> = {
  tricycle: { box: 26, font: 15 },
  pharmacy: { box: 20, font: 11 },
}

function dotIcon(color: string, pulse?: boolean, icon?: 'tricycle' | 'pharmacy') {
  if (icon) {
    const emoji = EMOJI_MARKER_ICONS[icon]
    const { box, font } = EMOJI_MARKER_SIZES[icon]
    const halfBox = box / 2
    const haloInset = box === 26 ? -6 : -5
    return L.divIcon({
      className: '',
      html: `<div style="position:relative;width:${box}px;height:${box}px;">
        ${pulse ? `<div style="position:absolute;inset:${haloInset}px;border-radius:9999px;background:${color};opacity:0.25;"></div>` : ''}
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border-radius:9999px;background:white;border:2px solid ${color};box-shadow:0 1px 3px rgba(0,0,0,0.45);font-size:${font}px;line-height:1;">${emoji}</div>
      </div>`,
      iconSize: [box, box],
      iconAnchor: [halfBox, halfBox],
    })
  }
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:18px;height:18px;">
      ${pulse ? `<div style="position:absolute;inset:-7px;border-radius:9999px;background:${color};opacity:0.25;"></div>` : ''}
      <div style="position:absolute;inset:0;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.45);"></div>
    </div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

// Fits the map to all current points once, then only re-fits if the *set* of
// points changes (e.g. a driver marker appears) — not on every tiny GPS
// update, so live tracking doesn't jump-recenter the view each tick. Callers
// that want a re-fit on every coordinate change too (the address picker) opt
// in via `refitOnMove`.
function FitBounds({ points, refitOnMove }: { points: MapPoint[]; refitOnMove?: boolean }) {
  const map = useMap()
  const fitKey = refitOnMove
    ? points.map((p) => `${p.id}:${p.gps.lat.toFixed(5)},${p.gps.lng.toFixed(5)}`).join('|')
    : points.map((p) => p.id).join(',')

  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView([points[0].gps.lat, points[0].gps.lng], 15)
      return
    }
    const bounds = L.latLngBounds(points.map((p) => [p.gps.lat, p.gps.lng] as [number, number]))
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey])

  return null
}

// Fires onMapClick with the tapped lat/lng — a bare listener component (no
// visible output) since react-leaflet wires map events through hooks rather
// than DOM handlers on MapContainer itself.
function ClickHandler({ onMapClick }: { onMapClick: (gps: GeoCoords) => void }) {
  useMapEvents({
    click(e) {
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

// The free, keyless renderer — OpenStreetMap tiles via Leaflet. Used
// whenever no Google Maps API key is configured (see RealLiveMap below).
function OsmLiveMap({ points, routeLine, routeIsReal, routeVariant, onMapClick, onPointClick, refitOnMove }: RealLiveMapProps) {
  const center: [number, number] = [points[0].gps.lat, points[0].gps.lng]

  return (
    <MapContainer
      center={center}
      zoom={15}
      scrollWheelZoom={false}
      style={{ height: '220px', width: '100%', cursor: onMapClick ? 'crosshair' : undefined }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {onMapClick && <ClickHandler onMapClick={onMapClick} />}
      {routeLine && routeLine.length > 1 && (
        <Polyline positions={routeLine.map((p) => [p.lat, p.lng])} pathOptions={routeLineStyle(routeIsReal, routeVariant)} />
      )}
      {points.map((p) => (
        <Marker
          key={p.id}
          position={[p.gps.lat, p.gps.lng]}
          icon={dotIcon(p.color, p.pulse, p.icon)}
          eventHandlers={onPointClick ? { click: () => onPointClick(p.id) } : undefined}
        >
          <Tooltip direction="top" offset={[0, -10]}>
            {p.label}
          </Tooltip>
        </Marker>
      ))}
      <FitBounds points={points} refitOnMove={refitOnMove} />
    </MapContainer>
  )
}

// Small barangays that OpenStreetMap's free Nominatim data doesn't have a
// point for fall back to a broader match (e.g. the whole city) — see
// geocode.ts's progressive fallback. When that happens to two different
// points on the same map (pickup and dropoff both landing on the same
// city-center coordinate is the common case), their pins would render stacked
// exactly on top of each other with no visual way to tell them apart. This
// nudges exact-duplicate coordinates apart by a few meters, in different
// directions per duplicate, purely for map display — it never touches the
// underlying ride/route data (fare, ETA, and the actual route line still use
// the real, un-nudged coordinates), so it's just making an existing geocoding
// gap visible instead of hiding it as one indistinguishable pin.
function spreadOverlappingPoints(points: MapPoint[]): MapPoint[] {
  const seen = new Map<string, number>()
  return points.map((p) => {
    const key = `${p.gps.lat.toFixed(5)},${p.gps.lng.toFixed(5)}`
    const duplicateIndex = seen.get(key) ?? 0
    seen.set(key, duplicateIndex + 1)
    if (duplicateIndex === 0) return p

    // Golden-angle spacing fans any number of duplicates out evenly instead
    // of stacking them along one line; ~15m per step is enough to separate
    // pins at any zoom level this map is realistically viewed at.
    const angle = duplicateIndex * 2.399963229728653
    const radiusMeters = 15 * duplicateIndex
    const metersPerDegLat = 111320
    const metersPerDegLng = 111320 * Math.cos((p.gps.lat * Math.PI) / 180)
    return {
      ...p,
      gps: {
        lat: p.gps.lat + (Math.sin(angle) * radiusMeters) / metersPerDegLat,
        lng: p.gps.lng + (Math.cos(angle) * radiusMeters) / metersPerDegLng,
      },
    }
  })
}

// Picks the renderer — real Google Maps tiles/roads when
// VITE_GOOGLE_MAPS_API_KEY is configured (see googleMapsLoader.ts), the free
// OpenStreetMap/Leaflet stack otherwise — behind one shared wrapper (sizing,
// border, and the point legend below the map) so callers never need to know
// which one is active.
export function RealLiveMap({ points, routeLine, routeIsReal, routeVariant, onMapClick, onPointClick, refitOnMove }: RealLiveMapProps) {
  // If the Google script fails to load (bad key, network block, CSP), fall
  // back to the OSM/Leaflet canvas instead of showing an empty map.
  const [googleFailed, setGoogleFailed] = useState(false)
  if (points.length === 0) return null
  const useGoogle = !!googleMapsApiKey() && !googleFailed
  const displayPoints = spreadOverlappingPoints(points)

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      {useGoogle ? (
        <GoogleLiveMap
          points={displayPoints}
          routeLine={routeLine}
          routeIsReal={routeIsReal}
          routeVariant={routeVariant}
          onMapClick={onMapClick}
          onPointClick={onPointClick}
          refitOnMove={refitOnMove}
          onFailed={() => setGoogleFailed(true)}
        />
      ) : (
        <OsmLiveMap
          points={displayPoints}
          routeLine={routeLine}
          routeIsReal={routeIsReal}
          routeVariant={routeVariant}
          onMapClick={onMapClick}
          onPointClick={onPointClick}
          refitOnMove={refitOnMove}
        />
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-500">
        {points.map((p) => (
          <span key={p.id} className="flex items-center gap-1 truncate">
            <span style={{ color: p.color }}>●</span>
            {p.label}
          </span>
        ))}
      </div>
    </div>
  )
}
