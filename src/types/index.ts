export type Role = 'passenger' | 'driver' | 'parent' | 'admin'

export interface Coords {
  x: number
  y: number
}

export interface MockLocation {
  id: string
  label: string
  coords: Coords
  // Real-shaped (though illustrative, not exhaustive) PH address tags used
  // purely for search/filter matching — the abstract x/y coords above still
  // drive the fare/ETA simulation math.
  province: string
  city: string
  barangay: string
  // Real approximate lat/lng, used only to place this point on the actual
  // OpenStreetMap live-tracking view — independent of the coords above.
  gps: GeoCoords
}

export interface LocationPing {
  ts: string
  coords: Coords
}

export type RideStatus =
  | 'requested'
  | 'accepted'
  | 'driver_arriving'
  | 'ongoing'
  | 'completed'
  | 'declined'
  | 'cancelled'

export type VerificationStatus = 'pending' | 'approved' | 'rejected'

export type DocumentType = 'nbiClearance' | 'driversLicense' | 'ltoRegistration' | 'lguRegistration'

export interface DriverDocument {
  submitted: boolean
  dataUrl: string | null
}

export type DriverDocuments = Record<DocumentType, DriverDocument>

export interface GeoCoords {
  lat: number
  lng: number
}

export type TodaOfficerRole = 'President' | 'Secretary' | 'Other'

export interface TodaOfficer {
  name: string
  role: TodaOfficerRole
}

export type TodaOrgVerificationStatus = 'pending' | 'approved' | 'rejected'

// Two independent sign-offs are required before a TODA's own per-ride
// commission actually takes effect: the org's own members (simulated as a
// single attestation toggle the TODA Admin sets — no real per-member vote)
// and the App Admin. Both must be true for proposedCommissionPerRide to be
// charged; otherwise the TODA collects nothing extra.
export interface TodaOrganization {
  id: string
  name: string
  // Legacy link into the abstract-grid pickup/priority-dispatch system used
  // by the three seed TODAs; null for newly self-registered orgs, which
  // rely on terminalGps instead (see isRideVisibleToDriver/getPriorityTodaOrgId
  // scoping notes — new orgs don't yet participate in ride pickup priority,
  // only in the terminal-presence queue-join check).
  terminalLocationId: string | null
  proposedCommissionPerRide: number | null
  commissionApprovedByMembers: boolean
  commissionApprovedByAdmin: boolean
  // Exclusive access credential for this org's own TODA Admin panel — a
  // separate officer credential, not tied to any individual driver login.
  adminPin: string
  // At least two authorized officers (President and/or Secretary) named at
  // registration, who the App Admin can hold accountable for the org.
  officers: TodaOfficer[]
  province: string
  city: string
  barangay: string
  addressDetail: string
  // Captured via the browser's real Geolocation API — this is what
  // getTodaQueue's proximity check compares a driver's live position
  // against before letting them join the queue. Null until someone
  // captures/sets it (registration doesn't strictly require it, but the
  // proximity check is skipped entirely when it's null).
  terminalGps: GeoCoords | null
  verificationStatus: TodaOrgVerificationStatus
  // Same "approve as noted, with a resubmission deadline" pattern as
  // Driver.pendingNote/pendingNoteDeadline — set together when the App Admin
  // uses "Approve as noted" instead of a bare Approve/Reject on a pending
  // registration.
  registrationNote: string | null
  registrationNoteDeadline: string | null
  // Passenger-submitted average, folded in as a running average alongside
  // ratingCount — same shape as Driver's rating/ratingCount below.
  rating: number
  ratingCount: number
  // TaaS Level 1 — every TODA is a "SaaS Partner" by default (see
  // TODASafeRide-as-a-Service business roadmap). These are B2B billing
  // fields owed to TODASafeRide HQ, separate from the per-ride fare split
  // above — never subtracted from proposedCommissionPerRide/driver payouts.
  saasPlan: SaasPlan
  monthlyPlatformFee: number
  perBookingFee: number
  // Level-2 Operator this TODA reports to, if any; null = reports directly
  // to HQ (the default — most TODAs never move past Level 1).
  operatorId: string | null
}

export type SaasPlan = 'starter' | 'standard' | 'premium'

// TaaS Level 2 — "Authorized Operator": an established TODA
// cooperative/organization that has qualified for greater access to the
// TODASafeRide brand and business system, and can itself have one or more
// TodaOrganizations reporting to it (see TodaOrganization.operatorId). A
// distinct account/login from TodaOrganization's own TODA Admin — modeled on
// the same PIN-login + pending/approved verification pattern.
export interface Operator {
  id: string
  name: string
  contactPerson: string
  contactPhone: string
  adminPin: string
  province: string
  city: string
  // Self-service business-profile fields — editable from the Operator's own
  // dashboard (OperatorPortalPage.tsx) via updateOperatorProfile, unlike
  // TodaOrganization/Pharmacy's org profile which stays read-only.
  email: string | null
  barangay: string
  addressDetail: string
  businessRegistrationNo: string | null
  // One-time activation fee, set by the App Admin on approval (typical
  // ₱25,000–75,000 per the roadmap) — null until approved.
  activationFee: number | null
  monthlyPlatformFee: number
  perBookingFee: number
  // Level-3 Franchise this Operator belongs to, if any; null = reports
  // directly to HQ.
  franchiseId: string | null
  verificationStatus: TodaOrgVerificationStatus
  registrationNote: string | null
}

// TaaS Level 3 — "Franchise": the right to operate a TODASafeRide business
// within an approved territory, introduced only after the SaaS/Operator
// levels have proven the model (see roadmap's "earn the right to franchise").
// Owns a set of Operators via Operator.franchiseId. royaltyPct is
// display-only — it is never deducted from actual ride payouts.
export interface Franchise {
  id: string
  name: string
  contactPerson: string
  contactPhone: string
  adminPin: string
  province: string
  city: string
  // Self-service business-profile fields — editable from the Franchise's own
  // dashboard (FranchisePage.tsx) via updateFranchiseProfile.
  email: string | null
  barangay: string
  addressDetail: string
  businessRegistrationNo: string | null
  // One-time franchise fee, set by the App Admin on approval (typical
  // ₱100,000–300,000+ per the roadmap) — null until approved.
  initialFranchiseFee: number | null
  monthlyTechnologyFee: number
  royaltyPct: number | null
  verificationStatus: TodaOrgVerificationStatus
  registrationNote: string | null
}

