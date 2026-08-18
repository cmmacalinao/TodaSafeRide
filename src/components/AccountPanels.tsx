import { useState, type ReactNode } from 'react'
import type { VerificationStatus } from '../types'

export type AccountPanelKind = 'profile' | 'settings' | 'help' | 'privacy' | 'safety'

export interface ProfileSaveValues {
  name: string
  phone: string
  email: string | null
  paymentDetail: string | null
  emergencyContact: string | null
  // Blank/undefined means "leave unchanged" — a credential reset is opt-in
  // per save, not a value that's ever pre-filled back into the form.
  newPin?: string
  newPassword?: string
}

// Minimal, genuinely-real stand-ins for the five menu destinations the app
// has no dedicated page for yet (My Profile, Settings, Help & Support,
// Privacy & Safety, and a no-active-ride Safety/SOS explainer). My Profile
// is the one actually-editable panel — everything else stays read-only.
// Deliberately a single overlay component (not five separate pages/routes)
// so the hamburger menu doesn't have to fight NavBar's existing
// role-confined routing in App.tsx — opening/closing a panel never touches
// the URL.
export type AccountRole = 'passenger' | 'parent' | 'driver' | 'pharmacy' | 'toda_admin' | 'admin' | 'operator_admin' | 'franchise_admin'

const ROLE_LABELS: Record<AccountRole, string> = {
  passenger: 'Passenger',
  parent: 'Parent',
  driver: 'Driver',
  pharmacy: 'Pharmacy',
  toda_admin: 'TODA Admin',
  admin: 'Admin',
  operator_admin: 'Operator',
  franchise_admin: 'Franchise',
}

export interface AccountPanelInfo {
  id: string
  role: AccountRole
  name: string
  phone: string
  email: string | null
  province: string
  city: string
  barangay: string
  paymentDetail: string | null
  emergencyContact: string | null
  // Driver-only — undefined otherwise.
  rating?: number
  ratingCount?: number
  verificationStatus?: VerificationStatus
  plateNumber?: string
  hasActiveRide: boolean
}

function Shell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/60 sm:items-center sm:p-6" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
    </label>
  )
}

