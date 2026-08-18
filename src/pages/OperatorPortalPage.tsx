import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useSession } from '../context/SessionContext'
import { useRides } from '../context/RideContext'
import { estimatedMonthlyOperatorFee, estimatedMonthlyTodaFee, operatorPortfolioStats } from '../mock/data'
import { EMPTY_PH_ADDRESS, PhAddressFields, type PhAddressValue } from '../components/PhAddressFields'
import type { Driver, TodaOfficer } from '../types'

const STATUS_STYLES: Record<string, string> = {
  approved: 'bg-brand-100 text-brand-700',
  pending: 'bg-amber-100 text-amber-800',
  rejected: 'bg-rose-100 text-rose-700',
}

const DRIVER_STATUS_STYLES: Record<string, string> = {
  active: 'bg-brand-100 text-brand-700',
  paused: 'bg-amber-100 text-amber-800',
  terminated: 'bg-rose-100 text-rose-700',
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-brand-700">{value}</p>
    </div>
  )
}

// TaaS Level 2 — "Authorized Operator" dashboard, mirroring PharmacyPortalPage's/
// TodaAdminPage's shape (own-scope filtering in-component, single-scroll
// layout). Reached at the dedicated /operator route (see App.tsx) when an
// Operator logs in themselves — an Operator can see, but not directly
// manage, the TodaOrganizations reporting to it (see
// TodaOrganization.operatorId); each TODA's own admin still runs its own
// day-to-day operations from its own TODA Admin login.
//
// Also reused (read-only) by SuperAdminPage.tsx's "Operators (Level 2)" tab
// so Super Admin can view any Operator's dashboard for oversight — passing
// `operatorId` overrides the session-based self-lookup and forces the
// Business Profile section into view-only mode (Super Admin isn't editing
// on the Operator's behalf from here).
export function OperatorPortalPage({ operatorId: operatorIdProp }: { operatorId?: string } = {}) {
  const { loggedInOperatorAdminId } = useSession()
  const {
    operators,
    franchises,
    todaOrganizations,
    drivers,
    rides,
    updateOperatorProfile,
    registerTodaOrganization,
    setTodaOperator,
    approveTodaOrg,
  } = useRides()
  const readOnly = !!operatorIdProp
  const operatorId = operatorIdProp ?? loggedInOperatorAdminId

  if (!operatorId) {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
        <p className="text-sm text-slate-400">Not logged in.</p>
      </div>
    )
  }

  const operator = operators.find((o) => o.id === operatorId)
  if (!operator) {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
        <p className="text-sm text-slate-400">Operator not found.</p>
      </div>
    )
  }

  const franchise = operator.franchiseId ? franchises.find((f) => f.id === operator.franchiseId) : null
  const myTodaOrgs = todaOrganizations.filter((o) => o.operatorId === operator.id)
  const myTodaOrgIds = new Set(myTodaOrgs.map((o) => o.id))
  const myDrivers = drivers.filter((d) => d.todaOrgId && myTodaOrgIds.has(d.todaOrgId))
  const estimatedThisMonth = estimatedMonthlyOperatorFee(operator, todaOrganizations, drivers, rides)
  const portfolio = operatorPortfolioStats(operator, todaOrganizations, drivers, rides)

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-medium text-slate-500">{readOnly ? 'Viewing (Super Admin)' : 'Logged in as'}</p>
        <h1 className="text-sm font-semibold text-slate-700">🏢 {operator.name}</h1>
        <p className="mt-1 text-xs text-slate-500">
          {readOnly
            ? "Super Admin view — read-only. Nothing here is editable on the Operator's behalf."
            : "Exclusive access to " + operator.name + " only — you can't view or manage any other Operator's TODAs from here. Each TODA's own admin still runs its own day-to-day operations."}
        </p>
        <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[operator.verificationStatus]}`}>
          {operator.verificationStatus === 'approved' ? '✓ Approved' : operator.verificationStatus === 'pending' ? 'Pending review' : 'Rejected'}
        </span>
      </section>

      <PortfolioOverviewSection portfolio={portfolio} />

      <BusinessProfileSection operator={operator} readOnly={readOnly} onSave={(updates) => updateOperatorProfile(operator.id, updates)} />

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">My Subscription (Level 2)</h2>
        <p className="mb-3 text-xs text-slate-500">
          TODASafeRide's Level 2 "Authorized Operator" plan — a separate billing relationship with TODASafeRide HQ,
          set by the App Admin on approval.
        </p>
        <div className="space-y-1.5 rounded-lg bg-slate-50 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Activation fee</span>
            <span className="font-medium text-slate-700">{operator.activationFee !== null ? `₱${operator.activationFee}` : 'Not yet set'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Monthly platform fee</span>
            <span className="font-medium text-slate-700">₱{operator.monthlyPlatformFee}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Per-booking fee</span>
            <span className="font-medium text-slate-700">{operator.perBookingFee > 0 ? `₱${operator.perBookingFee}` : 'Not enabled'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Reports to</span>
            <span className="font-medium text-slate-700">{franchise ? franchise.name : 'TODASafeRide HQ (direct)'}</span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
            <span className="font-medium text-slate-600">Estimated this month</span>
            <span className="font-semibold text-slate-800">₱{estimatedThisMonth}</span>
          </div>
        </div>
      </section>

      {!readOnly && (
        <TodaInviteSection
          operatorId={operator.id}
          operatorName={operator.name}
          registerTodaOrganization={registerTodaOrganization}
          setTodaOperator={setTodaOperator}
          approveTodaOrg={approveTodaOrg}
        />
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">TODA groups under my operation</h2>
        <p className="mb-3 text-xs text-slate-500">
          Each TODA's own admin manages its own members, dues, and commission day-to-day — use the section above to
          add a TODA to your operation.
        </p>
        {myTodaOrgs.length === 0 ? (
          <p className="text-sm text-slate-400">No TODAs assigned to your operation yet.</p>
        ) : (
          <div className="space-y-2">
            {myTodaOrgs.map((org) => (
              <div key={org.id} className="rounded-lg border border-slate-200 p-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">{org.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[org.verificationStatus]}`}>
                    {org.verificationStatus}
                  </span>
                </div>
                <p className="mt-0.5 text-slate-400">
                  {org.barangay}, {org.city} · {org.saasPlan} plan · {drivers.filter((d) => d.todaOrgId === org.id).length} driver(s)
                </p>
                <p className="mt-1 font-medium text-slate-600">
                  Estimated this month: ₱{estimatedMonthlyTodaFee(org, drivers, rides)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <MembersSection drivers={myDrivers} todaOrgs={myTodaOrgs} />
    </div>
  )
}