// TODARIDE MEDS — a pharmacy account, modeled directly on TodaOrganization
// above: its own PIN login, its own portal (PharmacyPortalPage), scoped to
// its own orders/products. For this MVP pass every seeded pharmacy ships
// pre-approved (no Admin approval UI yet — see verificationStatus comment).
export type MedicineCategory = 'otc' | 'rx' | 'restricted'

export interface MedicineProduct {
  id: string
  pharmacyId: string
  name: string
  genericName: string | null
  category: MedicineCategory
  price: number
  inStock: boolean
}

// 'pharmacy' gets the full TODARIDE MEDS catalog/quote pipeline (this
// entity's own products + medsOrders/quote flow). 'store' is a general
// business (sari-sari store, hardware, grocery, etc.) with no medicine
// catalog — it registers through the same form so it appears as a pickable,
// named pickup point for a Pabili errand instead of the auto-resolved
// generic "nearby public market", but Pabili itself stays freeform (the
// passenger still just types what to buy; there's no product list or quote
// step for a store).
export type BusinessType = 'pharmacy' | 'store'

// A single e-wallet account a pharmacy/store shows to customers so they can
// pay for goods directly (as opposed to cash, which the driver collects on
// delivery — see MedsBooking.tsx/PassengerPage.tsx's "medicine cost to the
// pharmacy, delivery fee to the driver" split). qrDataUrl is optional since
// a business may only want to show the account number/name.
export interface PaymentAccountDetails {
  accountName: string
  accountNumber: string
  qrDataUrl: string | null
}

export interface Pharmacy {
  id: string
  name: string
  businessType: BusinessType
  // Null until the pharmacy/store fills these in from its own portal — see
  // PharmacyPortalPage.tsx's "Payment accounts" section. Customers only see
  // one of these (and its QR/account info) when they pick GCash/Maya as
  // their payment method — Card stays a plain simulated "paid online" note
  // since it has no comparable account-number/QR concept.
  gcashAccount: PaymentAccountDetails | null
  mayaAccount: PaymentAccountDetails | null
  // Exclusive login credential for this pharmacy's own portal — same role as
  // TodaOrganization.adminPin.
  adminPin: string
  contactPhone: string
  province: string
  city: string
  barangay: string
  addressDetail: string
  // Abstract simulation-grid position (fare/ETA math) alongside the real
  // locationGps below, same split as MockLocation.coords/gps — needed so a
  // confirmed order can build a pickup MockLocation for the dispatched Ride.
  coords: Coords
  locationGps: GeoCoords | null
  isOpen: boolean
  // 'pending'/'rejected' exist for a future Admin-approval pass — every
  // seeded pharmacy this MVP ships as 'approved' directly, so the UI never
  // actually shows a pending/rejected pharmacy yet.
  verificationStatus: TodaOrgVerificationStatus
  // Editable from My Profile (see NavBar.tsx's hamburger drawer) — optional
  // so existing Pharmacy literals stay valid. No email field previously
  // existed at all; paymentDetail here is deliberately separate from the
  // real gcashAccount/mayaAccount above (those are what customers actually
  // pay into — this is just a free-text note on the profile panel).
  email?: string | null
  paymentDetail?: string | null
  password?: string | null
  emergencyContact?: string | null
}

// Full lifecycle: pending_confirmation (customer asked for a quote) →
// quoted (pharmacy priced the items, awaiting the customer) → confirmed
// (customer accepted the quote and checked out — only now may the pharmacy
// actually process/dispatch it) → ready_for_pickup (self_book orders only,
// between processing and the customer booking their own ride) → dispatched
// (a real Ride exists — look at it for further delivery status instead of
// tracking progress twice here). rejected/cancelled are terminal off-ramps
// reachable from any pre-dispatch state.
export type MedsOrderStatus =
  | 'pending_confirmation'
  | 'quoted'
  | 'confirmed'
  | 'rejected'
  | 'cancelled'
  | 'ready_for_pickup'
  | 'dispatched'

export interface MedsOrderItem {
  productId: string
  name: string
  quantity: number
  unitPrice: number
  // The pharmacy's own note on this line — e.g. the requested brand wasn't
  // in stock and they substituted a generic — set when they send the quote,
  // shown to the customer alongside the price. Null until then.
  note: string | null
}

export interface MedsOrder {
  id: string
  customerId: string
  customerName: string
  pharmacyId: string
  items: MedsOrderItem[]
  subtotal: number
  deliveryFee: number
  serviceFee: number
  total: number
  paymentMethod: PaymentMethod
  status: MedsOrderStatus
  rejectionReason: string | null
  // 'not_required' when the cart has no Rx item — otherwise starts 'pending'
  // as soon as a prescription photo is attached, reviewed by the pharmacy
  // portal same as a driver document review. An array since a prescription
  // is often more than one page — empty array means none attached.
  prescriptionDataUrls: string[]
  prescriptionStatus: 'not_required' | 'pending' | 'approved' | 'rejected'
  // A photo of a handwritten/printed receipt the pharmacy sends back with
  // its quote — the alternative to (or backup for) typing individual line
  // items, for a prescription-only order with nothing itemized yet. Set
  // together with the quote (see PHARMACY_SEND_QUOTE); null otherwise.
  receiptDataUrl: string | null
  deliveryAddress: MockLocation
  // Chosen by the customer at checkout. 'pharmacy_books' (default): the
  // pharmacy's confirmation immediately dispatches a Ride, same as before
  // this field existed. 'self_book': confirmation instead leaves the order
  // at 'ready_for_pickup' and the customer dispatches the Ride themselves
  // (e.g. to pick their own favorite driver, or time it around their day)
  // via bookOwnMedsRide.
  deliveryMode: 'pharmacy_books' | 'self_book'
  // Set once a Ride is actually created for this order (either
  // automatically when the pharmacy processes it, or via bookOwnMedsRide) —
  // from here on, DriverPage/TripMonitor (looking up this Ride) are the
  // source of truth for delivery progress, not this MedsOrder.
  linkedRideId: string | null
  // Simulated online payment — set together when the customer accepts a
  // quote with an online method (gcash/maya/card). Same "Prototype ·
  // Simulated data" spirit as the rest of the app's payment handling: no
  // real gateway, just an instant recorded confirmation. Stays null for
  // cash, which is still collected/confirmed at delivery via the linked
  // Ride's existing payment flow, unchanged.
  paidOnline: boolean
  paymentReference: string | null
  // Uploaded by the customer alongside accepting a gcash/maya quote — a
  // screenshot of the actual e-wallet transfer to the pharmacy's own
  // account (see Pharmacy.gcashAccount/mayaAccount), so the pharmacy has
  // something to check before processing. Optional — stays null for cash
  // and for online payments the customer didn't bother attaching proof to.
  paymentProofDataUrl: string | null
  requestedAt: string
  quotedAt: string | null
  confirmedAt: string | null
  // Freeform back-and-forth between the customer and the pharmacy about
  // this specific order — brand substitutions, stock questions, delivery
  // instructions. Kept on the order itself (not the eventual Ride) since it
  // starts as soon as a quote is requested, before any driver exists.
  messages: OrderMessage[]
}

