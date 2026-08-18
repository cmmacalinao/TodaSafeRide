import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useSession } from '../context/SessionContext'
import { useRides } from '../context/RideContext'
import { estimatedMonthlyOperatorFee, franchisePortfolioStats } from '../mock/data'
import type { Driver, Operator } from '../types'

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

// TaaS Level 3 — "Franchise" (territory) dashboard, mirroring
// OperatorPortalPage.tsx's shape one level up: an Operator (Level 2) belongs
// to a Franchise via Operator.franchiseId, same nullable-back-reference
// pattern used everywhere else in this hierarchy. Reached at the dedicated
// /franchise route (see App.tsx) when a Franchise logs in themselves.
//
// Also reused (read-only) by SuperAdminPage.tsx's "Franchises (Level 3)"
// tab — passing `franchiseId` overrides the session-based self-lookup and
// forces the Business Profile section into view-only mode, same pattern as
// OperatorPortalPage.tsx.
export function FranchisePage({ franchiseId: franchiseIdProp }: { franchiseId?: string } = {}) {
  const { loggedInFranchiseAdminId } = useSession()
  const {
    franchises,
    operators,
    todaOrganizations,
    drivers,
    rides,
    updateFranchiseProfile,
    registerOperator,
    setOperatorFranchise,
    approveOperator,
  } = useRides()
  const readOnly = !!franchiseIdProp
  const franchiseId = franchiseIdProp ?? loggedInFranchiseAdminId

  if (!franchiseId) {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
        <p className="text-sm text-slate-400">Not logged in.</p>
      </div>
    )
  }

  const franchise = franchises.find((f) => f.id === franchiseId)
  if (!franchise) {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
        <p className="text-sm text-slate-400">Franchise not found.</p>
      </div>
    )
  }

  const myOperators = operators.filter((o) => o.franchiseId === franchise.id)
  const myOperatorIds = new Set(myOperators.map((o) => o.id))
  const myTodaOrgs = todaOrganizations.filter((o) => o.operatorId && myOperatorIds.has(o.operatorId))
  const myTodaOrgIds = new Set(myTodaOrgs.map((o) => o.id))
  const myDrivers = drivers.filter((d) => d.todaOrgId && myTodaOrgIds.has(d.todaOrgId))
  const portfolio = franchisePortfolioStats(franchise, operators, todaOrganizations, drivers, rides)

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-medium text-slate-500">{readOnly ? 'Viewing (Super Admin)' : 'Logged in as'}</p>
        <h1 className="text-sm font-semibold text-slate-700">🗺️ {franchise.name}</h1>
        <p className="mt-1 text-xs text-slate-500">
          {readOnly
            ? "Super Admin view — read-only. Nothing here is editable on the Franchise's behalf."
            : `${franchise.city}, ${franchise.province} territory — exclusive access to ${franchise.name} only, you can't view or manage any other Franchise's Operators from here.`}
        </p>
        <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[franchise.verificationStatus]}`}>
          {franchise.verificationStatus === 'approved' ? '✓ Approved' : franchise.verificationStatus === 'pending' ? 'Pending review' : 'Rejected'}
        </span>
      </section>

      <TerritoryOverviewSection portfolio={portfolio} />

      <BusinessProfileSection franchise={franchise} readOnly={readOnly} onSave={(updates) => updateFranchiseProfile(franchise.id, updates)} />

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">My Franchise (Level 3)</h2>
        <p className="mb-3 text-xs text-slate-500">
          TODASafeRide's Level 3 Franchise plan — set by the App Admin on approval.
        </p>
        <div className="space-y-1.5 rounded-lg bg-slate-50 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Initial franchise fee</span>
            <span className="font-medium text-slate-700">
              {franchise.initialFranchiseFee !== null ? `₱${franchise.initialFranchiseFee}` : 'Not yet set'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Monthly technology fee</span>
            <span className="font-medium text-slate-700">₱{franchise.monthlyTechnologyFee}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Royalty / transaction share</span>
            <span className="font-medium text-slate-700">
              {franchise.royaltyPct !== null ? `${franchise.royaltyPct}%` : 'Not enabled'}
            </span>
          </div>
        </div>
      </section>

      {!readOnly && (
        <TerritoryInviteSection
          franchiseId={franchise.id}
          franchiseName={franchise.name}
          myOperators={myOperators}
          registerOperator={registerOperator}
          setOperatorFranchise={setOperatorFranchise}
          approveOperator={approveOperator}
        />
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">Operators in my territory</h2>
        <p className="mb-3 text-xs text-slate-500">
          Each Operator manages its own TODAs day-to-day — use the section above to add an Operator to your
          territory.
        </p>
        {myOperators.length === 0 ? (
          <p className="text-sm text-slate-400">No Operators assigned to your territory yet.</p>
        ) : (
          <div className="space-y-2">
            {myOperators.map((operator) => (
              <div key={operator.id} className="rounded-lg border border-slate-200 p-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">{operator.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[operator.verificationStatus]}`}>
                    {operator.verificationStatus}
                  </span>
                </div>
                <p className="mt-0.5 text-slate-400">
                  {operator.city}, {operator.province} ·{' '}
                  {todaOrganizations.filter((o) => o.operatorId === operator.id).length} TODA(s)
                </p>
                <p className="mt-1 font-medium text-slate-600">
                  Estimated this month: ₱{estimatedMonthlyOperatorFee(operator, todaOrganizations, drivers, rides)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">TODA groups in my territory</h2>
        <p className="mb-3 text-xs text-slate-500">Every TODA under an Operator in your territory, across the whole franchise.</p>
        {myTodaOrgs.length === 0 ? (
          <p className="text-sm text-slate-400">No TODAs in your territory yet.</p>
        ) : (
          <div className="max-h-[300px] space-y-1.5 overflow-y-auto pr-1">
            {myTodaOrgs.map((org) => (
              <div key={org.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2 text-xs">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-700">{org.name}</p>
                  <p className="truncate text-[11px] text-slate-400">
                    {operators.find((o) => o.id === org.operatorId)?.name ?? 'Unknown Operator'} ·{' '}
                    {drivers.filter((d) => d.todaOrgId === org.id).length} driver(s)
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[org.verificationStatus]}`}>
                  {org.verificationStatus}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <MembersSection drivers={myDrivers} todaOrgs={myTodaOrgs} />
    </div>
  )
}

function TerritoryOverviewSection({ portfolio }: { portfolio: ReturnType<typeof franchisePortfolioStats> }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-slate-700">Territory Overview — Income Status</h2>
      <p className="mb-3 text-xs text-slate-500">
        All-time activity across every Operator, TODA, and driver in your territory — read straight off completed
        rides, not estimated.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <StatTile label="Operators" value={String(portfolio.operatorCount)} />
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

// Lets a Franchise grow its territory two ways: hand an Operator a
// self-service link/QR (auto-linked under this Franchise, still reviewed by
// the App Admin — mirrors OperatorPortalPage.tsx's TodaInviteSection one
// level down), or add one directly when the Franchise already has the
// Operator's details (auto-approved). Also surfaces a TODA sign-up
// link/QR scoped to whichever of the Franchise's own Operators is
// selected — TODAs still report to an Operator (see
// TodaOrganization.operatorId), a Franchise has no direct authority over
// them, so this is really "send this Operator's TODA invite on their
// behalf," convenient for a Franchise coordinating onboarding across its
// whole territory.
function TerritoryInviteSection({
  franchiseId,
  franchiseName,
  myOperators,
  registerOperator,
  setOperatorFranchise,
  approveOperator,
}: {
  franchiseId: string
  franchiseName: string
  myOperators: Operator[]
  registerOperator: ReturnType<typeof useRides>['registerOperator']
  setOperatorFranchise: ReturnType<typeof useRides>['setOperatorFranchise']
  approveOperator: ReturnType<typeof useRides>['approveOperator']
}) {
  const [copiedOperatorLink, setCopiedOperatorLink] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [name, setName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [province, setProvince] = useState('')
  const [city, setCity] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [addedName, setAddedName] = useState('')

  const [todaOperatorId, setTodaOperatorId] = useState(myOperators[0]?.id ?? '')
  const [copiedTodaLink, setCopiedTodaLink] = useState(false)

  const operatorInviteLink =
    typeof window !== 'undefined' ? `${window.location.origin}/operator?apply=1&franchiseId=${franchiseId}` : ''
  const todaInviteLink =
    typeof window !== 'undefined' && todaOperatorId
      ? `${window.location.origin}/drive?mode=toda_admin&operatorId=${todaOperatorId}`
      : ''

  function handleCopyOperatorLink() {
    navigator.clipboard.writeText(operatorInviteLink).then(() => {
      setCopiedOperatorLink(true)
      setTimeout(() => setCopiedOperatorLink(false), 2000)
    })
  }

  function handleCopyTodaLink() {
    navigator.clipboard.writeText(todaInviteLink).then(() => {
      setCopiedTodaLink(true)
      setTimeout(() => setCopiedTodaLink(false), 2000)
    })
  }

  function resetAddForm() {
    setName('')
    setContactPerson('')
    setContactPhone('')
    setProvince('')
    setCity('')
    setPin('')
    setError('')
  }

  function handleAddOperator() {
    if (
      !name.trim() ||
      !contactPerson.trim() ||
      !contactPhone.trim() ||
      !province.trim() ||
      !city.trim() ||
      pin.trim().length !== 4
    ) {
      setError('Fill in the Operator name, contact person, contact number, province, city, and a 4-digit PIN.')
      return
    }
    const newId = registerOperator({
      name: name.trim(),
      contactPerson: contactPerson.trim(),
      contactPhone: contactPhone.trim(),
      province: province.trim(),
      city: city.trim(),
      adminPin: pin.trim(),
    })
    setOperatorFranchise(newId, franchiseId)
    approveOperator(newId)
    setAddedName(name.trim())
    resetAddForm()
    setShowAddForm(false)
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-slate-700">Grow your territory</h2>
      <p className="mb-3 text-xs text-slate-500">
        Add Operators to {franchiseName} — send a self-sign-up link or QR code, or add one directly if you already
        have their details. You can also hand out a TODA sign-up link on behalf of any Operator in your territory.
      </p>

      <div className="rounded-lg bg-slate-50 p-3">
        <p className="mb-1 text-xs font-medium text-slate-600">Operator sign-up link</p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={operatorInviteLink}
            onFocus={(e) => e.target.select()}
            className="w-full truncate rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={handleCopyOperatorLink}
            className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
          >
            {copiedOperatorLink ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          Send this to a prospective Operator — it opens straight to the Operator sign-up form and automatically
          links their organization under {franchiseName} once the App Admin approves it.
        </p>
        <div className="mt-3 flex justify-center rounded-lg border border-slate-200 bg-white p-3">
          <QRCodeSVG value={operatorInviteLink || ' '} size={144} level="M" marginSize={2} />
        </div>
      </div>

      {addedName && (
        <p className="mt-3 rounded-lg bg-brand-50 p-2 text-xs font-medium text-brand-700">
          ✓ {addedName} added and approved under {franchiseName}.
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
          + Add an Operator directly
        </button>
      ) : (
        <div className="mt-3 space-y-2 rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-medium text-slate-600">Add an Operator directly</p>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">Operator name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Nueva Ecija North Operator"
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">Contact person</label>
            <input
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500">Contact number</label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="09XX-XXX-XXXX"
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Province</label>
              <input
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500">City</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
              />
            </div>
          </div>
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
              onClick={handleAddOperator}
              className="flex-1 rounded-lg bg-brand-600 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
            >
              Add Operator
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

      <div className="mt-4 border-t border-slate-200 pt-3">
        <p className="mb-1 text-xs font-medium text-slate-600">TODA sign-up link (on behalf of an Operator)</p>
        {myOperators.length === 0 ? (
          <p className="text-xs text-slate-400">Add an Operator to your territory first — a TODA still needs an Operator over it.</p>
        ) : (
          <>
            <select
              value={todaOperatorId}
              onChange={(e) => setTodaOperatorId(e.target.value)}
              className="mb-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            >
              {myOperators.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={todaInviteLink}
                onFocus={(e) => e.target.select()}
                className="w-full truncate rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={handleCopyTodaLink}
                className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
              >
                {copiedTodaLink ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Opens straight to the TODA sign-up form, automatically linked under{' '}
              {myOperators.find((o) => o.id === todaOperatorId)?.name ?? 'the selected Operator'}.
            </p>
            <div className="mt-3 flex justify-center rounded-lg border border-slate-200 bg-white p-3">
              <QRCodeSVG value={todaInviteLink || ' '} size={144} level="M" marginSize={2} />
            </div>
          </>
        )}
      </div>
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
  franchise,
  readOnly = false,
  onSave,
}: {
  franchise: BusinessProfileValues
  readOnly?: boolean
  onSave: (values: BusinessProfileValues) => void
}) {
  const [editing, setEditing] = useState(false)
  const [contactPerson, setContactPerson] = useState(franchise.contactPerson)
  const [contactPhone, setContactPhone] = useState(franchise.contactPhone)
  const [email, setEmail] = useState(franchise.email ?? '')
  const [province, setProvince] = useState(franchise.province)
  const [city, setCity] = useState(franchise.city)
  const [barangay, setBarangay] = useState(franchise.barangay)
  const [addressDetail, setAddressDetail] = useState(franchise.addressDetail)
  const [businessRegistrationNo, setBusinessRegistrationNo] = useState(franchise.businessRegistrationNo ?? '')
  const [saved, setSaved] = useState(false)

  function handleStartEdit() {
    setContactPerson(franchise.contactPerson)
    setContactPhone(franchise.contactPhone)
    setEmail(franchise.email ?? '')
    setProvince(franchise.province)
    setCity(franchise.city)
    setBarangay(franchise.barangay)
    setAddressDetail(franchise.addressDetail)
    setBusinessRegistrationNo(franchise.businessRegistrationNo ?? '')
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
      <p className="mb-3 text-xs text-slate-500">Your own business details — required for franchise documentation.</p>

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
              <label className="mb-1 block text-[11px] font-medium text-slate-500">Territory province</label>
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
            <span className="font-medium text-slate-700">{franchise.contactPerson}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Contact number</span>
            <span className="font-medium text-slate-700">{franchise.contactPhone}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Email</span>
            <span className="font-medium text-slate-700">{franchise.email ?? 'Not set'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Address</span>
            <span className="max-w-[220px] truncate text-right font-medium text-slate-700">
              {[franchise.addressDetail, franchise.barangay, franchise.city, franchise.province].filter(Boolean).join(', ')}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Business Reg. No.</span>
            <span className="font-medium text-slate-700">{franchise.businessRegistrationNo ?? 'Not set'}</span>
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
        Every driver registered under a TODA anywhere in your territory. Read-only — each driver's own TODA admin
        handles access/hold/terminate.
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
