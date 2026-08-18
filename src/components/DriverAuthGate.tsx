import { useState } from 'react'
import { useRides } from '../context/RideContext'
import { autoDetectTodaOrgId, DOCUMENT_LABELS, DOCUMENT_TYPES, MOCK_DRIVERS, MOCK_TODA_ORGANIZATIONS } from '../mock/data'
import { getCurrentGeoPosition } from '../lib/geo'
import { matchesNameQuery } from '../lib/fuzzyName'
import { DocumentUploadField } from './DocumentUploadField'
import { IdentifierLoginForm } from './IdentifierLoginForm'
import { EMPTY_PH_ADDRESS, PhAddressFields, type PhAddressValue } from './PhAddressFields'
import { RegistrationOtpStep } from './RegistrationOtpStep'
import type { DriverDocuments, DriverInvite, GeoCoords, TodaOfficer } from '../types'

const EMPTY_DOCUMENTS: DriverDocuments = {
  nbiClearance: { submitted: false, dataUrl: null },
  driversLicense: { submitted: false, dataUrl: null },
  ltoRegistration: { submitted: false, dataUrl: null },
  lguRegistration: { submitted: false, dataUrl: null },
}

const FREELANCE_VALUE = 'freelance'

export function DriverAuthGate({
  onLoggedIn,
  onTodaAdminLoggedIn,
}: {
  onLoggedIn: (driverId: string) => void
  onTodaAdminLoggedIn: (todaOrgId: string) => void
}) {
  const { drivers, todaOrganizations, registerDriver, driverInvites } = useRides()
  const searchParams = new URLSearchParams(window.location.search)
  const inviteId = searchParams.get('invite')
  const invite = inviteId ? driverInvites.find((i) => i.id === inviteId && !i.usedByDriverId) ?? null : null
  // An Operator's "TODA sign-up" link/QR (see OperatorPortalPage.tsx) carries
  // this so a brand-new TODA registering through it is auto-linked to that
  // Operator — no manual Admin assignment needed afterward.
  const inviteOperatorId = searchParams.get('operatorId')
  // A TODA's "Grow your TODA" driver sign-up link/QR (see
  // TodaAdminPage.tsx's DriverInviteSection) carries this so a new driver
  // registering through it has their TODA organization pre-selected — unlike
  // the named DriverInvite flow above, the driver still verifies via OTP and
  // fills in their own documents; only the org choice is pre-scoped.
  const inviteTodaOrgId = !invite ? searchParams.get('todaOrgId') : null
  // Lets the hamburger drawer's "TODA Admin" item (see NavBar.tsx) land
  // straight on this tab after logging the driver out, instead of the
  // default Driver login one.
  const [mode, setMode] = useState<'login' | 'register' | 'toda_admin'>(
    invite || inviteTodaOrgId
      ? 'register'
      : searchParams.get('mode') === 'toda_admin' || inviteOperatorId
        ? 'toda_admin'
        : 'login',
  )

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
        <button
          onClick={() => setMode('login')}
          className={`flex-1 rounded-md py-2 text-xs font-medium transition ${
            mode === 'login' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'
          }`}
        >
          Driver login
        </button>
        <button
          onClick={() => setMode('register')}
          className={`flex-1 rounded-md py-2 text-xs font-medium transition ${
            mode === 'register' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'
          }`}
        >
          Register as driver
        </button>
        <button
          onClick={() => setMode('toda_admin')}
          className={`flex-1 rounded-md py-2 text-xs font-medium transition ${
            mode === 'toda_admin' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'
          }`}
        >
          TODA Admin
        </button>
      </div>

      {mode === 'login' && <LoginForm drivers={drivers} onLoggedIn={onLoggedIn} />}
      {mode === 'register' && (
        <RegisterForm
          onSubmitted={() => setMode('login')}
          registerDriver={registerDriver}
          invite={invite}
          inviteTodaOrgId={inviteTodaOrgId}
        />
      )}
      {mode === 'toda_admin' && (
        <TodaAdminSection
          todaOrganizations={todaOrganizations}
          onLoggedIn={onTodaAdminLoggedIn}
          inviteOperatorId={inviteOperatorId}
        />
      )}
    </div>
  )
}