export interface OrderMessage {
  id: string
  sender: 'customer' | 'pharmacy'
  text: string
  sentAt: string
}

export type DriverAccessStatus = 'active' | 'paused' | 'terminated'

export interface Driver {
  id: string
  name: string
  plateNumber: string
  licenseNo: string
  licenseExpiry: string
  pin: string
  rating: number
  // Number of ratings folded into `rating` so far — lets a new rating be
  // merged in as a running average instead of overwriting it.
  ratingCount: number
  online: boolean
  verificationStatus: VerificationStatus
  documents: DriverDocuments
  todaOrgId: string | null
  province: string
  city: string
  barangay: string
  addressDetail: string
  phone: string
  // Optional alternate login identifier alongside name/phone — not collected
  // at registration by default, only if the driver chooses to add one.
  email: string | null
  // Optional Facebook profile URL/username — common for PH riders/TODAs to
  // vouch for or look up a driver informally, alongside the formal license
  // documents below.
  facebook: string | null
  // When this TODA member last joined the terminal queue; null = not
  // currently queued. Ordering within a TODA's queue is by this timestamp
  // ascending (first to join is first offered a ride). Irrelevant for
  // freelance drivers (todaOrgId === null) — they have no terminal queue.
  queueJoinedAt: string | null
  // Opt-in: when a request is a Pabili errand, drivers with this on are
  // offered it before anyone else in the terminal queue (still in join
  // order among themselves) — Pabili makes up a large, real share of
  // requests, so drivers who specifically want that work can get first
  // crack at it instead of it being offered in plain queue order. Doesn't
  // affect regular ride requests at all.
  pabiliPriority: boolean
  // Only the App Admin can change this (not the TODA itself — a TODA can
  // only *request* a hold/terminate, see MembershipRequest). A paused or
  // terminated driver can still log in to see why, but can't join a
  // terminal queue or receive ride offers.
  accessStatus: DriverAccessStatus
  accessNote: string | null
  // Admin's note on a still-pending application, shown to the applicant on
  // their login screen (e.g. "resubmit a clearer LTO OR/CR photo").
  pendingNote: string | null
  // Set together with pendingNote when Admin uses "Approve as noted" instead
  // of a bare Approve/Reject — gives the applicant a real deadline to submit
  // the missing requirement. Purely a display deadline (see isPastDeadline
  // in mock/data.ts): once it passes with the application still pending,
  // the queue shows it as needing rejection rather than silently mutating
  // state on its own.
  pendingNoteDeadline: string | null
  // Set together with verificationStatus 'rejected' — Admin's reason shown to
  // the applicant on their login screen, alongside the option to appeal.
  rejectionReason: string | null
  // Set when a rejected applicant appeals — flips verificationStatus back to
  // 'pending' so it re-enters the Admin queue, with this message shown
  // alongside the original rejectionReason for context. Cleared whenever
  // Admin approves or rejects again (see APPROVE_DRIVER/REJECT_DRIVER).
  appealMessage: string | null
  appealedAt: string | null
  // Freeform note of a preferred payout account (e.g. a GCash/Maya number)
  // shown on My Profile — a saved reference only, doesn't change how fares
  // are actually settled. Optional so existing Driver literals don't need
  // updating just because this field exists.
  paymentDetail?: string | null
  // Account password set from My Profile — this prototype's actual login
  // still only checks `pin` (see DriverAuthGate.tsx), so this field is
  // stored for completeness but doesn't gate sign-in.
  password?: string | null
  // A driver has no guardian/parent account backing an emergency contact
  // the way a Passenger's guardianPhone does — this is the driver-side
  // equivalent, editable from My Profile.
  emergencyContact?: string | null
}

// A fixed, single-slot-per-label set of quick-pick places — saving a new
// location under a label already in use (e.g. a second "Home") replaces the
// old one rather than accumulating duplicates. `location` is a full
// MockLocation (not just an id) so a saved place can be either a preset
// location or a previously-geocoded custom address, either way carrying its
// own real gps for the map.
export type SavedLocationLabel = 'Home' | 'School' | 'Work' | 'Favorite'

export interface SavedLocation {
  id: string
  label: SavedLocationLabel
  location: MockLocation
}

export interface Passenger {
  id: string
  name: string
  age: number
  isStudent: boolean
  // PWD/Senior citizen discount — mutually exclusive with isStudent in
  // practice (fare calc gives this priority when both are somehow true).
  isPwdSenior: boolean
  phone: string
  // Optional alternate login identifier alongside name/phone.
  email: string | null
  // 4-digit PIN, alternative to OTP at login. Null for passengers who never
  // log in on their own (e.g. a child registered through a Parent account).
  pin: string | null
  province: string
  city: string
  barangay: string
  addressDetail: string
  // Only used as an SOS fallback when this passenger has no linked parent
  // account (e.g. a solo-registered adult passenger).
  guardianPhone: string | null
  // When set, a new ride is offered to this driver first, ahead of the
  // normal terminal-queue order.
  favoriteDriverId: string | null
  savedLocations: SavedLocation[]
  // Freeform note of a preferred payment account (e.g. a GCash/Maya number)
  // shown on My Profile — a saved reference only, not read by checkout,
  // which still asks the payment method fresh on every booking. Optional so
  // existing seed passengers (and every other Passenger literal in the
  // codebase) don't need updating just because this field exists.
  paymentDetail?: string | null
  // Account password set from My Profile — this prototype's actual login
  // still only checks `pin`/OTP (see AuthGate.tsx), so this field is stored
  // for completeness but doesn't gate sign-in. Optional for the same reason
  // as paymentDetail above.
  password?: string | null
}