// The one editable panel — starts in a presentable read-only view (bigger
// avatar/header, grouped info), switches to a form on "Edit Profile".
// Credentials (PIN/password) are edited via separate "leave blank to keep
// current" fields rather than ever displaying the existing secret back.
function ProfilePanel({
  info,
  onClose,
  onSave,
}: {
  info: AccountPanelInfo
  onClose: () => void
  onSave: (values: ProfileSaveValues) => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(info.name)
  const [phone, setPhone] = useState(info.phone)
  const [email, setEmail] = useState(info.email ?? '')
  const [paymentDetail, setPaymentDetail] = useState(info.paymentDetail ?? '')
  const [emergencyContact, setEmergencyContact] = useState(info.emergencyContact ?? '')
  const [newPin, setNewPin] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [saved, setSaved] = useState(false)

  function handleSave() {
    onSave({
      name: name.trim() || info.name,
      phone: phone.trim(),
      email: email.trim() || null,
      paymentDetail: paymentDetail.trim() || null,
      emergencyContact: emergencyContact.trim() || null,
      newPin: newPin.trim() || undefined,
      newPassword: newPassword.trim() || undefined,
    })
    setNewPin('')
    setNewPassword('')
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function handleCancel() {
    setName(info.name)
    setPhone(info.phone)
    setEmail(info.email ?? '')
    setPaymentDetail(info.paymentDetail ?? '')
    setEmergencyContact(info.emergencyContact ?? '')
    setNewPin('')
    setNewPassword('')
    setEditing(false)
  }

  return (
    <Shell title="My Profile" onClose={onClose}>
      <div className="space-y-4">
        <div className="-mx-5 -mt-5 rounded-t-2xl bg-gradient-to-br from-brand-600 to-brand-700 px-5 pb-5 pt-6 text-white sm:-mx-5 sm:-mt-5 sm:rounded-t-2xl">
          <div className="flex items-center gap-3">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/20 text-xl font-semibold">
              {info.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">{info.name}</p>
              <p className="text-xs text-brand-100">{ROLE_LABELS[info.role]}</p>
              {info.role === 'driver' && info.verificationStatus === 'approved' && (
                <p className="text-xs font-medium text-emerald-200">✓ Verified Driver</p>
              )}
              {info.role === 'driver' && info.rating !== undefined && (
                <p className="text-xs text-brand-100">
                  {info.rating > 0 ? `${info.rating.toFixed(1)} ★ (${info.ratingCount ?? 0} ratings)` : 'No ratings yet'}
                </p>
              )}
            </div>
          </div>
        </div>

        {saved && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
            ✓ Profile updated.
          </p>
        )}

        {!editing ? (
          <>
            <div className="rounded-lg border border-slate-100 px-3">
              <Row label="Phone" value={info.phone} />
              <Row label="Email" value={info.email ?? 'Not set'} />
              <Row label="Payment detail" value={info.paymentDetail ?? 'Not set'} />
              <Row label="Emergency contact" value={info.emergencyContact ?? 'Not set'} />
              <Row label="Address" value={`${info.barangay ? `${info.barangay}, ` : ''}${info.city}, ${info.province}`} />
              {info.role === 'driver' && <Row label="Plate number" value={info.plateNumber ?? '—'} />}
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              ✎ Edit Profile
            </button>
            <p className="text-[11px] text-slate-400">
              Address and plate number aren't editable here yet — contact support to update those.
            </p>
          </>
        ) : (
          <>
            <div className="space-y-3">
              <Field label="Name" value={name} onChange={setName} placeholder="Full name" />
              <Field label="Email" value={email} onChange={setEmail} placeholder="you@email.com" type="email" />
              <Field label="Phone Number" value={phone} onChange={setPhone} placeholder="09XX-XXX-XXXX" />
              <Field
                label="Payment Detail"
                value={paymentDetail}
                onChange={setPaymentDetail}
                placeholder="e.g. GCash 0917-XXX-XXXX"
              />
              <Field
                label="Emergency Contact"
                value={emergencyContact}
                onChange={setEmergencyContact}
                placeholder="Name and/or phone number"
              />
            </div>
            <div className="space-y-3 rounded-lg border border-slate-100 p-3">
              <p className="text-xs font-semibold text-slate-600">Credentials</p>
              <Field label="Reset Password" value={newPassword} onChange={setNewPassword} placeholder="Leave blank to keep current" type="password" />
              <Field label="Reset PIN" value={newPin} onChange={setNewPin} placeholder="Leave blank to keep current" type="password" />
              <p className="text-[11px] text-slate-400">
                {info.role === 'driver' || info.role === 'pharmacy' || info.role === 'toda_admin'
                  ? 'Your PIN is what you actually log in with.'
                  : 'Your PIN (if set) is what you actually log in with — password isn’t used for sign-in yet in this prototype.'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Save changes
              </button>
            </div>
          </>
        )}
      </div>
    </Shell>
  )
}

// TodaOrganization (and App Admin) don't map to a single editable
// name/phone/email the way an individual account does — a TODA org's real
// contact info lives in its officers list, and it has no phone/email field
// at all (see types/index.ts). Rather than inventing fields just so the
// generic edit form has something to bind to, org-level accounts get a
// read-only summary here instead.
function OrgProfilePanel({ info, onClose }: { info: AccountPanelInfo; onClose: () => void }) {
  return (
    <Shell title="My Profile" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700">
            {info.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-800">{info.name}</p>
            <p className="text-xs text-slate-500">{ROLE_LABELS[info.role]}</p>
          </div>
        </div>
        <div className="rounded-lg border border-slate-100 px-3">
          <Row label="Address" value={`${info.barangay ? `${info.barangay}, ` : ''}${info.city}, ${info.province}`} />
        </div>
        <p className="text-[11px] text-slate-400">
          Organization-level accounts aren't editable from here yet — contact support to update your org's details
          or admin PIN.
        </p>
      </div>
    </Shell>
  )
}

export function AccountPanels({
  panel,
  onClose,
  info,
  onSaveProfile,
}: {
  panel: AccountPanelKind | null
  onClose: () => void
  info: AccountPanelInfo
  onSaveProfile: (values: ProfileSaveValues) => void
}) {
  if (!panel) return null

  if (panel === 'profile') {
    if (info.role === 'toda_admin' || info.role === 'admin' || info.role === 'operator_admin' || info.role === 'franchise_admin')
      return <OrgProfilePanel info={info} onClose={onClose} />
    return <ProfilePanel info={info} onClose={onClose} onSave={onSaveProfile} />
  }

  if (panel === 'settings') {
    return (
      <Shell title="Settings" onClose={onClose}>
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-100 px-3">
            <Row label="Name" value={info.name} />
            <Row label="Phone" value={info.phone} />
            <Row label="Email" value={info.email ?? 'Not set'} />
            <Row label="Payment detail" value={info.paymentDetail ?? 'Not set'} />
            <Row label="Home address" value={`${info.city}, ${info.province}`} />
          </div>
          <p className="text-[11px] text-slate-400">
            Name, email, phone, and payment detail are editable from My Profile. Other preferences (notifications,
            language) aren't wired up yet in this prototype.
          </p>
        </div>
      </Shell>
    )
  }

  if (panel === 'help') {
    return (
      <Shell title="Help & Support" onClose={onClose}>
        <div className="space-y-3 text-sm">
          <div className="space-y-2">
            <p className="font-medium text-slate-700">Frequently asked</p>
            <details className="rounded-lg border border-slate-100 p-2.5 text-xs">
              <summary className="cursor-pointer font-medium text-slate-600">How do I pay for a ride?</summary>
              <p className="mt-1 text-slate-500">Cash, GCash, Maya, or Card — pick a payment method when you book.</p>
            </details>
            <details className="rounded-lg border border-slate-100 p-2.5 text-xs">
              <summary className="cursor-pointer font-medium text-slate-600">My driver hasn't arrived — what do I do?</summary>
              <p className="mt-1 text-slate-500">
                Open your current ride's tracking screen — you can message or call your driver, or use SOS if it's
                an emergency.
              </p>
            </details>
            <details className="rounded-lg border border-slate-100 p-2.5 text-xs">
              <summary className="cursor-pointer font-medium text-slate-600">How do I cancel a booking?</summary>
              <p className="mt-1 text-slate-500">While a ride is pending or in progress, a Cancel button is available on its tracking screen.</p>
            </details>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            Still need help? Contact TODA SafeRide support at{' '}
            <span className="font-medium text-slate-700">support@todasaferide.ph</span>.
          </div>
        </div>
      </Shell>
    )
  }

  if (panel === 'privacy') {
    return (
      <Shell title="Privacy & Safety" onClose={onClose}>
        <div className="space-y-2.5 text-xs text-slate-600">
          <p>
            TODA SafeRide collects your GPS location, trip history, and contact info only to arrange and track your
            rides — your exact live location is shared with a driver only while a trip is active, and only if you
            choose to share it.
          </p>
          <p>Drivers on this platform are verified by their TODA organization before they can accept rides.</p>
          <p>
            You can trigger SOS at any time during an active trip — it alerts your registered emergency contact and
            flags the trip for review.
          </p>
          <p className="rounded-lg bg-amber-50 p-2.5 text-amber-800">
            In a life-threatening emergency, always call 911 (or your local emergency line) first — SOS in this app
            is a safety record and alert, not a replacement for emergency services.
          </p>
        </div>
      </Shell>
    )
  }

  // 'safety' — reached from the menu's Emergency/SOS item when there's no
  // active ride to attach a real SOS trigger to (TripMonitor already owns
  // that — see its own SOS button). Reusing that implementation rather than
  // duplicating an SOS system with nothing behind it.
  return (
    <Shell title="Emergency / Safety" onClose={onClose}>
      <div className="space-y-2.5 text-sm">
        {info.hasActiveRide ? (
          <p className="text-slate-600">
            You have a trip in progress — open it to use the SOS button on your tracking screen.
          </p>
        ) : (
          <p className="text-slate-600">SOS is available on your tracking screen once a ride is in progress.</p>
        )}
        <div className="rounded-lg border border-slate-100 px-3">
          <Row label="Emergency contact on file" value={info.emergencyContact ?? 'Not set'} />
        </div>
        <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
          In a life-threatening emergency right now, call 911 (or your local emergency line) first.
        </p>
      </div>
    </Shell>
  )
}
