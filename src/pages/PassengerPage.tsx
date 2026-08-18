import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useRides } from '../context/RideContext'
import { useSession } from '../context/SessionContext'
import {
  CLSU_MAIN_GATE_LOCATION,
  DEFAULT_BOOKING_ADDRESS_DETAIL,
  DEFAULT_BOOKING_BARANGAY,
  DEFAULT_BOOKING_CITY,
  DEFAULT_BOOKING_PROVINCE,
  DRIVER_REPORT_REASONS,
  DRIVER_REPORT_REASON_LABELS,
  MOCK_LOCATIONS,
  PAYMENT_METHODS,
  estimateFareBreakdown,
  estimateSpecialPickupBreakdown,
  getCitiesForProvince,
  getPriorityTodaOrgId,
  getTerminalGps,
} from '../mock/data'
import { getCurrentGeoPosition } from '../lib/geo'
import { isWithinRetentionDays } from '../lib/tracking'
import { resolvePhAddress, resolveNearbyPublicMarket, type PhAddressTags } from '../lib/customLocation'
import { StatusBadge } from '../components/StatusBadge'
import { ReceiptCard } from '../components/ReceiptCard'
import { StarRating } from '../components/StarRating'
import { TripMonitor } from '../components/TripMonitor'
import { PassengerRegisterForm } from '../components/PassengerRegisterForm'
import { BarangayAddressPicker } from '../components/BarangayAddressPicker'
import { LocationMapPicker } from '../components/LocationMapPicker'
import { MedsBooking } from '../components/MedsBooking'
import { PabiliItemsInput } from '../components/PabiliItemsInput'
import { GuestRiderFields, makeGuestPassengerId, useGuestRider } from '../components/GuestRiderFields'
import { PassengerRewardsCard } from '../components/PassengerRewardsCard'
import { GoogleAdSlot } from '../components/GoogleAdSlot'
import type {
  DriverReportReason,
  GeoCoords,
  MockLocation,
  PaymentMethod,
  Pharmacy,
  Ride,
  SavedLocationLabel,
  ServiceType,
} from '../types'

const MAX_RIDE_PASSENGERS = 4
const SAVED_LOCATION_LABELS: SavedLocationLabel[] = ['Home', 'School', 'Work', 'Favorite']
const SAVED_LOCATION_ICONS: Record<SavedLocationLabel, string> = {
  Home: '🏠',
  School: '🏫',
  Work: '💼',
  Favorite: '⭐',
}
// Home/School/Work are single-slot (saving one replaces the old one), so
// their button just names the slot. Favorite accumulates instead — the "+"
// makes clear that tapping it adds another rather than replacing anything.
function savedLocationButtonLabel(label: SavedLocationLabel): string {
  return label === 'Favorite' ? `+ ${SAVED_LOCATION_ICONS[label]} ${label}` : `${SAVED_LOCATION_ICONS[label]} ${label}`
}