// A TODA officer starts a new member's registration by supplying just
// enough to identify them and a channel to reach them — the invite link
// (built from this record's id) opens the driver registration form
// pre-filled with these fields and locked to this TODA, so the recruit only
// has to add the rest: plate/license/address/PIN/documents.
export interface DriverInvite {
  id: string
  todaOrgId: string
  name: string
  phone: string
  email: string | null
  createdAt: string
  // Set once someone actually completes registration through this invite —
  // an invite is single-use so the same link can't spawn duplicate accounts.
  usedByDriverId: string | null
}

export type DuesType = 'monthly_dues' | 'contribution'

export interface DuesRecord {
  id: string
  driverId: string
  todaOrgId: string
  type: DuesType
  label: string
  amount: number
  dueDate: string
  paidAt: string | null
}

export type MembershipRequestType = 'hold' | 'terminate'
export type MembershipRequestStatus = 'pending' | 'approved' | 'rejected'

// A TODA org can only ask — the App Admin decides. This is that ask.
export interface MembershipRequest {
  id: string
  driverId: string
  todaOrgId: string
  requestType: MembershipRequestType
  reason: string
  status: MembershipRequestStatus
  requestedAt: string
  resolvedAt: string | null
}

export interface Parent {
  id: string
  name: string
  phone: string
  // Optional alternate login identifier alongside name/phone.
  email: string | null
  // 4-digit PIN, alternative to OTP at login.
  pin: string | null
  province: string
  city: string
  barangay: string
  addressDetail: string
  // When set, a new ride booked for the parent's own self-booking is
  // offered to this driver first, ahead of the normal terminal-queue order
  // — mirrors Passenger.favoriteDriverId. Optional (not `| null`) so older
  // persisted records without it still satisfy the type; treat missing the
  // same as null.
  favoriteDriverId?: string | null
  // Same optional, editable-from-My-Profile fields as Passenger/Driver —
  // see those for why they're optional (existing literals stay valid).
  paymentDetail?: string | null
  password?: string | null
  emergencyContact?: string | null
}

export interface ParentLink {
  parentId: string
  studentPassengerId: string
  relationship: string
  consentGiven: boolean
  proofOfAuthorityDataUrl: string | null
  consentedAt: string
}

export type SosAlertType = 'sos' | 'route_deviation'
export type SosAlertStatus = 'open' | 'resolved'
export type SosTriggeredByRole = 'passenger' | 'driver'

export interface SosAlert {
  id: string
  // Ride-bound for the original passenger-triggered flow; null for a
  // driver-initiated SOS (see TRIGGER_DRIVER_SOS), which can fire whether or
  // not the driver is currently on a trip.
  rideId: string | null
  triggeredBy: string
  type: SosAlertType
  status: SosAlertStatus
  notes: string
  createdAt: string
  // Set when this alert's passenger had no linked parent account, so the
  // fallback guardian contact on file was (simulated-)notified instead.
  guardianNotifiedPhone: string | null
  // Driver-initiated SOS only — undefined/null on every existing
  // passenger-triggered alert. todaOrgId is what lets TodaAdminPage.tsx and
  // fellow members on DriverPage.tsx find "alerts from my own TODA" without
  // touching the (unscoped, ride-bound) passenger SOS path at all.
  triggeredByRole?: SosTriggeredByRole
  todaOrgId?: string | null
  location?: GeoCoords | null
}

export interface RidePhoto {
  id: string
  dataUrl: string
  takenBy: string
  takenAt: string
}

export type PaymentMethod = 'cash' | 'gcash' | 'maya' | 'card'
export type PaymentStatus = 'pending' | 'paid'

export interface Payment {
  method: PaymentMethod
  status: PaymentStatus
  referenceNo: string | null
  // Total collected from the passenger, i.e. fareEstimate + tip.
  amount: number
  driverPayout: number
  platformFee: number
  // The driver's own TODA's per-ride cut, if the org has an
  // admin-and-member-approved commission active at completion time. 0 for
  // freelance drivers or TODAs without an active commission.
  todaCommission: number
  // Passenger-offered tip (Pabili orders only, currently) — goes to the
  // driver in full, not subject to platform fee or TODA commission.
  tip: number
  paidAt: string
}

export type QueueOfferOutcome = 'declined' | 'timeout'

export interface QueueOfferLogEntry {
  driverId: string
  driverName: string
  outcome: QueueOfferOutcome
  at: string
}

