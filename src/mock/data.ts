import type {
  AccountingOfficer,
  AdSenseSettings,
  Advertiser,
  Campaign,
  CorporateRegistrationInfo,
  DocumentType,
  Driver,
  DriverDocuments,
  DriverReportReason,
  EquityAllocation,
  ExpenseCategory,
  GeoCoords,
  IncomePromotionSettings,
  Franchise,
  MedicineProduct,
  MockLocation,
  Operator,
  Parent,
  ParentLink,
  Passenger,
  PaymentMethod,
  Pharmacy,
  RewardRules,
  Ride,
  RideCreditTier,
  SaasPlan,
  TariffSettings,
  TodaExpenseCategory,
  TodaOrganization,
} from '../types'
import { haversineDistanceMeters } from '../lib/geo'

export const DOCUMENT_TYPES: DocumentType[] = ['nbiClearance', 'driversLicense', 'ltoRegistration', 'lguRegistration']

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  nbiClearance: 'NBI / Police Clearance',
  driversLicense: "Driver's License",
  ltoRegistration: 'LTO Registration (OR/CR)',
  lguRegistration: 'LGU / TODA Registration',
}

function submittedDocs(): DriverDocuments {
  return {
    nbiClearance: { submitted: true, dataUrl: null },
    driversLicense: { submitted: true, dataUrl: null },
    ltoRegistration: { submitted: true, dataUrl: null },
    lguRegistration: { submitted: true, dataUrl: null },
  }
}

// City/province are the same for every location below — the whole app is
// scoped to a single city service area (San Jose City, Nueva Ecija), so only
// barangay actually varies. Tags exist purely for the location search/filter
// UI — the x/y coords are still what drives the ride simulation. Every
// sample driver/passenger/parent/TODA below shares this same city on
// purpose: a TODA's operation is inter-barangay within one city (or a
// neighboring town), so keeping everyone in the same real city makes that
// easy to test — pick two different real barangays and the fare/ETA/routing
// all reflect an actual, sane distance between them.
const TOWN_PROVINCE = 'Nueva Ecija'
const TOWN_CITY = 'San Jose City'

// Real approximate coordinates anchored around San Jose City, Nueva Ecija so
// the OpenStreetMap live-tracking view has somewhere real to draw —
// illustrative placements within the city (picked to land in the named
// barangay's general area), not surveyed addresses.
// `coords` (the abstract 0-100 x/y grid) is a linear proportional mapping of
// each point's real `gps` onto that range — x from longitude, y from
// latitude, scaled across this set's min/max — NOT arbitrary placement.
// getPriorityTodaOrgId() (below) compares pickups against TODA terminals
// using only this grid, so it has to stay geographically consistent with the
// real gps/barangay or dispatch silently routes to the wrong TODA (a pickup
// can end up "closer" on the grid to a terminal that's actually towns away
// in real life). Re-derive these any time a location's gps changes.
export const MOCK_LOCATIONS: MockLocation[] = [
  {
    id: 'loc-home-1',
    label: 'Sitio Maligaya, Crisanto Sanchez Poblacion',
    coords: { x: 69, y: 68 },
    gps: { lat: 15.7940977, lng: 120.9905849 },
    province: TOWN_PROVINCE,
    city: TOWN_CITY,
    barangay: 'Crisanto Sanchez Poblacion',
  },
  {
    id: 'loc-home-2',
    label: 'Purok 3, Barangay San Agustin',
    coords: { x: 100, y: 46 },
    gps: { lat: 15.77, lng: 121.01 },
    province: TOWN_PROVINCE,
    city: TOWN_CITY,
    barangay: 'San Agustin',
  },
  {
    id: 'loc-terminal',
    label: 'Public Market Terminal',
    coords: { x: 69, y: 68 },
    gps: { lat: 15.7940977, lng: 120.9905849 },
    province: TOWN_PROVINCE,
    city: TOWN_CITY,
    barangay: 'Crisanto Sanchez Poblacion',
  },
  {
    id: 'loc-school-1',
    label: 'Sto. Nino Elementary School',
    coords: { x: 52, y: 87 },
    gps: { lat: 15.815, lng: 120.98 },
    province: TOWN_PROVINCE,
    city: TOWN_CITY,
    barangay: 'Santo Niño 1st',
  },
  {
    id: 'loc-school-2',
    label: 'Municipal National High School',
    coords: { x: 77, y: 75 },
    gps: { lat: 15.8019002, lng: 120.995624 },
    province: TOWN_PROVINCE,
    city: TOWN_CITY,
    barangay: 'Malasin',
  },
  {
    id: 'loc-church',
    label: 'San Juan Parish Church',
    coords: { x: 44, y: 37 },
    gps: { lat: 15.76, lng: 120.975 },
    province: TOWN_PROVINCE,
    city: TOWN_CITY,
    barangay: 'San Juan',
  },
  {
    id: 'loc-hospital',
    label: 'District Hospital',
    coords: { x: 35, y: 0 },
    gps: { lat: 15.718135, lng: 120.969148 },
    province: TOWN_PROVINCE,
    city: TOWN_CITY,
    barangay: 'Tondod',
  },
  {
    id: 'loc-mall',
    label: 'Town Center Mall',
    coords: { x: 20, y: 100 },
    gps: { lat: 15.83, lng: 120.96 },
    province: TOWN_PROVINCE,
    city: TOWN_CITY,
    barangay: 'Manicla',
  },
  // Two real, user-confirmed San Jose City, Nueva Ecija locations — precise
  // anchors so they don't need to be re-geocoded (and re-billed against
  // Nominatim's rate limit) on every booking. Coordinates came from live
  // Nominatim lookups the user corroborated against real-world knowledge
  // (distance between the two checked out to ~3.1km, matching the "2
  // barangays apart, 3-4km" the user gave).
  {
    id: 'loc-bosca-greentech',
    label: 'Bosca by Greentech (front of Roseville Subd.)',
    coords: { x: 0, y: 27 },
    gps: { lat: 15.7480428, lng: 120.9472983 },
    province: 'Nueva Ecija',
    city: 'San Jose City',
    barangay: 'Santo Tomas',
  },
  {
    id: 'loc-caanawan-nhs',
    label: 'Caanawan National High School',
    coords: { x: 26, y: 47 },
    gps: { lat: 15.7709428, lng: 120.9637338 },
    province: 'Nueva Ecija',
    city: 'San Jose City',
    barangay: 'Caanawan',
  },
  // The default Pabili "deliver to" destination — OpenStreetMap has no POI
  // tagged specifically as San Jose City's public market, so this is derived
  // rather than geocoded directly: Nominatim locates Saint Joseph the Worker
  // Cathedral at 15.7921012, 120.9895791 (Rafael Rueda Sr. Poblacion, on
  // Maharlika Highway), and per public sources the market sits ~230m
  // northeast of the cathedral — this is that offset point. For any city
  // other than San Jose City, PassengerPage looks up "Public Market" for
  // that city live via resolvePhAddress/geocodeAddress instead of using this
  // fixed point.
  {
    id: 'loc-public-market-sjc',
    label: 'Public Market',
    coords: { x: 60, y: 63 },
    gps: { lat: 15.793564, lng: 120.991099 },
    province: 'Nueva Ecija',
    city: 'San Jose City',
    barangay: 'Rafael Rueda, Sr. Poblacion',
  },
]

// Simulated driver starting point (tricycle terminal) used before a driver
// reaches the passenger's pickup point.
export const DRIVER_BASE_COORDS = { x: 50, y: 50 }
export const DRIVER_BASE_LABEL = 'Tricycle Terminal'
// Real terminal-type landmark (San Jose City Public Market) — every mock
// location, driver, passenger, parent, and TODA now shares this same real
// city, so this is a genuinely central, close starting point for all of them.
export const DRIVER_BASE_GPS = { lat: 15.7940977, lng: 120.9905849 }

// All 38 official barangays of San Jose City, Nueva Ecija — cross-checked
// against PhilAtlas (philatlas.com/luzon/r03/nueva-ecija/san-jose.html) and
// Wikimedia Commons' barangay category, spelling per PhilAtlas where the two
// disagreed (e.g. "Villa Floresca"). Replaces an earlier, smaller subset
// that included "Licaong" — dropped here since neither source lists it as
// one of San Jose City's actual barangays.
const SAN_JOSE_CITY_BARANGAYS = [
  'A. Pascual',
  'Abar 1st',
  'Abar 2nd',
  'Bagong Sikat',
  'Caanawan',
  'Calaocan',
  'Camanacsacan',
  'Canuto Ramos Poblacion',
  'Crisanto Sanchez Poblacion',
  'Culaylay',
  'Dizol',
  'Ferdinand E. Marcos Poblacion',
  'Kaliwanagan',
  'Kita-Kita',
  'Malasin',
  'Manicla',
  'Palestina',
  'Parang Mangga',
  'Pinili',
  'Porais',
  'Rafael Rueda, Sr. Poblacion',
  'Raymundo Eugenio Poblacion',
  'San Agustin',
  'San Juan',
  'San Mauricio',
  'Santo Niño 1st',
  'Santo Niño 2nd',
  'Santo Niño 3rd',
  'Santo Tomas',
  'Sibut',
  'Sinipit Bubon',
  'Tabulac',
  'Tayabo',
  'Tondod',
  'Tulat',
  'Villa Floresca',
  'Villa Joson',
  'Villa Marina',
]

// All 37 official barangays of Science City of Muñoz, Nueva Ecija —
// cross-checked against PhilAtlas (philatlas.com/luzon/r03/nueva-ecija/
// munoz.html), Wikipedia, and BarangayDirectory.com, all three in exact
// agreement (including tricky cases like "Rang-ayan" and "Villa Cuizon").
const SCIENCE_CITY_MUNOZ_BARANGAYS = [
  'Bagong Sikat',
  'Balante',
  'Bantug',
  'Bical',
  'Cabisuculan',
  'Calabalabaan',
  'Calisitan',
  'Catalanacan',
  'Curva',
  'Franza',
  'Gabaldon',
  'Labney',
  'Licaong',
  'Linglingay',
  'Magtanggol',
  'Maligaya',
  'Mangandingay',
  'Mapangpang',
  'Maragol',
  'Matingkis',
  'Naglabrahan',
  'Palusapis',
  'Pandalla',
  'Poblacion East',
  'Poblacion North',
  'Poblacion South',
  'Poblacion West',
  'Rang-ayan',
  'Rizal',
  'San Andres',
  'San Antonio',
  'San Felipe',
  'Sapang Cawayan',
  'Villa Cuizon',
  'Villa Isla',
  'Villa Nati',
  'Villa Santos',
]

// CLSU (Central Luzon State University) sits within Science City of Muñoz
// but isn't itself one of its 37 official barangays — added as its own
// special entry (alongside the real barangays above) so campus bookings can
// pick a specific building/facility instead of falling back to a generic
// barangay pin. Placed first since it's this app's primary/default area.
SCIENCE_CITY_MUNOZ_BARANGAYS.unshift('CLSU')

// Anchor for CLSU's main campus (Academic Ave / main gate area) — matches
// the university's actual published location, not a rough guess. Every
// specific CLSU place below is jittered off this single point (see
// getClsuPlaceGps) since the real campus spans several hundred hectares and
// per-building coordinates aren't worth surveying for a prototype, but the
// jitter now stays centered on real campus ground instead of drifting into
// neighboring barangays.
export const CLSU_GPS: GeoCoords = { lat: 15.73299, lng: 120.931426 }

// Default "current location" for starting a Ride/Pabili/Buy Medicine
// booking — CLSU, rather than each passenger's own registered home address.
// Temporary/demo default, not a permanent replacement for the passenger's
// real address (which is still what registration and the "Booking as" panel
// use) — see PassengerPage.tsx/QuickBookingForm.tsx's booking-default seeds.
export const DEFAULT_BOOKING_PROVINCE = 'Nueva Ecija'
export const DEFAULT_BOOKING_CITY = 'Science City of Muñoz'
export const DEFAULT_BOOKING_BARANGAY = 'CLSU'
export const DEFAULT_BOOKING_ADDRESS_DETAIL = 'CLSU Main Gate'

export const CLSU_MAIN_GATE_LOCATION: MockLocation = {
  id: 'loc-clsu-main-gate',
  label: 'CLSU Main Gate, Science City of Muñoz',
  coords: { x: 15, y: 20 },
  gps: CLSU_GPS,
  province: DEFAULT_BOOKING_PROVINCE,
  city: DEFAULT_BOOKING_CITY,
  barangay: DEFAULT_BOOKING_BARANGAY,
}
// MOCK_LOCATIONS is declared earlier in this file — appended here (instead
// of inline in that array literal) since CLSU_MAIN_GATE_LOCATION depends on
// CLSU_GPS, which is itself declared after MOCK_LOCATIONS.
MOCK_LOCATIONS.push(CLSU_MAIN_GATE_LOCATION)

