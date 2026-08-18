// Optional swap-in for the free Nominatim/OSRM stack: when
// VITE_GOOGLE_MAPS_API_KEY is set, geocode.ts and routing.ts prefer Google's
// Geocoding/Directions APIs for better PH address and road coverage. Loaded
// via Google's official JS SDK (not raw REST fetch) — Google's REST
// Geocoding/Directions endpoints don't reliably support browser CORS, and
// the JS SDK is what Google actually recommends for client-side use.
// Falls back to the free OSM stack whenever the key is absent, the script
// fails to load, or Google itself returns no result.

export interface GoogleLatLng {
  lat: number
  lng: number
}

export interface GoogleMapOptions {
  center: GoogleLatLng
  zoom: number
  disableDefaultUI?: boolean
  zoomControl?: boolean
  gestureHandling?: string
}

export interface GoogleMapClickEvent {
  latLng: { lat: () => number; lng: () => number } | null
}

export interface GoogleMap {
  setCenter: (latLng: GoogleLatLng) => void
  fitBounds: (bounds: GoogleLatLngBounds, padding?: number) => void
  addListener: (event: 'click', handler: (e: GoogleMapClickEvent) => void) => void
}

export interface GoogleLatLngBounds {
  extend: (latLng: GoogleLatLng) => void
}

export interface GoogleMarkerIcon {
  path: number
  scale: number
  fillColor: string
  fillOpacity: number
  strokeColor: string
  strokeWeight: number
}

export interface GoogleMarkerLabel {
  text: string
  fontSize?: string
}

export interface GoogleMarkerOptions {
  position: GoogleLatLng
  map?: GoogleMap | null
  title?: string
  icon?: GoogleMarkerIcon
  // A tricycle-emoji driver marker sets this alongside a plain white-circle
  // icon (see GoogleLiveMap) instead of a custom bitmap icon.
  label?: GoogleMarkerLabel
  zIndex?: number
}

export interface GoogleMarker {
  setPosition: (latLng: GoogleLatLng) => void
  setIcon: (icon: GoogleMarkerIcon) => void
  setLabel: (label: GoogleMarkerLabel | null) => void
  setMap: (map: GoogleMap | null) => void
  addListener: (event: string, handler: () => void) => void
}

export interface GooglePolylineOptions {
  path: GoogleLatLng[]
  map?: GoogleMap | null
  strokeColor?: string
  strokeOpacity?: number
  strokeWeight?: number
}

export interface GooglePolyline {
  setPath: (path: GoogleLatLng[]) => void
  setMap: (map: GoogleMap | null) => void
}

export interface GoogleDirectionsResult {
  routes: Array<{
    overview_path: Array<{ lat: () => number; lng: () => number }>
    legs: Array<{ distance?: { value: number }; duration?: { value: number } }>
  }>
}

declare global {
  interface Window {
    google?: {
      maps: {
        Geocoder: new () => {
          geocode: (
            request:
              | { address: string; componentRestrictions?: { country: string } }
              | { location: GoogleLatLng },
            callback: (
              results: Array<{
                geometry: { location: { lat: () => number; lng: () => number } }
                formatted_address: string
              }> | null,
              status: string,
            ) => void,
          ) => void
        }
        DirectionsService: new () => {
          route: (
            request: {
              origin: { lat: number; lng: number }
              destination: { lat: number; lng: number }
              travelMode: string
            },
            callback: (result: GoogleDirectionsResult | null, status: string) => void,
          ) => void
        }
        TravelMode: { DRIVING: string }
        Map: new (el: HTMLElement, opts: GoogleMapOptions) => GoogleMap
        Marker: new (opts: GoogleMarkerOptions) => GoogleMarker
        Polyline: new (opts: GooglePolylineOptions) => GooglePolyline
        LatLngBounds: new () => GoogleLatLngBounds
        SymbolPath: { CIRCLE: number }
      }
    }
  }
}

let loadPromise: Promise<void> | null = null

export function googleMapsApiKey(): string | undefined {
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
}

// Returns null immediately (no promise created) when no key is configured,
// so callers can cheaply skip Google entirely and go straight to the OSM
// fallback without waiting on anything.
export function loadGoogleMaps(): Promise<void> | null {
  const apiKey = googleMapsApiKey()
  if (!apiKey) return null
  if (window.google?.maps) return Promise.resolve()
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&v=weekly`
    script.async = true
    script.onload = () => {
      if (window.google?.maps) resolve()
      else reject(new Error('google.maps unavailable after script load'))
    }
    script.onerror = () => reject(new Error('Failed to load Google Maps script'))
    document.head.appendChild(script)
  })
  return loadPromise
}
