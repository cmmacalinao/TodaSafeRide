import { useEffect, useRef, useState } from 'react'
import { CLSU_LOCATION_GROUPS, PH_PROVINCES, getBarangaysForCity, getCitiesForProvince } from '../mock/data'
import type { PhAddressTags } from '../lib/customLocation'

interface BarangayAddressPickerProps {
  label: string
  defaultProvince: string
  defaultCity: string
  // Pre-fills barangay/street-landmark too — used when the caller remounts
  // this picker (via a changing `key`) to reflect an already-known location,
  // e.g. a Saved Place quick-pick, so the dropdowns don't silently disagree
  // with what "Booking as"/fare/map are actually using.
  defaultBarangay?: string
  defaultAddressDetail?: string
  onResolve: (address: PhAddressTags) => Promise<void>
}

// Pickup/destination entry for booking: cascading Province → City →
// Barangay dropdowns (pre-filled from the rider's home address, but still
// changeable) plus a free-text field for the street/house number and
// nearby landmark. Auto-resolves to a real geocoded point once a barangay is
// picked, and re-resolves (debounced) as the landmark text settles.
export function BarangayAddressPicker({
  label,
  defaultProvince,
  defaultCity,
  defaultBarangay = '',
  defaultAddressDetail = '',
  onResolve,
}: BarangayAddressPickerProps) {
  const [province, setProvince] = useState(defaultProvince)
  const [city, setCity] = useState(defaultCity)
  const [barangay, setBarangay] = useState(defaultBarangay)
  const [addressDetail, setAddressDetail] = useState(defaultAddressDetail)
  // CLSU's "place on campus" dropdown picks a named landmark/building, which
  // is often too coarse on its own (e.g. which room, which side, a nearer
  // landmark) — this is the extra free-text detail that combines with it
  // rather than replacing it. Kept separate from addressDetail (the actual
  // resolved value the dropdown owns) so both survive independently.
  const [campusExtra, setCampusExtra] = useState('')
  const [status, setStatus] = useState<'idle' | 'locating' | 'done' | 'error'>(defaultBarangay ? 'done' : 'idle')
  // A pre-filled barangay means this mount was seeded from a location that's
  // already resolved (a Saved Place quick-pick, or a map-tap/GPS guess) —
  // skip resolving again while the fields still match exactly what they were
  // seeded with, so we don't re-geocode and overwrite an already-correct
  // location (a re-geocode of the address text is less precise than the
  // exact tapped/GPS point it would replace). Compared against a snapshot
  // taken once at mount, not a one-shot "consumed" flag — a ref that gets
  // mutated inside the effect body doesn't survive React 18 StrictMode's
  // double-invoked effects in dev (mount→cleanup→mount again reuses the same
  // ref object, so the first invocation's mutation leaks into the second,
  // wrongly making it think a real edit happened and firing an unwanted
  // resolve ~600ms after mount). A snapshot that's never mutated gives both
  // invocations the same answer.
  const initialValues = useRef({ province: defaultProvince, city: defaultCity, barangay: defaultBarangay, addressDetail: defaultAddressDetail, campusExtra: '' })

  const cities = province ? getCitiesForProvince(province) : []
  const barangays = province && city ? getBarangaysForCity(province, city) : []

  useEffect(() => {
    if (!barangay) {
      setStatus('idle')
      return
    }
    const seed = initialValues.current
    if (
      province === seed.province &&
      city === seed.city &&
      barangay === seed.barangay &&
      addressDetail === seed.addressDetail &&
      campusExtra === seed.campusExtra
    ) {
      setStatus('done')
      return
    }
    let cancelled = false
    setStatus('locating')
    const combinedAddressDetail =
      barangay === 'CLSU' && campusExtra.trim()
        ? `${addressDetail.trim()}${addressDetail.trim() ? ' — ' : ''}${campusExtra.trim()}`
        : addressDetail.trim()
    const timeout = setTimeout(() => {
      onResolve({ province, city, barangay, addressDetail: combinedAddressDetail })
        .then(() => {
          if (!cancelled) setStatus('done')
        })
        .catch(() => {
          if (!cancelled) setStatus('error')
        })
    }, 600)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
    // Re-resolve on any of these changing — onResolve is a stable callback
    // from the parent, not a dependency of the address itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [province, city, barangay, addressDetail, campusExtra])

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-slate-500">{label}</label>
      <select
        value={province}
        onChange={(e) => {
          setProvince(e.target.value)
          setCity('')
          setBarangay('')
        }}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">Select province</option>
        {PH_PROVINCES.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <select
          value={city}
          onChange={(e) => {
            setCity(e.target.value)
            setBarangay('')
          }}
          disabled={!province}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
        >
          <option value="">Select city</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={barangay}
          onChange={(e) => {
            setBarangay(e.target.value)
            setAddressDetail('')
            setCampusExtra('')
          }}
          disabled={!city}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
        >
          <option value="">Select barangay</option>
          {barangays.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>
      {barangay === 'CLSU' ? (
        <>
          <select
            value={addressDetail}
            onChange={(e) => setAddressDetail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Select a place on campus</option>
            {CLSU_LOCATION_GROUPS.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.places.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <input
            value={campusExtra}
            onChange={(e) => setCampusExtra(e.target.value)}
            placeholder="Detailed address — room, floor, or nearby landmark (optional)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </>
      ) : (
        <input
          value={addressDetail}
          onChange={(e) => setAddressDetail(e.target.value)}
          placeholder="Street / house no., nearby landmark (optional)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      )}
      {status === 'locating' && <p className="text-[11px] text-slate-400">📍 Locating…</p>}
      {status === 'done' && <p className="text-[11px] text-emerald-600">✓ Location set</p>}
      {status === 'error' && (
        <p className="text-[11px] text-rose-600">Couldn't locate that address — try a nearby landmark.</p>
      )}
    </div>
  )
}
