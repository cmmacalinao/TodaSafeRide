import { DRIVER_BASE_GPS, MOCK_LOCATIONS, PH_PROVINCES, getBarangaysForCity, getCitiesForProvince, getClsuPlaceGps } from '../mock/data'
import { geocodeAddress, reverseGeocode } from './geocode'
import type { GeoCoords, MockLocation } from '../types'

export const PUBLIC_MARKET_SJC_ID = 'loc-public-market-sjc'

export interface PhAddressTags {
  province: string
  city: string
  barangay: string
  addressDetail: string
}

// Best-effort match of a freeform reverse-geocoded label (e.g. Nominatim's
// "123 Rizal St, Bakal I, Talavera, Nueva Ecija, Central Luzon, Philippines")
// against our own closed PH_ADDRESS_TREE. Substring search against the label
// text, rather than trusting the geocoder's own admin-level field tagging
// (Google's address_components and Nominatim's addressdetails carve up PH
// addresses inconsistently, and this app's tree is a small illustrative
// sample anyway — not the full PSGC). Longest names are checked first at
// each level so a more specific match (e.g. "Science City of Muñoz") wins
// over an accidental shorter substring hit (e.g. "Muñoz"). Returns null only
// if not even the province resolved; a matched province with no city (or a
// matched city with no barangay) still comes back with the levels that did.
export function guessPhAddressFromLabel(label: string): PhAddressTags | null {
  const lower = label.toLowerCase()
  const byLengthDesc = (a: string, b: string) => b.length - a.length
  const province = [...PH_PROVINCES].sort(byLengthDesc).find((p) => lower.includes(p.toLowerCase()))
  if (!province) return null

  const city = [...getCitiesForProvince(province)].sort(byLengthDesc).find((c) => lower.includes(c.toLowerCase()))
  if (!city) return { province, city: '', barangay: '', addressDetail: '' }

  const barangay = [...getBarangaysForCity(province, city)]
    .sort(byLengthDesc)
    .find((b) => lower.includes(b.toLowerCase()))
  if (!barangay) return { province, city, barangay: '', addressDetail: '' }

  // Whatever text sits before the matched barangay in the original label
  // (street name, house number, subdivision) becomes the free-text detail —
  // split on the first case-insensitive occurrence of the barangay name.
  const idx = lower.indexOf(barangay.toLowerCase())
  const addressDetail = label.slice(0, idx).replace(/,\s*$/, '').trim()
  return { province, city, barangay, addressDetail }
}

export interface ReverseGeocodeGuess {
  label: string | null
  guess: PhAddressTags | null
}

// Reverse-geocodes a map tap/GPS pin and tries to place it in our own
// Province/City/Barangay tree — used so tapping the map (or "Use my exact
// GPS location") can fill the address dropdowns, not just a freeform label,
// same as picking a Saved Place already does. `guess` is null (dropdowns
// stay as they were) whenever the point falls outside every province this
// app knows about, or the label can't be parsed — silently leaving fields
// unfilled is the honest outcome there, not a bug to paper over.
export async function reverseGeocodeToPhAddress(gps: GeoCoords): Promise<ReverseGeocodeGuess> {
  const label = await reverseGeocode(gps)
  return { label, guess: label ? guessPhAddressFromLabel(label) : null }
}

// Typed-in addresses that don't match anything in MOCK_LOCATIONS still need
// a position on both the abstract simulation grid (fare/ETA math) and the
// real map. The grid spot is always pseudo-random (it's just an animation
// input); the real gps tries actual geocoding first (see callers) and only
// falls back to jitteredFallbackGps if that fails — e.g. no network, or
// Nominatim found nothing for the typed text. `tags` carries the real PH
// province/city/barangay when known (from BarangayAddressPicker) — blank for
// the older plain-freetext callers that don't have structured address parts.
export function createCustomLocation(
  label: string,
  gps: GeoCoords,
  tags?: { province: string; city: string; barangay: string },
): MockLocation {
  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label,
    coords: { x: 10 + Math.random() * 80, y: 10 + Math.random() * 80 },
    gps,
    province: tags?.province ?? '',
    city: tags?.city ?? '',
    barangay: tags?.barangay ?? '',
  }
}