export interface ClsuLocationGroup {
  group: string
  places: string[]
}

// Selectable CLSU campus places, grouped for the "CLSU place" dropdown that
// BarangayAddressPicker shows once barangay === 'CLSU' (see resolvePhAddress
// in lib/customLocation.ts for how a pick here turns into a real map point).
// Kept free of exact-duplicate names across groups — "College of Agriculture"
// lives only under Agriculture, not also under Academic Buildings.
export const CLSU_LOCATION_GROUPS: ClsuLocationGroup[] = [
  {
    group: 'Academic Buildings',
    places: ['Administration Building', 'College of Engineering', 'College of Education', 'College of Science', 'CBAA'],
  },
  {
    group: 'Student Facilities',
    places: ['Library', 'Gymnatorium', 'Umali Gym', 'Dormitories'],
  },
  {
    group: 'Food & Commercial',
    places: ['Food Park', 'Old Market', 'Canteens'],
  },
  {
    group: 'Parks & Recreation',
    places: ['Rizal Park', 'Lingap Kalikasan Park', 'Botanical Garden', 'Oval'],
  },
  {
    group: 'University Administration',
    places: [
      'Office of the President',
      'Office of the VPs',
      'University Registrar',
      'Accounting Office',
      'Cashier',
      'HR Management Office',
      'Procurement Office',
      'Supply Office',
      'University Legal Office',
      'Univ. Planning Office',
      'Internal Audit',
      'MIS Office',
      'Public Affairs Office',
      'Office of Student Affairs',
    ],
  },
  {
    group: 'Research',
    places: [
      'Univ. Research Office',
      'Research Laboratories',
      'Agri Research Centers',
      'Experimental Farms',
      'Crop Research Facilities',
      'Animal Research Facilities',
      'Fisheries Facilities',
      'Soil/Water Laboratories',
      'Agri Engineering Labs',
    ],
  },
  {
    group: 'Agriculture',
    places: [
      'College of Agriculture',
      'Crop Science Facilities',
      'Animal Science Facilities',
      'Dairy Facilities',
      'Poultry Facilities',
      'Swine Facilities',
      'Agri Machinery Facilities',
      'Irrigation Facilities',
      'Demonstration Farms',
      'Organic Agri Facilities',
    ],
  },
  {
    group: 'Specialized CLSU Centers',
    places: [
      'PhilMech',
      'PCC',
      'PhiSCAT',
      'Carabao Center (PCC)',
      'PhilMech-Related Facilities',
      'CLAARRDEC Facilities',
      'Food Processing Facilities',
      'Postharvest Facilities',
      'Biotechnology Facilities',
    ],
  },
  {
    group: 'Other',
    places: ['Infirmary', 'Post Office', 'Museum', 'Gates', 'Parking Areas'],
  },
]

// Deterministic per-place jitter around CLSU_GPS (same input always gives
// the same output) so different campus places land at visually distinct —
// but reproducible — map points without needing a real survey or a live
// geocoding call that likely wouldn't resolve informal names like
// "Umali Gym" or "CBAA". Capped at ~±330m so every place stays on real
// campus ground near the actual entrance/Academic Ave anchor instead of
// drifting into a neighboring barangay.
export function getClsuPlaceGps(place: string): GeoCoords {
  let hash = 0
  for (let i = 0; i < place.length; i++) hash = (hash * 31 + place.charCodeAt(i)) >>> 0
  const jitterLat = ((hash % 1000) / 1000 - 0.5) * 0.006
  const jitterLng = (((hash >>> 10) % 1000) / 1000 - 0.5) * 0.006
  return { lat: CLSU_GPS.lat + jitterLat, lng: CLSU_GPS.lng + jitterLng }
}

// All 89 official barangays of Cabanatuan City, Nueva Ecija — cross-checked
// against PhilAtlas (philatlas.com/luzon/r03/nueva-ecija/cabanatuan.html) and
// Wikipedia's article for Cabanatuan City, Nueva Ecija.
// Spelling follows PhilAtlas where Wikipedia's list differs (e.g. "Daang
// Sarile" vs Wikipedia's "Daan Sarile", "Campo Tinio" vs "Camp Tinio", "Ibabao
// Bana" vs "Ibabao-Bana", "Villa Ofelia-Caridad" vs "Villa Ofelia
// Subdivision", "Zulueta District" vs "Zuleta District").
const CABANATUAN_CITY_BARANGAYS = [
  'Aduas Centro',
  'Aduas Norte',
  'Aduas Sur',
  'Bagong Buhay',
  'Bagong Sikat',
  'Bakero',
  'Bakod Bayan',
  'Balite',
  'Bangad',
  'Bantug Bulalo',
  'Bantug Norte',
  'Barlis',
  'Barrera District',
  'Bernardo District',
  'Bitas',
  'Bonifacio District',
  'Buliran',
  'Caalibangbangan',
  'Cabu',
  'Calawagan',
  'Campo Tinio',
  'Caridad',
  'Caudillo',
  'Cinco-Cinco',
  'City Supermarket',
  'Communal',
  'Cruz Roja',
  'Daang Sarile',
  'Dalampang',
  'Dicarma',
  'Dimasalang',
  'Dionisio S. Garcia',
  'Fatima',
  'General Luna',
  'Hermogenes C. Concepcion, Sr.',
  'Ibabao Bana',
  'Imelda District',
  'Isla',
  'Kalikid Norte',
  'Kalikid Sur',
  'Kapitan Pepe',
  'Lagare',
  'Lourdes',
  'M. S. Garcia',
  'Mabini Extension',
  'Mabini Homesite',
  'Macatbong',
  'Magsaysay District',
  'Magsaysay South',
  'Maria Theresa',
  'Matadero',
  'Mayapyap Norte',
  'Mayapyap Sur',
  'Melojavilla',
  'Nabao',
  'Obrero',
  'Padre Burgos',
  'Padre Crisostomo',
  'Pagas',
  'Palagay',
  'Pamaldan',
  'Pangatian',
  'Patalac',
  'Polilio',
  'Pula',
  'Quezon District',
  'Rizdelis',
  'Samon',
  'San Isidro',
  'San Josef Norte',
  'San Josef Sur',
  'San Juan Poblacion',
  'San Roque Norte',
  'San Roque Sur',
  'Sanbermicristi',
  'Sangitan',
  'Sangitan East',
  'Santa Arcadia',
  'Santo Niño',
  'Sapang',
  'Sumacab Este',
  'Sumacab Norte',
  'Sumacab South',
  'Talipapa',
  'Valdefuente',
  'Valle Cruz',
  'Vijandre District',
  'Villa Ofelia-Caridad',
  'Zulueta District',
]

// All 23 official barangays of Gapan City, Nueva Ecija — cross-checked against
// PhilAtlas (philatlas.com/luzon/r03/nueva-ecija/gapan.html) and Wikipedia's
// article for Gapan City, Nueva Ecija.
const GAPAN_CITY_BARANGAYS = [
  'Balante',
  'Bayanihan',
  'Bulak',
  'Bungo',
  'Kapalangan',
  'Mabunga',
  'Maburak',
  'Mahipon',
  'Makabaclay',
  'Malimba',
  'Mangino',
  'Marelo',
  'Pambuan',
  'Parcutela',
  'Puting Tubig',
  'San Lorenzo',
  'San Nicolas',
  'San Roque',
  'San Vicente',
  'Santa Cruz',
  'Santo Cristo Norte',
  'Santo Cristo Sur',
  'Santo Niño',
]

// All 19 official barangays of Palayan City, Nueva Ecija — cross-checked
// against PhilAtlas (philatlas.com/luzon/r03/nueva-ecija/palayan.html) and
// Wikipedia's article for Palayan City, Nueva Ecija.
const PALAYAN_CITY_BARANGAYS = [
  'Atate',
  'Aulo',
  'Bagong Buhay',
  'Bo. Militar',
  'Caballero',
  'Caimito',
  'Doña Josefa',
  'Ganaderia',
  'Imelda Valley',
  'Langka',
  'Malate',
  'Maligaya',
  'Manacnac',
  'Mapait',
  'Marcos Village',
  'Popolon Pagas',
  'Santolan',
  'Sapang Buho',
  'Singalat',
]

// All 26 official barangays of Aliaga, Nueva Ecija — cross-checked against
// PhilAtlas (philatlas.com/luzon/r03/nueva-ecija/aliaga.html) and Wikipedia's
// article for Aliaga, Nueva Ecija.
const ALIAGA_BARANGAYS = [
  'Betes',
  'Bibiclat',
  'Bucot',
  'La Purisima',
  'Macabucod',
  'Magsaysay',
  'Pantoc',
  'Poblacion Centro',
  'Poblacion East I',
  'Poblacion East II',
  'Poblacion West III',
  'Poblacion West IV',
  'San Carlos',
  'San Emiliano',
  'San Eustacio',
  'San Felipe Bata',
  'San Felipe Matanda',
  'San Juan',
  'San Pablo Bata',
  'San Pablo Matanda',
  'Santa Monica',
  'Santiago',
  'Santo Rosario',
  'Santo Tomas',
  'Sunson',
  'Umangan',
]

// All 28 official barangays of Bongabon, Nueva Ecija — cross-checked against
// PhilAtlas (philatlas.com/luzon/r03/nueva-ecija/bongabon.html) and
// Wikipedia's article for Bongabon, Nueva Ecija.
const BONGABON_BARANGAYS = [
  'Antipolo',
  'Ariendo',
  'Bantug',
  'Calaanan',
  'Commercial',
  'Cruz',
  'Curva',
  'Digmala',
  'Kaingin',
  'Labi',
  'Larcon',
  'Lusok',
  'Macabaclay',
  'Magtanggol',
  'Mantile',
  'Olivete',
  'Palo Maria',
  'Pesa',
  'Rizal',
  'Sampalucan',
  'San Roque',
  'Santor',
  'Sinipit',
  'Sisilang na Ligaya',
  'Social',
  'Tugatug',
  'Tulay na Bato',
  'Vega',
]

// All 23 official barangays of Cabiao, Nueva Ecija — cross-checked against
// PhilAtlas (philatlas.com/luzon/r03/nueva-ecija/cabiao.html) and Wikipedia's
// article for Cabiao, Nueva Ecija.
const CABIAO_BARANGAYS = [
  'Bagong Buhay',
  'Bagong Sikat',
  'Bagong Silang',
  'Concepcion',
  'Entablado',
  'Maligaya',
  'Natividad North',
  'Natividad South',
  'Palasinan',
  'Polilio',
  'San Antonio',
  'San Carlos',
  'San Fernando Norte',
  'San Fernando Sur',
  'San Gregorio',
  'San Juan North',
  'San Juan South',
  'San Roque',
  'San Vicente',
  'Santa Ines',
  'Santa Isabel',
  'Santa Rita',
  'Sinipit',
]

// All 17 official barangays of Carranglan, Nueva Ecija — cross-checked against
// PhilAtlas (philatlas.com/luzon/r03/nueva-ecija/carranglan.html) and
// Wikipedia's article for Carranglan, Nueva Ecija.
const CARRANGLAN_BARANGAYS = [
  'Bantug',
  'Bunga',
  'Burgos',
  'Capintalan',
  'D. L. Maglanoc Poblacion',
  'F. C. Otic Poblacion',
  'G. S. Rosario Poblacion',
  'General Luna',
  'Joson',
  'Minuli',
  'Piut',
  'Puncan',
  'Putlan',
  'R. A. Padilla',
  'Salazar',
  'San Agustin',
  'T. L. Padilla Poblacion',
]

// All 51 official barangays of Cuyapo, Nueva Ecija — cross-checked against
// PhilAtlas (philatlas.com/luzon/r03/nueva-ecija/cuyapo.html) and Wikipedia's
// article for Cuyapo, Nueva Ecija.
// "District III" is genuinely absent from both sources (Districts I, II,
// IV–VIII exist, with no III) — not an accidental omission here.
const CUYAPO_BARANGAYS = [
  'Baloy',
  'Bambanaba',
  'Bantug',
  'Bentigan',
  'Bibiclat',
  'Bonifacio',
  'Bued',
  'Bulala',
  'Burgos',
  'Cabatuan',
  'Cabileo',
  'Cacapasan',
  'Calancuasan Norte',
  'Calancuasan Sur',
  'Colosboa',
  'Columbitin',
  'Curva',
  'District I',
  'District II',
  'District IV',
  'District V',
  'District VI',
  'District VII',
  'District VIII',
  'Landig',
  'Latap',
  'Loob',
  'Luna',
  'Malbeg-Patalan',
  'Malineng',
  'Matindeg',
  'Maycaban',
  'Nacuralan',
  'Nagmisahan',
  'Paitan Norte',
  'Paitan Sur',
  'Piglisan',
  'Pugo',
  'Rizal',
  'Sabit',
  'Salagusog',
  'San Antonio',
  'San Jose',
  'San Juan',
  'Santa Clara',
  'Santa Cruz',
  'Sinimbaan',
  'Tagtagumbao',
  'Tutuloy',
  'Ungab',
  'Villaflores',
]