export interface Ride {
  id: string
  passengerId: string
  passengerName: string
  // Only set for a "book for someone else" guest ride, where passengerId is
  // a synthetic id with no real Passenger record to look up a phone from —
  // lets the driver still call the actual rider directly. Null otherwise;
  // a self-booking's phone comes from the real Passenger/Parent record.
  passengerPhone: string | null
  driverId: string | null
  driverName: string | null
  pickup: MockLocation
  dropoff: MockLocation
  fareEstimate: number
  status: RideStatus
  requestedAt: string
  acceptedAt: string | null
  startedAt: string | null
  completedAt: string | null
  driverPosition: Coords | null
  passengerPosition: Coords | null
  // Real device GPS captured at booking time, for the driver to pinpoint
  // exactly where the passenger is standing — independent of the abstract
  // pickup point used for the simulation grid above. Null if the passenger
  // didn't capture it (it's optional).
  pickupGps: GeoCoords | null
  // Continuously-updated real device GPS, only present while the driver (or
  // passenger) has explicitly opted in to live-sharing their location on the
  // real OpenStreetMap tracking view for this ride — null otherwise, in
  // which case the map falls back to interpolating along legProgress.
  driverLiveGps: GeoCoords | null
  driverLiveGpsAt: string | null
  passengerLiveGps: GeoCoords | null
  passengerLiveGpsAt: string | null
  legProgress: number
  locationLog: LocationPing[]
  paymentMethod: PaymentMethod
  payment: Payment | null
  isStudentRide: boolean
  // PWD/Senior discount, snapshotted at request time same as isStudentRide —
  // takes priority over the student rate if both are somehow true.
  isPwdSeniorRide: boolean
  routeAlert: boolean
  deviationOffset: Coords | null
  safetyPhotos: RidePhoto[]
  priorityTodaOrgId: string | null
  // Sequential terminal-queue dispatch: while the priority window is open,
  // only the driver currently "up" (queueOfferedDriverId) can accept — not
  // a broadcast to the whole TODA. Null means either the queue was empty at
  // request time or everyone in it has already been offered and passed, in
  // which case the ride opens to all immediately (see isRideVisibleToDriver).
  priorityQueueOfferedDriverId: string | null
  priorityQueueOfferedAt: string | null
  priorityQueueLog: QueueOfferLogEntry[]
  // How many riders are actually in the tricycle for this trip (1-4, a
  // standard tricycle's practical capacity) — the passenger books once for
  // their whole group rather than each rider booking separately.
  passengerCount: number
  // A completed ride can be rated once — driver and TODA are rated and
  // reviewed independently (a great driver from a poorly-run TODA, or vice
  // versa, should be able to say so). Null fields = not yet rated.
  driverRating: number | null
  driverReviewText: string | null
  todaRating: number | null
  todaReviewText: string | null
  ratedAt: string | null
  // "ride" is a normal trip; "pabili" and "buy_medicine" are errand
  // requests — the driver buys whatever's in pabiliItems at `pickup` and
  // delivers it to `dropoff`, reusing the same dispatch/tracking/completion
  // flow as a regular ride. "buy_medicine" additionally carries the
  // passenger's uploaded prescription/ID so the driver can show them at the
  // pharmacy counter.
  serviceType: ServiceType
  pabiliItems: string | null
  // Goes entirely to the driver on completion — see Payment.tip.
  pabiliTip: number
  // Admin's Pabili/Buy Medicine service charge, snapshotted at request time
  // (0 for serviceType 'ride') and folded into fareEstimate.
  pabiliServiceFee: number
  // "buy_medicine" only — a photo of the passenger's prescription and/or
  // Senior Citizen ID (for discounted/controlled medicine) and any other
  // supporting document, so the driver can present them at the pharmacy
  // counter instead of the passenger having to be there in person. All
  // optional (not every purchase needs a prescription or a senior discount)
  // and empty/null for every other serviceType. prescriptionDataUrls is an
  // array since a prescription is often more than one page.
  prescriptionDataUrls: string[]
  seniorIdDataUrl: string | null
  otherDocDataUrl: string | null
  // A screenshot of a gcash/maya transfer sent directly to a Pabili store's
  // own account (see Pharmacy.gcashAccount/mayaAccount) — only meaningful
  // when pickup is a registered store and paymentMethod isn't 'cash'. Null
  // otherwise; purely informational for the driver, same spirit as the
  // prescription/document photos above.
  paymentProofDataUrl: string | null
  // Set when a parent booked this ride on behalf of their linked child
  // (passengerId/passengerName are still the child's — this is just a
  // record of who initiated it).
  bookedByParentId: string | null
  // "Special pickup": the passenger's TODA Terminal is far from them, so
  // instead of walking to the terminal they've asked the driver to come to
  // their exact pickupGps spot — folded into fareEstimate as the extra
  // terminal→pickup distance beyond tariffSettings.standardKmCovered (see
  // estimateSpecialPickupFee in mock/data.ts). specialPickupFee is 0 (and
  // specialPickupRequested false) for an ordinary terminal pickup.
  specialPickupRequested: boolean
  specialPickupFee: number
  // An incentive tip the passenger can add (and keep raising) while still
  // waiting for a driver to accept — separate from pabiliTip (which is
  // fixed at request time for an errand). Starts at 0 and only rises while
  // status is 'requested' (see ADD_TIP_OFFER); goes entirely to the driver
  // on completion, same as pabiliTip — see Payment.tip.
  tipOffer: number
  // The payment method chosen at request time is locked while the trip is
  // in progress — the passenger sees it (read-only) on the trip screen but
  // can't change it until the ride is actually 'completed', at which point
  // tapping a method confirms/corrects how they paid (see
  // acknowledgeRidePayment) and is what moves this ride out of "current
  // trip" and into Trip History. False for every ride until that tap.
  paymentAcknowledged: boolean
}

export type ServiceType = 'ride' | 'pabili' | 'buy_medicine'

export type DriverReportReason =
  | 'unsafe_driving'
  | 'rude_behavior'
  | 'overcharging'
  | 'vehicle_condition'
  | 'other'

export type DriverReportStatus = 'open' | 'reviewed'

// A non-emergency complaint about a driver, distinct from the real-time SOS
// alert system — filed after the fact (or mid-ride) for the App Admin to
// review, not something that pages a guardian.
export interface DriverReport {
  id: string
  rideId: string
  passengerId: string
  passengerName: string
  driverId: string
  driverName: string
  reason: DriverReportReason
  details: string
  createdAt: string
  status: DriverReportStatus
}

export type ExpenseCategory =
  | 'driver_incentives'
  | 'fuel_subsidy'
  | 'maintenance'
  | 'marketing'
  | 'sms_api_fees'
  | 'office_admin'
  | 'salaries'
  | 'permits_fees'
  | 'other'

// A manually-logged business cost — separate from Payment (which tracks
// money already moving through completed rides). Expenses are money going
// out that never touched a ride: fuel subsidies, marketing spend, the
// Semaphore/Google Maps bills, permits, etc. Recorded, never auto-derived.
export interface ExpenseRecord {
  id: string
  category: ExpenseCategory
  amount: number
  description: string
  recordedAt: string
  recordedBy: string
}

// A shareholder's paid-in capital — equity money the business raised from
// its owners, not revenue it earned from operating. Kept as its own record
// (never folded into Payment/ExpenseRecord totals) since mixing capital
// into an income statement misstates both: capital belongs on the balance
// sheet, income/expenses on the P&L. The Accounting panel shows it
// alongside income for visibility, but always as a clearly separate figure.
export interface CapitalContribution {
  id: string
  stockholderName: string
  shares: number
  amount: number
  contributedAt: string
  recordedBy: string
}

// The specific position an officer holds — matched against these plus a
// free-text label when position is 'other' (e.g. "Auditor", "Board Member").
export type AccountingOfficerPosition = 'President' | 'Treasurer' | 'Other'

// The allowlist gating the Accounting & Compliance ("Super Admin") page —
// managed by the App Admin from the main Admin dashboard, never from inside
// the restricted page itself (that would be a chicken-and-egg lockout: the
// first officer has to be added by someone who doesn't need this list to get
// in). Email is the lookup key at the lock screen — only a registered
// officer's email unlocks the page, replacing the old "type any name" flow.
export interface AccountingOfficer {
  id: string
  name: string
  email: string
  position: AccountingOfficerPosition
  // Only meaningful when position === 'Other' — the custom title shown
  // instead of the generic word "Other" (e.g. "Auditor").
  otherPositionLabel: string | null
  addedAt: string
}

