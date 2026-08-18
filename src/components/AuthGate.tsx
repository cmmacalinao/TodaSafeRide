import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useRides } from '../context/RideContext'
import { useSession } from '../context/SessionContext'
import {
  APP_ADMIN_CREDENTIALS,
  APP_SUPER_ADMIN_EMAIL,
  MOCK_FRANCHISES,
  MOCK_OPERATORS,
  MOCK_PARENTS,
  MOCK_PASSENGERS,
  MOCK_PHARMACIES,
} from '../mock/data'
import { resolvePhAddress } from '../lib/customLocation'
import { IdentifierLoginForm } from './IdentifierLoginForm'
import { PassengerRegisterForm } from './PassengerRegisterForm'
import { ParentRegisterForm } from './ParentRegisterForm'
import { DriverAuthGate } from './DriverAuthGate'
import { SimpleOtpStep } from './SimpleOtpStep'
import { EMPTY_PH_ADDRESS, PhAddressFields, type PhAddressValue } from './PhAddressFields'
import type { BusinessType } from '../types'

type GateRole = 'passenger' | 'parent' | 'driver' | 'admin' | 'pharmacy' | 'operator' | 'franchise'

const ROLE_LABELS: Record<GateRole, string> = {
  passenger: 'Passenger',
  parent: 'Parent',
  driver: 'Driver',
  admin: 'Admin',
  pharmacy: 'Pharmacy',
  operator: 'Operator',
  franchise: 'Franchise',
}

const ALL_ROLES: GateRole[] = ['passenger', 'parent', 'driver', 'admin', 'pharmacy', 'operator', 'franchise']

// Which login tabs make sense for whichever entry point sent someone here —
// LandingPage's "Book a Ride →" only ever needs a rider identity
// (Passenger or Parent booking for a child), "I'm a Driver" only ever needs
// the Driver tab, "Admin Operation" only ever needs the Admin form, and
// "/pharmacy" only ever needs the Pharmacy form (no tab row at all —
// there's nothing to choose between, same as /admin). Any other path
// (typed directly) falls back to showing every tab.
function allowedRolesForPath(pathname: string): GateRole[] {
  if (pathname === '/book') return ['passenger', 'parent']
  if (pathname === '/drive') return ['driver']
  if (pathname === '/admin') return ['admin']
  if (pathname === '/pharmacy') return ['pharmacy']
  if (pathname === '/operator') return ['operator']
  if (pathname === '/franchise') return ['franchise']
  return ALL_ROLES
}

// The Admin, Pharmacy, Operator, and Franchise entry points skip the tab row
// entirely and go straight to their own form — unlike /drive, which still
// shows a single "Driver" pill.
function showsRoleTabs(pathname: string): boolean {
  return pathname !== '/admin' && pathname !== '/pharmacy' && pathname !== '/operator' && pathname !== '/franchise'
}