// All 16 official barangays of Gabaldon, Nueva Ecija — cross-checked against
// PhilAtlas (philatlas.com/luzon/r03/nueva-ecija/gabaldon.html) and
// Wikipedia's article for Gabaldon, Nueva Ecija.
const GABALDON_BARANGAYS = [
  'Bagong Sikat',
  'Bagting',
  'Bantug',
  'Bitulok',
  'Bugnan',
  'Calabasa',
  'Camachile',
  'Cuyapa',
  'Ligaya',
  'Macasandal',
  'Malinao',
  'Pantoc',
  'Pinamalisan',
  'Sawmill',
  'South Poblacion',
  'Tagumpay',
]

// All 20 official barangays of General Mamerto Natividad, Nueva Ecija —
// cross-checked against PhilAtlas
// (philatlas.com/luzon/r03/nueva-ecija/general-mamerto-natividad.html) and
// Wikipedia's article for General Mamerto Natividad, Nueva Ecija.
const GENERAL_MAMERTO_NATIVIDAD_BARANGAYS = [
  'Balangkare Norte',
  'Balangkare Sur',
  'Balaring',
  'Belen',
  'Bravo',
  'Burol',
  'Kabulihan',
  'Mag-asawang Sampaloc',
  'Manarog',
  'Mataas na Kahoy',
  'Panacsac',
  'Picaleon',
  'Pinahan',
  'Platero',
  'Poblacion',
  'Pula',
  'Pulong Singkamas',
  'Sapang Bato',
  'Talabutab Norte',
  'Talabutab Sur',
]

// All 13 official barangays of General Tinio, Nueva Ecija — cross-checked
// against PhilAtlas (philatlas.com/luzon/r03/nueva-ecija/general-tinio.html)
// and Wikipedia's article for General Tinio, Nueva Ecija.
const GENERAL_TINIO_BARANGAYS = [
  'Bago',
  'Concepcion',
  'Nazareth',
  'Padolina',
  'Palale',
  'Pias',
  'Poblacion Central',
  'Poblacion East',
  'Poblacion West',
  'Pulong Matong',
  'Rio Chico',
  'Sampaguita',
  'San Pedro',
]

// All 64 official barangays of Guimba, Nueva Ecija — cross-checked against
// PhilAtlas (philatlas.com/luzon/r03/nueva-ecija/guimba.html) and Wikipedia's
// article for Guimba, Nueva Ecija.
const GUIMBA_BARANGAYS = [
  'Agcano',
  'Ayos Lomboy',
  'Bacayao',
  'Bagong Barrio',
  'Balbalino',
  'Balingog East',
  'Balingog West',
  'Banitan',
  'Bantug',
  'Bulakid',
  'Bunol',
  'Caballero',
  'Cabaruan',
  'Caingin Tabing Ilog',
  'Calem',
  'Camiling',
  'Cardinal',
  'Casongsong',
  'Catimon',
  'Cavite',
  'Cawayan Bugtong',
  'Consuelo',
  'Culong',
  'Escano',
  'Faigal',
  'Galvan',
  'Guiset',
  'Lamorito',
  'Lennec',
  'Macamias',
  'Macapabellag',
  'Macatcatuit',
  'Manacsac',
  'Manggang Marikit',
  'Maturanoc',
  'Maybubon',
  'Naglabrahan',
  'Nagpandayan',
  'Narvacan I',
  'Narvacan II',
  'Pacac',
  'Partida I',
  'Partida II',
  'Pasong Inchic',
  'Saint John District',
  'San Agustin',
  'San Andres',
  'San Bernardino',
  'San Marcelino',
  'San Miguel',
  'San Rafael',
  'San Roque',
  'Santa Ana',
  'Santa Cruz',
  'Santa Lucia',
  'Santa Veronica District',
  'Santo Cristo District',
  'Saranay District',
  'Sinulatan',
  'Subol',
  'Tampac I',
  'Tampac II & III',
  'Triala',
  'Yuson',
]

// All 27 official barangays of Jaen, Nueva Ecija — cross-checked against
// PhilAtlas (philatlas.com/luzon/r03/nueva-ecija/jaen.html) and Wikipedia's
// article for Jaen, Nueva Ecija.
const JAEN_BARANGAYS = [
  'Calabasa',
  'Dampulan',
  'Don Mariano Marcos',
  'Hilera',
  'Imbunia',
  'Imelda Poblacion',
  'Lambakin',
  'Langla',
  'Magsalisi',
  'Malabon-Kaingin',
  'Marawa',
  'Niyugan',
  'Ocampo-Rivera District',
  'Pakol',
  'Pamacpacan',
  'Pinanggaan',
  'Putlod',
  'San Jose',
  'San Josef',
  'San Pablo',
  'San Roque',
  'San Vicente',
  'Santa Rita',
  'Santo Tomas North',
  'Santo Tomas South',
  'Sapang',
  'Ulanin-Pitak',
]

// All 17 official barangays of Laur, Nueva Ecija — cross-checked against
// PhilAtlas (philatlas.com/luzon/r03/nueva-ecija/laur.html) and Wikipedia's
// article for Laur, Nueva Ecija.
const LAUR_BARANGAYS = [
  'Barangay I',
  'Barangay II',
  'Barangay III',
  'Barangay IV',
  'Betania',
  'Canantong',
  'Nauzon',
  'Pangarulong',
  'Pinagbayanan',
  'Sagana',
  'San Felipe',
  'San Fernando',
  'San Isidro',
  'San Josef',
  'San Juan',
  'San Vicente',
  'Siclong',
]

// All 11 official barangays of Licab, Nueva Ecija — cross-checked against
// PhilAtlas (philatlas.com/luzon/r03/nueva-ecija/licab.html) and Wikipedia's
// article for Licab, Nueva Ecija.
const LICAB_BARANGAYS = [
  'Aquino',
  'Linao',
  'Poblacion Norte',
  'Poblacion Sur',
  'San Casimiro',
  'San Cristobal',
  'San Jose',
  'San Juan',
  'Santa Maria',
  'Tabing Ilog',
  'Villarosa',
]

// All 22 official barangays of Llanera, Nueva Ecija — cross-checked against
// PhilAtlas (philatlas.com/luzon/r03/nueva-ecija/llanera.html) and Wikipedia's
// article for Llanera, Nueva Ecija.
const LLANERA_BARANGAYS = [
  'A. Bonifacio',
  'Bagumbayan',
  'Bosque',
  'Caridad Norte',
  'Caridad Sur',
  'Casile',
  'Florida Blanca',
  'General Luna',
  'General Ricarte',
  'Gomez',
  'Inanama',
  'Ligaya',
  'Mabini',
  'Murcon',
  'Plaridel',
  'San Felipe',
  'San Francisco',
  'San Nicolas',
  'San Vicente',
  'Santa Barbara',
  'Victoria',
  'Villa Viniegas',
]

// All 24 official barangays of Lupao, Nueva Ecija — cross-checked against
// PhilAtlas (philatlas.com/luzon/r03/nueva-ecija/lupao.html) and Wikipedia's
// article for Lupao, Nueva Ecija.
const LUPAO_BARANGAYS = [
  'Agupalo Este',
  'Agupalo Weste',
  'Alalay Chica',
  'Alalay Grande',
  'Bagong Flores',
  'Balbalungao',
  'Burgos',
  'Cordero',
  'J. U. Tienzo',
  'Mapangpang',
  'Namulandayan',
  'Parista',
  'Poblacion East',
  'Poblacion North',
  'Poblacion South',
  'Poblacion West',
  'Salvacion I',
  'Salvacion II',
  'San Antonio Este',
  'San Antonio Weste',
  'San Isidro',
  'San Pedro',
  'San Roque',
  'Santo Domingo',
]

// All 21 official barangays of Nampicuan, Nueva Ecija — cross-checked against
// PhilAtlas (philatlas.com/luzon/r03/nueva-ecija/nampicuan.html) and
// Wikipedia's article for Nampicuan, Nueva Ecija.
const NAMPICUAN_BARANGAYS = [
  'Alemania',
  'Ambasador Alzate Village',
  'Cabaducan East',
  'Cabaducan West',
  'Cabawangan',
  'East Central Poblacion',
  'Edy',
  'Estacion',
  'Maeling',
  'Mayantoc',
  'Medico',
  'Monic',
  'North Poblacion',
  'Northwest Poblacion',
  'Recuerdo',
  'South Central Poblacion',
  'Southeast Poblacion',
  'Southwest Poblacion',
  'Tony',
  'West Central Poblacion',
  'West Poblacion',
]

// All 14 official barangays of Pantabangan, Nueva Ecija — cross-checked
// against PhilAtlas (philatlas.com/luzon/r03/nueva-ecija/pantabangan.html) and
// Wikipedia's article for Pantabangan, Nueva Ecija.
const PANTABANGAN_BARANGAYS = [
  'Cadaclan',
  'Cambitala',
  'Conversion',
  'Fatima',
  'Ganduz',
  'Liberty',
  'Malbang',
  'Marikit',
  'Napon-Napon',
  'Poblacion East',
  'Poblacion West',
  'Sampaloc',
  'San Juan',
  'Villarica',
]

// All 10 official barangays of Peñaranda, Nueva Ecija — cross-checked against
// PhilAtlas (philatlas.com/luzon/r03/nueva-ecija/penaranda.html) and
// Wikipedia's article for Peñaranda, Nueva Ecija.
const PENARANDA_BARANGAYS = [
  'Callos',
  'Las Piñas',
  'Poblacion I',
  'Poblacion II',
  'Poblacion III',
  'Poblacion IV',
  'San Josef',
  'San Mariano',
  'Santo Tomas',
  'Sinasajan',
]

// All 16 official barangays of Quezon, Nueva Ecija — cross-checked against
// PhilAtlas (philatlas.com/luzon/r03/nueva-ecija/quezon.html) and Wikipedia's
// article for Quezon, Nueva Ecija.
const QUEZON_BARANGAYS = [
  'Barangay I',
  'Barangay II',
  'Bertese',
  'Doña Lucia',
  'Dulong Bayan',
  'Ilog Baliwag',
  'Pulong Bahay',
  'San Alejandro',
  'San Andres I',
  'San Andres II',
  'San Manuel',
  'San Miguel',
  'Santa Clara',
  'Santa Rita',
  'Santo Cristo',
  'Santo Tomas Feria',
]

// All 26 official barangays of Rizal, Nueva Ecija — cross-checked against
// PhilAtlas (philatlas.com/luzon/r03/nueva-ecija/rizal.html) and Wikipedia's
// article for Rizal, Nueva Ecija.
const RIZAL_BARANGAYS = [
  'Agbannawag',
  'Aglipay',
  'Bicos',
  'Cabucbucan',
  'Calaocan District',
  'Canaan East',
  'Canaan West',
  'Casilagan',
  'Del Pilar',
  'Estrella',
  'General Luna',
  'Macapsing',
  'Maligaya',
  'Paco Roman',
  'Pag-asa',
  'Poblacion Central',
  'Poblacion East',
  'Poblacion Norte',
  'Poblacion Sur',
  'Poblacion West',
  'Portal',
  'San Esteban',
  'San Gregorio',
  'Santa Monica',
  'Villa Labrador',
  'Villa Paraiso',
]

// All 16 official barangays of San Antonio, Nueva Ecija — cross-checked
// against PhilAtlas (philatlas.com/luzon/r03/nueva-ecija/san-antonio.html) and
// Wikipedia's article for San Antonio, Nueva Ecija.
const SAN_ANTONIO_BARANGAYS = [
  'Buliran',
  'Cama Juan',
  'Julo',
  'Lawang Kupang',
  'Luyos',
  'Maugat',
  'Panabingan',
  'Papaya',
  'Poblacion',
  'San Francisco',
  'San Jose',
  'San Mariano',
  'Santa Barbara',
  'Santa Cruz',
  'Santo Cristo',
  'Tikiw',
]

// All 9 official barangays of San Isidro, Nueva Ecija — cross-checked against
// PhilAtlas (philatlas.com/luzon/r03/nueva-ecija/san-isidro.html) and PSA's
// PSGC entry for San Isidro
// (psa.gov.ph/classification/psgc/barangays/0304925000).
const SAN_ISIDRO_BARANGAYS = [
  'Alua',
  'Calaba',
  'Malapit',
  'Mangga',
  'Poblacion',
  'Pulo',
  'San Roque',
  'Santo Cristo',
  'Tabon',
]

