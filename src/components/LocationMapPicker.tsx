import { useRef, useState } from 'react'
import { RealLiveMap, type MapPoint } from './RealLiveMap'
import { createCustomLocation, reverseGeocodeToPhAddress, type PhAddressTags } from '../lib/customLocation'
import { getCurrentGeoPosition } from '../lib/geo'
import type { GeoCoords, MockLocation } from '../types'

// Lets the passenger drop a pin directly on the map instead of (or in
// addition to) picking province/city/barangay — an alternative input method
// for the same pickup/dropoff state the BarangayAddressPicker below drives.
// A toggle picks which one a tap sets; both pins always show together so
// placing one doesn't lose sight of the other. `target` is controlled by the
// caller (not local state) so the caller can also use it to show only the
// matching BarangayAddressPicker section below, instead of both at once.
export function LocationMapPicker({
  pickup,
  dropoff,
  target,
  onTargetChange,
  onPinPickup,
  onPinDropoff,
  pickupLabel = 'Pickup',
  dropoffLabel = 'Destination',
  gpsTarget = 'pickup',
}: {
  pickup: MockLocation
  dropoff: MockLocation
  target: 'pickup' | 'dropoff'
  onTargetChange: (target: 'pickup' | 'dropoff') => void
  // `guess` carries the tapped point's Province/City/Barangay (and
  // best-effort street detail) when it resolved to somewhere in our own
  // address tree — null when it didn't (outside every province this app
  // knows about, or the reverse-geocode itself failed). Callers use it to
  // seed the BarangayAddressPicker's dropdowns to match, same as picking a
  // Saved Place already does.
  onPinPickup: (location: MockLocation, guess: PhAddressTags | null) => void
  onPinDropoff: (location: MockLocation, guess: PhAddressTags | null) => void
  // Ride booking calls these "Pickup"/"Destination"; a Pabili/Buy Medicine
  // errand calls them "Buy near to"/"Deliver to" instead — same map, same
  // pickup/dropoff state, just different words for what each pin means.
  pickupLabel?: string
  dropoffLabel?: string
  // Which tab shows the "Use my exact GPS location" pin-drop shortcut. A
  // Ride wants it on Pickup (that's where the passenger boards); an errand
  // wants it on Destination instead (that's where the passenger actually
  // is, waiting for delivery — the "buy near to" side is just a store).
  gpsTarget?: 'pickup' | 'dropoff'
}) {
  const [status, setStatus] = useState<'idle' | 'locating' | 'error'>('idle')
  const containerRef = useRef<HTMLDivElement>(null)

  // Switching Pickup/Destination scrolls this whole picker (toggle, GPS
  // button, map) to the top of the screen — the passenger just told us
  // which pin they're about to place, so the thing they need to see (and
  // tap) should be the thing in front of them, not still off past whatever
  // they'd scrolled down to.
  function selectTarget(next: 'pickup' | 'dropoff') {
    onTargetChange(next)
    containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function placePin(gps: GeoCoords) {
    setStatus('locating')
    try {
      const { label, guess } = await reverseGeocodeToPhAddress(gps)
      const location = createCustomLocation(label ?? `Pinned location (${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)})`, gps, guess ?? undefined)
      if (target === 'pickup') onPinPickup(location, guess)
      else onPinDropoff(location, guess)
      setStatus('idle')
    } catch {
      setStatus('error')
    }
  }

  async function handleUseGps() {
    setStatus('locating')
    try {
      const gps = await getCurrentGeoPosition()
      await placePin(gps)
    } catch {
      setStatus('error')
    }
  }

  const points: MapPoint[] = [
    ...(pickup.gps ? [{ id: 'pickup', gps: pickup.gps, color: '#0d9488', label: `${pickupLabel} — ${pickup.label}` }] : []),
    ...(dropoff.gps
      ? [{ id: 'dropoff', gps: dropoff.gps, color: '#e11d48', label: `${dropoffLabel} — ${dropoff.label}` }]
      : []),
  ]

  return (
    // scroll-mt-24 keeps the toggle/GPS row clear of the sticky header
    // (~81px tall) when selectTarget scrolls this into view — without it,
    // scrollIntoView's default 'start' alignment tucks the top of this
    // section directly under the header, hiding the very controls the
    // passenger just asked to see.
    <div ref={containerRef} className="scroll-mt-24 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-500">📍 Or tap the map to drop a pin</p>
        <div className="flex shrink-0 gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => selectTarget('pickup')}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
              target === 'pickup' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'
            }`}
          >
            {pickupLabel}
          </button>
          <button
            type="button"
            onClick={() => selectTarget('dropoff')}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
              target === 'dropoff' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'
            }`}
          >
            {dropoffLabel}
          </button>
        </div>
      </div>
      {target === gpsTarget && (
        <button
          type="button"
          onClick={handleUseGps}
          disabled={status === 'locating'}
          className="w-full rounded-lg border border-slate-300 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          📍 Use my exact GPS location
        </button>
      )}
      <RealLiveMap points={points} onMapClick={placePin} refitOnMove />
      {/* Confirms the tap actually filled Pickup/Destination — the province/
          city/barangay form above doesn't reflect a map pin (it has no
          structured address for a freeform tap), so without this the
          passenger has no visible sign anything happened until they notice
          the marker move. */}
      <div className="space-y-0.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs">
        <p className={target === 'pickup' ? 'font-medium text-brand-700' : 'text-slate-500'}>📍 {pickupLabel}: {pickup.label}</p>
        <p className={target === 'dropoff' ? 'font-medium text-brand-700' : 'text-slate-500'}>🏁 {dropoffLabel}: {dropoff.label}</p>
      </div>
      {status === 'locating' && (
        <p className="text-[11px] text-slate-400">📍 Locating that spot…</p>
      )}
      {status === 'error' && (
        <p className="text-[11px] text-rose-600">Couldn't place that pin — try tapping again.</p>
      )}
    </div>
  )
}