// Blocks the whole app until someone logs in or signs up — rendered by
// App.tsx in place of NavBar/Routes whenever session.authedAccount is null.
// Not itself a route, so it has no URL of its own.
export function AuthGate() {
  const location = useLocation()
  const navigate = useNavigate()
  const allowedRoles = allowedRolesForPath(location.pathname)
  const showTabs = showsRoleTabs(location.pathname)
  const [role, setRole] = useState<GateRole>(allowedRoles[0])
  // Shared between Passenger and Parent so the Log in/Sign up choice is a
  // single row above the Passenger/Parent tabs (not one buried inside each),
  // and switching role tabs doesn't reset which mode was selected.
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')

  // AuthGate doesn't always remount between entry points (e.g. browser
  // back/forward between /book and /drive without passing through '/'), so
  // keep the selected role valid if the allowed set changes under it.
  useEffect(() => {
    if (!allowedRoles.includes(role)) setRole(allowedRoles[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  return (
    <div>
      <div className="mx-auto max-w-lg px-4 pt-6">
        <div className="mb-6 flex flex-col items-center text-center">
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Back to home"
          >
            <img src="/logo.png" alt="TodaRide" className="h-20 w-auto rounded-xl shadow" />
          </button>
          <p className="mt-3 text-sm font-semibold text-slate-700">Log in or sign up to continue</p>
          <span className="mt-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-500">
            Prototype · Simulated data
          </span>
        </div>

        {/* Log in/Sign up sits above Passenger/Parent — it's the more
            fundamental choice (what are you here to do), and putting it
            first means switching Passenger↔Parent below it doesn't reset
            which mode was selected (see authMode, lifted up to this level). */}
        {(role === 'passenger' || role === 'parent') && <SubTabs mode={authMode} setMode={setAuthMode} />}

        {showTabs && (
          <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
            {allowedRoles.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`flex-1 rounded-md py-2 text-xs font-medium transition ${
                  role === r ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'
                }`}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
        )}
      </div>

      {role === 'driver' ? (
        <DriverAuth />
      ) : (
        <div className="mx-auto max-w-lg px-4 pb-6">
          {role === 'passenger' && <PassengerAuth mode={authMode} />}
          {role === 'parent' && <ParentAuth mode={authMode} />}
          {role === 'admin' && <AdminAuth />}
          {role === 'pharmacy' && <PharmacyAuth />}
          {role === 'operator' && <OperatorAuth />}
          {role === 'franchise' && <FranchiseAuth />}
        </div>
      )}
    </div>
  )
}

function SubTabs({ mode, setMode }: { mode: 'login' | 'signup'; setMode: (m: 'login' | 'signup') => void }) {
  return (
    <div className="mb-3 flex gap-1 rounded-lg bg-slate-100 p-1">
      <button
        type="button"
        onClick={() => setMode('login')}
        className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
          mode === 'login' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'
        }`}
      >
        Log in
      </button>
      <button
        type="button"
        onClick={() => setMode('signup')}
        className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
          mode === 'signup' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'
        }`}
      >
        Sign up
      </button>
    </div>
  )
}

const MOCK_PASSENGER_IDS = new Set(MOCK_PASSENGERS.map((p) => p.id))

function PassengerAuth({ mode }: { mode: 'login' | 'signup' }) {
  const { passengers } = useRides()
  const { setCurrentPassengerId, setAuthedAccount, setRole: setSessionRole } = useSession()

  return (
    <div>
      {mode === 'login' ? (
        <IdentifierLoginForm
          accounts={passengers}
          seedIds={MOCK_PASSENGER_IDS}
          onFound={(id) => {
            setCurrentPassengerId(id)
            setAuthedAccount({ role: 'passenger', id })
            setSessionRole('passenger')
          }}
          noAccountHint="No passenger account found for that name, email, or number — switch to Sign up."
        />
      ) : (
        <PassengerRegisterForm
          onRegistered={(id) => {
            setCurrentPassengerId(id)
            setAuthedAccount({ role: 'passenger', id })
            setSessionRole('passenger')
          }}
        />
      )}
    </div>
  )
}

const MOCK_PARENT_IDS = new Set(MOCK_PARENTS.map((p) => p.id))

function ParentAuth({ mode }: { mode: 'login' | 'signup' }) {
  const { parents } = useRides()
  const { setCurrentParentId, setAuthedAccount, setRole: setSessionRole } = useSession()

  return (
    <div>
      {mode === 'login' ? (
        <IdentifierLoginForm
          accounts={parents}
          seedIds={MOCK_PARENT_IDS}
          onFound={(id) => {
            setCurrentParentId(id)
            setAuthedAccount({ role: 'parent', id })
            setSessionRole('parent')
          }}
          noAccountHint="No parent account found for that name, email, or number — switch to Sign up."
        />
      ) : (
        <ParentRegisterForm
          onRegistered={(id) => {
            setCurrentParentId(id)
            setAuthedAccount({ role: 'parent', id })
            setSessionRole('parent')
          }}
        />
      )}
    </div>
  )
}

function DriverAuth() {
  const { setLoggedInDriverId, setLoggedInTodaAdminOrgId, setAuthedAccount } = useSession()

  return (
    <DriverAuthGate
      onLoggedIn={(driverId) => {
        setLoggedInDriverId(driverId)
        setAuthedAccount({ role: 'driver', id: driverId })
      }}
      onTodaAdminLoggedIn={(orgId) => {
        setLoggedInTodaAdminOrgId(orgId)
        setAuthedAccount({ role: 'toda_admin', id: orgId })
      }}
    />
  )
}

function AdminAuth() {
  const { setAuthedAccount, setRole: setSessionRole } = useSession()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials')

  function handleLogin() {
    const enteredUsername = username.trim().toLowerCase()
    const isValidIdentity =
      enteredUsername === APP_ADMIN_CREDENTIALS.username || enteredUsername === APP_SUPER_ADMIN_EMAIL.toLowerCase()
    if (!isValidIdentity || password !== APP_ADMIN_CREDENTIALS.password) {
      setError('Incorrect username or password.')
      return
    }
    setError('')
    setStep('otp')
  }

  function handleOtpVerified() {
    setAuthedAccount({ role: 'admin', id: 'admin' })
    setSessionRole('admin')
  }

  if (step === 'otp') {
    return (
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <p className="text-xs text-slate-500">
          Password confirmed for <span className="font-medium text-slate-700">{username.trim()}</span> — verify
          with a one-time code to finish logging in.
        </p>
        <SimpleOtpStep
          destination={username.trim().includes('@') ? username.trim() : `${username.trim()}@todaride.ph`}
          onVerified={handleOtpVerified}
          onCancel={() => setStep('credentials')}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-xs text-slate-500">
        Admin access isn't self-service, so there's no Sign up here — demo credential:{' '}
        <span className="font-mono">
          {APP_ADMIN_CREDENTIALS.username} / {APP_ADMIN_CREDENTIALS.password}
        </span>{' '}
        (or <span className="font-mono">{APP_SUPER_ADMIN_EMAIL}</span> with the same password)
      </p>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
      <button
        type="button"
        onClick={handleLogin}
        className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Log in
      </button>
    </div>
  )
}

// TODARIDE MEDS — a pharmacy's own portal login, same shape as TODA Admin's
// org-select + PIN (see DriverAuthGate.tsx's TodaAdminLoginForm), plus a
// self-service Sign up (any pharmacy can register itself — see
// PharmacySignupForm below) since MEDS isn't limited to the seeded partner
// list anymore.
// Every seeded demo pharmacy's PIN is auto-filled on selection (see
// handleSelectPharmacy below) so testing doesn't require looking up PINs in
// mock/data.ts — a self-registered pharmacy/store isn't in this set, so its
// real, actually-secret PIN is never guessed or shown, and still has to be
// typed in by hand like any real login.
const MOCK_PHARMACY_IDS = new Set(MOCK_PHARMACIES.map((p) => p.id))

function PharmacyAuth() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const { pharmacies } = useRides()
  const { setLoggedInPharmacyId, setAuthedAccount } = useSession()
  const [pharmacyId, setPharmacyId] = useState(pharmacies[0]?.id ?? '')
  const [pin, setPin] = useState(() => pharmacies[0]?.id && MOCK_PHARMACY_IDS.has(pharmacies[0].id) ? pharmacies[0].adminPin : '')
  const [error, setError] = useState('')

  function handleSelectPharmacy(id: string) {
    setPharmacyId(id)
    const seed = MOCK_PHARMACY_IDS.has(id) ? pharmacies.find((p) => p.id === id) : undefined
    setPin(seed?.adminPin ?? '')
  }

  function logIntoPharmacy(id: string) {
    setLoggedInPharmacyId(id)
    setAuthedAccount({ role: 'pharmacy', id })
  }

  function handleLogin() {
    const pharmacy = pharmacies.find((p) => p.id === pharmacyId)
    if (!pharmacy) {
      setError('Select a pharmacy.')
      return
    }
    if (pharmacy.adminPin !== pin) {
      setError('Incorrect PIN.')
      return
    }
    setError('')
    logIntoPharmacy(pharmacy.id)
  }

  return (
    <div>
      <SubTabs mode={mode} setMode={setMode} />
      {mode === 'signup' ? (
        <PharmacySignupForm onRegistered={logIntoPharmacy} />
      ) : (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs text-slate-500">
            For partner pharmacies and stores — no account yet? Switch to Sign up.
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Pharmacy</label>
            <select
              value={pharmacyId}
              onChange={(e) => handleSelectPharmacy(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {pharmacies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {MOCK_PHARMACY_IDS.has(p.id) ? ` (demo, PIN ${p.adminPin})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
          <button
            type="button"
            onClick={handleLogin}
            className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Log in
          </button>
        </div>
      )}
    </div>
  )
}

// Any pharmacy can sign up — no Admin-approval workflow built for MEDS yet
// (see Pharmacy.verificationStatus's comment), so registering goes live and
// logs straight in, same as Passenger/Parent signup rather than Driver/TODA's
// submit-and-wait pattern.
function PharmacySignupForm({ onRegistered }: { onRegistered: (pharmacyId: string) => void }) {
  const { registerPharmacy } = useRides()
  const [name, setName] = useState('')
  const [businessType, setBusinessType] = useState<BusinessType>('pharmacy')
  const [contactPhone, setContactPhone] = useState('')
  const [address, setAddress] = useState<PhAddressValue>(EMPTY_PH_ADDRESS)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (
      !name.trim() ||
      !contactPhone.trim() ||
      !address.province ||
      !address.city ||
      !address.barangay ||
      !address.addressDetail.trim() ||
      pin.trim().length !== 4
    ) {
      setError('Fill in your pharmacy name, contact number, full address (province/city/barangay/detail), and a 4-digit PIN.')
      return
    }
    setError('')
    setSubmitting(true)
    // Geocodes the typed address into both the real gps (for the live map)
    // and an abstract simulation-grid position (for fare/priority-dispatch
    // math) — same helper the booking flow uses to resolve a delivery
    // address, reused here so a self-registered pharmacy is positioned the
    // same way a seeded one is.
    const location = await resolvePhAddress({
      province: address.province,
      city: address.city,
      barangay: address.barangay,
      addressDetail: address.addressDetail.trim(),
    })
    const id = registerPharmacy({
      name: name.trim(),
      businessType,
      contactPhone: contactPhone.trim(),
      province: address.province,
      city: address.city,
      barangay: address.barangay,
      addressDetail: address.addressDetail.trim(),
      coords: location.coords,
      locationGps: location.gps,
      adminPin: pin.trim(),
    })
    setSubmitting(false)
    onRegistered(id)
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-xs text-slate-500">
        Register your business to start receiving orders — you'll be able to add products/manage orders right after
        signing up.
      </p>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">What kind of business is this?</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setBusinessType('pharmacy')}
            className={`rounded-lg border p-2.5 text-left text-xs transition ${
              businessType === 'pharmacy' ? 'border-brand-600 bg-brand-50' : 'border-slate-300 hover:bg-slate-50'
            }`}
          >
            <span className="font-medium text-slate-700">💊 Pharmacy</span>
            <p className="mt-0.5 text-[11px] text-slate-400">Connects to TODARIDE MEDS — product catalog, quotes, prescriptions.</p>
          </button>
          <button
            type="button"
            onClick={() => setBusinessType('store')}
            className={`rounded-lg border p-2.5 text-left text-xs transition ${
              businessType === 'store' ? 'border-brand-600 bg-brand-50' : 'border-slate-300 hover:bg-slate-50'
            }`}
          >
            <span className="font-medium text-slate-700">🏪 Store</span>
            <p className="mt-0.5 text-[11px] text-slate-400">Connects to Pabili — passengers can pick you by name for an errand.</p>
          </button>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">
          {businessType === 'pharmacy' ? 'Pharmacy name' : 'Store name'}
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={businessType === 'pharmacy' ? 'e.g. Mercury Drug — Your Branch' : 'e.g. Aling Nena Sari-Sari Store'}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Contact number</label>
        <input
          type="tel"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          placeholder="09XX-XXX-XXXX"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <PhAddressFields
        value={address}
        onChange={setAddress}
        addressDetailLabel="Store address (street, landmark, notes)"
        addressDetailPlaceholder="e.g. Unit 2, near the public market entrance"
      />
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Create a 4-digit PIN</label>
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-widest"
          placeholder="••••"
        />
        <p className="mt-1 text-[11px] text-slate-400">Use this to log in to your pharmacy portal.</p>
      </div>
      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Registering…' : 'Register pharmacy'}
      </button>
    </div>
  )
}

const MOCK_OPERATOR_IDS = new Set(MOCK_OPERATORS.map((o) => o.id))

// TaaS Level 2 — "Authorized Operator." Unlike Pharmacy's instant self-service
// signup, an Operator's registration lands 'pending' and login is blocked
// until the App Admin approves it (same pending-block pattern as
// TodaAdminLoginForm in DriverAuthGate.tsx) — becoming an Operator is a
// bigger commitment (activation fee, managing other TODAs) than joining MEDS.
// Admin's "Copy application link" (AdminPage.tsx's TaaS Applications
// section) appends ?apply=1 so the shared link opens straight on the
// Sign-up sub-tab instead of Login — same query-param pattern DriverAuthGate
// already uses for ?mode=toda_admin.
function wantsApplyMode(): boolean {
  return new URLSearchParams(window.location.search).get('apply') === '1'
}

// A Franchise's "Operator sign-up" link/QR (see FranchisePage.tsx) carries
// this so a brand-new Operator registering through it is auto-linked to that
// Franchise — same pattern as DriverAuthGate's inviteOperatorId for TODAs.
function inviteFranchiseId(): string | null {
  return new URLSearchParams(window.location.search).get('franchiseId')
}

function OperatorAuth() {
  const [mode, setMode] = useState<'login' | 'signup'>(() => (wantsApplyMode() || inviteFranchiseId() ? 'signup' : 'login'))
  const { operators } = useRides()
  const { setLoggedInOperatorAdminId, setAuthedAccount } = useSession()
  const [operatorId, setOperatorId] = useState(operators[0]?.id ?? '')
  const [pin, setPin] = useState(() => operators[0]?.id && MOCK_OPERATOR_IDS.has(operators[0].id) ? operators[0].adminPin : '')
  const [error, setError] = useState('')

  function handleSelectOperator(id: string) {
    setOperatorId(id)
    const seed = MOCK_OPERATOR_IDS.has(id) ? operators.find((o) => o.id === id) : undefined
    setPin(seed?.adminPin ?? '')
  }

  function handleLogin() {
    const operator = operators.find((o) => o.id === operatorId)
    if (!operator) {
      setError('Select an Operator.')
      return
    }
    if (operator.adminPin !== pin) {
      setError('Incorrect PIN.')
      return
    }
    if (operator.verificationStatus === 'pending') {
      setError('This Operator application is still under review by the App Admin.')
      return
    }
    if (operator.verificationStatus === 'rejected') {
      setError('This Operator application was not approved. Contact support.')
      return
    }
    setError('')
    setLoggedInOperatorAdminId(operator.id)
    setAuthedAccount({ role: 'operator_admin', id: operator.id })
  }

  return (
    <div>
      <SubTabs mode={mode} setMode={setMode} />
      {mode === 'signup' ? (
        <OperatorRegisterForm onSubmitted={() => setMode('login')} inviteFranchiseId={inviteFranchiseId()} />
      ) : (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs text-slate-500">
            TaaS Level 2 — for TODA cooperatives and organizations authorized to manage other TODAs. No account yet?
            Switch to Sign up.
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Operator</label>
            <select
              value={operatorId}
              onChange={(e) => handleSelectOperator(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {operators.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                  {o.verificationStatus !== 'approved' ? ` (${o.verificationStatus})` : ''}
                  {MOCK_OPERATOR_IDS.has(o.id) ? ` (demo, PIN ${o.adminPin})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
          <button
            type="button"
            onClick={handleLogin}
            className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Log in
          </button>
        </div>
      )}
    </div>
  )
}

function OperatorRegisterForm({
  onSubmitted,
  inviteFranchiseId,
}: {
  onSubmitted: () => void
  inviteFranchiseId: string | null
}) {
  const { registerOperator, setOperatorFranchise, franchises } = useRides()
  const inviteFranchise = inviteFranchiseId ? franchises.find((f) => f.id === inviteFranchiseId) ?? null : null
  const [name, setName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [province, setProvince] = useState('')
  const [city, setCity] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit() {
    if (
      !name.trim() ||
      !contactPerson.trim() ||
      !contactPhone.trim() ||
      !province.trim() ||
      !city.trim() ||
      pin.trim().length !== 4
    ) {
      setError('Fill in your Operator name, contact person, contact number, province, city, and a 4-digit PIN.')
      return
    }
    const newOperatorId = registerOperator({
      name: name.trim(),
      contactPerson: contactPerson.trim(),
      contactPhone: contactPhone.trim(),
      province: province.trim(),
      city: city.trim(),
      adminPin: pin.trim(),
    })
    if (inviteFranchise) setOperatorFranchise(newOperatorId, inviteFranchise.id)
    setError('')
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <section className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-center">
        <p className="text-sm font-semibold text-brand-800">Application submitted</p>
        <p className="mt-1 text-xs text-slate-600">
          {inviteFranchise
            ? `Your Operator is now linked under ${inviteFranchise.name}. It's still with the App Admin for review — they'll also set your activation and monthly fees on approval. Your PIN will work once it's approved.`
            : "Your Operator application is with the App Admin for review — they'll also set your activation and monthly fees on approval. Your PIN will work once it's approved."}
        </p>
        <button
          onClick={onSubmitted}
          className="mt-3 rounded-lg border border-brand-300 bg-white px-4 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50"
        >
          Back to login
        </button>
      </section>
    )
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-700">Apply as an Authorized Operator</h2>
      <p className="text-xs text-slate-500">
        For established TODA cooperatives and organizations ready to manage multiple TODAs under TODASafeRide's
        Level-2 Authorized Operator program.
      </p>

      {inviteFranchise && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-xs text-brand-800">
          <p className="font-medium">Joining {inviteFranchise.name}</p>
          <p className="mt-0.5">
            Registering through this link automatically links your Operator under {inviteFranchise.name} (TaaS
            Level 3) once the App Admin approves it — no separate assignment step needed.
          </p>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Operator name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Nueva Ecija North Operator"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Contact person</label>
        <input
          value={contactPerson}
          onChange={(e) => setContactPerson(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Contact number</label>
        <input
          type="tel"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          placeholder="09XX-XXX-XXXX"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Province</label>
          <input
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">City</label>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Create a 4-digit PIN</label>
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-widest"
          placeholder="••••"
        />
      </div>
      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
      <button
        type="button"
        onClick={handleSubmit}
        className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Submit application
      </button>
    </section>
  )
}

const MOCK_FRANCHISE_IDS = new Set(MOCK_FRANCHISES.map((f) => f.id))

// TaaS Level 3 — "Franchise" (territory). Same pending-block pattern as
// Operator above — introduced only after the model is proven, so becoming a
// franchisee is the highest-stakes signup in the app.
function FranchiseAuth() {
  const [mode, setMode] = useState<'login' | 'signup'>(() => (wantsApplyMode() ? 'signup' : 'login'))
  const { franchises } = useRides()
  const { setLoggedInFranchiseAdminId, setAuthedAccount } = useSession()
  const [franchiseId, setFranchiseId] = useState(franchises[0]?.id ?? '')
  const [pin, setPin] = useState(() => franchises[0]?.id && MOCK_FRANCHISE_IDS.has(franchises[0].id) ? franchises[0].adminPin : '')
  const [error, setError] = useState('')

  function handleSelectFranchise(id: string) {
    setFranchiseId(id)
    const seed = MOCK_FRANCHISE_IDS.has(id) ? franchises.find((f) => f.id === id) : undefined
    setPin(seed?.adminPin ?? '')
  }

  function handleLogin() {
    const franchise = franchises.find((f) => f.id === franchiseId)
    if (!franchise) {
      setError('Select a Franchise.')
      return
    }
    if (franchise.adminPin !== pin) {
      setError('Incorrect PIN.')
      return
    }
    if (franchise.verificationStatus === 'pending') {
      setError('This Franchise application is still under review by the App Admin.')
      return
    }
    if (franchise.verificationStatus === 'rejected') {
      setError('This Franchise application was not approved. Contact support.')
      return
    }
    setError('')
    setLoggedInFranchiseAdminId(franchise.id)
    setAuthedAccount({ role: 'franchise_admin', id: franchise.id })
  }

  return (
    <div>
      <SubTabs mode={mode} setMode={setMode} />
      {mode === 'signup' ? (
        <FranchiseRegisterForm onSubmitted={() => setMode('login')} />
      ) : (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs text-slate-500">
            TaaS Level 3 — the right to operate a TODASafeRide business within an approved territory. No account yet?
            Switch to Sign up.
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Franchise</label>
            <select
              value={franchiseId}
              onChange={(e) => handleSelectFranchise(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {franchises.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                  {f.verificationStatus !== 'approved' ? ` (${f.verificationStatus})` : ''}
                  {MOCK_FRANCHISE_IDS.has(f.id) ? ` (demo, PIN ${f.adminPin})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
          <button
            type="button"
            onClick={handleLogin}
            className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Log in
          </button>
        </div>
      )}
    </div>
  )
}

function FranchiseRegisterForm({ onSubmitted }: { onSubmitted: () => void }) {
  const { registerFranchise } = useRides()
  const [name, setName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [province, setProvince] = useState('')
  const [city, setCity] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit() {
    if (
      !name.trim() ||
      !contactPerson.trim() ||
      !contactPhone.trim() ||
      !province.trim() ||
      !city.trim() ||
      pin.trim().length !== 4
    ) {
      setError('Fill in your Franchise name, contact person, contact number, territory province, city, and a 4-digit PIN.')
      return
    }
    registerFranchise({
      name: name.trim(),
      contactPerson: contactPerson.trim(),
      contactPhone: contactPhone.trim(),
      province: province.trim(),
      city: city.trim(),
      adminPin: pin.trim(),
    })
    setError('')
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <section className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-center">
        <p className="text-sm font-semibold text-brand-800">Application submitted</p>
        <p className="mt-1 text-xs text-slate-600">
          Your Franchise application is with the App Admin for review — they'll also set your franchise and monthly
          technology fees on approval. Your PIN will work once it's approved.
        </p>
        <button
          onClick={onSubmitted}
          className="mt-3 rounded-lg border border-brand-300 bg-white px-4 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50"
        >
          Back to login
        </button>
      </section>
    )
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-700">Apply for a Franchise territory</h2>
      <p className="text-xs text-slate-500">
        For transportation entrepreneurs, TODA cooperatives, and business investors ready to build and operate a
        TODASafeRide territory.
      </p>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Franchise name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Nueva Ecija Franchise"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Contact person</label>
        <input
          value={contactPerson}
          onChange={(e) => setContactPerson(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Contact number</label>
        <input
          type="tel"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          placeholder="09XX-XXX-XXXX"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Territory province</label>
          <input
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">City</label>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Create a 4-digit PIN</label>
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-widest"
          placeholder="••••"
        />
      </div>
      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
      <button
        type="button"
        onClick={handleSubmit}
        className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Submit application
      </button>
    </section>
  )
}