// All 15 official barangays of San Leonardo, Nueva Ecija — cross-checked
// against PhilAtlas (philatlas.com/luzon/r03/nueva-ecija/san-leonardo.html)
// and Wikipedia's article for San Leonardo, Nueva Ecija.
// Spelling follows PhilAtlas (e.g. "San Bartolome" without the accent, plain
// "District" suffixes) over Wikipedia's "San Bartolomé" and "(Población)"
// suffixes.
const SAN_LEONARDO_BARANGAYS = [
  'Bonifacio District',
  'Burgos District',
  'Castellano',
  'Diversion',
  'Magpapalayoc',
  'Mallorca',
  'Mambangnan',
  'Nieves',
  'Rizal District',
  'San Anton',
  'San Bartolome',
  'San Roque',
  'Tabuating',
  'Tagumpay',
  'Tambo Adorable',
]

// All 33 official barangays of Santa Rosa, Nueva Ecija — cross-checked against
// PhilAtlas (philatlas.com/luzon/r03/nueva-ecija/santa-rosa.html) and
// Wikipedia's article for Santa Rosa, Nueva Ecija.
// PhilAtlas spells one barangay "San Josep"; Wikipedia spells it "San Joseph"
// — PhilAtlas spelling kept per this file's convention.
const SANTA_ROSA_BARANGAYS = [
  'Aguinaldo',
  'Berang',
  'Burgos',
  'Cojuangco',
  'Del Pilar',
  'Gomez',
  'Inspector',
  'Isla',
  'La Fuente',
  'Liwayway',
  'Lourdes',
  'Luna',
  'Mabini',
  'Malacañang',
  'Maliolio',
  'Mapalad',
  'Rajal Centro',
  'Rajal Norte',
  'Rajal Sur',
  'Rizal',
  'San Gregorio',
  'San Isidro',
  'San Josep',
  'San Mariano',
  'San Pedro',
  'Santa Teresita',
  'Santo Rosario',
  'Sapsap',
  'Soledad',
  'Tagpos',
  'Tramo',
  'Valenzuela',
  'Zamora',
]

// All 24 official barangays of Santo Domingo, Nueva Ecija — cross-checked
// against PhilAtlas (philatlas.com/luzon/r03/nueva-ecija/santo-domingo.html)
// and Wikipedia's article for Santo Domingo, Nueva Ecija.
const SANTO_DOMINGO_BARANGAYS = [
  'Baloc',
  'Buasao',
  'Burgos',
  'Cabugao',
  'Casulucan',
  'Comitang',
  'Concepcion',
  'Dolores',
  'General Luna',
  'Hulo',
  'Mabini',
  'Malasin',
  'Malaya',
  'Malayantoc',
  'Mambarao',
  'Poblacion',
  'Pulong Buli',
  'Sagaba',
  'San Agustin',
  'San Fabian',
  'San Francisco',
  'San Pascual',
  'Santa Rita',
  'Santo Rosario',
]

// All 53 official barangays of Talavera, Nueva Ecija — cross-checked against
// PhilAtlas (philatlas.com/luzon/r03/nueva-ecija/talavera.html) and
// Wikipedia's article for Talavera, Nueva Ecija.
// Spelling follows PhilAtlas over Wikipedia in a couple of spots (e.g. "Andal
// Alino" vs Wikipedia's "Andal Aliño", "Bantug Hamog" vs Wikipedia's "Basang
// Hamog").
const TALAVERA_BARANGAYS = [
  'Andal Alino',
  'Bagong Sikat',
  'Bagong Silang',
  'Bakal I',
  'Bakal II',
  'Bakal III',
  'Baluga',
  'Bantug',
  'Bantug Hacienda',
  'Bantug Hamog',
  'Bugtong na Buli',
  'Bulac',
  'Burnay',
  'Caaniplahan',
  'Cabubulaonan',
  'Calipahan',
  'Campos',
  'Caputican',
  'Casulucan Este',
  'Collado',
  'Dimasalang Norte',
  'Dimasalang Sur',
  'Dinarayat',
  'Esguerra District',
  'Gulod',
  'Homestead I',
  'Homestead II',
  'Kinalanguyan',
  'La Torre',
  'Lomboy',
  'Mabuhay',
  'Maestrang Kikay',
  'Mamandil',
  'Marcos District',
  'Matingkis',
  'Minabuyoc',
  'Pag-asa',
  'Paludpod',
  'Pantoc Bulac',
  'Pinagpanaan',
  'Poblacion Sur',
  'Pula',
  'Pulong San Miguel',
  'Purok Matias',
  'Sampaloc',
  'San Miguel na Munti',
  'San Pascual',
  'San Ricardo',
  'Sibul',
  'Sicsican Matanda',
  'Tabacao',
  'Tagaytay',
  'Valle',
]

// All 28 official barangays of Talugtug, Nueva Ecija — cross-checked against
// PhilAtlas (philatlas.com/luzon/r03/nueva-ecija/talugtug.html) and
// Wikipedia's article for Talugtug, Nueva Ecija.
const TALUGTUG_BARANGAYS = [
  'Alula',
  'Baybayabas',
  'Buted',
  'Cabiangan',
  'Calisitan',
  'Cinense',
  'Culiat',
  'Maasin',
  'Magsaysay',
  'Mayamot I',
  'Mayamot II',
  'Nangabulan',
  'Osmeña',
  'Pangit',
  'Patola',
  'Quezon',
  'Quirino',
  'Roxas',
  'Saguing',
  'Sampaloc',
  'Santa Catalina',
  'Santo Domingo',
  'Saringaya',
  'Saverona',
  'Tandoc',
  'Tibag',
  'Villa Boado',
  'Villa Rosario',
]

// All 19 official barangays of Zaragoza, Nueva Ecija — cross-checked against
// PhilAtlas (philatlas.com/luzon/r03/nueva-ecija/zaragoza.html) and
// Wikipedia's article for Zaragoza, Nueva Ecija.
const ZARAGOZA_BARANGAYS = [
  'Batitang',
  'Carmen',
  'Concepcion',
  'Del Pilar',
  'General Luna',
  'H. Romero',
  'Macarse',
  'Manaul',
  'Mayamot',
  'Pantoc',
  'San Isidro',
  'San Rafael',
  'San Vicente',
  'Santa Cruz',
  'Santa Lucia Old',
  'Santa Lucia Young',
  'Santo Rosario Old',
  'Santo Rosario Young',
  'Valeriana',
]

// A small illustrative Province → City/Municipality → Barangay tree for the
// TODA/driver/passenger/parent registration address picker — NOT the full
// PSGC registry, just enough real-shaped sample data to demo a cascading
// address select. Reuses the same barangay names already seeded elsewhere in
// this app (Poblacion, San Isidro, San Roque) so the world stays consistent.
export const PH_ADDRESS_TREE: Record<string, Record<string, string[]>> = {
  // Default province for every address form in the app (see
  // PhAddressFields' EMPTY_PH_ADDRESS) — listed first, and Nueva Ecija's
  // full real set of 5 cities + 27 municipalities is filled in (unlike the
  // other provinces below, which only sample a couple of cities each) so
  // the City/Municipality dropdown is actually complete once the province
  // defaults here. Every Nueva Ecija city/municipality below now has its own
  // real, individually-verified barangay list (see the named *_BARANGAYS
  // constants above, each with its sourcing noted). San Jose City and
  // Science City of Muñoz are listed first (object key order = the
  // dropdown's display order) since they're this app's two default booking
  // cities — see DEFAULT_BOOKING_CITY and the CLSU-first barangay ordering
  // in SCIENCE_CITY_MUNOZ_BARANGAYS below.
  'Nueva Ecija': {
    'San Jose City': SAN_JOSE_CITY_BARANGAYS,
    'Science City of Muñoz': SCIENCE_CITY_MUNOZ_BARANGAYS,
    'Cabanatuan City': CABANATUAN_CITY_BARANGAYS,
    'Gapan City': GAPAN_CITY_BARANGAYS,
    'Palayan City': PALAYAN_CITY_BARANGAYS,
    Aliaga: ALIAGA_BARANGAYS,
    Bongabon: BONGABON_BARANGAYS,
    Cabiao: CABIAO_BARANGAYS,
    Carranglan: CARRANGLAN_BARANGAYS,
    Cuyapo: CUYAPO_BARANGAYS,
    Gabaldon: GABALDON_BARANGAYS,
    'General Mamerto Natividad': GENERAL_MAMERTO_NATIVIDAD_BARANGAYS,
    'General Tinio': GENERAL_TINIO_BARANGAYS,
    Guimba: GUIMBA_BARANGAYS,
    Jaen: JAEN_BARANGAYS,
    Laur: LAUR_BARANGAYS,
    Licab: LICAB_BARANGAYS,
    Llanera: LLANERA_BARANGAYS,
    Lupao: LUPAO_BARANGAYS,
    Nampicuan: NAMPICUAN_BARANGAYS,
    Pantabangan: PANTABANGAN_BARANGAYS,
    Peñaranda: PENARANDA_BARANGAYS,
    Quezon: QUEZON_BARANGAYS,
    Rizal: RIZAL_BARANGAYS,
    'San Antonio': SAN_ANTONIO_BARANGAYS,
    'San Isidro': SAN_ISIDRO_BARANGAYS,
    'San Leonardo': SAN_LEONARDO_BARANGAYS,
    'Santa Rosa': SANTA_ROSA_BARANGAYS,
    'Santo Domingo': SANTO_DOMINGO_BARANGAYS,
    Talavera: TALAVERA_BARANGAYS,
    Talugtug: TALUGTUG_BARANGAYS,
    Zaragoza: ZARAGOZA_BARANGAYS,
  },
  Batangas: {
    'San Juan': ['Poblacion', 'San Isidro', 'San Roque', 'Sto. Niño', 'Bagong Silang'],
    Rosario: ['Barangay 1', 'Barangay 2', 'Barangay 3', 'Barangay Bagong Pook'],
  },
  Cavite: {
    Tagaytay: ['Barangay Kaybagal', 'Barangay Sungay', 'Barangay Maitim'],
  },
  Laguna: {
    'Sta. Cruz': ['Barangay Poblacion', 'Barangay Bubukal', 'Barangay Duhat'],
  },
}

export const PH_PROVINCES = Object.keys(PH_ADDRESS_TREE)

export function getCitiesForProvince(province: string): string[] {
  return Object.keys(PH_ADDRESS_TREE[province] ?? {})
}

export function getBarangaysForCity(province: string, city: string): string[] {
  return PH_ADDRESS_TREE[province]?.[city] ?? []
}

// App Admin isn't self-service (unlike Passenger/Parent/Driver, nobody
// signs up as Admin) — this prototype has exactly one operator account,
// provisioned here instead of through a registration flow. Shown directly
// on the login screen since there's no other way to discover it in a demo.
export const APP_ADMIN_CREDENTIALS = { username: 'admin', password: 'admin123' }

// A second accepted identity for the same single App Admin/Super Admin
// role — lets the operator log in with their real email instead of the
// generic 'admin' username, same password (this whole panel is already
// shown as a plaintext demo credential above, so this doesn't weaken
// anything). Not a separate account/permission tier — it's the same
// role='admin' session either way.
export const APP_SUPER_ADMIN_EMAIL = 'cmmacalinao@gmail.com'

// A second, separate credential gating the Accounting & Compliance panel —
// deliberately independent of APP_ADMIN_CREDENTIALS so that "can operate
// the platform" and "can see income/expense records" are different
// permissions, matching how a real TODA/cooperative would restrict its
// books to a treasurer/finance officer rather than every admin user. Shown
// on the lock screen since, like the admin login above, there's no other
// way to discover it in a demo.
export const ACCOUNTING_OFFICER_CREDENTIALS = { password: 'finance2026' }

// Seed roster for the Accounting & Compliance allowlist — who's registered
// to unlock that page (see AccountingOfficer in types). Only these emails
// (case-insensitive) pass the lock screen; the App Admin adds/removes
// officers from the main Admin dashboard, not from inside the restricted
// page itself.
export const MOCK_ACCOUNTING_OFFICERS: AccountingOfficer[] = [
  {
    id: 'officer-1',
    name: 'Celeste M.',
    email: 'celeste.president@todaride.ph',
    position: 'President',
    otherPositionLabel: null,
    addedAt: '2026-01-05T00:00:00.000Z',
  },
  {
    id: 'officer-2',
    name: 'Elena D.',
    email: 'elena.treasurer@todaride.ph',
    position: 'Treasurer',
    otherPositionLabel: null,
    addedAt: '2026-01-05T00:00:00.000Z',
  },
]