function TodaAdminSection({
  todaOrganizations,
  onLoggedIn,
  inviteOperatorId,
}: {
  todaOrganizations: ReturnType<typeof useRides>['todaOrganizations']
  onLoggedIn: (todaOrgId: string) => void
  inviteOperatorId: string | null
}) {
  const [subMode, setSubMode] = useState<'login' | 'register'>(inviteOperatorId ? 'register' : 'login')

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        <button
          onClick={() => setSubMode('login')}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
            subMode === 'login' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'
          }`}
        >
          Log in
        </button>
        <button
          onClick={() => setSubMode('register')}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
            subMode === 'register' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'
          }`}
        >
          Register new TODA
        </button>
      </div>
      {subMode === 'login' ? (
        <TodaAdminLoginForm todaOrganizations={todaOrganizations} onLoggedIn={onLoggedIn} />
      ) : (
        <TodaOrgRegisterForm onSubmitted={() => setSubMode('login')} inviteOperatorId={inviteOperatorId} />
      )}
    </div>
  )
}

// Every seeded demo TODA's officer PIN is auto-filled on selection (see
// handleSelectOrg below) — a newly self-registered org isn't in this set
// (even once Admin approves it), so its real PIN is never guessed or shown.
const MOCK_TODA_ORG_IDS = new Set(MOCK_TODA_ORGANIZATIONS.map((o) => o.id))