export function PassengerPage() {
  const {
    rides,
    passengers,
    drivers,
    todaOrganizations,
    tariffSettings,
    pabiliServiceFee,
    specialPickupEscalationMs,
    tripHistoryRetentionDays,
    requestRide,
    cancelRide,
    setFavoriteDriver,
    savePassengerLocation,
    removePassengerLocation,
    medsOrders,
    pharmacies,
  } = useRides()
  const { currentPassengerId, setCurrentPassengerId, authedAccount } = useSession()
  // Only the Admin ops view (/passenger) needs to switch between accounts to
  // test as anyone — a real logged-in passenger's identity is fixed to
  // whoever authenticated, same as the Driver app.
  const isAdminOpsView = authedAccount?.role === 'admin'
  const [customLocations, setCustomLocations] = useState<MockLocation[]>([])
  const [pickupId, setPickupId] = useState(CLSU_MAIN_GATE_LOCATION.id)
  const [dropoffId, setDropoffId] = useState(MOCK_LOCATIONS[3].id)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [passengerCount, setPassengerCount] = useState(1)
  const [showRegister, setShowRegister] = useState(false)
  const [pageTab, setPageTab] = useState<'book' | 'rewards'>('book')
  const [pickupGps, setPickupGps] = useState<GeoCoords | null>(null)
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'done' | 'error'>('idle')
  const [gpsError, setGpsError] = useState('')
  const [serviceType, setServiceType] = useState<ServiceType>('ride')
  const [pabiliItems, setPabiliItems] = useState('')
  // Bumping this remounts PabiliItemsInput fresh (clearing its internal
  // table rows) after a successful submit — it owns its own row state and
  // has no other way to know pabiliItems was reset out from under it.
  const [pabiliItemsResetKey, setPabiliItemsResetKey] = useState(0)
  // The specific store/establishment to buy from, typed freeform (e.g. "7-Eleven",
  // "SM Grocery", "Aling Nena's Store") — overrides the resolved pickup point's
  // generic label (a public-market proxy or a dropped pin) only at request time
  // (see handleRequest), same pattern MedsBooking's "direct" flow uses for
  // directPharmacyName, so the driver's ride card shows the actual store name.
  const [storeName, setStoreName] = useState('')
  const [tipInput, setTipInput] = useState('')
  const [specialPickupRequested, setSpecialPickupRequested] = useState(false)
  // Stable for the component's lifetime (not regenerated per render) — a
  // MEDS order needs a customerId that stays the same across the whole
  // pharmacy→catalog→cart flow, same as a guest ride's id is only minted
  // once at actual submit time.
  const [guestCustomerId] = useState(() => makeGuestPassengerId())
  // Bumping `key` remounts the matching BarangayAddressPicker with these
  // exact values as its new defaults — the only way to push an externally
  // chosen location (a Saved Place quick-pick) into a picker that otherwise
  // owns its own dropdown state, so the dropdowns don't keep showing
  // whatever they last had while pickupId/dropoffId already moved on.
  const [pickupPickerSeed, setPickupPickerSeed] = useState({ key: 0, province: '', city: '', barangay: '', addressDetail: '' })
  const [dropoffPickerSeed, setDropoffPickerSeed] = useState({ key: 0, province: '', city: '', barangay: '', addressDetail: '' })
  // Which of Pickup/Destination the map picker's toggle is on — also
  // controls which address form shows below the map, so only one is on
  // screen at a time instead of both stacked.
  const [mapTarget, setMapTarget] = useState<'pickup' | 'dropoff'>('pickup')
  // Lets completed rides be dismissed from the "current trip" slot without
  // requiring a payment-method tap first — see TripMonitor's onDismiss. A
  // set, not a single id, since more than one ride can pile up unacknowledged
  // (e.g. several cash trips completed in a row) and each needs its own
  // dismissal, not just the most recent.
  const [dismissedRideIds, setDismissedRideIds] = useState<Set<string>>(new Set())
  // Trip history starts collapsed — it's a long, low-priority list the
  // passenger only wants to check occasionally, not something that should
  // push the actual booking form further down the page by default.
  const [showTripHistory, setShowTripHistory] = useState(false)
  // The booking form starts collapsed behind a single "Book a Ride" CTA so
  // Pickup/Destination don't require scrolling past the full form once the
  // passenger actually starts booking.
  const [bookingStarted, setBookingStarted] = useState(false)
  // Scroll targets for the hamburger drawer's "My Current Ride" and "Ride
  // History" items (see NavDrawer/NavBar) — the drawer can't reach into
  // this page's own tab/collapse state directly since it's a sibling
  // component, so NavBar navigates here with `location.state.section`
  // instead and this page does the actual tab-switch/expand/scroll below.
  const currentRideSectionRef = useRef<HTMLDivElement>(null)
  const tripHistorySectionRef = useRef<HTMLElement>(null)
  const guestRider = useGuestRider()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  // Lets the landing page's "💊 Buy a Medicine" button link straight into
  // the Medicine flow (/book?service=buy_medicine) instead of dropping the
  // passenger on the collapsed "Ready to head out?" prompt.
  useEffect(() => {
    if (searchParams.get('service') === 'buy_medicine') {
      setPageTab('book')
      setBookingStarted(true)
      setServiceType('buy_medicine')
      return
    }
    // A Ride in progress always shows regardless of bookingStarted (see
    // activeRide below, checked outside the collapsed-CTA gate) — a MEDS
    // order needs the same treatment, since MedsBooking itself is only
    // rendered once bookingStarted && isBuyMedicine are both true. Without
    // this, a passenger who placed an order, closed the tab, and came back
    // would land on the generic "Ready to head out?" prompt with no sign
    // their order (awaiting a quote, or already quoted) still exists.
    const resolvedPassengerId = currentPassengerId ?? passengers[0]?.id
    const hasActiveMedsOrder = medsOrders.some((o) => {
      if (o.customerId !== resolvedPassengerId) return false
      if (o.status === 'pending_confirmation' || o.status === 'quoted' || o.status === 'confirmed' || o.status === 'ready_for_pickup') {
        return true
      }
      if (o.status !== 'dispatched') return false
      const linkedRideStatus = rides.find((r) => r.id === o.linkedRideId)?.status
      return linkedRideStatus !== 'completed' && linkedRideStatus !== 'cancelled' && linkedRideStatus !== 'declined'
    })
    // A "driver buys it directly" request (see MedsBooking's 'direct' step)
    // dispatches straight to a Ride with no MedsOrder behind it at all — the
    // above check alone would miss it.
    const hasActiveDirectMedsRide = rides.some(
      (r) =>
        r.passengerId === resolvedPassengerId &&
        r.serviceType === 'buy_medicine' &&
        !medsOrders.some((o) => o.linkedRideId === r.id) &&
        !['completed', 'cancelled', 'declined'].includes(r.status),
    )
    if (hasActiveMedsOrder || hasActiveDirectMedsRide) {
      setPageTab('book')
      setBookingStarted(true)
      setServiceType('buy_medicine')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Hamburger-drawer navigation (see NavBar.tsx/NavDrawer.tsx) — a menu
  // item calls navigate('/book', { state: { section } }). location.key
  // changes on every such call, even re-clicking the same item while
  // already on /book, so this fires every time rather than only reacting
  // to a value change like the mount-only effect above.
  useEffect(() => {
    const section = (location.state as { section?: string } | null)?.section
    if (!section) return
    // Clear the state right away so back/forward or a later same-route
    // navigation doesn't replay a stale section.
    navigate(location.pathname, { replace: true, state: {} })
    const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })
    switch (section) {
      case 'home':
        setPageTab('book')
        scrollTop()
        break
      case 'ride':
        setPageTab('book')
        setBookingStarted(true)
        setServiceType('ride')
        scrollTop()
        break
      case 'medicine':
        setPageTab('book')
        setBookingStarted(true)
        setServiceType('buy_medicine')
        scrollTop()
        break
      case 'pabili':
        setPageTab('book')
        setBookingStarted(true)
        setServiceType('pabili')
        scrollTop()
        break
      case 'current':
        setPageTab('book')
        setTimeout(() => currentRideSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
        break
      case 'history':
        setShowTripHistory(true)
        setTimeout(() => tripHistorySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
        break
      case 'rewards':
        setPageTab('rewards')
        scrollTop()
        break
      default:
        break
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key])

  const passenger = passengers.find((p) => p.id === currentPassengerId) ?? passengers[0]
  const savedLocations = passenger.savedLocations
  const allLocations = [
    ...MOCK_LOCATIONS,
    ...customLocations,
    ...savedLocations.map((s) => s.location),
  ].filter((loc, i, arr) => arr.findIndex((l) => l.id === loc.id) === i)
  const pickup = allLocations.find((l) => l.id === pickupId)!
  const dropoff = allLocations.find((l) => l.id === dropoffId)!
  const isPabili = serviceType === 'pabili'
  const isBuyMedicine = serviceType === 'buy_medicine'
  // Buy Medicine has its own self-contained flow (MedsBooking) with a
  // completely different shape (cart, pharmacy confirmation) — none of the
  // shared Ride/Pabili JSX below (address forms, fare breakdown, submit
  // button) ever renders for it, so isErrand only needs to track Pabili.
  const isErrand = isPabili
  const tip = Math.max(0, Number(tipInput) || 0)
  const fareBreakdown = estimateFareBreakdown(pickup, dropoff, tariffSettings, {
    isStudent: passenger.isStudent,
    isPwdSenior: passenger.isPwdSenior,
    passengerCount,
  })
  const oneWayFare = fareBreakdown.total
  // Which TODA's terminal has dispatch priority for this pickup — the same
  // org the ride will actually be routed through (see RideContext's
  // REQUEST_RIDE), so the "far from Terminal" fee preview always matches
  // what gets charged.
  const priorityTodaOrg = todaOrganizations.find((o) => o.id === getPriorityTodaOrgId(pickup))
  const terminalGps = getTerminalGps(priorityTodaOrg)
  const specialPickupBreakdown = estimateSpecialPickupBreakdown(terminalGps, pickupGps, tariffSettings)
  const specialPickupFee = specialPickupRequested ? specialPickupBreakdown.fee : 0
  // An errand is a round trip for the driver (store and back), so it's
  // charged at 2x the one-way distance fare — mirrors RideContext's
  // REQUEST_RIDE. The special-pickup detour is a one-time trip to reach the
  // passenger, not doubled even for an errand round trip.
  const baseFare = isErrand ? oneWayFare * 2 : oneWayFare
  const serviceFee = isErrand ? pabiliServiceFee : 0
  const totalFare = baseFare + serviceFee + specialPickupFee + (isErrand ? tip : 0)
  // Split for the passenger-facing breakdown: standard rate vs. distance
  // overage, doubled for an errand's round trip same as baseFare above. The
  // extra-km fee rounds once and the standard-rate portion absorbs whatever
  // is left, so the two lines always add up to exactly baseFare (no stray
  // ₱1 from rounding each piece separately).
  const fareExtraKmFeePortionOneWay = Math.round(fareBreakdown.extraKmFee)
  const fareExtraKmFeePortion = fareExtraKmFeePortionOneWay * (isErrand ? 2 : 1)
  const fareStandardRatePortion = (oneWayFare - fareExtraKmFeePortionOneWay) * (isErrand ? 2 : 1)
  const fareExtraKmDisplay = isErrand ? fareBreakdown.extraKm * 2 : fareBreakdown.extraKm

  // "Pickup"/"Destination" for a ride; "Buy near to"/"Deliver to" for an
  // errand — same map picker, same underlying pickup/dropoff state, just
  // different words for what each pin means.
  const pickupLabel = isErrand ? 'Buy near to' : 'Pickup'
  const dropoffLabel = isErrand ? 'Deliver to' : 'Destination'

  function handleSaveLocation(label: SavedLocationLabel, location: MockLocation) {
    savePassengerLocation(passenger.id, label, location)
  }

  async function handlePickupResolve(address: PhAddressTags) {
    const location = await resolvePhAddress(address)
    setCustomLocations((prev) => [...prev, location])
    handlePickupChange(location.id)
  }

  async function handleDropoffResolve(address: PhAddressTags) {
    const location = await resolvePhAddress(address)
    setCustomLocations((prev) => [...prev, location])
    setDropoffId(location.id)
  }

  const myRides = rides.filter((r) => r.passengerId === passenger.id)
  // A just-completed ride stays in the "current trip" slot (still driven by
  // TripMonitor, not yet in Trip History) until the passenger taps a
  // payment method to confirm/correct how they paid, or dismisses it via
  // "Book a new ride" — see acknowledgeRidePayment and dismissedRideIds.
  // Declined/cancelled rides never show here. A dispatched MEDS delivery is
  // excluded — MedsBooking's own activeOrder/linkedRide lookup already
  // renders it (as "Your medicine delivery", with MEDS-aware cancel rules
  // that refuse to cancel once dispatched); without this exclusion this
  // generic card would claim the same ride first and let the customer
  // cancel an already-dispatched delivery outright via plain cancelRide.
  const activeRide = myRides.find(
    (r) =>
      r.serviceType !== 'buy_medicine' &&
      !['declined', 'cancelled'].includes(r.status) &&
      (r.status !== 'completed' || !r.paymentAcknowledged) &&
      !dismissedRideIds.has(r.id),
  )
  const isGuestBooking = guestRider.bookingFor === 'other'
  const canSubmit =
    pickupId !== dropoffId &&
    (!isErrand || pabiliItems.trim().length > 0) &&
    (!isGuestBooking || guestRider.otherName.trim().length > 0)

  function handleRequest() {
    if (!canSubmit) return
    requestRide({
      passengerId: isGuestBooking ? makeGuestPassengerId() : passenger.id,
      passengerName: isGuestBooking ? guestRider.otherName.trim() : passenger.name,
      passengerPhone: isGuestBooking ? guestRider.otherPhone.trim() || null : null,
      pickup: isErrand && storeName.trim() ? { ...pickup, label: storeName.trim() } : pickup,
      dropoff,
      paymentMethod,
      isStudentRide: isGuestBooking ? false : passenger.isStudent,
      isPwdSeniorRide: isGuestBooking ? false : passenger.isPwdSenior,
      pickupGps,
      passengerCount,
      serviceType,
      pabiliItems: isErrand ? pabiliItems.trim() : null,
      tip: isErrand ? tip : 0,
      specialPickupRequested: specialPickupRequested && pickupGps !== null,
    })
    setPassengerCount(1)
    setPabiliItems('')
    setPabiliItemsResetKey((k) => k + 1)
    setStoreName('')
    setTipInput('')
    setSpecialPickupRequested(false)
    guestRider.reset()
  }

  function handlePickupChange(id: string) {
    setPickupId(id)
    setPickupGps(null)
    setGpsStatus('idle')
    setGpsError('')
    setSpecialPickupRequested(false)
  }

  // From LocationMapPicker — a map tap resolves to a MockLocation plus,
  // when the tapped point falls inside our own address tree, a `guess` at
  // its Province/City/Barangay (see reverseGeocodeToPhAddress). Registers
  // the point either way; only seeds the BarangayAddressPicker dropdowns
  // (same remount-to-reseed mechanism the Saved Places quick-picks use)
  // when a guess actually resolved — an unresolved tap just leaves the
  // dropdowns as they were, same as before this feature existed.
  function handlePinPickup(location: MockLocation, guess: PhAddressTags | null) {
    setCustomLocations((prev) => [...prev, location])
    handlePickupChange(location.id)
    if (guess) {
      setPickupPickerSeed((prev) => ({
        key: prev.key + 1,
        province: guess.province,
        city: guess.city,
        barangay: guess.barangay,
        addressDetail: guess.addressDetail,
      }))
    }
  }

  function handlePinDropoff(location: MockLocation, guess: PhAddressTags | null) {
    setCustomLocations((prev) => [...prev, location])
    setDropoffId(location.id)
    if (guess) {
      setDropoffPickerSeed((prev) => ({
        key: prev.key + 1,
        province: guess.province,
        city: guess.city,
        barangay: guess.barangay,
        addressDetail: guess.addressDetail,
      }))
    }
  }

  // Used by the Saved Places quick-pick buttons — unlike handlePickupChange
  // (which the picker itself calls after resolving what it was typed),
  // this also seeds the BarangayAddressPicker's own dropdowns so they show
  // the place that's now actually selected, instead of whatever they held
  // before.
  function handlePickupQuickPick(location: MockLocation) {
    handlePickupChange(location.id)
    setPickupPickerSeed((prev) => ({
      key: prev.key + 1,
      province: location.province,
      city: location.city,
      barangay: location.barangay,
      addressDetail: '',
    }))
  }

  function handleDropoffQuickPick(location: MockLocation) {
    setDropoffId(location.id)
    setDropoffPickerSeed((prev) => ({
      key: prev.key + 1,
      province: location.province,
      city: location.city,
      barangay: location.barangay,
      addressDetail: '',
    }))
  }

  // Quick "jump to this city" for Ride/Pabili — same convenience as Buy
  // Medicine's own City dropdown (which re-filters its pharmacy list and
  // re-fits its map), but Ride/Pabili have no list to filter, so this jumps
  // the one point that represents "where I'm starting from" (pickup for a
  // Ride, "Buy near to" for a Pabili errand) to a resolved point in the
  // chosen city and lets the map's own refitOnMove pan there — same
  // public-market-search proxy already used as "the passenger's rough area"
  // elsewhere in this file (see handleSelectPabili). Destination/"Deliver
  // to" is left alone since that's a free choice, not a "where am I" field.
  async function handlePickupCityQuickPick(newCity: string) {
    const point = await resolveNearbyPublicMarket(newCity, DEFAULT_BOOKING_PROVINCE)
    setCustomLocations((prev) => [...prev, point])
    handlePickupQuickPick(point)
  }

  // Picking a registered store for Pabili's pickup ("Buy near to") — same
  // "must exist in customLocations before pickupId can point at it" rule as
  // every other custom pickup here (allLocations is built from
  // MOCK_LOCATIONS + customLocations + savedLocations, so pointing pickupId
  // at an id that isn't in any of those makes `pickup` resolve to undefined
  // and crashes the whole page on the next render).
  function handleStorePickupQuickPick(store: Pharmacy) {
    const location: MockLocation = {
      id: store.id,
      label: store.name,
      coords: store.coords,
      gps: store.locationGps ?? { lat: 15.7940977, lng: 120.9905849 },
      province: store.province,
      city: store.city,
      barangay: store.barangay,
    }
    setCustomLocations((prev) => [...prev, location])
    handlePickupQuickPick(location)
    setStoreName(store.name)
  }

  // Pabili defaults to buying from the public market near CLSU (the current
  // default "where I am" for booking — see DEFAULT_BOOKING_* in
  // mock/data.ts) and delivering there too, so both fields start pre-filled
  // instead of blank. The passenger can still change either afterward.
  async function handleSelectPabili() {
    setServiceType('pabili')
    setPassengerCount(1)

    // CLSU is the current default "where I am" for booking (see
    // DEFAULT_BOOKING_* in mock/data.ts) — both the store search and the
    // delivery address start there rather than the passenger's own
    // registered home address.
    const store = await resolveNearbyPublicMarket(DEFAULT_BOOKING_CITY, DEFAULT_BOOKING_PROVINCE)
    setCustomLocations((prev) => [...prev, store])
    handlePickupQuickPick(store)
    handleDropoffQuickPick(CLSU_MAIN_GATE_LOCATION)
  }

  async function handleUseMyGps() {
    setGpsStatus('locating')
    setGpsError('')
    try {
      const coords = await getCurrentGeoPosition()
      setPickupGps(coords)
      setGpsStatus('done')
    } catch (err) {
      setGpsStatus('error')
      setGpsError(err instanceof Error ? err.message : 'Could not get your location.')
    }
  }

  // Admin-configurable — see AdminPage's "Trip history retention" setting.
  // Older rides aren't lost, they just drop out of this list (earnings
  // totals, ratings, and admin reports all still see the full history).
  const visibleTripHistory = myRides.filter((r) => isWithinRetentionDays(r.requestedAt, tripHistoryRetentionDays))

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      <section>
        {isAdminOpsView ? (
          <>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-xs font-medium text-slate-500">Booking as</label>
              <button
                type="button"
                onClick={() => setShowRegister((v) => !v)}
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                {showRegister ? 'Cancel' : '+ New passenger'}
              </button>
            </div>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              value={passenger.id}
              onChange={(e) => setCurrentPassengerId(e.target.value)}
            >
              {passengers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {showRegister && (
              <div className="mt-2">
                <PassengerRegisterForm
                  onRegistered={(id) => {
                    setCurrentPassengerId(id)
                    setShowRegister(false)
                  }}
                />
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="shrink-0">
              <label className="block text-xs font-medium text-slate-500">Booking as</label>
              <p className="text-sm font-semibold text-slate-800">{passenger.name}</p>
            </div>
            <div className="min-w-0 flex-1">
              <GoogleAdSlot placement="passengerTop" />
            </div>
          </div>
        )}
      </section>

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setPageTab('book')}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
            pageTab === 'book' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'
          }`}
        >
          🛵 Book
        </button>
        <button
          type="button"
          onClick={() => setPageTab('rewards')}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
            pageTab === 'rewards' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'
          }`}
        >
          🎁 Rewards & Referrals
        </button>
      </div>

      {pageTab === 'rewards' && <PassengerRewardsCard passenger={passenger} />}

      {pageTab === 'book' && (
      <>
      {activeRide ? (
        <div ref={currentRideSectionRef}>
        <ActiveRideCard
          rideId={activeRide.id}
          onCancel={() => cancelRide(activeRide.id)}
          onDismiss={() => {
            // Go straight to the open booking form (pickup/destination
            // fields + map already visible) instead of landing on the
            // collapsed "Book a Ride" prompt and making them click twice.
            // Dismiss every completed-but-unacknowledged ride at once, not
            // just this one — otherwise a passenger with several stacked
            // (e.g. cash trips the driver never got a chance to confirm)
            // has to click "Book a new ride" once per stuck ride before
            // reaching the form, instead of getting there in one click.
            setDismissedRideIds((prev) => {
              const next = new Set(prev)
              myRides.forEach((r) => {
                if (r.status === 'completed' && !r.paymentAcknowledged) next.add(r.id)
              })
              return next
            })
            setBookingStarted(true)
          }}
        />
        </div>
      ) : (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {!bookingStarted ? (
            <div className="space-y-2.5 py-2 text-center">
              <p className="text-sm font-semibold text-slate-700">Ready to head out?</p>
              <button
                type="button"
                onClick={() => setBookingStarted(true)}
                className="w-full rounded-lg bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700"
              >
                🛵 Book a Ride
              </button>
              <button
                type="button"
                onClick={() => {
                  setBookingStarted(true)
                  handleSelectPabili()
                }}
                className="w-full rounded-lg border border-slate-300 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                🛍️ Pabili — ask a driver to buy something
              </button>
              <button
                type="button"
                onClick={() => {
                  setBookingStarted(true)
                  setServiceType('buy_medicine')
                }}
                className="w-full rounded-lg border border-slate-300 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                💊 Buy Medicine — order from a nearby pharmacy
              </button>
            </div>
          ) : (
            <>
          {!isBuyMedicine && (
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">
                {isPabili ? 'Pabili — ask your driver to buy something' : 'Book a ride'}
              </h2>
            </div>
          )}
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setServiceType('ride')}
              className={`flex-1 rounded-md py-2 text-xs font-medium transition ${
                !isPabili && !isBuyMedicine ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'
              }`}
            >
              🛵 Ride
            </button>
            <button
              type="button"
              onClick={handleSelectPabili}
              className={`flex-1 rounded-md py-2 text-xs font-medium transition ${
                isPabili ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'
              }`}
            >
              🛍️ Pabili
            </button>
            <button
              type="button"
              onClick={() => setServiceType('buy_medicine')}
              className={`flex-1 rounded-md py-2 text-xs font-medium transition ${
                isBuyMedicine ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'
              }`}
            >
              💊 Medicine
            </button>
          </div>
          {isPabili && (
            <p className="text-xs text-slate-500">
              Tell your driver what to buy — food, groceries, medicine, anything from a nearby store — and they'll
              pick it up and deliver it to you.
            </p>
          )}
          {isBuyMedicine && (
            <p className="text-xs text-slate-500">
              Order medicine from a nearby participating pharmacy — your driver picks it up and delivers it to you.
            </p>
          )}

          <GuestRiderFields state={guestRider} selfLabel="Myself" />

          {isErrand && <PabiliItemsInput key={pabiliItemsResetKey} value={pabiliItems} onChange={setPabiliItems} />}

          {isErrand && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Store / establishment (optional)</label>
              <input
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="e.g. 7-Eleven, SM Grocery, Aling Nena's Store"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Tell your driver exactly where to buy from — this shows on their ride card. Leave blank to just let
                them buy near the pickup point below.
              </p>
            </div>
          )}

          {isBuyMedicine ? (
            <MedsBooking
              customerId={isGuestBooking ? guestCustomerId : passenger.id}
              customerName={isGuestBooking ? guestRider.otherName.trim() || 'them' : passenger.name}
              defaultProvince={DEFAULT_BOOKING_PROVINCE}
              defaultCity={DEFAULT_BOOKING_CITY}
              defaultBarangay={DEFAULT_BOOKING_BARANGAY}
              defaultAddressDetail={DEFAULT_BOOKING_ADDRESS_DETAIL}
            />
          ) : (
          <>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {isErrand ? 'Jump to city (buy near to)' : 'Jump to city (pickup)'}
            </label>
            <select
              value={pickupPickerSeed.city || pickup.city || DEFAULT_BOOKING_CITY}
              onChange={(e) => handlePickupCityQuickPick(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {getCitiesForProvince(DEFAULT_BOOKING_PROVINCE).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          {isErrand && pharmacies.some((p) => p.businessType === 'store') && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Or pick a registered store</label>
              <div className="space-y-1.5">
                {pharmacies
                  .filter((p) => p.businessType === 'store')
                  .map((store) => (
                    <button
                      key={store.id}
                      type="button"
                      onClick={() => handleStorePickupQuickPick(store)}
                      className="w-full rounded-lg border border-slate-200 p-2.5 text-left text-xs transition hover:bg-slate-50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-700">🏪 {store.name}</span>
                        <span className={store.isOpen ? 'text-emerald-600' : 'text-rose-600'}>
                          {store.isOpen ? '🟢 Open' : '⚪ Closed'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {store.addressDetail}, {store.barangay}, {store.city}
                      </p>
                    </button>
                  ))}
              </div>
            </div>
          )}
          <LocationMapPicker
            pickup={pickup}
            dropoff={dropoff}
            target={mapTarget}
            onTargetChange={setMapTarget}
            onPinPickup={handlePinPickup}
            onPinDropoff={handlePinDropoff}
            pickupLabel={pickupLabel}
            dropoffLabel={dropoffLabel}
            gpsTarget={isErrand ? 'dropoff' : 'pickup'}
          />

          {/* Mirrors the map picker's own Pickup/Destination toggle right
              above the address form itself, so switching which one you're
              editing doesn't require scrolling back up to the map. */}
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMapTarget('pickup')}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
                mapTarget === 'pickup' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'
              }`}
            >
              {pickupLabel}
            </button>
            <button
              type="button"
              onClick={() => setMapTarget('dropoff')}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
                mapTarget === 'dropoff' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'
              }`}
            >
              {dropoffLabel}
            </button>
          </div>

          {/* Only the address form matching the map picker's active tab
              shows at a time — switching tabs above swaps which one
              appears here instead of always stacking both. */}
          {mapTarget === 'pickup' && (
            <div>
              <BarangayAddressPicker
                key={pickupPickerSeed.key}
                label={pickupLabel}
                defaultProvince={pickupPickerSeed.province || DEFAULT_BOOKING_PROVINCE}
                defaultCity={pickupPickerSeed.city || DEFAULT_BOOKING_CITY}
                defaultBarangay={pickupPickerSeed.barangay || DEFAULT_BOOKING_BARANGAY}
                defaultAddressDetail={pickupPickerSeed.addressDetail}
                onResolve={handlePickupResolve}
              />
              {/* A Ride's "special pickup" (terminal detour) belongs here,
                  at wherever the passenger boards. An errand's exact-GPS
                  capture instead belongs on Deliver to below — the store
                  isn't where the passenger is standing. */}
              {!isErrand && (
                <>
                  <button
                    type="button"
                    onClick={handleUseMyGps}
                    disabled={gpsStatus === 'locating'}
                    className={`mt-1.5 w-full rounded-lg border py-1.5 text-xs font-medium transition ${
                      gpsStatus === 'done'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {gpsStatus === 'locating' && 'Locating…'}
                    {gpsStatus === 'done' && '✓ Exact GPS location captured — driver can pinpoint you'}
                    {(gpsStatus === 'idle' || gpsStatus === 'error') && '📍 Use my exact GPS location'}
                  </button>
                  {gpsStatus === 'error' && <p className="mt-1 text-[11px] text-rose-600">{gpsError}</p>}
                  <p className="mt-1 text-[11px] text-slate-400">
                    Optional — pins your precise spot within the pickup area so the driver can find you exactly.
                  </p>
                  {gpsStatus === 'done' && terminalGps && (
                    <label className="mt-1.5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={specialPickupRequested}
                        onChange={(e) => setSpecialPickupRequested(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="font-medium text-amber-800">
                          Special request — Terminal is far, pick me up right here
                        </span>
                        <br />
                        <span className="text-amber-700">
                          ~{specialPickupBreakdown.distanceKm.toFixed(1)} km from the TODA Terminal
                          {specialPickupBreakdown.fee > 0
                            ? ` — adds ₱${specialPickupBreakdown.fee} (${specialPickupBreakdown.extraKm.toFixed(1)} km beyond the ${tariffSettings.standardKmCovered} km standard fare already covers)`
                            : ' — within the standard fare’s covered distance, no extra fee'}
                          <br />
                          If no one from your TODA accepts within {Math.round(specialPickupEscalationMs / 60000)}{' '}
                          minutes, it opens to any TODA member and freelance drivers nearby.
                        </span>
                      </span>
                    </label>
                  )}
                </>
              )}
              <div className="mt-1.5 flex flex-wrap gap-1">
                <span className="text-[11px] text-slate-400">Save this pickup as:</span>
                {SAVED_LOCATION_LABELS.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleSaveLocation(label, pickup)}
                    className="rounded-full border border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                  >
                    {savedLocationButtonLabel(label)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mapTarget === 'dropoff' && (
            <div>
              <BarangayAddressPicker
                key={dropoffPickerSeed.key}
                label={dropoffLabel}
                defaultProvince={dropoffPickerSeed.province || passenger.province}
                defaultCity={dropoffPickerSeed.city || passenger.city}
                defaultBarangay={dropoffPickerSeed.barangay}
                defaultAddressDetail={dropoffPickerSeed.addressDetail}
                onResolve={handleDropoffResolve}
              />
              {isErrand && (
                <>
                  <button
                    type="button"
                    onClick={handleUseMyGps}
                    disabled={gpsStatus === 'locating'}
                    className={`mt-1.5 w-full rounded-lg border py-1.5 text-xs font-medium transition ${
                      gpsStatus === 'done'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {gpsStatus === 'locating' && 'Locating…'}
                    {gpsStatus === 'done' && '✓ Exact GPS location captured — driver can find you exactly'}
                    {(gpsStatus === 'idle' || gpsStatus === 'error') && '📍 Use my exact GPS location'}
                  </button>
                  {gpsStatus === 'error' && <p className="mt-1 text-[11px] text-rose-600">{gpsError}</p>}
                </>
              )}
              <div className="mt-1.5 flex flex-wrap gap-1">
                <span className="text-[11px] text-slate-400">Save this destination as:</span>
                {SAVED_LOCATION_LABELS.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleSaveLocation(label, dropoff)}
                    className="rounded-full border border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                  >
                    {savedLocationButtonLabel(label)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {savedLocations.length > 0 && (
            <div className="space-y-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-500">Saved places</p>
              {savedLocations.map((s) => {
                const favorites = savedLocations.filter((f) => f.label === 'Favorite')
                const favoriteNumber = s.label === 'Favorite' && favorites.length > 1 ? favorites.findIndex((f) => f.id === s.id) + 1 : null
                return (
                <div key={s.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate text-slate-600">
                    {SAVED_LOCATION_ICONS[s.label]} {s.label}
                    {favoriteNumber !== null ? ` ${favoriteNumber}` : ''} — {s.location.label}
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => handlePickupQuickPick(s.location)}
                      className="rounded-lg border border-slate-300 px-2 py-1 font-medium text-slate-600 hover:bg-white"
                    >
                      Pickup
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDropoffQuickPick(s.location)}
                      className="rounded-lg border border-slate-300 px-2 py-1 font-medium text-slate-600 hover:bg-white"
                    >
                      Destination
                    </button>
                    <button
                      type="button"
                      onClick={() => removePassengerLocation(passenger.id, s.id)}
                      className="rounded-lg border border-rose-200 px-2 py-1 font-medium text-rose-600 hover:bg-rose-50"
                    >
                      ×
                    </button>
                  </div>
                </div>
                )
              })}
            </div>
          )}

          {isErrand && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Tip your driver (optional)</label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-slate-500">₱</span>
                <input
                  type="number"
                  min={0}
                  value={tipInput}
                  onChange={(e) => setTipInput(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          {!isErrand && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Passengers riding (up to {MAX_RIDE_PASSENGERS})</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPassengerCount((n) => Math.max(1, n - 1))}
                  disabled={passengerCount <= 1}
                  className="h-8 w-8 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm font-semibold text-slate-800">{passengerCount}</span>
                <button
                  type="button"
                  onClick={() => setPassengerCount((n) => Math.min(MAX_RIDE_PASSENGERS, n + 1))}
                  disabled={passengerCount >= MAX_RIDE_PASSENGERS}
                  className="h-8 w-8 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  +
                </button>
                <span className="text-xs text-slate-400">
                  {passengerCount > 1 ? `Riding together — sharing this tricycle` : 'Just you'}
                </span>
              </div>
              {passengerCount > 1 && tariffSettings.extraPassengerFee > 0 && (
                <p className="mt-1 text-[11px] text-slate-400">
                  +₱{tariffSettings.extraPassengerFee} per rider beyond the first
                </p>
              )}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Favorite driver (optional)</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={passenger.favoriteDriverId ?? ''}
              onChange={(e) => setFavoriteDriver(passenger.id, e.target.value || null)}
            >
              <option value="">No favorite — normal terminal queue order</option>
              {drivers
                .filter((d) => d.verificationStatus === 'approved' && d.accessStatus === 'active')
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} · {d.plateNumber}
                  </option>
                ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">
              If set, your favorite driver is offered your next ride first, ahead of the normal queue.
            </p>
          </div>

          <button
            onClick={handleRequest}
            disabled={!canSubmit}
            className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isPabili
              ? isGuestBooking
                ? `Request Pabili for ${guestRider.otherName.trim() || 'them'}`
                : 'Request Pabili'
              : isGuestBooking
                ? `Request tricycle for ${guestRider.otherName.trim() || 'them'}`
                : 'Request tricycle'}
          </button>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Payment method</label>
            <div className="grid grid-cols-4 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMethod(m.id)}
                  className={`rounded-lg border py-2 text-xs font-medium transition ${
                    paymentMethod === m.id
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <p className="pb-0.5 text-[11px] font-medium text-slate-400">Estimated cost breakdown</p>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Standard rate{isErrand ? ' (round trip, x2)' : ` (covers ${tariffSettings.standardKmCovered} km)`}</span>
              <span>₱{fareStandardRatePortion}</span>
            </div>
            {fareExtraKmFeePortion > 0 && (
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  Extra distance ({fareExtraKmDisplay.toFixed(1)} km beyond the {tariffSettings.standardKmCovered} km
                  covered{isErrand ? ', round trip' : ''})
                </span>
                <span>₱{fareExtraKmFeePortion}</span>
              </div>
            )}
            {isErrand && (
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Pabili service fee</span>
                <span>₱{serviceFee}</span>
              </div>
            )}
            {specialPickupFee > 0 && (
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Special pickup — Terminal detour ({specialPickupBreakdown.extraKm.toFixed(1)} km)</span>
                <span>₱{specialPickupFee}</span>
              </div>
            )}
            {isErrand && tip > 0 && (
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Tip</span>
                <span>₱{tip}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-slate-200 pt-1">
              <span className="font-medium text-slate-600">{isErrand ? 'Total' : 'Estimated fare'}</span>
              <span className="font-semibold text-slate-800">₱{totalFare}</span>
            </div>
          </div>
          </>
          )}
            </>
          )}
        </section>
      )}

      <section ref={tripHistorySectionRef}>
        <button
          type="button"
          onClick={() => setShowTripHistory((v) => !v)}
          className="mb-2 flex w-full items-center justify-between text-sm font-semibold text-slate-700"
        >
          Trip history
          <span className="text-xs text-slate-400">{showTripHistory ? '▲ Hide' : '▼ Show'}</span>
        </button>
        {showTripHistory && (
        <div className="space-y-2">
          {visibleTripHistory.length === 0 && <p className="text-sm text-slate-400">No trips yet.</p>}
          {visibleTripHistory.map((r) => {
            const driver = r.driverId ? drivers.find((d) => d.id === r.driverId) : null
            const toda = driver?.todaOrgId ? todaOrganizations.find((o) => o.id === driver.todaOrgId) : null
            return (
              <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">
                    {r.serviceType === 'pabili' && '🛍️ Pabili · '}
                    {r.serviceType === 'buy_medicine' && '💊 Buy Medicine · '}
                    {r.pickup.label} → {r.dropoff.label}
                  </span>
                  <StatusBadge status={r.status} />
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  ₱{r.fareEstimate}
                  {r.pabiliTip > 0 && ` + ₱${r.pabiliTip} tip`}
                  {r.tipOffer > 0 && ` + ₱${r.tipOffer} tip offer`} · {new Date(r.requestedAt).toLocaleString()}
                </div>
                {(r.serviceType === 'pabili' || r.serviceType === 'buy_medicine') && r.pabiliItems && (
                  <p className="mt-1 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">🛒 {r.pabiliItems}</p>
                )}
                {r.payment && <ReceiptCard payment={r.payment} />}
                {r.status === 'completed' && driver && (
                  <RateRideSection ride={r} driverName={driver.name} todaName={toda?.name ?? null} />
                )}
                {driver && <ReportDriverSection ride={r} driver={driver} passengerId={passenger.id} passengerName={passenger.name} />}
              </div>
            )
          })}
        </div>
        )}
      </section>

      <GoogleAdSlot placement="passengerBottom" />
      </>
      )}
    </div>
  )
}

function ActiveRideCard({
  rideId,
  onCancel,
  onDismiss,
}: {
  rideId: string
  onCancel: () => void
  onDismiss: () => void
}) {
  const { rides } = useRides()
  const ride = rides.find((r) => r.id === rideId)
  if (!ride) return null

  return (
    <TripMonitor
      title="Your ride"
      ride={ride}
      sosActorId={ride.passengerId}
      sosLabel="SOS — Something's wrong"
      showCancel
      onCancel={onCancel}
      onDismiss={onDismiss}
      allowLiveGpsToggle
    />
  )
}

function RateRideSection({ ride, driverName, todaName }: { ride: Ride; driverName: string; todaName: string | null }) {
  const { rateRide } = useRides()
  const [open, setOpen] = useState(false)
  const [driverStars, setDriverStars] = useState(0)
  const [driverReview, setDriverReview] = useState('')
  const [todaStars, setTodaStars] = useState(0)
  const [todaReview, setTodaReview] = useState('')

  if (ride.ratedAt) {
    return (
      <div className="mt-2 space-y-1 rounded-lg bg-slate-50 p-2.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Your rating — {driverName}</span>
          <StarRating value={ride.driverRating ?? 0} size="sm" />
        </div>
        {ride.driverReviewText && <p className="text-slate-600">"{ride.driverReviewText}"</p>}
        {todaName && ride.todaRating !== null && (
          <>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-slate-500">Your rating — {todaName}</span>
              <StarRating value={ride.todaRating} size="sm" />
            </div>
            {ride.todaReviewText && <p className="text-slate-600">"{ride.todaReviewText}"</p>}
          </>
        )}
      </div>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 w-full rounded-lg border border-slate-300 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        ⭐ Rate this ride
      </button>
    )
  }

  return (
    <div className="mt-2 space-y-2.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
      <div>
        <p className="mb-1 text-xs font-medium text-slate-500">Driver — {driverName}</p>
        <StarRating value={driverStars} onChange={setDriverStars} />
        <textarea
          value={driverReview}
          onChange={(e) => setDriverReview(e.target.value)}
          placeholder="Optional review of your driver…"
          rows={2}
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
        />
      </div>
      {todaName && (
        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">TODA — {todaName}</p>
          <StarRating value={todaStars} onChange={setTodaStars} />
          <textarea
            value={todaReview}
            onChange={(e) => setTodaReview(e.target.value)}
            placeholder="Optional review of the TODA…"
            rows={2}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={driverStars < 1}
          onClick={() =>
            rateRide({
              rideId: ride.id,
              driverRating: driverStars,
              driverReviewText: driverReview,
              todaRating: todaName ? (todaStars || null) : null,
              todaReviewText: todaReview,
            })
          }
          className="flex-1 rounded-lg bg-brand-600 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Submit rating
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function ReportDriverSection({
  ride,
  driver,
  passengerId,
  passengerName,
}: {
  ride: Ride
  driver: { id: string; name: string }
  passengerId: string
  passengerName: string
}) {
  const { reportDriver } = useRides()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<DriverReportReason>('other')
  const [details, setDetails] = useState('')
  const [submitted, setSubmitted] = useState(false)

  if (submitted) {
    return <p className="mt-2 text-xs text-emerald-700">✓ Reported — our team will review this.</p>
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1.5 w-full rounded-lg border border-rose-200 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
      >
        🚩 Report driver
      </button>
    )
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-dashed border-rose-200 bg-rose-50 p-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Reason</span>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value as DriverReportReason)}
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
        >
          {DRIVER_REPORT_REASONS.map((r) => (
            <option key={r} value={r}>
              {DRIVER_REPORT_REASON_LABELS[r]}
            </option>
          ))}
        </select>
      </label>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="What happened?"
        rows={2}
        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            reportDriver({
              rideId: ride.id,
              passengerId,
              passengerName,
              driverId: driver.id,
              driverName: driver.name,
              reason,
              details,
            })
            setSubmitted(true)
          }}
          className="flex-1 rounded-lg bg-rose-600 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
        >
          Submit report
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