// Seed cap table — the proposed corporate structure as configurable data,
// not hard-coded logic (see EquityAllocation in types). Founder/Investors/
// Developers/Strategic/Future pools sum to 100%; percentages and holder
// names are editable from the Cap Table section, same restricted-page
// pattern as the rest of Accounting & Compliance. Illustrative starting
// point only — not a substitute for actual corporate/legal documentation.
export const MOCK_EQUITY_ALLOCATIONS: EquityAllocation[] = [
  {
    id: 'equity-1',
    holderName: 'Cesar Macalinao',
    category: 'Founder',
    otherCategoryLabel: null,
    percentage: 35,
    notes: 'Founder & Main Developer — contribution-based (concept, software, IP, leadership), not a cash requirement.',
    addedAt: '2026-01-05T00:00:00.000Z',
  },
  {
    id: 'equity-2',
    holderName: 'Investor Pool',
    category: 'Investors',
    otherCategoryLabel: null,
    percentage: 30,
    notes: 'Reserved pool — allocated per investment round as investors join.',
    addedAt: '2026-01-05T00:00:00.000Z',
  },
  {
    id: 'equity-3',
    holderName: 'Developers & Key Personnel Pool',
    category: 'Developers & Key Personnel',
    otherCategoryLabel: null,
    percentage: 15,
    notes: 'Reserved pool — allocated per person with vesting, not issued automatically.',
    addedAt: '2026-01-05T00:00:00.000Z',
  },
  {
    id: 'equity-4',
    holderName: 'Strategic / Community Partner Pool',
    category: 'Strategic / Community Pool',
    otherCategoryLabel: null,
    percentage: 10,
    notes: 'Reserved — not automatically issued to any partner.',
    addedAt: '2026-01-05T00:00:00.000Z',
  },
  {
    id: 'equity-5',
    holderName: 'Future Investor / Employee Pool',
    category: 'Future Investor / Employee Pool',
    otherCategoryLabel: null,
    percentage: 10,
    notes: 'Reserved for future investors, executives, or key hires.',
    addedAt: '2026-01-05T00:00:00.000Z',
  },
]

// Deliberately blank/zero — this is real legal filing data (SEC Articles of
// Incorporation / General Information Sheet figures) that must come from an
// actual registration, never a placeholder guess. Filled in from the
// Capitalization & Stockholding page once the company is actually
// registered.
export const DEFAULT_CORPORATE_REGISTRATION: CorporateRegistrationInfo = {
  companyName: '',
  secRegistrationNo: '',
  registrationDate: null,
  tin: '',
  principalOfficeAddress: '',
  primaryPurpose: '',
  corporateTermYears: null,
  authorizedCapitalStock: 0,
  parValuePerShare: 0,
  numberOfSharesAuthorized: 0,
  subscribedCapitalStock: 0,
  paidUpCapitalStock: 0,
  treasurerInTrust: null,
  updatedAt: null,
}

// Starting TODARIDE COINS amounts per earning action — Admin-configurable
// via setRewardRules (Income & Promotion → Rewards tab).
export const DEFAULT_REWARD_RULES: RewardRules = {
  registration: 50,
  verification: 25,
  ride: 5,
  rating: 5,
  review: 10,
  referral: 100,
  socialShare: 10,
  safety: 15,
  campaign: 20,
}

// Coin → ride-credit conversion tiers — admin-configurable list, not fixed
// math (see RideCreditTier). These are the brief's own example tiers.
export const DEFAULT_RIDE_CREDIT_TIERS: RideCreditTier[] = [
  { id: 'credit-tier-1', coins: 100, pesoValue: 5 },
  { id: 'credit-tier-2', coins: 200, pesoValue: 10 },
  { id: 'credit-tier-3', coins: 500, pesoValue: 25 },
]

export const DEFAULT_INCOME_PROMOTION_SETTINGS: IncomePromotionSettings = {
  theoreticalCommissionRatePct: 7.5,
  coinExpirationDays: null,
  fraudReferralThreshold: 5,
  defaultCampaignDailyLimit: null,
  defaultCampaignWeeklyLimit: null,
  defaultCampaignMonthlyLimit: null,
}

// A single starter advertiser + campaign so the header ad banner (see
// AdBanner.tsx) has something real to show out of the box, instead of an
// empty header or a hardcoded string outside the actual Advertiser/Campaign
// data model. Admin can edit or delete this from Income & Promotion →
// Advertisers/Campaigns like any other record — it's real seed data, not a
// separate hardcoded demo.
export const MOCK_ADVERTISERS: Advertiser[] = [
  {
    id: 'advertiser-sample-1',
    businessName: "Ka-Load Padala Center",
    category: 'Load, Bills Payment & Padala',
    province: 'Nueva Ecija',
    city: 'San Jose City',
    barangay: 'Crisanto Sanchez Poblacion',
    addressDetail: 'Beside the Public Market Terminal',
    contactName: 'Julie Santos',
    contactPhone: '0917-555-0001',
    contactEmail: null,
    plan: 'standard',
    monthlyValue: 800,
    status: 'active',
    joinedAt: '2026-01-05T00:00:00.000Z',
    notes: 'Sample advertiser, shown in the header ad banner as a working demo.',
  },
]

export const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: 'campaign-sample-1',
    name: 'Ka-Load Padala Center — Grand Opening',
    description: 'Load, bills payment, and padala — right beside the Terminal. Fast and reliable, para sa drivers at pasahero!',
    type: 'merchant_promotion',
    targetAudience: 'public',
    startDate: '2026-01-05',
    endDate: null,
    rewardCoins: 0,
    rewardNote: null,
    budget: 800,
    dailyLimit: null,
    weeklyLimit: null,
    monthlyLimit: null,
    status: 'active',
    advertiserId: 'advertiser-sample-1',
    reach: 0,
    clicks: 0,
    shares: 0,
    participants: 0,
    createdAt: '2026-01-05T00:00:00.000Z',
    updatedAt: null,
  },
]

// Off by default — see AdSenseSettings in types/index.ts. Admin pastes in a
// real Publisher ID + slot IDs from an actual AdSense account under
// Income & Promotion → Settings to turn this on; nothing here fabricates
// working credentials.
export const DEFAULT_ADSENSE_SETTINGS: AdSenseSettings = {
  enabled: false,
  publisherId: null,
  slots: {
    landing: null,
    passengerTop: null,
    passengerBottom: null,
    driverTop: null,
    driverBottom: null,
    parentBottom: null,
  },
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  driver_incentives: 'Driver incentives',
  fuel_subsidy: 'Fuel subsidy',
  maintenance: 'Vehicle & equipment maintenance',
  marketing: 'Marketing & promotions',
  sms_api_fees: 'SMS / API / hosting fees',
  office_admin: 'Office & admin supplies',
  salaries: 'Staff salaries',
  permits_fees: 'Permits, licenses & government fees',
  other: 'Other',
}

export const TODA_EXPENSE_CATEGORY_LABELS: Record<TodaExpenseCategory, string> = {
  fuel_subsidy: 'Fuel subsidy',
  terminal_maintenance: 'Terminal maintenance',
  event: 'Fiesta / event',
  officer_honorarium: 'Officer honorarium',
  office_admin: 'Office & admin supplies',
  other: 'Other',
}

// A starting checklist of Philippine compliance items relevant to running a
// tricycle-dispatch platform as an actual registered business — not legal
// advice, just the common obligations an operator would otherwise have to
// piece together from several agencies. Admin can check items off as
// they're completed; the list itself is fixed (add new items here as
// requirements change, rather than making it admin-editable).
export interface ComplianceChecklistItem {
  id: string
  label: string
  detail: string
}

export const COMPLIANCE_CHECKLIST: ComplianceChecklistItem[] = [
  {
    id: 'dti-sec',
    label: 'DTI (sole proprietor) or SEC (partnership/corporation) registration',
    detail: 'Registers the business name itself — the prerequisite for every other registration below.',
  },
  {
    id: 'lgu-permit',
    label: "Mayor's / Business Permit from the LGU",
    detail: 'Renewed annually with the city/municipality where the business operates.',
  },
  {
    id: 'bir-cor',
    label: 'BIR Certificate of Registration (Form 2303) + registered Books of Accounts',
    detail: 'Required before legally issuing any receipt or filing any tax return.',
  },
  {
    id: 'bir-receipts',
    label: 'BIR-registered official receipts/invoices for platform fees collected',
    detail: 'Commission and service fees collected from drivers/riders should be receipted, not informal.',
  },
  {
    id: 'bir-filing',
    label: 'Percentage tax or VAT registration, filed monthly/quarterly as required',
    detail: 'Which one applies depends on gross annual receipts — confirm the threshold with BIR or an accountant.',
  },
  {
    id: 'bir-annual',
    label: 'Annual Income Tax Return filing',
    detail: 'Due the following tax year on gross income minus allowable deductions (including logged expenses).',
  },
  {
    id: 'ltfrb-toda',
    label: 'LTFRB/LGU franchise or accreditation for TODA tricycle operation',
    detail: "Confirms the app's dispatched trips are covered by each TODA's actual franchise, not just the app's own terms.",
  },
  {
    id: 'data-privacy',
    label: 'Data Privacy Act compliance / NPC registration',
    detail: 'The app collects GPS location, driver IDs/licenses, and contact info — registrable personal data processing.',
  },
  {
    id: 'sss-philhealth',
    label: 'SSS, PhilHealth, Pag-IBIG registration & remittance for actual employees',
    detail: 'Applies to hired staff (dispatchers, admins) — independent drivers are a separate classification question.',
  },
  {
    id: 'toda-agreements',
    label: 'Written agreements with each TODA on commission/revenue-sharing terms',
    detail: "Matches what's configured in the TODA commission approvals above — put it in writing too, not just in-app.",
  },
  {
    id: 'insurance',
    label: 'Passenger/third-party liability insurance coverage',
    detail: 'Standard practice for any passenger transport service, independent of individual driver insurance.',
  },
  {
    id: 'reconciliation',
    label: 'Regular reconciliation of driver payouts vs. platform revenue vs. TODA commissions',
    detail: 'Bookkeeping hygiene — cross-check the income breakdown chart against actual bank/e-wallet movements periodically.',
  },
]

// TaaS Level 1 — SaaS Partner pricing tiers, per the TODASafeRide-as-a-Service
// business roadmap (Starter ₱2,500/mo, Standard ₱5,000/mo, Premium ₱8,000-
// 10,000/mo — using the midpoint here). Used both to seed new TodaOrganizations
// and by AdminPage.tsx's plan-change control.
export const SAAS_PLAN_FEES: Record<SaasPlan, number> = {
  starter: 2500,
  standard: 5000,
  premium: 9000,
}