function TodaAdminLoginForm({
  todaOrganizations,
  onLoggedIn,
}: {
  todaOrganizations: ReturnType<typeof useRides>['todaOrganizations']
  onLoggedIn: (todaOrgId: string) => void
}) {
  const [todaOrgId, setTodaOrgId] = useState(todaOrganizations[0]?.id ?? '')
  const [pin, setPin] = useState(() =>
    todaOrganizations[0]?.id && MOCK_TODA_ORG_IDS.has(todaOrganizations[0].id) ? todaOrganizations[0].adminPin : '',
  )
  const [error, setError] = useState('')

  function handleSelectOrg(id: string) {
    setTodaOrgId(id)
    const seed = MOCK_TODA_ORG_IDS.has(id) ? todaOrganizations.find((o) => o.id === id) : undefined
    setPin(seed?.adminPin ?? '')
  }

  function handleLogin() {
    const org = todaOrganizations.find((o) => o.id === todaOrgId)
    if (!org) {
      setError('Select a TODA organization.')
      return
    }
    if (org.adminPin !== pin) {
      setError('Incorrect PIN.')
      return
    }
    if (org.verificationStatus === 'pending') {
      const deadlineText = org.registrationNoteDeadline
        ? ` Please resubmit by ${new Date(org.registrationNoteDeadline).toLocaleDateString()}, or this application will be rejected.`
        : ''
      setError(
        org.registrationNote
          ? `This TODA registration is still under review by the App Admin. Note from Admin: ${org.registrationNote}${deadlineText}`
          : 'This TODA registration is still under review by the App Admin.',
      )
      return
    }
    if (org.verificationStatus === 'rejected') {
      setError('This TODA registration was not approved. Contact support.')
      return
    }
    setError('')
    onLoggedIn(org.id)
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-700">TODA Admin access</h2>
      <p className="text-xs text-slate-500">
        Exclusive to your own TODA organization's officer PIN — this only manages your organization, not others.
      </p>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">TODA organization</label>
        <select
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={todaOrgId}
          onChange={(e) => handleSelectOrg(e.target.value)}
        >
          {todaOrganizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
              {org.verificationStatus !== 'approved' ? ` (${org.verificationStatus})` : ''}
              {MOCK_TODA_ORG_IDS.has(org.id) ? ` (demo, PIN ${org.adminPin})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Officer PIN</label>
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
        onClick={handleLogin}
        className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Log in
      </button>
    </section>
  )
}

function TodaOrgRegisterForm({
  onSubmitted,
  inviteOperatorId,
}: {
  onSubmitted: () => void
  inviteOperatorId: string | null
}) {
  const { registerTodaOrganization, setTodaOperator, operators } = useRides()
  const inviteOperator = inviteOperatorId ? operators.find((o) => o.id === inviteOperatorId) ?? null : null
  const [name, setName] = useState('')
  const [presidentName, setPresidentName] = useState('')
  const [secretaryName, setSecretaryName] = useState('')
  const [additionalOfficerName, setAdditionalOfficerName] = useState('')
  const [address, setAddress] = useState<PhAddressValue>(EMPTY_PH_ADDRESS)
  const [gps, setGps] = useState<GeoCoords | null>(null)
  const [gpsStatus, setGpsStatus] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function handleCaptureGps() {
    setGpsStatus('Getting your current location…')
    try {
      const coords = await getCurrentGeoPosition()
      setGps(coords)
      setGpsStatus(`Captured: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`)
    } catch {
      setGpsStatus('Could not get your location — check location permissions, or enter coordinates manually below.')
    }
  }

  function handleSubmit() {
    if (
      !name.trim() ||
      !presidentName.trim() ||
      !secretaryName.trim() ||
      !address.province ||
      !address.city ||
      !address.barangay ||
      !address.addressDetail.trim() ||
      pin.length !== 4
    ) {
      setError(
        "Fill in your TODA's name, President's and Secretary's names, full address (province/city/barangay/detail), and a 4-digit PIN.",
      )
      return
    }
    const officers: TodaOfficer[] = [
      { name: presidentName.trim(), role: 'President' },
      { name: secretaryName.trim(), role: 'Secretary' },
      ...(additionalOfficerName.trim() ? [{ name: additionalOfficerName.trim(), role: 'Other' as const }] : []),
    ]
    const newTodaOrgId = registerTodaOrganization({
      name: name.trim(),
      officers,
      province: address.province,
      city: address.city,
      barangay: address.barangay,
      addressDetail: address.addressDetail.trim(),
      terminalGps: gps,
      adminPin: pin,
    })
    if (inviteOperator) setTodaOperator(newTodaOrgId, inviteOperator.id)
    setError('')
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <section className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-center">
        <p className="text-sm font-semibold text-brand-800">Registration submitted</p>
        <p className="mt-1 text-xs text-slate-600">
          {inviteOperator
            ? `Your TODA is now linked under ${inviteOperator.name}. It's still with the App Admin for review — your officer PIN will work once it's approved.`
            : "Your TODA's application is with the App Admin for review. Your officer PIN will work once it's approved."}
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
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-700">Register a new TODA organization</h2>

      {inviteOperator && (
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-xs text-brand-800">
          <p className="font-medium">Joining {inviteOperator.name}</p>
          <p className="mt-0.5">
            Registering through this link automatically links your TODA under {inviteOperator.name} (TaaS Level 2)
            once the App Admin approves it — no separate assignment step needed.
          </p>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">TODA name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. San Roque TODA"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">President's name</label>
          <input
            value={presidentName}
            onChange={(e) => setPresidentName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Secretary's name</label>
          <input
            value={secretaryName}
            onChange={(e) => setSecretaryName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Additional officer (optional)</label>
        <input
          value={additionalOfficerName}
          onChange={(e) => setAdditionalOfficerName(e.target.value)}
          placeholder="e.g. Treasurer's name"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-[11px] text-slate-400">
          At least two authorized officers (President and Secretary) are required — Admin holds them accountable
          for the organization.
        </p>
      </div>

      <PhAddressFields value={address} onChange={setAddress} />

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="mb-1 text-xs font-medium text-slate-600">Terminal GPS location</p>
        <p className="mb-2 text-[11px] text-slate-400">
          Stand at the terminal and tap this so the app can later confirm a driver is actually there before letting
          them join the queue.
        </p>
        <button
          type="button"
          onClick={handleCaptureGps}
          className="w-full rounded-lg border border-brand-300 bg-white py-2 text-xs font-medium text-brand-700 hover:bg-brand-50"
        >
          📍 Use my current GPS location
        </button>
        {gpsStatus && <p className="mt-2 text-[11px] text-slate-500">{gpsStatus}</p>}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            type="number"
            step="any"
            value={gps?.lat ?? ''}
            onChange={(e) => setGps((prev) => ({ lat: Number(e.target.value), lng: prev?.lng ?? 0 }))}
            placeholder="Latitude"
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
          <input
            type="number"
            step="any"
            value={gps?.lng ?? ''}
            onChange={(e) => setGps((prev) => ({ lat: prev?.lat ?? 0, lng: Number(e.target.value) }))}
            placeholder="Longitude"
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          Optional at registration — you can also set/update this later from the TODA Admin page.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Create a 4-digit officer PIN</label>
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
        onClick={handleSubmit}
        className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Submit registration
      </button>
    </section>
  )
}

const MOCK_DRIVER_IDS = new Set(MOCK_DRIVERS.map((d) => d.id))

function LoginForm({
  drivers,
  onLoggedIn,
}: {
  drivers: ReturnType<typeof useRides>['drivers']
  onLoggedIn: (driverId: string) => void
}) {
  const { appealDriverRejection, resubmitDriverDocument } = useRides()
  const [statusDriverId, setStatusDriverId] = useState<string | null>(null)
  const [appealDraft, setAppealDraft] = useState('')
  const [appealSubmitted, setAppealSubmitted] = useState(false)

  const statusDriver = statusDriverId ? drivers.find((d) => d.id === statusDriverId) ?? null : null

  function handleFound(driverId: string) {
    const driver = drivers.find((d) => d.id === driverId)
    if (!driver) return
    if (driver.verificationStatus !== 'approved') {
      setStatusDriverId(driver.id)
      setAppealDraft('')
      setAppealSubmitted(false)
      return
    }
    setStatusDriverId(null)
    onLoggedIn(driver.id)
  }

  function handleSubmitAppeal() {
    if (!statusDriver || !appealDraft.trim()) return
    appealDriverRejection(statusDriver.id, appealDraft.trim())
    setAppealSubmitted(true)
  }

  if (statusDriver && statusDriver.verificationStatus !== 'approved') {
    const isPending = statusDriver.verificationStatus === 'pending'
    const isAppealPending = isPending && !!statusDriver.appealMessage
    return (
      <div className="space-y-3">
        <div
          className={`rounded-xl border p-4 ${
            isPending ? 'border-amber-200 bg-amber-50' : 'border-rose-200 bg-rose-50'
          }`}
        >
          <p className={`text-sm font-semibold ${isPending ? 'text-amber-800' : 'text-rose-800'}`}>
            {isAppealPending
              ? 'Your appeal is under review'
              : isPending
                ? 'Application status: Pending review'
                : 'Application status: Rejected'}
          </p>
          <p className={`mt-1 text-xs ${isPending ? 'text-amber-700' : 'text-rose-700'}`}>
            {statusDriver.name}
            {statusDriver.plateNumber ? ` · Plate ${statusDriver.plateNumber}` : ''}
          </p>

          {isPending && statusDriver.pendingNote && (
            <p className="mt-2 rounded-lg bg-white/70 p-2 text-xs text-amber-800">
              <span className="font-semibold">Note from Admin — requirements as noted: </span>
              {statusDriver.pendingNote}
            </p>
          )}
          {isPending && statusDriver.pendingNoteDeadline && (
            <p className="mt-1 text-[11px] text-amber-700">
              Please resubmit by {new Date(statusDriver.pendingNoteDeadline).toLocaleDateString()}, or your
              application will be rejected.
            </p>
          )}
          {isPending && !statusDriver.pendingNote && !isAppealPending && (
            <p className="mt-2 text-xs text-amber-700">Your application is still under review by Admin.</p>
          )}
          {isAppealPending && (
            <p className="mt-2 text-xs text-amber-700">
              Admin is re-reviewing your application along with the appeal message you sent.
            </p>
          )}

          {isPending && (
            <div className="mt-3 space-y-2 border-t border-amber-200 pt-3">
              <p className="text-xs font-medium text-amber-800">
                Follow up on your application — update or re-upload any document below. Admin sees the change on
                their next review, no need to wait for a specific note first.
              </p>
              {DOCUMENT_TYPES.map((type) => (
                <DocumentUploadField
                  key={type}
                  label={DOCUMENT_LABELS[type]}
                  dataUrl={statusDriver.documents[type].dataUrl}
                  onUpload={(dataUrl) => resubmitDriverDocument(statusDriver.id, type, dataUrl)}
                />
              ))}
            </div>
          )}

          {!isPending && (
            <>
              {statusDriver.rejectionReason && (
                <p className="mt-2 rounded-lg bg-white/70 p-2 text-xs text-rose-800">
                  <span className="font-semibold">Reason: </span>
                  {statusDriver.rejectionReason}
                </p>
              )}
              {appealSubmitted ? (
                <p className="mt-2 rounded-lg bg-white/70 p-2 text-xs font-medium text-emerald-700">
                  Appeal submitted — Admin will review it again.
                </p>
              ) : (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-rose-700">
                    You can appeal this decision — Admin will review your application again.
                  </p>
                  <textarea
                    value={appealDraft}
                    onChange={(e) => setAppealDraft(e.target.value)}
                    placeholder="Explain why this should be reconsidered, or what you've fixed"
                    rows={3}
                    className="w-full rounded-lg border border-rose-200 bg-white px-2 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleSubmitAppeal}
                    disabled={!appealDraft.trim()}
                    className="w-full rounded-lg bg-rose-600 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Appeal this decision
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => setStatusDriverId(null)}
          className="text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          ← Back to login
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-700">Driver login</h2>
        <p className="mt-1 text-xs text-slate-500">
          Access is exclusive to your own driver account — no list of other drivers is shown.
        </p>
      </div>
      <IdentifierLoginForm
        accounts={drivers}
        seedIds={MOCK_DRIVER_IDS}
        onFound={handleFound}
        noAccountHint="No driver account found for that name, email, or mobile number."
      />
    </div>
  )
}

function RegisterForm({
  onSubmitted,
  registerDriver,
  invite,
  inviteTodaOrgId,
}: {
  onSubmitted: () => void
  registerDriver: ReturnType<typeof useRides>['registerDriver']
  invite: DriverInvite | null
  inviteTodaOrgId: string | null
}) {
  const { todaOrganizations } = useRides()
  // An invite already identifies who this is and which TODA vouched for
  // them, so it skips the OTP identity-verification step entirely and goes
  // straight to filling in the rest (plate/license/address/PIN/documents).
  const [step, setStep] = useState<'otp' | 'profile'>(invite ? 'profile' : 'otp')
  const [name, setName] = useState(invite?.name ?? '')
  const [plateNumber, setPlateNumber] = useState('')
  const [licenseNo, setLicenseNo] = useState('')
  const [confirmLicenseNo, setConfirmLicenseNo] = useState('')
  const [licenseExpiry, setLicenseExpiry] = useState('')
  // null = not yet chosen — resolved at submit time by matching the driver's
  // own address to an approved org (see autoDetectTodaOrgId), falling back
  // to freelance if nothing matches. A named invite or a TODA's own
  // sign-up link (inviteTodaOrgId — see DriverInviteSection in
  // TodaAdminPage.tsx) both pre-lock this instead.
  const [todaSelection, setTodaSelection] = useState<string | null>(invite?.todaOrgId ?? inviteTodaOrgId ?? null)
  const [todaQuery, setTodaQuery] = useState('')
  const [address, setAddress] = useState<PhAddressValue>(EMPTY_PH_ADDRESS)
  const [phone, setPhone] = useState(invite?.phone ?? '')
  const [email, setEmail] = useState(invite?.email ?? '')
  const [facebook, setFacebook] = useState('')
  const [pin, setPin] = useState('')
  const [documents, setDocuments] = useState<DriverDocuments>(EMPTY_DOCUMENTS)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const inviteOrgName = invite ? todaOrganizations.find((o) => o.id === invite.todaOrgId)?.name : null
  // Locked (non-editable) TODA org, from either flow above — distinct from
  // todaSelection being merely "chosen" (via search/freelance), which still
  // shows a "Change" option.
  const lockedTodaOrgId = invite?.todaOrgId ?? inviteTodaOrgId ?? null
  const lockedOrgName = lockedTodaOrgId ? todaOrganizations.find((o) => o.id === lockedTodaOrgId)?.name : null

  function updateDocument(type: keyof DriverDocuments, dataUrl: string) {
    setDocuments((prev) => ({ ...prev, [type]: { submitted: true, dataUrl } }))
  }

  function handleVerified(verifiedName: string, verifiedPhone: string) {
    setName(verifiedName)
    setPhone(verifiedPhone)
    setStep('profile')
  }

  function handleSubmit() {
    if (
      !plateNumber.trim() ||
      !licenseNo.trim() ||
      !licenseExpiry ||
      !address.province ||
      !address.city ||
      !address.barangay ||
      !address.addressDetail.trim() ||
      pin.length !== 4
    ) {
      setError('Fill in your plate number, license details, full address, and a 4-digit PIN.')
      return
    }
    if (licenseNo.trim() !== confirmLicenseNo.trim()) {
      setError(
        "The license number you typed and the confirmation don't match. Double-check both fields against your license.",
      )
      return
    }
    if (new Date(licenseExpiry).getTime() <= Date.now()) {
      setError('Your license expiry date must be in the future — an expired license can\'t be used to register.')
      return
    }
    const missing = DOCUMENT_TYPES.filter((t) => !documents[t].submitted)
    if (missing.length > 0) {
      setError(`Please upload: ${missing.map((t) => DOCUMENT_LABELS[t]).join(', ')}.`)
      return
    }
    const resolvedTodaOrgId =
      todaSelection === null
        ? autoDetectTodaOrgId(todaOrganizations, address)
        : todaSelection === FREELANCE_VALUE
          ? null
          : todaSelection
    registerDriver({
      name: name.trim(),
      plateNumber: plateNumber.trim(),
      licenseNo: licenseNo.trim(),
      licenseExpiry,
      pin,
      documents,
      todaOrgId: resolvedTodaOrgId,
      province: address.province,
      city: address.city,
      barangay: address.barangay,
      addressDetail: address.addressDetail.trim(),
      phone: phone.trim(),
      email: email.trim() || null,
      facebook: facebook.trim() || null,
      inviteId: invite?.id ?? null,
    })
    setError('')
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <section className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-center">
        <p className="text-sm font-semibold text-brand-800">Application submitted</p>
        <p className="mt-1 text-xs text-slate-600">
          Your documents are with Admin for review. You'll be able to log in once your account is approved.
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

  if (step === 'otp') {
    return (
      <RegistrationOtpStep
        title="Register as a new driver"
        onVerified={handleVerified}
      />
    )
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-700">Register as a new driver</h2>

      {invite ? (
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-xs text-brand-800">
          <p className="font-medium">Invited by {inviteOrgName ?? 'your TODA'}</p>
          <p className="mt-0.5">
            {name} · {phone}
            {email ? ` · ${email}` : ''} — set by your TODA officer. Fill in the rest below, including your
            documents.
          </p>
        </div>
      ) : inviteTodaOrgId && lockedOrgName ? (
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-xs text-brand-800">
          <p className="font-medium">Joining {lockedOrgName}</p>
          <p className="mt-0.5">
            Registering through this link automatically sets your TODA organization to {lockedOrgName} — Admin
            still reviews your documents as usual.
          </p>
        </div>
      ) : null}
      {!invite && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">
            {name} · {phone} · <span className="font-medium text-emerald-600">✓ verified</span>
          </span>
          <button
            type="button"
            onClick={() => setStep('otp')}
            className="font-medium text-brand-600 hover:text-brand-700"
          >
            Change
          </button>
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Email (optional)</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-[11px] text-slate-400">
          Optional — lets you log in with your email instead of just your name or number.
        </p>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Facebook profile or username (optional)</label>
        <input
          value={facebook}
          onChange={(e) => setFacebook(e.target.value)}
          placeholder="facebook.com/yourname"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-[11px] text-slate-400">
          Optional — helps riders and your TODA recognize you informally, alongside your license documents.
        </p>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Tricycle plate number</label>
        <input
          value={plateNumber}
          onChange={(e) => setPlateNumber(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Driver's license number</label>
        <input
          value={licenseNo}
          onChange={(e) => setLicenseNo(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">
          Confirm driver's license number
        </label>
        <input
          value={confirmLicenseNo}
          onChange={(e) => setConfirmLicenseNo(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-[11px] text-slate-400">
          Re-type it exactly as it appears on your license — we check the two entries match. (This checks
          your typing, not the uploaded photo — we don't do automatic ID/OCR verification yet.)
        </p>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">License expiry date</label>
        <input
          type="date"
          value={licenseExpiry}
          onChange={(e) => setLicenseExpiry(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">TODA organization</label>
        {lockedTodaOrgId ? (
          <p className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {lockedOrgName ?? 'Your TODA'} — set by your {invite ? 'invite' : "TODA's sign-up link"}
          </p>
        ) : todaSelection !== null ? (
          <div className="flex items-center justify-between rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-700">
              {todaSelection === FREELANCE_VALUE
                ? 'Freelance (no TODA)'
                : (todaOrganizations.find((o) => o.id === todaSelection)?.name ?? 'Selected TODA')}
            </span>
            <button
              type="button"
              onClick={() => setTodaSelection(null)}
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <input
              value={todaQuery}
              onChange={(e) => setTodaQuery(e.target.value)}
              placeholder="Type your TODA's name…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            {todaQuery.trim() &&
              (() => {
                const matches = todaOrganizations.filter(
                  (org) => org.verificationStatus === 'approved' && matchesNameQuery(org.name, todaQuery),
                )
                return (
                  <div className="mt-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
                    {matches.length === 0 ? (
                      <p className="px-2 py-1.5 text-xs text-slate-400">
                        No matching TODA found — check the spelling, or leave this blank.
                      </p>
                    ) : (
                      matches.map((org) => (
                        <button
                          key={org.id}
                          type="button"
                          onClick={() => {
                            setTodaSelection(org.id)
                            setTodaQuery('')
                          }}
                          className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                        >
                          {org.name}
                        </button>
                      ))
                    )}
                  </div>
                )
              })()}
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-[11px] text-slate-400">Leave blank to auto-fill from your address, or</p>
              <button
                type="button"
                onClick={() => setTodaSelection(FREELANCE_VALUE)}
                className="shrink-0 text-[11px] font-medium text-brand-600 hover:text-brand-700"
              >
                I'm freelance (no TODA)
              </button>
            </div>
          </>
        )}
      </div>
      <PhAddressFields
        value={address}
        onChange={setAddress}
        addressDetailLabel="Detailed home address (zone, street, house no., notes)"
        addressDetailPlaceholder="e.g. Purok 2, near the barangay hall"
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
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-500">Required documents</p>
        {DOCUMENT_TYPES.map((type) => (
          <DocumentUploadField
            key={type}
            label={DOCUMENT_LABELS[type]}
            dataUrl={documents[type].dataUrl}
            onUpload={(dataUrl) => updateDocument(type, dataUrl)}
          />
        ))}
      </div>

      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

      <button
        onClick={handleSubmit}
        className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Submit application
      </button>
    </section>
  )
}