function PortfolioOverviewSection({ portfolio }: { portfolio: ReturnType<typeof operatorPortfolioStats> }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-slate-700">Portfolio Overview — Income Status</h2>
      <p className="mb-3 text-xs text-slate-500">
        All-time activity across every TODA and driver in your operation — read straight off completed rides, not
        estimated.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <StatTile label="TODAs" value={String(portfolio.todaCount)} />
        <StatTile label="Drivers" value={String(portfolio.driverCount)} />
        <StatTile label="Completed rides" value={String(portfolio.completedRides)} />
        <StatTile label="Gross fares" value={`₱${portfolio.grossFares}`} />
        <StatTile label="Driver payouts" value={`₱${portfolio.driverPayouts}`} />
        <StatTile label="TODA commissions" value={`₱${portfolio.todaCommissions}`} />
      </div>
    </section>
  )
}

// Lets an Operator grow their own portfolio two ways: hand a TODA a
// self-service link/QR (they fill in their own details, still reviewed by
// the App Admin same as any TODA registration — see TodaOrgRegisterForm's
// inviteOperatorId handling), or add one directly when the Operator already
// has the TODA's details in hand (auto-approved, since the Operator is
// vouching for them directly — same trust level as Admin adding one).
function TodaInviteSection({
  operatorId,
  operatorName,
  registerTodaOrganization,
  setTodaOperator,
  approveTodaOrg,
}: {
  operatorId: string
  operatorName: string
  registerTodaOrganization: ReturnType<typeof useRides>['registerTodaOrganization']
  setTodaOperator: ReturnType<typeof useRides>['setTodaOperator']
  approveTodaOrg: ReturnType<typeof useRides>['approveTodaOrg']
}) {
  const [copied, setCopied] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [name, setName] = useState('')
  const [presidentName, setPresidentName] = useState('')
  const [secretaryName, setSecretaryName] = useState('')
  const [address, setAddress] = useState<PhAddressValue>(EMPTY_PH_ADDRESS)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [addedName, setAddedName] = useState('')

  const inviteLink = typeof window !== 'undefined' ? `${window.location.origin}/drive?mode=toda_admin&operatorId=${operatorId}` : ''

  function handleCopyLink() {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function resetAddForm() {
    setName('')
    setPresidentName('')
    setSecretaryName('')
    setAddress(EMPTY_PH_ADDRESS)
    setPin('')
    setError('')
  }

  function handleAddToda() {
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
      setError("Fill in the TODA's name, President's and Secretary's names, full address, and a 4-digit PIN.")
      return
    }
    const officers: TodaOfficer[] = [
      { name: presidentName.trim(), role: 'President' },
      { name: secretaryName.trim(), role: 'Secretary' },
    ]
    const newId = registerTodaOrganization({
      name: name.trim(),
      officers,
      province: address.province,
      city: address.city,
      barangay: address.barangay,
      addressDetail: address.addressDetail.trim(),
      terminalGps: null,
      adminPin: pin,
    })
    setTodaOperator(newId, operatorId)
    approveTodaOrg(newId)
    setAddedName(name.trim())
    resetAddForm()
    setShowAddForm(false)
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-slate-700">Grow your operation</h2>
      <p className="mb-3 text-xs text-slate-500">
        Add TODA groups to {operatorName} — send a self-sign-up link or QR code, or add one directly if you already
        have their details.
      </p>

      <div className="rounded-lg bg-slate-50 p-3">
        <p className="mb-1 text-xs font-medium text-slate-600">TODA sign-up link</p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={inviteLink}
            onFocus={(e) => e.target.select()}
            className="w-full truncate rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={handleCopyLink}
            className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          Send this via Messenger/SMS to a TODA president or secretary — it opens straight to the TODA sign-up form
          and automatically links their organization under {operatorName} once the App Admin approves it.
        </p>
        <div className="mt-3 flex justify-center rounded-lg border border-slate-200 bg-white p-3">
          <QRCodeSVG value={inviteLink || ' '} size={144} level="M" marginSize={2} />
        </div>
      </div>

      {addedName && (
        <p className="mt-3 rounded-lg bg-brand-50 p-2 text-xs font-medium text-brand-700">
          ✓ {addedName} added and approved under {operatorName}.
        </p>
      )}

      {!showAddForm ? (
        <button
          type="button"
          onClick={() => {
            setAddedName('')
            setShowAddForm(true)
          }}
          className="mt-3 w-full rounded-lg border border-brand-300 bg-white py-2 text-xs font-medium text-brand-700 hover:bg-brand-50"
        >
          + Add a TODA directly
        </button>
      ) : (
        <div className="mt-3 space-y-2 rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-medium text-slate-600">Add a TODA directly</p>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">TODA name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. San Roque TODA"
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">President's name</label>
              <input
                value={presidentName}
                onChange={(e) => setPresidentName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Secretary's name</label>
              <input
                value={secretaryName}
                onChange={(e) => setSecretaryName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
              />
            </div>
          </div>
          <PhAddressFields value={address} onChange={setAddress} />
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">Officer PIN (4 digits)</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs tracking-widest"
              placeholder="••••"
            />
          </div>
          {error && <p className="text-[11px] font-medium text-rose-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleAddToda}
              className="flex-1 rounded-lg bg-brand-600 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
            >
              Add TODA
            </button>
            <button
              type="button"
              onClick={() => {
                resetAddForm()
                setShowAddForm(false)
              }}
              className="flex-1 rounded-lg border border-slate-300 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

interface BusinessProfileValues {
  contactPerson: string
  contactPhone: string
  email: string | null
  province: string
  city: string
  barangay: string
  addressDetail: string
  businessRegistrationNo: string | null
}

function BusinessProfileSection({
  operator,
  readOnly = false,
  onSave,
}: {
  operator: BusinessProfileValues
  readOnly?: boolean
  onSave: (values: BusinessProfileValues) => void
}) {
  const [editing, setEditing] = useState(false)
  const [contactPerson, setContactPerson] = useState(operator.contactPerson)
  const [contactPhone, setContactPhone] = useState(operator.contactPhone)
  const [email, setEmail] = useState(operator.email ?? '')
  const [province, setProvince] = useState(operator.province)
  const [city, setCity] = useState(operator.city)
  const [barangay, setBarangay] = useState(operator.barangay)
  const [addressDetail, setAddressDetail] = useState(operator.addressDetail)
  const [businessRegistrationNo, setBusinessRegistrationNo] = useState(operator.businessRegistrationNo ?? '')
  const [saved, setSaved] = useState(false)

  function handleStartEdit() {
    setContactPerson(operator.contactPerson)
    setContactPhone(operator.contactPhone)
    setEmail(operator.email ?? '')
    setProvince(operator.province)
    setCity(operator.city)
    setBarangay(operator.barangay)
    setAddressDetail(operator.addressDetail)
    setBusinessRegistrationNo(operator.businessRegistrationNo ?? '')
    setSaved(false)
    setEditing(true)
  }

  function handleSave() {
    onSave({
      contactPerson: contactPerson.trim(),
      contactPhone: contactPhone.trim(),
      email: email.trim() || null,
      province: province.trim(),
      city: city.trim(),
      barangay: barangay.trim(),
      addressDetail: addressDetail.trim(),
      businessRegistrationNo: businessRegistrationNo.trim() || null,
    })
    setEditing(false)
    setSaved(true)
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Business Profile</h2>
        {!editing && !readOnly && (
          <button type="button" onClick={handleStartEdit} className="text-xs font-medium text-brand-600 hover:text-brand-700">
            Edit
          </button>
        )}
      </div>
      <p className="mb-3 text-xs text-slate-500">Your own business details — required for franchise/operator documentation.</p>

      {editing ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Contact person</label>
              <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Contact number</label>
              <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Province</label>
              <input value={province} onChange={(e) => setProvince(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">City</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Barangay</label>
              <input value={barangay} onChange={(e) => setBarangay(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Business Reg. No.</label>
              <input value={businessRegistrationNo} onChange={(e) => setBusinessRegistrationNo(e.target.value)} placeholder="DTI/SEC no." className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">Address detail</label>
            <input value={addressDetail} onChange={(e) => setAddressDetail(e.target.value)} placeholder="Building, unit, street" className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={handleSave} className="flex-1 rounded-lg bg-brand-600 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className="flex-1 rounded-lg border border-slate-300 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5 rounded-lg bg-slate-50 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Contact person</span>
            <span className="font-medium text-slate-700">{operator.contactPerson}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Contact number</span>
            <span className="font-medium text-slate-700">{operator.contactPhone}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Email</span>
            <span className="font-medium text-slate-700">{operator.email ?? 'Not set'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Address</span>
            <span className="max-w-[220px] truncate text-right font-medium text-slate-700">
              {[operator.addressDetail, operator.barangay, operator.city, operator.province].filter(Boolean).join(', ')}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Business Reg. No.</span>
            <span className="font-medium text-slate-700">{operator.businessRegistrationNo ?? 'Not set'}</span>
          </div>
          {saved && <p className="pt-1 text-[11px] font-medium text-brand-600">✓ Saved</p>}
        </div>
      )}
    </section>
  )
}

function MembersSection({ drivers, todaOrgs }: { drivers: Driver[]; todaOrgs: { id: string; name: string }[] }) {
  const [search, setSearch] = useState('')
  const [todaFilter, setTodaFilter] = useState('all')

  const filtered = drivers.filter((d) => {
    if (todaFilter !== 'all' && d.todaOrgId !== todaFilter) return false
    if (search.trim() && !d.name.toLowerCase().includes(search.trim().toLowerCase()) && !d.plateNumber.toLowerCase().includes(search.trim().toLowerCase())) return false
    return true
  })

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-slate-700">Members — Drivers ({drivers.length})</h2>
      <p className="mb-3 text-xs text-slate-500">
        Every driver registered under a TODA in your operation. Read-only — each driver's own TODA admin handles
        access/hold/terminate.
      </p>
      <div className="mb-2 flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or plate…"
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
        />
        <select value={todaFilter} onChange={(e) => setTodaFilter(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
          <option value="all">All TODAs</option>
          {todaOrgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-slate-400">No members found.</p>
      ) : (
        <div className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
          {filtered.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2 text-xs">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-700">
                  {d.name} · {d.plateNumber}
                </p>
                <p className="truncate text-[11px] text-slate-400">
                  {todaOrgs.find((o) => o.id === d.todaOrgId)?.name ?? 'Unknown TODA'} · ★{' '}
                  {d.ratingCount > 0 ? d.rating.toFixed(1) : '—'}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${DRIVER_STATUS_STYLES[d.accessStatus] ?? 'bg-slate-100 text-slate-600'}`}>
                {d.accessStatus}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