export const MOCK_TODA_ORGANIZATIONS: TodaOrganization[] = [
  {
    id: 'toda-poblacion',
    name: 'Poblacion TODA',
    terminalLocationId: 'loc-terminal',
    proposedCommissionPerRide: null,
    commissionApprovedByMembers: false,
    commissionApprovedByAdmin: false,
    adminPin: '1010',
    officers: [
      { name: 'Ramon Villanueva', role: 'President' },
      { name: 'Betty Ocampo', role: 'Secretary' },
    ],
    province: 'Nueva Ecija',
    city: 'San Jose City',
    barangay: 'Crisanto Sanchez Poblacion',
    addressDetail: 'Public Market Terminal, Zone 1',
    terminalGps: null,
    verificationStatus: 'approved',
    registrationNote: null,
    registrationNoteDeadline: null,
    rating: 4.7,
    ratingCount: 28,
    saasPlan: 'starter',
    monthlyPlatformFee: SAAS_PLAN_FEES.starter,
    perBookingFee: 0,
    operatorId: null,
  },
  {
    id: 'toda-sanisidro',
    name: 'San Isidro TODA',
    terminalLocationId: 'loc-home-2',
    proposedCommissionPerRide: null,
    commissionApprovedByMembers: false,
    commissionApprovedByAdmin: false,
    adminPin: '2020',
    officers: [
      { name: 'Elena Fernandez', role: 'President' },
      { name: 'Jun Torres', role: 'Secretary' },
    ],
    province: 'Nueva Ecija',
    city: 'San Jose City',
    barangay: 'San Agustin',
    addressDetail: 'Purok 3 Terminal',
    terminalGps: null,
    verificationStatus: 'approved',
    registrationNote: null,
    registrationNoteDeadline: null,
    rating: 4.8,
    ratingCount: 41,
    saasPlan: 'starter',
    monthlyPlatformFee: SAAS_PLAN_FEES.starter,
    perBookingFee: 0,
    operatorId: null,
  },
  {
    id: 'toda-sanroque',
    name: 'San Roque TODA',
    terminalLocationId: 'loc-church',
    proposedCommissionPerRide: null,
    commissionApprovedByMembers: false,
    commissionApprovedByAdmin: false,
    adminPin: '3030',
    officers: [
      { name: 'Lito Cruz', role: 'President' },
      { name: 'Maria Santos', role: 'Secretary' },
    ],
    province: 'Nueva Ecija',
    city: 'San Jose City',
    barangay: 'San Juan',
    addressDetail: 'San Juan Parish Church grounds',
    terminalGps: null,
    verificationStatus: 'approved',
    registrationNote: null,
    registrationNoteDeadline: null,
    rating: 4.5,
    ratingCount: 15,
    saasPlan: 'starter',
    monthlyPlatformFee: SAAS_PLAN_FEES.starter,
    perBookingFee: 0,
    operatorId: null,
  },
  {
    id: 'toda-clsu',
    name: 'CLSU TODA',
    // Not part of the legacy grid-based priority-dispatch system (same as
    // any newly self-registered org) — relies on terminalGps below instead.
    terminalLocationId: null,
    proposedCommissionPerRide: null,
    commissionApprovedByMembers: false,
    commissionApprovedByAdmin: false,
    adminPin: '4040',
    officers: [
      { name: 'Rodel Pineda', role: 'President' },
      { name: 'Grace Manalo', role: 'Secretary' },
    ],
    province: 'Nueva Ecija',
    city: 'Science City of Muñoz',
    barangay: 'CLSU',
    addressDetail: 'Near the CLSU Main Gate',
    terminalGps: CLSU_GPS,
    verificationStatus: 'approved',
    registrationNote: null,
    registrationNoteDeadline: null,
    rating: 4.6,
    ratingCount: 0,
    saasPlan: 'standard',
    monthlyPlatformFee: SAAS_PLAN_FEES.standard,
    perBookingFee: 2,
    operatorId: 'op-nueva-ecija-north',
  },
]

// TaaS Level 2 — one seed "Authorized Operator" so the full 3-level chain
// (Franchise → Operator → TODA) is demoable without any manual setup: CLSU
// TODA above reports to this Operator, which itself reports to the seed
// Franchise below.
export const MOCK_OPERATORS: Operator[] = [
  {
    id: 'op-nueva-ecija-north',
    name: 'Nueva Ecija North Operator',
    contactPerson: 'Ramon dela Cruz',
    contactPhone: '09171234567',
    adminPin: '5050',
    province: 'Nueva Ecija',
    city: 'Science City of Muñoz',
    email: 'ramon@nuevaecijanorth.ph',
    barangay: 'CLSU',
    addressDetail: 'Unit 2B, Muñoz Commercial Complex',
    businessRegistrationNo: 'DTI-2024-00512',
    activationFee: 45000,
    monthlyPlatformFee: 8000,
    perBookingFee: 2,
    franchiseId: 'fr-nueva-ecija',
    verificationStatus: 'approved',
    registrationNote: null,
  },
]

// TaaS Level 3 — one seed Franchise (territory), pre-approved so its fee
// schedule and Operator roster are visible immediately.
export const MOCK_FRANCHISES: Franchise[] = [
  {
    id: 'fr-nueva-ecija',
    name: 'Nueva Ecija Franchise',
    contactPerson: 'Celeste Macalinao',
    contactPhone: '09181234567',
    adminPin: '6060',
    province: 'Nueva Ecija',
    city: 'San Jose City',
    email: 'celeste@nuevaecijafranchise.ph',
    barangay: 'Crisanto Sanchez Poblacion',
    addressDetail: '2nd Floor, San Jose City Business Center',
    businessRegistrationNo: 'SEC-2024-001234',
    initialFranchiseFee: 150000,
    monthlyTechnologyFee: 10000,
    royaltyPct: 5,
    verificationStatus: 'approved',
    registrationNote: null,
  },
]

// Live-computed B2B billing estimate for a TODA's Level-1 SaaS subscription —
// never wired into the ride-fare split (see Payment/COMPLETE_RIDE), purely
// informational for TodaAdminPage's "My Subscription" section.
export function estimatedMonthlyTodaFee(org: TodaOrganization, drivers: Driver[], rides: Ride[]): number {
  if (org.perBookingFee <= 0) return org.monthlyPlatformFee
  const memberIds = new Set(drivers.filter((d) => d.todaOrgId === org.id).map((d) => d.id))
  return org.monthlyPlatformFee + org.perBookingFee * countCompletedRidesThisMonth(rides, memberIds)
}

// Same idea one level up — rolls up every TodaOrganization reporting to this
// Operator, not just the Operator's own direct bookings.
export function estimatedMonthlyOperatorFee(
  operator: Operator,
  todaOrgs: TodaOrganization[],
  drivers: Driver[],
  rides: Ride[],
): number {
  if (operator.perBookingFee <= 0) return operator.monthlyPlatformFee
  const orgIds = new Set(todaOrgs.filter((o) => o.operatorId === operator.id).map((o) => o.id))
  const memberIds = new Set(drivers.filter((d) => d.todaOrgId && orgIds.has(d.todaOrgId)).map((d) => d.id))
  return operator.monthlyPlatformFee + operator.perBookingFee * countCompletedRidesThisMonth(rides, memberIds)
}

function countCompletedRidesThisMonth(rides: Ride[], driverIds: Set<string>): number {
  const now = new Date()
  return rides.filter((r) => {
    if (r.status !== 'completed' || !r.completedAt || !r.driverId || !driverIds.has(r.driverId)) return false
    const completed = new Date(r.completedAt)
    return completed.getMonth() === now.getMonth() && completed.getFullYear() === now.getFullYear()
  }).length
}

// "Income status" for a Level-2/3 dashboard — an all-time rollup of the
// actual ride activity happening across the org's portfolio (their TODAs'
// drivers), NOT their own B2B subscription bill (see estimatedMonthly*Fee
// above, which is the opposite direction of money). Gross fares/driver
// payouts/TODA commissions here are read straight off each completed ride's
// stored Payment — never recomputed — so this always matches what actually
// happened, including rides completed before any fee/plan change.
export interface PortfolioStats {
  todaCount: number
  driverCount: number
  completedRides: number
  grossFares: number
  driverPayouts: number
  todaCommissions: number
}

function summarizePortfolio(driverIds: Set<string>, todaCount: number, rides: Ride[]): PortfolioStats {
  const completed = rides.filter((r) => r.status === 'completed' && r.driverId && driverIds.has(r.driverId) && r.payment)
  return {
    todaCount,
    driverCount: driverIds.size,
    completedRides: completed.length,
    grossFares: completed.reduce((sum, r) => sum + (r.payment?.amount ?? 0), 0),
    driverPayouts: completed.reduce((sum, r) => sum + (r.payment?.driverPayout ?? 0), 0),
    todaCommissions: completed.reduce((sum, r) => sum + (r.payment?.todaCommission ?? 0), 0),
  }
}

export function operatorPortfolioStats(operator: Operator, todaOrgs: TodaOrganization[], drivers: Driver[], rides: Ride[]): PortfolioStats {
  const orgIds = new Set(todaOrgs.filter((o) => o.operatorId === operator.id).map((o) => o.id))
  const driverIds = new Set(drivers.filter((d) => d.todaOrgId && orgIds.has(d.todaOrgId)).map((d) => d.id))
  return summarizePortfolio(driverIds, orgIds.size, rides)
}

export function franchisePortfolioStats(
  franchise: Franchise,
  operators: Operator[],
  todaOrgs: TodaOrganization[],
  drivers: Driver[],
  rides: Ride[],
): PortfolioStats & { operatorCount: number } {
  const operatorIds = new Set(operators.filter((o) => o.franchiseId === franchise.id).map((o) => o.id))
  const orgIds = new Set(todaOrgs.filter((o) => o.operatorId && operatorIds.has(o.operatorId)).map((o) => o.id))
  const driverIds = new Set(drivers.filter((d) => d.todaOrgId && orgIds.has(d.todaOrgId)).map((d) => d.id))
  return { ...summarizePortfolio(driverIds, orgIds.size, rides), operatorCount: operatorIds.size }
}

// A TODA's own per-ride commission only actually applies once both the
// members (simulated) and the App Admin have signed off on it.
export function getActiveTodaCommission(org: TodaOrganization | undefined | null): number {
  if (!org || org.proposedCommissionPerRide === null) return 0
  if (!org.commissionApprovedByMembers || !org.commissionApprovedByAdmin) return 0
  return org.proposedCommissionPerRide
}

// Which TODA has dispatch priority for a given pickup point: whichever
// org's terminal is geographically closest to that pickup.
export function getPriorityTodaOrgId(pickup: MockLocation): string | null {
  let closest: TodaOrganization | null = null
  let closestDist = Infinity
  for (const org of MOCK_TODA_ORGANIZATIONS) {
    const terminal = MOCK_LOCATIONS.find((l) => l.id === org.terminalLocationId)
    if (!terminal) continue
    const dist = Math.hypot(pickup.coords.x - terminal.coords.x, pickup.coords.y - terminal.coords.y)
    if (dist < closestDist) {
      closestDist = dist
      closest = org
    }
  }
  return closest?.id ?? null
}

// Used when a driver skips picking their TODA at registration — Philippine
// TODAs are conventionally tied to a single barangay, so matching the
// driver's own registered address to an approved org's address is enough to
// auto-fill the right one without making them search. Falls back to null
// (freelance) when no org's address matches exactly.
export function autoDetectTodaOrgId(
  orgs: TodaOrganization[],
  address: { province: string; city: string; barangay: string },
): string | null {
  const match = orgs.find(
    (o) =>
      o.verificationStatus === 'approved' &&
      o.province === address.province &&
      o.city === address.city &&
      o.barangay === address.barangay,
  )
  return match?.id ?? null
}

// The ordered terminal queue for a TODA: approved members who have
// currently "registered" (joined) the queue, oldest join first — mirrors
// how a real terminal line works, first come first served.
export function getTodaQueue(todaOrgId: string, drivers: Driver[]): Driver[] {
  return drivers
    .filter(
      (d) =>
        d.todaOrgId === todaOrgId &&
        d.verificationStatus === 'approved' &&
        d.accessStatus === 'active' &&
        d.queueJoinedAt !== null,
    )
    .sort((a, b) => new Date(a.queueJoinedAt!).getTime() - new Date(b.queueJoinedAt!).getTime())
}

// Purely a display check — never mutates state on its own. An "approve as
// noted" deadline that has passed just means the queue should show this
// application as needing rejection; the actual reject is still an explicit
// admin click, same as everywhere else in this app.
export function isPastDeadline(deadline: string | null): boolean {
  return deadline !== null && Date.now() > new Date(deadline).getTime()
}

