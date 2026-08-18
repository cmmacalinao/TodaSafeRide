/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Optional — when set, geocode.ts/routing.ts prefer Google's
  // Geocoding/Directions APIs over the free Nominatim/OSRM fallback. Needs
  // the Geocoding API and Directions API enabled (with billing) on the
  // Google Cloud project this key belongs to.
  readonly VITE_GOOGLE_MAPS_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