// Money a TODA collects that isn't a member's dues charge — an officer's
// own contribution, a sponsor/donor gift, a fiesta pot, etc. Same
// equity/goodwill-money-vs-revenue distinction as CapitalContribution above,
// but scoped to a single TODA org's own treasury rather than the platform.
export interface TodaContribution {
  id: string
  todaOrgId: string
  contributorName: string
  purpose: string
  amount: number
  contributedAt: string
  recordedBy: string
}

export type TodaExpenseCategory =
  | 'fuel_subsidy'
  | 'terminal_maintenance'
  | 'event'
  | 'officer_honorarium'
  | 'office_admin'
  | 'other'

// A TODA-level business cost, scoped to a single org's own books — same
// shape/intent as the platform-wide ExpenseRecord above, kept separate so a
// TODA's spending never mixes into the platform's own income statement.
export interface TodaExpenseRecord {
  id: string
  todaOrgId: string
  category: TodaExpenseCategory
  amount: number
  description: string
  recordedAt: string
  recordedBy: string
}

// A slice of the cap table — deliberately a plain, editable percentage
// record rather than issued/legal shares (see AccountingOfficerManager-style
// caveat: this is internal management data, not a substitute for actual
// corporate/legal share issuance). "category" groups holders the way a
// proposed corporate structure typically would (Founder, Investors, etc.);
// "Other" + otherCategoryLabel covers anything that doesn't fit those pools
// (e.g. a reserved/unallocated slice, or a one-off partner).
export type EquityHolderCategory =
  | 'Founder'
  | 'Investors'
  | 'Developers & Key Personnel'
  | 'Strategic / Community Pool'
  | 'Future Investor / Employee Pool'
  | 'Other'

export interface EquityAllocation {
  id: string
  holderName: string
  category: EquityHolderCategory
  otherCategoryLabel: string | null
  percentage: number
  notes: string | null
  addedAt: string
}

export type InvestorStatus = 'proposed' | 'active' | 'exited'
export type ShareClass = 'common' | 'preferred' | 'other'

// A tracked investment round, not an automatic cap-table entry — per the
// "don't automatically issue equity" principle, sharePercentage here is
// informational until someone deliberately mirrors it into EquityAllocation
// (see AdminAccounting's "Add to cap table" action). preMoneyValuation and
// postMoneyValuation are both optional/independent since real deals don't
// always follow investmentAmount = postMoney - preMoney exactly (option
// pools, SAFEs, etc.) — the UI offers to compute one from the others but
// never forces it.
export interface Investor {
  id: string
  investorName: string
  investmentDate: string
  investmentAmount: number
  investmentRound: string
  preMoneyValuation: number | null
  postMoneyValuation: number | null
  sharePercentage: number
  shareClass: ShareClass
  agreementReference: string | null
  status: InvestorStatus
  notes: string | null
  addedAt: string
}

export type FounderContributionKind = 'cash' | 'non_cash'
export type FounderContributionStatus = 'pending' | 'approved' | 'rejected'

// Tracks what backs the Founder's cap-table percentage — per the master
// structure doc, the Founder allocation is contribution-based (concept,
// software, IP, leadership), not automatically a cash requirement, so
// cash and non-cash contributions are tracked side by side rather than
// assumed equal to the equity percentage.
export interface FounderContribution {
  id: string
  founderName: string
  date: string
  contributionType: string
  description: string
  kind: FounderContributionKind
  estimatedValue: number
  supportingDocDataUrl: string | null
  status: FounderContributionStatus
  approvedValue: number | null
  approvedBy: string | null
  approvalDate: string | null
  addedAt: string
}

export type RotaryProjectCategory =
  | 'Community Partner Project'
  | 'NGO-Supported Project'
  | 'Grant-Funded Project'
  | 'Passenger Safety'
  | 'Student Safety'
  | 'Road Safety'
  | 'Health'
  | 'Education'
  | 'Water'
  | 'Other Community Project'

export type RotaryProjectStatus = 'proposed' | 'approved' | 'in_progress' | 'completed' | 'cancelled'

// A community project funded (wholly or partly) from the Social Impact
// Fund below — amountSpent is deliberately NOT stored here; it's derived
// from SocialImpactTransaction records linked by projectId (see
// lib/socialImpact.ts), so there's one source of truth for money movement
// instead of a project total that can drift from its own transaction log.
// "partner" is the beneficiary organization's name — a free-text field on
// purpose, since the actual Community Partner/NGO differs per city and is
// never hard-coded here.
export interface RotaryProject {
  id: string
  projectName: string
  partner: string
  description: string
  category: RotaryProjectCategory
  // Not automatically classified as grant-funded — category is a deliberate
  // choice, never assumed (see master structure doc's caution on this).
  approvedBudget: number
  socialImpactFundAllocation: number
  additionalFunding: number
  status: RotaryProjectStatus
  startDate: string | null
  endDate: string | null
  addedAt: string
}

export type SocialImpactTransactionCategory =
  | 'fund_allocation'
  | 'project_commitment'
  | 'project_expense'
  | 'transfer'
  | 'adjustment'

export type SocialImpactTransactionStatus =
  | 'proposed'
  | 'approved'
  | 'allocated'
  | 'disbursed'
  | 'completed'
  | 'cancelled'

// A single movement in the Social Impact Fund ledger — NOT a dividend to a
// Community Partner/NGO or TODA Partner (those beneficiary organizations
// hold 0% equity, see RotaryProject.partner/RccIncentive.partner). "amount"
// is always entered as a positive
// magnitude; category alone determines inflow vs. outflow when computing
// the running balance (see lib/socialImpact.ts), so it always reads as
// "how much moved," not a sign a data-entry mistake could quietly flip.
export interface SocialImpactTransaction {
  id: string
  date: string
  description: string
  amount: number
  projectId: string | null
  category: SocialImpactTransactionCategory
  status: SocialImpactTransactionStatus
  approvedBy: string | null
  supportingDocDataUrl: string | null
  addedAt: string
}

export type DistributionType =
  | 'Investor Distribution'
  | 'Shareholder Dividend'
  | 'Founder Distribution'
  | 'Reinvestment'
  | 'Social Impact Allocation'
  | 'TODA Partner Incentive'
  | 'Other Approved Distribution'

export type DistributionStatus = 'proposed' | 'approved' | 'paid' | 'cancelled'