export const MOCK_DRIVERS: Driver[] = [
  {
    id: 'drv-1',
    name: 'Mang Ramon',
    plateNumber: 'TRC-1023',
    licenseNo: 'DL-4471-2021',
    licenseExpiry: '2028-03-15',
    pin: '1111',
    rating: 4.8,
    ratingCount: 34,
    online: true,
    verificationStatus: 'approved',
    documents: submittedDocs(),
    todaOrgId: 'toda-poblacion',
    province: 'Nueva Ecija',
    city: 'San Jose City',
    barangay: 'Crisanto Sanchez Poblacion',
    addressDetail: 'Purok 2',
    phone: '0917-100-1001',
    email: null,
    facebook: null,
    queueJoinedAt: null,
    pabiliPriority: false,
    accessStatus: 'active',
    accessNote: null,
    pendingNote: null,
    pendingNoteDeadline: null,
    rejectionReason: null,
    appealMessage: null,
    appealedAt: null,
  },
  {
    id: 'drv-2',
    name: 'Aling Betty',
    plateNumber: 'TRC-0451',
    licenseNo: 'DL-2290-2019',
    licenseExpiry: '2027-11-02',
    pin: '2222',
    rating: 4.9,
    ratingCount: 51,
    online: true,
    verificationStatus: 'approved',
    documents: submittedDocs(),
    todaOrgId: 'toda-sanisidro',
    province: 'Nueva Ecija',
    city: 'San Jose City',
    barangay: 'San Agustin',
    addressDetail: 'Purok 3',
    phone: '0917-100-1002',
    email: null,
    facebook: null,
    queueJoinedAt: null,
    pabiliPriority: false,
    accessStatus: 'active',
    accessNote: null,
    pendingNote: null,
    pendingNoteDeadline: null,
    rejectionReason: null,
    appealMessage: null,
    appealedAt: null,
  },
  {
    id: 'drv-3',
    name: 'Kuya Jun',
    plateNumber: 'TRC-2210',
    licenseNo: 'DL-8834-2022',
    licenseExpiry: '2029-06-20',
    pin: '3333',
    rating: 4.6,
    ratingCount: 19,
    online: true,
    verificationStatus: 'approved',
    documents: submittedDocs(),
    todaOrgId: null,
    province: 'Nueva Ecija',
    city: 'San Jose City',
    barangay: 'Manicla',
    addressDetail: 'Sitio Maligaya',
    phone: '0917-100-1003',
    email: null,
    facebook: null,
    queueJoinedAt: null,
    pabiliPriority: false,
    accessStatus: 'active',
    accessNote: null,
    pendingNote: null,
    pendingNoteDeadline: null,
    rejectionReason: null,
    appealMessage: null,
    appealedAt: null,
  },
  {
    id: 'drv-4',
    name: 'Tonyo Reyes',
    plateNumber: 'TRC-3391',
    licenseNo: 'DL-5512-2026',
    licenseExpiry: '2030-01-10',
    pin: '4444',
    rating: 0,
    ratingCount: 0,
    online: false,
    verificationStatus: 'pending',
    documents: submittedDocs(),
    todaOrgId: 'toda-poblacion',
    province: 'Nueva Ecija',
    city: 'San Jose City',
    barangay: 'Crisanto Sanchez Poblacion',
    addressDetail: 'Purok 5',
    phone: '0917-100-1004',
    email: null,
    facebook: null,
    queueJoinedAt: null,
    pabiliPriority: false,
    accessStatus: 'active',
    accessNote: null,
    pendingNote: null,
    pendingNoteDeadline: null,
    rejectionReason: null,
    appealMessage: null,
    appealedAt: null,
  },
  {
    id: 'drv-5',
    name: 'Lito Cruz',
    plateNumber: 'TRC-4487',
    licenseNo: 'DL-6603-2026',
    licenseExpiry: '2029-09-05',
    pin: '5555',
    rating: 0,
    ratingCount: 0,
    online: false,
    verificationStatus: 'pending',
    documents: submittedDocs(),
    todaOrgId: 'toda-sanroque',
    province: 'Nueva Ecija',
    city: 'San Jose City',
    barangay: 'San Juan',
    addressDetail: 'Zone 4',
    phone: '0917-100-1005',
    email: null,
    facebook: null,
    queueJoinedAt: null,
    pabiliPriority: false,
    accessStatus: 'active',
    accessNote: null,
    pendingNote: null,
    pendingNoteDeadline: null,
    rejectionReason: null,
    appealMessage: null,
    appealedAt: null,
  },
]

export const MOCK_PASSENGERS: Passenger[] = [
  {
    id: 'pax-1',
    name: 'Celeste M.',
    age: 28,
    isStudent: false,
    isPwdSenior: false,
    phone: '0917-200-2001',
    email: null,
    pin: '2001',
    province: 'Nueva Ecija',
    city: 'San Jose City',
    barangay: 'Crisanto Sanchez Poblacion',
    addressDetail: 'Sitio Maligaya',
    guardianPhone: '0917-400-4001',
    favoriteDriverId: null,
    savedLocations: [],
  },
  {
    id: 'pax-2',
    name: 'Miguel D. (Student)',
    age: 15,
    isStudent: true,
    isPwdSenior: false,
    phone: '0917-200-2002',
    email: null,
    // Minor registered through a Parent account — doesn't log in on their
    // own, so no PIN of their own.
    pin: null,
    province: 'Nueva Ecija',
    city: 'San Jose City',
    barangay: 'San Agustin',
    addressDetail: 'Purok 3',
    guardianPhone: null,
    favoriteDriverId: null,
    savedLocations: [],
  },
  {
    id: 'pax-3',
    name: 'Lola Nena (Senior)',
    age: 68,
    isStudent: false,
    isPwdSenior: true,
    phone: '0917-200-2003',
    email: null,
    pin: '2003',
    province: 'Nueva Ecija',
    city: 'San Jose City',
    barangay: 'Crisanto Sanchez Poblacion',
    addressDetail: 'Sitio Maligaya',
    guardianPhone: null,
    favoriteDriverId: null,
    savedLocations: [],
  },
  {
    id: 'pax-4',
    name: 'Ces Macalinao',
    age: 30,
    isStudent: false,
    isPwdSenior: false,
    phone: '0929-805-2527',
    email: 'cmmacalinao@gmail.com',
    pin: '2527',
    province: 'Nueva Ecija',
    city: 'San Jose City',
    barangay: 'Crisanto Sanchez Poblacion',
    addressDetail: 'Sitio Maligaya',
    guardianPhone: null,
    favoriteDriverId: null,
    savedLocations: [],
  },
  {
    id: 'pax-5',
    name: 'Elito Circa',
    age: 30,
    isStudent: false,
    isPwdSenior: false,
    phone: '0927-973-3887',
    email: null,
    pin: '3887',
    province: 'Nueva Ecija',
    city: 'San Jose City',
    barangay: 'Crisanto Sanchez Poblacion',
    addressDetail: 'Sitio Maligaya',
    guardianPhone: null,
    favoriteDriverId: null,
    savedLocations: [],
  },
]

export const MOCK_PARENTS: Parent[] = [
  {
    id: 'parent-1',
    name: 'Elena D.',
    phone: '0917-300-3001',
    email: null,
    pin: '3001',
    province: 'Nueva Ecija',
    city: 'San Jose City',
    barangay: 'San Agustin',
    addressDetail: 'Purok 3',
    favoriteDriverId: null,
  },
]

export const MOCK_PARENT_LINKS: ParentLink[] = [
  {
    parentId: 'parent-1',
    studentPassengerId: 'pax-2',
    relationship: 'Mother',
    consentGiven: true,
    proofOfAuthorityDataUrl: null,
    consentedAt: '2026-01-05T00:00:00.000Z',
  },
]

export const MINOR_AGE_LIMIT = 18

// Real, commonly-found Philippine pharmacy chains — offered as a picker for
// "Buy Medicine" bookings instead of a single auto-resolved "Pharmacy" pin,
// so the passenger controls which branch the driver actually goes to. Each
// name is geocoded live per the passenger's own city (see
// resolveNearbyPharmacy in lib/customLocation.ts) rather than using a fixed
// coordinate, since which branches exist — and where — varies by town.
export const PHARMACY_CHAINS = [
  'Mercury Drug',
  'Watsons',
  'Rose Pharmacy',
  'Southstar Drug',
  'The Generics Pharmacy',
  'Generika Drugstore',
] as const

// TODARIDE MEDS seed pharmacies — every one ships pre-approved
// (verificationStatus: 'approved') since this MVP pass has no Admin
// approval UI yet (see the Pharmacy type comment). Locations sit near
// already-verified real landmarks in this file (San Jose City's public
// market/cathedral area, and CLSU_GPS in Muñoz) rather than fresh
// unverified coordinates — same "anchor near something real" approach used
// for loc-public-market-sjc above. adminPin is each pharmacy's own portal
// login credential, mirroring TodaOrganization.adminPin.
export const MOCK_PHARMACIES: Pharmacy[] = [
  {
    id: 'pharm-1',
    name: 'Mercury Drug — San Jose Poblacion',
    businessType: 'pharmacy',
    adminPin: '1111',
    contactPhone: '0917-500-1001',
    province: 'Nueva Ecija',
    city: 'San Jose City',
    barangay: 'Rafael Rueda, Sr. Poblacion',
    addressDetail: 'Maharlika Highway, near the public market',
    coords: { x: 62, y: 65 },
    locationGps: { lat: 15.79241, lng: 120.98965 },
    isOpen: true,
    verificationStatus: 'approved',
    gcashAccount: { accountName: 'Mercury Drug SJC Branch', accountNumber: '0917-500-1001', qrDataUrl: null },
    mayaAccount: null,
  },
  {
    id: 'pharm-2',
    name: 'Watsons — Town Center',
    businessType: 'pharmacy',
    adminPin: '2222',
    contactPhone: '0917-500-1002',
    province: 'Nueva Ecija',
    city: 'San Jose City',
    barangay: 'Manicla',
    addressDetail: 'Town Center Mall',
    coords: { x: 22, y: 98 },
    locationGps: { lat: 15.8296, lng: 120.9605 },
    isOpen: true,
    verificationStatus: 'approved',
    gcashAccount: null,
    mayaAccount: null,
  },
  {
    id: 'pharm-7',
    name: 'Rose Pharmacy — San Jose City',
    businessType: 'pharmacy',
    adminPin: '7777',
    contactPhone: '0917-500-1007',
    province: 'Nueva Ecija',
    city: 'San Jose City',
    barangay: 'Abar 1st',
    addressDetail: 'Along Maharlika Highway, near the terminal',
    coords: { x: 58, y: 60 },
    locationGps: { lat: 15.8012, lng: 120.9838 },
    isOpen: true,
    verificationStatus: 'approved',
    gcashAccount: null,
    mayaAccount: null,
  },
  {
    id: 'pharm-8',
    name: 'Southstar Drug — San Jose City',
    businessType: 'pharmacy',
    adminPin: '8888',
    contactPhone: '0917-500-1008',
    province: 'Nueva Ecija',
    city: 'San Jose City',
    barangay: 'Kaliwanagan',
    addressDetail: 'Near the city hall',
    coords: { x: 65, y: 55 },
    locationGps: { lat: 15.7889, lng: 120.9921 },
    isOpen: true,
    verificationStatus: 'approved',
    gcashAccount: null,
    mayaAccount: null,
  },
  {
    id: 'pharm-9',
    name: 'Generika Drugstore — San Jose City',
    businessType: 'pharmacy',
    adminPin: '9999',
    contactPhone: '0917-500-1009',
    province: 'Nueva Ecija',
    city: 'San Jose City',
    barangay: 'Santo Niño 1st',
    addressDetail: 'Near Sto. Nino Elementary School',
    coords: { x: 52, y: 87 },
    locationGps: { lat: 15.8155, lng: 120.9782 },
    isOpen: false,
    verificationStatus: 'approved',
    gcashAccount: null,
    mayaAccount: null,
  },
  {
    id: 'pharm-3',
    name: 'The Generics Pharmacy — Muñoz',
    businessType: 'pharmacy',
    adminPin: '3333',
    contactPhone: '0917-500-1003',
    province: 'Nueva Ecija',
    city: 'Science City of Muñoz',
    barangay: 'CLSU',
    addressDetail: 'Near CLSU Main Gate',
    coords: { x: 15, y: 20 },
    locationGps: { lat: 15.7328, lng: 120.9317 },
    isOpen: true,
    verificationStatus: 'approved',
    gcashAccount: null,
    mayaAccount: null,
  },
  {
    id: 'pharm-4',
    name: 'Mercury Drug — Muñoz Poblacion',
    businessType: 'pharmacy',
    adminPin: '4444',
    contactPhone: '0917-500-1004',
    province: 'Nueva Ecija',
    city: 'Science City of Muñoz',
    barangay: 'Poblacion North',
    addressDetail: 'Near the public market, town proper',
    coords: { x: 20, y: 30 },
    locationGps: { lat: 15.7238, lng: 120.8972 },
    isOpen: true,
    verificationStatus: 'approved',
    gcashAccount: null,
    mayaAccount: null,
  },
  {
    id: 'pharm-5',
    name: 'Generika Drugstore — Muñoz Town Center',
    businessType: 'pharmacy',
    adminPin: '5555',
    contactPhone: '0917-500-1005',
    province: 'Nueva Ecija',
    city: 'Science City of Muñoz',
    barangay: 'Poblacion South',
    addressDetail: 'Near the Municipal Hall',
    coords: { x: 18, y: 25 },
    locationGps: { lat: 15.7256, lng: 120.9008 },
    isOpen: true,
    verificationStatus: 'approved',
    gcashAccount: null,
    mayaAccount: null,
  },
  {
    id: 'pharm-6',
    name: 'Southstar Drug — CLSU Gate',
    businessType: 'pharmacy',
    adminPin: '6666',
    contactPhone: '0917-500-1006',
    province: 'Nueva Ecija',
    city: 'Science City of Muñoz',
    barangay: 'CLSU',
    addressDetail: 'Along Academic Avenue, near the CLSU main gate',
    coords: { x: 13, y: 18 },
    locationGps: { lat: 15.7312, lng: 120.9298 },
    isOpen: false,
    verificationStatus: 'approved',
    gcashAccount: null,
    mayaAccount: null,
  },
]