export function jitteredFallbackGps(): GeoCoords {
  return {
    lat: DRIVER_BASE_GPS.lat + (Math.random() - 0.5) * 0.02,
    lng: DRIVER_BASE_GPS.lng + (Math.random() - 0.5) * 0.02,
  }
}

// Turns a structured PH address (province/city/barangay + optional street/
// landmark detail) from BarangayAddressPicker into a real MockLocation —
// geocodes the fullest query first, and (via geocodeAddress's own
// progressive fallback) still resolves to at least a barangay/city-level
// point if the landmark text itself isn't in OpenStreetMap's data.
export async function resolvePhAddress(address: PhAddressTags): Promise<MockLocation> {
  // CLSU isn't a real barangay OSM would recognize, and its specific places
  // (picked from BarangayAddressPicker's CLSU dropdown, carried here as
  // addressDetail) are informal names like "Umali Gym" that live geocoding
  // likely wouldn't resolve — falling through to jitteredFallbackGps would
  // silently place them in the wrong city entirely (it's centered on San
  // Jose City). Resolve deterministically off CLSU_GPS instead.
  if (address.barangay === 'CLSU') {
    const label = address.addressDetail ? `${address.addressDetail}, CLSU, ${address.city}` : `CLSU, ${address.city}`
    return createCustomLocation(label, getClsuPlaceGps(address.addressDetail || 'CLSU'), {
      province: address.province,
      city: address.city,
      barangay: address.barangay,
    })
  }
  const query = [address.addressDetail, `Barangay ${address.barangay}`, address.city, address.province]
    .filter((part) => part.trim())
    .join(', ')
  const geocoded = await geocodeAddress(query)
  const label = address.addressDetail
    ? `${address.addressDetail}, Brgy. ${address.barangay}, ${address.city}`
    : `Brgy. ${address.barangay}, ${address.city}`
  return createCustomLocation(label, geocoded?.gps ?? jitteredFallbackGps(), {
    province: address.province,
    city: address.city,
    barangay: address.barangay,
  })
}

// The default Pabili "buy items near" pickup — San Jose City has a fixed,
// accurate preset (see MOCK_LOCATIONS' loc-public-market-sjc, derived from a
// real OSM landmark since no POI is tagged "Public Market" there). Any other
// city has no such preset, so this looks one up live the same way a typed
// address resolves.
export async function resolveNearbyPublicMarket(city: string, province: string): Promise<MockLocation> {
  if (city === 'San Jose City') {
    const preset = MOCK_LOCATIONS.find((l) => l.id === PUBLIC_MARKET_SJC_ID)
    if (preset) return preset
  }
  const result = await geocodeAddress(`Public Market, ${city}, ${province}, Philippines`)
  return createCustomLocation('Public Market', result?.gps ?? jitteredFallbackGps(), {
    province,
    city,
    barangay: '',
  })
}

// "Buy Medicine" pickup — the passenger picks which real pharmacy chain
// (see PHARMACY_CHAINS) rather than getting a single auto-resolved generic
// pin, so the driver goes to a branch the passenger actually recognizes.
// Unlike the public market (an informal place OSM rarely tags), named
// pharmacy chains are usually real POIs Nominatim can geocode directly —
// this always looks one up live, per the passenger's own city, since which
// branches exist (and where) varies by town. `chainName` omitted (or
// "Nearest pharmacy") falls back to a generic search instead of a specific
// brand, for passengers with no preference.
export async function resolveNearbyPharmacy(
  city: string,
  province: string,
  chainName?: string,
): Promise<MockLocation> {
  const query = chainName && chainName !== 'Nearest pharmacy' ? chainName : 'Pharmacy'
  const result = await geocodeAddress(`${query}, ${city}, ${province}, Philippines`)
  const label = query === 'Pharmacy' ? 'Pharmacy' : query
  return createCustomLocation(label, result?.gps ?? jitteredFallbackGps(), {
    province,
    city,
    barangay: '',
  })
}