// A payout FROM the business to a recipient — distinct from the inbound
// records elsewhere (Investor rounds, CapitalContribution). A Community
// Partner/NGO or TODA Partner must never receive a Shareholder Dividend or
// Investor Distribution here (they hold 0% equity, see
// RotaryProject.partner/RccIncentive.partner) — the UI warns rather than
// hard-blocks, checking against the actual registered partner names rather
// than any hard-coded org name.
export interface Distribution {
  id: string
  recipient: string
  distributionType: DistributionType
  amount: number
  date: string
  source: string
  reference: string | null
  status: DistributionStatus
  approvedBy: string | null
  addedAt: string
}

export type RccIncentiveBasis =
  | 'Per qualified driver recruited'
  | 'Per active driver'
  | 'Passenger acquisition'
  | 'Local revenue incentive'
  | 'Approved community campaign'
  | 'Approved social-impact program'

export type RccIncentiveStatus = 'proposed' | 'approved' | 'paid' | 'cancelled'

// A TODA Partner is a community marketing/promotion partner (driver
// recruitment, barangay outreach, safety campaigns) — 0% corporate equity,
// same as a Community Partner/NGO. Incentives are earned per a specific
// configured basis, never paid automatically just because the partnership
// exists. "partner" is the organization's name — free text, since it
// differs per TODA/city and is never hard-coded here.
export interface RccIncentive {
  id: string
  partner: string
  basis: RccIncentiveBasis
  description: string
  amount: number
  date: string
  status: RccIncentiveStatus
  approvedBy: string | null
  addedAt: string
}

// The formal SEC Articles of Incorporation / GIS-level capitalization
// figures — distinct from EquityAllocation (the internal, percentage-only
// cap table) and CapitalContribution (a running ledger of cash paid in).
// This is a single record, not a list: it's "what's on file with SEC,"
// which only ever has one current version. All figures start blank/zero —
// never pre-filled with placeholder SEC data, since these must come from
// an actual filed registration, not a guess.
export interface CorporateRegistrationInfo {
  companyName: string
  secRegistrationNo: string
  registrationDate: string | null
  tin: string
  principalOfficeAddress: string
  primaryPurpose: string
  // null = perpetual (RA 11232 default), a number = a fixed term in years.
  corporateTermYears: number | null
  authorizedCapitalStock: number
  parValuePerShare: number
  numberOfSharesAuthorized: number
  subscribedCapitalStock: number
  paidUpCapitalStock: number
  treasurerInTrust: string | null
  updatedAt: string | null
}

export type StockholderType = 'Individual' | 'Corporation' | 'Other'

// One row of the SEC General Information Sheet's stockholders table —
// deliberately mirrors those exact fields (name, nationality, address,
// shares, amount subscribed, amount paid) rather than the looser shape
// CapitalContribution/EquityAllocation already use, so this page can be
// filled in directly from an actual filed GIS/AOI.
export interface Stockholder {
  id: string
  name: string
  nationality: string
  address: string
  stockholderType: StockholderType
  sharesSubscribed: number
  amountSubscribed: number
  amountPaid: number
  dateSubscribed: string | null
  certificateNo: string | null
  addedAt: string
}

// Admin-configurable LGU-style tariff: a flat base rate (student or
// standard) that covers the first `standardKmCovered` kilometers, then
// `perKmRate` for each additional km beyond that — see estimateFare in
// mock/data.ts for the actual calculation using real (haversine) distance
// between pickup/dropoff gps.
export interface TariffSettings {
  standardRate: number
  studentRate: number
  // PWD/Senior citizen discounted flat base rate — takes priority over the
  // student rate if a passenger somehow qualifies for both.
  pwdSeniorRate: number
  perKmRate: number
  standardKmCovered: number
  // Flat surcharge added per rider beyond the first when a group of 2+ books
  // together (see Ride.passengerCount) — admin-configurable. Used as a
  // fallback for group sizes without a computed group discount, i.e. 5+
  // riders, since ride-sharing bookings cap at 4 (see Ride.passengerCount).
  extraPassengerFee: number
  // Percentage knocked off standardRate×passengerCount for a standard
  // (non-student, non-PWD/Senior) ride-sharing booking of 2-4 — e.g. 10 means
  // a 2-passenger ride costs standardRate×2×0.9. Discounted-fare riders keep
  // using the flat extraPassengerFee surcharge instead.
  groupRideDiscountPct: number
}

// Who made a logged change — an audit-trail concept, not a login role (see
// Role / AuthedAccountRole for that). The underlying account is always just
// 'admin' or 'toda_admin', but 'admin' splits into two logged personas that
// already exist as separate badges in the UI (see NavBar): "Admin" for
// ordinary /admin actions (driver/TODA approvals, tariff, etc.) vs. "Super
// Admin" for the extra-gated Accounting & Compliance page (cap table,
// distributions, SEC registration, ...), unlocked only by a registered
// finance officer. 'toda_admin' is a single TODA's own org-scoped admin.
export type ActivityLogActorRole = 'admin' | 'super_admin' | 'toda_admin'

// A single audit-trail row: who changed what, where, and when. Deliberately
// generic (a short action label + a human-readable summary) rather than a
// typed union per action, so logging a new kind of admin change is just
// another logActivity() call, not a type change here. todaOrgId scopes a
// toda_admin's entries to their own org (null for a global Super Admin
// change) so each TODA Admin's log view only shows their own org's history.
export interface ActivityLogEntry {
  id: string
  actorRole: ActivityLogActorRole
  actorName: string
  todaOrgId: string | null
  action: string
  summary: string
  at: string
}

// ============================================================
// Income & Promotion — admin-only module (marketing, ads, coins/
// rewards, referrals, ride credits). Passenger-facing surfaces only ever
// read a thin slice of this (their own coin balance, active promos,
// their referral code) — never revenue, advertiser pricing, budgets, or
// settings. See IncomePromotionPage.tsx / PassengerRewardsCard.tsx.
// ============================================================

export type AdvertiserStatus = 'active' | 'paused' | 'expired' | 'pending'
export type AdvertiserPlan = 'basic' | 'standard' | 'premium' | 'custom'

// A paying business partner running ads/promotions on the platform —
// distinct from a Campaign (which is the marketing activity itself; an
// Advertiser can sponsor zero or more Campaigns via Campaign.advertiserId).
export interface Advertiser {
  id: string
  businessName: string
  category: string
  province: string
  city: string
  barangay: string
  addressDetail: string
  contactName: string
  contactPhone: string
  contactEmail: string | null
  plan: AdvertiserPlan
  monthlyValue: number
  status: AdvertiserStatus
  joinedAt: string
  notes: string | null
}