// A handful of products per pharmacy spanning all three MedicineCategory
// values, so the customer-facing catalog can demonstrate every badge
// (OTC / Rx required / Restricted) without needing a real inventory feed.
export const MOCK_MEDICINE_PRODUCTS: MedicineProduct[] = [
  { id: 'med-1', pharmacyId: 'pharm-1', name: 'Biogesic 500mg', genericName: 'Paracetamol', category: 'otc', price: 5, inStock: true },
  { id: 'med-2', pharmacyId: 'pharm-1', name: 'Cecon 500mg', genericName: 'Vitamin C (Ascorbic Acid)', category: 'otc', price: 8, inStock: true },
  { id: 'med-3', pharmacyId: 'pharm-1', name: 'Amoxil 500mg', genericName: 'Amoxicillin', category: 'rx', price: 12, inStock: true },
  { id: 'med-4', pharmacyId: 'pharm-1', name: 'Virlix 10mg', genericName: 'Cetirizine', category: 'otc', price: 10, inStock: true },
  { id: 'med-5', pharmacyId: 'pharm-1', name: 'Tramadol 50mg', genericName: 'Tramadol HCl', category: 'restricted', price: 25, inStock: true },
  { id: 'med-6', pharmacyId: 'pharm-2', name: 'Biogesic 500mg', genericName: 'Paracetamol', category: 'otc', price: 6, inStock: true },
  { id: 'med-7', pharmacyId: 'pharm-2', name: 'Imodium 2mg', genericName: 'Loperamide', category: 'otc', price: 15, inStock: true },
  { id: 'med-8', pharmacyId: 'pharm-2', name: 'Glucophage 500mg', genericName: 'Metformin', category: 'rx', price: 7, inStock: true },
  { id: 'med-9', pharmacyId: 'pharm-2', name: 'Valium 5mg', genericName: 'Diazepam', category: 'restricted', price: 30, inStock: false },
  { id: 'med-10', pharmacyId: 'pharm-3', name: 'Biogesic 500mg', genericName: 'Paracetamol', category: 'otc', price: 5, inStock: true },
  { id: 'med-11', pharmacyId: 'pharm-3', name: 'Ceelin Plus', genericName: 'Vitamin C + Zinc', category: 'otc', price: 9, inStock: true },
  { id: 'med-12', pharmacyId: 'pharm-3', name: 'Amoxil 500mg', genericName: 'Amoxicillin', category: 'rx', price: 11, inStock: true },
  { id: 'med-13', pharmacyId: 'pharm-3', name: 'Tramadol 50mg', genericName: 'Tramadol HCl', category: 'restricted', price: 28, inStock: true },
  { id: 'med-14', pharmacyId: 'pharm-4', name: 'Biogesic 500mg', genericName: 'Paracetamol', category: 'otc', price: 5, inStock: true },
  { id: 'med-15', pharmacyId: 'pharm-4', name: 'Neozep Forte', genericName: 'Phenylephrine + Paracetamol', category: 'otc', price: 8, inStock: true },
  { id: 'med-16', pharmacyId: 'pharm-4', name: 'Amoxil 500mg', genericName: 'Amoxicillin', category: 'rx', price: 12, inStock: true },
  { id: 'med-17', pharmacyId: 'pharm-4', name: 'Tramadol 50mg', genericName: 'Tramadol HCl', category: 'restricted', price: 26, inStock: true },
  { id: 'med-18', pharmacyId: 'pharm-5', name: 'Biogesic 500mg', genericName: 'Paracetamol', category: 'otc', price: 5, inStock: true },
  { id: 'med-19', pharmacyId: 'pharm-5', name: 'Bioflu', genericName: 'Paracetamol + Phenylephrine + Chlorphenamine', category: 'otc', price: 9, inStock: true },
  { id: 'med-20', pharmacyId: 'pharm-5', name: 'Losartan 50mg', genericName: 'Losartan Potassium', category: 'rx', price: 10, inStock: true },
  { id: 'med-21', pharmacyId: 'pharm-5', name: 'Ceelin Plus', genericName: 'Vitamin C + Zinc', category: 'otc', price: 9, inStock: false },
  { id: 'med-22', pharmacyId: 'pharm-6', name: 'Biogesic 500mg', genericName: 'Paracetamol', category: 'otc', price: 5, inStock: true },
  { id: 'med-23', pharmacyId: 'pharm-6', name: 'Amoxil 500mg', genericName: 'Amoxicillin', category: 'rx', price: 12, inStock: true },
  { id: 'med-24', pharmacyId: 'pharm-6', name: 'Diazepam 5mg', genericName: 'Diazepam', category: 'restricted', price: 27, inStock: true },
  { id: 'med-25', pharmacyId: 'pharm-7', name: 'Biogesic 500mg', genericName: 'Paracetamol', category: 'otc', price: 5, inStock: true },
  { id: 'med-26', pharmacyId: 'pharm-7', name: 'Kremil-S', genericName: 'Antacid', category: 'otc', price: 8, inStock: true },
  { id: 'med-27', pharmacyId: 'pharm-7', name: 'Amoxil 500mg', genericName: 'Amoxicillin', category: 'rx', price: 13, inStock: true },
  { id: 'med-28', pharmacyId: 'pharm-7', name: 'Tramadol 50mg', genericName: 'Tramadol HCl', category: 'restricted', price: 29, inStock: true },
  { id: 'med-29', pharmacyId: 'pharm-8', name: 'Biogesic 500mg', genericName: 'Paracetamol', category: 'otc', price: 5, inStock: true },
  { id: 'med-30', pharmacyId: 'pharm-8', name: 'Neozep Forte', genericName: 'Phenylephrine + Paracetamol', category: 'otc', price: 8, inStock: true },
  { id: 'med-31', pharmacyId: 'pharm-8', name: 'Metformin 500mg', genericName: 'Metformin', category: 'rx', price: 6, inStock: true },
  { id: 'med-32', pharmacyId: 'pharm-9', name: 'Biogesic 500mg', genericName: 'Paracetamol', category: 'otc', price: 5, inStock: true },
  { id: 'med-33', pharmacyId: 'pharm-9', name: 'Cecon 500mg', genericName: 'Vitamin C (Ascorbic Acid)', category: 'otc', price: 8, inStock: true },
  { id: 'med-34', pharmacyId: 'pharm-9', name: 'Amoxil 500mg', genericName: 'Amoxicillin', category: 'rx', price: 12, inStock: false },
]

// Flat delivery + service fee for a MEDS order — same "flat, not
// distance-based" shape as DEFAULT_PABILI_SERVICE_FEE below, kept separate
// since MEDS pricing may diverge from Pabili's later.
export const DEFAULT_MEDS_DELIVERY_FEE = 25
export const DEFAULT_MEDS_SERVICE_FEE = 15

export const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'gcash', label: 'GCash' },
  { id: 'maya', label: 'Maya' },
  { id: 'card', label: 'Card' },
]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  gcash: 'GCash',
  maya: 'Maya',
  card: 'Card',
}

export const DRIVER_REPORT_REASONS: DriverReportReason[] = [
  'unsafe_driving',
  'rude_behavior',
  'overcharging',
  'vehicle_condition',
  'other',
]

export const DRIVER_REPORT_REASON_LABELS: Record<DriverReportReason, string> = {
  unsafe_driving: 'Unsafe driving',
  rude_behavior: 'Rude behavior',
  overcharging: 'Overcharging',
  vehicle_condition: 'Vehicle condition',
  other: 'Other',
}

// Historical flat zone-hop model — superseded by the LGU-style tariff below
// (estimateFare now uses real distance), kept only as the fallback numbers
// shown before Admin ever changes anything.
export const BASE_FARE = 15
export const PER_HOP_RATE = 8

// Standard LGU tricycle tariff shape: a flat base rate (student or regular)
// that covers the first few kilometers, then a per-km rate beyond that.
// Admin-configurable at runtime via RideContext's tariffSettings — these are
// just the starting defaults.
export const DEFAULT_TARIFF_SETTINGS: TariffSettings = {
  standardRate: BASE_FARE,
  studentRate: 12,
  pwdSeniorRate: 12,
  perKmRate: PER_HOP_RATE,
  standardKmCovered: 2,
  extraPassengerFee: 5,
  groupRideDiscountPct: 10,
}

// Admin-configurable flat charge added on top of the standard fare for a
// Pabili (errand/delivery) order — separate from the tariff above since it's
// not a distance-based rate, just a flat service fee for the driver's time
// buying the items.
export const DEFAULT_PABILI_SERVICE_FEE = 20

export interface FareOptions {
  isStudent: boolean
  isPwdSenior: boolean
  passengerCount: number
}

// Itemized version of estimateFare's math, for showing the passenger exactly
// what they're paying for (standard rate vs. distance overage) before they
// submit a request — see PassengerPage's fare-preview section.
export interface FareBreakdown {
  baseRate: number
  distanceKm: number
  extraKm: number
  extraKmFee: number
  extraPassengers: number
  total: number
}

// Real (haversine) distance between pickup and dropoff, in km, using each
// location's actual gps — not the abstract x/y simulation grid, which has
// no meaningful units to convert from. PWD/Senior takes priority over the
// student rate if both are somehow true. For a standard (non-discounted)
// group booking of 2-4, standardRate×passengerCount minus the admin-set
// group discount % replaces the base rate + flat per-head surcharge;
// discounted rides and groups of 5+ keep using the flat surcharge.
export function estimateFareBreakdown(
  pickup: MockLocation,
  dropoff: MockLocation,
  tariff: TariffSettings,
  { isStudent, isPwdSenior, passengerCount }: FareOptions,
): FareBreakdown {
  const isGroupEligible = !isStudent && !isPwdSenior && passengerCount >= 2 && passengerCount <= 4
  const groupRate = isGroupEligible
    ? tariff.standardRate * passengerCount * (1 - tariff.groupRideDiscountPct / 100)
    : null
  const baseRate =
    typeof groupRate === 'number'
      ? groupRate
      : isPwdSenior
        ? tariff.pwdSeniorRate
        : isStudent
          ? tariff.studentRate
          : tariff.standardRate
  const extraPassengers = typeof groupRate === 'number' ? 0 : Math.max(0, passengerCount - 1) * tariff.extraPassengerFee
  if (pickup.id === dropoff.id) {
    return { baseRate, distanceKm: 0, extraKm: 0, extraKmFee: 0, extraPassengers, total: Math.round(baseRate + extraPassengers) }
  }
  const distanceKm = haversineDistanceMeters(pickup.gps, dropoff.gps) / 1000
  const extraKm = Math.max(0, distanceKm - tariff.standardKmCovered)
  const extraKmFee = extraKm * tariff.perKmRate
  return { baseRate, distanceKm, extraKm, extraKmFee, extraPassengers, total: Math.round(baseRate + extraKmFee + extraPassengers) }
}

export function estimateFare(
  pickup: MockLocation,
  dropoff: MockLocation,
  tariff: TariffSettings,
  options: FareOptions,
): number {
  return estimateFareBreakdown(pickup, dropoff, tariff, options).total
}

// Real-world gps for a TODA org's terminal. The three seed orgs use the
// legacy grid (`terminalLocationId` → MOCK_LOCATIONS, which has accurate real
// gps); newer self-registered orgs have no grid entry and rely on
// `org.terminalGps`, captured live via the browser Geolocation API when the
// TODA Admin sets it.
export function getTerminalGps(org: TodaOrganization | undefined | null): GeoCoords | null {
  if (!org) return null
  const gridTerminal = MOCK_LOCATIONS.find((l) => l.id === org.terminalLocationId)
  return gridTerminal?.gps ?? org.terminalGps
}

export interface SpecialPickupBreakdown {
  distanceKm: number
  extraKm: number
  fee: number
}

// "Special pickup" fee: when the passenger's TODA Terminal is far from where
// they actually are, they can request the driver come to their exact spot
// instead of the terminal — this is the extra distance the driver has to
// cover to reach them, charged with the same "first `standardKmCovered` km
// free, then perKmRate per km" shape as the ride fare itself (not a separate
// fee schedule). Zero if the terminal is within the covered km, or if either
// gps is unknown.
export function estimateSpecialPickupBreakdown(
  terminalGps: GeoCoords | null,
  pickupGps: GeoCoords | null,
  tariff: TariffSettings,
): SpecialPickupBreakdown {
  if (!terminalGps || !pickupGps) return { distanceKm: 0, extraKm: 0, fee: 0 }
  const distanceKm = haversineDistanceMeters(terminalGps, pickupGps) / 1000
  const extraKm = Math.max(0, distanceKm - tariff.standardKmCovered)
  return { distanceKm, extraKm, fee: Math.round(extraKm * tariff.perKmRate) }
}

export function estimateSpecialPickupFee(
  terminalGps: GeoCoords | null,
  pickupGps: GeoCoords | null,
  tariff: TariffSettings,
): number {
  return estimateSpecialPickupBreakdown(terminalGps, pickupGps, tariff).fee
}