export type CampaignType =
  | 'social_share'
  | 'referral'
  | 'ride_challenge'
  | 'safety'
  | 'rating'
  | 'merchant_promotion'
  | 'community_campaign'
  | 'driver_recruitment'
  | 'passenger_recruitment'

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'ended' | 'archived'
export type CampaignAudience = 'passengers' | 'drivers' | 'both' | 'public'

// A structured marketing campaign with an audience, budget, and spend
// limits — distinct from a PromoOffer (a simple coupon/offer code). Reach/
// clicks/shares/participants are manually recorded (this app has no real ad
// tracking — see updateCampaignMetrics), while referralsCount/
// completedRides/rewardsIssued/revenueGenerated are DERIVED live from
// Referral/CoinTransaction records carrying this campaign's id, so those
// four numbers can never drift from the actual underlying records (same
// "single source of truth" principle as the Social Impact Fund).
export interface Campaign {
  id: string
  name: string
  description: string
  type: CampaignType
  targetAudience: CampaignAudience
  startDate: string
  endDate: string | null
  rewardCoins: number
  rewardNote: string | null
  budget: number
  dailyLimit: number | null
  weeklyLimit: number | null
  monthlyLimit: number | null
  status: CampaignStatus
  advertiserId: string | null
  reach: number
  clicks: number
  shares: number
  participants: number
  createdAt: string
  updatedAt: string | null
}

export type PromoOfferKind =
  | 'promotional_offer'
  | 'merchant_offer'
  | 'ride_campaign'
  | 'passenger_campaign'
  | 'driver_campaign'
  | 'referral_campaign'
  | 'social_media_campaign'
  | 'safety_campaign'

export type PromoOfferStatus = 'draft' | 'active' | 'paused' | 'ended' | 'archived'
export type PromoDiscountType = 'percent_off' | 'flat_off' | 'free_ride_credit'

// A simple, redeemable offer/coupon — e.g. "10% off Pabili this week" —
// as opposed to a full Campaign (structured, budgeted, audience-targeted
// marketing activity). Usage is tracked as a plain counter (timesRedeemed);
// this is a prototype with no real coupon-code redemption flow wired up.
export interface PromoOffer {
  id: string
  title: string
  description: string
  kind: PromoOfferKind
  discountType: PromoDiscountType
  discountValue: number
  code: string | null
  startDate: string
  endDate: string | null
  usageLimit: number | null
  timesRedeemed: number
  status: PromoOfferStatus
  createdAt: string
}

// Configurable coin amounts for each way a passenger/driver can earn
// TODARIDE COINS — Rewards tab. Individual Campaigns can still set their
// own rewardCoins that overrides this base 'campaign' rate.
export interface RewardRules {
  registration: number
  verification: number
  ride: number
  rating: number
  review: number
  referral: number
  socialShare: number
  safety: number
  campaign: number
}

export type CoinDirection = 'issued' | 'redeemed' | 'adjusted' | 'expired'
export type CoinSource =
  | 'registration'
  | 'verification'
  | 'ride'
  | 'rating'
  | 'review'
  | 'referral'
  | 'social_share'
  | 'safety'
  | 'campaign'
  | 'admin_adjustment'
  | 'ride_credit_redemption'

// One row of the TODARIDE COINS ledger — every issuance, redemption, or
// manual correction. amount is always a positive coin count; `direction`
// says which way it moved. Outstanding balance for any actor is the sum of
// issued+adjusted (positive) minus redeemed+expired (see lib/rewards.ts).
export interface CoinTransaction {
  id: string
  actorType: 'passenger' | 'driver'
  actorId: string
  actorName: string
  direction: CoinDirection
  source: CoinSource
  amount: number
  campaignId: string | null
  note: string | null
  recordedBy: string
  at: string
}

// One coin→peso ride-credit conversion tier, e.g. "100 coins = ₱5" —
// admin-configurable list, not fixed math, per the brief's example tiers.
export interface RideCreditTier {
  id: string
  coins: number
  pesoValue: number
}

export type ReferralStatus = 'pending' | 'qualified' | 'rewarded' | 'rejected' | 'fraud_review'

export interface Referral {
  id: string
  code: string
  referrerId: string
  referrerName: string
  referrerType: 'passenger' | 'driver'
  referredName: string
  referredPassengerId: string | null
  registeredAt: string | null
  verifiedAt: string | null
  firstRideAt: string | null
  status: ReferralStatus
  coinsAwarded: number
  campaignId: string | null
  createdAt: string
}

// Income & Promotion's own settings — separate from TariffSettings (ride
// fares) and commissionPerRide (the real, already-wired platform fee).
// theoreticalCommissionRatePct is a what-if comparison rate only: the
// pilot's actual commission is whatever commissionPerRide × completed
// rides already yields (real ₱0 if commissionPerRide is 0) — this setting
// never changes real fares or payouts, it only drives the Revenue tab's
// "what commission WOULD be at X%" comparison.
export interface IncomePromotionSettings {
  theoreticalCommissionRatePct: number
  coinExpirationDays: number | null
  fraudReferralThreshold: number
  defaultCampaignDailyLimit: number | null
  defaultCampaignWeeklyLimit: number | null
  defaultCampaignMonthlyLimit: number | null
}

// A recorded partnership/sponsorship payment — distinct from Advertiser
// (a recurring paid account with campaigns) and from ride/commission
// revenue. Simple add/delete ledger, same shape as ExpenseRecord/
// TodaContribution elsewhere in this app.
export interface PartnershipRevenueEntry {
  id: string
  partnerName: string
  description: string
  amount: number
  recordedAt: string
  recordedBy: string
}

// Third-party ad-network revenue (Google AdSense) — separate from the
// internal Advertiser/Campaign marketplace (TodaRide's own directly-sold
// ads, shown via AdBanner). This is scaffolding only: `enabled` stays false
// and every slot ID stays null until Admin pastes in a REAL Publisher ID and
// per-placement slot IDs from an actual, approved AdSense account — see
// GoogleAdSlot.tsx, which renders nothing (or a dev-only placeholder) until
// then. Nothing here can serve real ads or earn real income by itself.
export interface AdSensePlacementSlots {
  landing: string | null
  passengerTop: string | null
  passengerBottom: string | null
  driverTop: string | null
  driverBottom: string | null
  parentBottom: string | null
}

export interface AdSenseSettings {
  enabled: boolean
  publisherId: string | null
  slots: AdSensePlacementSlots
}
