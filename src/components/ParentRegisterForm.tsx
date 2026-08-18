import { useState } from 'react'
import { useRides } from '../context/RideContext'
import { MINOR_AGE_LIMIT } from '../mock/data'
import { DocumentUploadField } from './DocumentUploadField'
import { EMPTY_PH_ADDRESS, PhAddressFields, type PhAddressValue } from './PhAddressFields'
import { RegistrationOtpStep } from './RegistrationOtpStep'

export function ParentRegisterForm({ onRegistered }: { onRegistered: (parentId: string) => void }) {
  const { registerParentWithChild } = useRides()
  const [step, setStep] = useState<'otp' | 'profile'>('otp')
  const [parentName, setParentName] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [parentEmail, setParentEmail] = useState('')
  const [parentPin, setParentPin] = useState('')
  const [childName, setChildName] = useState('')
  const [childAge, setChildAge] = useState('')
  const [childPhone, setChildPhone] = useState('')
  const [address, setAddress] = useState<PhAddressValue>(EMPTY_PH_ADDRESS)
  const [relationship, setRelationship] = useState('Mother')
  const [proofDataUrl, setProofDataUrl] = useState<string | null>(null)
  const [consentGuardian, setConsentGuardian] = useState(false)
  const [consentSupervise, setConsentSupervise] = useState(false)
  const [consentResponsible, setConsentResponsible] = useState(false)
  const [error, setError] = useState('')

  function handleVerified(verifiedName: string, verifiedPhone: string) {
    setParentName(verifiedName)
    setParentPhone(verifiedPhone)
    setStep('profile')
  }

  function handleSubmit() {
    const ageNum = Number(childAge)
    if (!childName.trim() || !Number.isFinite(ageNum) || ageNum <= 0 || !childPhone.trim()) {
      setError("Fill in your child's name and age, and a number to reach your child.")
      return
    }
    if (!address.province || !address.city || !address.barangay || !address.addressDetail.trim()) {
      setError('Fill in your full household address (province/city/barangay/detail).')
      return
    }
    if (ageNum >= MINOR_AGE_LIMIT) {
      setError(
        `This child is ${MINOR_AGE_LIMIT} or older — they should register on their own as a Passenger instead of through a parent account.`,
      )
      return
    }
    if (!consentGuardian || !consentSupervise || !consentResponsible) {
      setError('All three consent checkboxes must be checked before your child can be registered.')
      return
    }
    if (parentPin.trim().length !== 4) {
      setError('Create a 4-digit PIN — you can use it to log in instead of OTP.')
      return
    }
    const result = registerParentWithChild({
      parentName,
      parentPhone,
      parentEmail: parentEmail.trim() || null,
      parentPin: parentPin.trim(),
      childName: childName.trim(),
      childAge: ageNum,
      childPhone: childPhone.trim(),
      relationship,
      province: address.province,
      city: address.city,
      barangay: address.barangay,
      addressDetail: address.addressDetail.trim(),
      proofOfAuthorityDataUrl: proofDataUrl,
    })
    if (!result) {
      setError('Registration failed. Please try again.')
      return
    }
    setError('')
    onRegistered(result.parentId)
  }

  if (step === 'otp') {
    return (
      <RegistrationOtpStep
        title="Register as a parent"
        description={`Since your child is under ${MINOR_AGE_LIMIT}, they register together with you — a child can't register on their own. If your child is ${MINOR_AGE_LIMIT} or older, they should use individual Passenger registration instead.`}
        nameLabel="Your full name"
        onVerified={handleVerified}
      />
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">
          {parentName} · {parentPhone} · <span className="font-medium text-emerald-600">✓ verified</span>
        </span>
        <button
          type="button"
          onClick={() => setStep('otp')}
          className="font-medium text-brand-600 hover:text-brand-700"
        >
          Change
        </button>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Relationship to child</label>
        <select
          value={relationship}
          onChange={(e) => setRelationship(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option>Mother</option>
          <option>Father</option>
          <option>Guardian</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Your email (optional)</label>
        <input
          type="email"
          value={parentEmail}
          onChange={(e) => setParentEmail(e.target.value)}
          placeholder="you@email.com"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-[11px] text-slate-400">
          Optional — lets you log in with your email instead of just your name or number.
        </p>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Create a 4-digit PIN</label>
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={parentPin}
          onChange={(e) => setParentPin(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-widest"
          placeholder="••••"
        />
        <p className="mt-1 text-[11px] text-slate-400">Use this to log in instead of OTP next time.</p>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Child's full name</label>
        <input
          value={childName}
          onChange={(e) => setChildName(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Child's age</label>
        <input
          type="number"
          min={1}
          value={childAge}
          onChange={(e) => setChildAge(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">
          Child's mobile number (or a number they can be reached at)
        </label>
        <input
          type="tel"
          value={childPhone}
          onChange={(e) => setChildPhone(e.target.value)}
          placeholder="09XX-XXX-XXXX"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-[11px] text-slate-400">So the driver and you can call your child directly.</p>
      </div>

      <PhAddressFields
        value={address}
        onChange={setAddress}
        addressDetailLabel="Detailed home address (zone, street, house no., notes)"
        addressDetailPlaceholder="e.g. Purok 3, near the barangay hall"
      />

      <DocumentUploadField
        label="Proof of parental authority (birth certificate / guardianship document) — optional"
        dataUrl={proofDataUrl}
        onUpload={setProofDataUrl}
      />

      <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-xs font-semibold text-slate-600">Parental consent &amp; certification (required)</p>
        <label className="flex items-start gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={consentGuardian}
            onChange={(e) => setConsentGuardian(e.target.checked)}
            className="mt-0.5"
          />
          I certify, under penalty of removal from TodaRide, that I am this child's parent or legal guardian
          and give explicit consent for them to use TodaRide.
        </label>
        <label className="flex items-start gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={consentSupervise}
            onChange={(e) => setConsentSupervise(e.target.checked)}
            className="mt-0.5"
          />
          I will supervise my child's use of the service.
        </label>
        <label className="flex items-start gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={consentResponsible}
            onChange={(e) => setConsentResponsible(e.target.checked)}
            className="mt-0.5"
          />
          I accept responsibility for my child's actions while using TodaRide.
        </label>
      </div>

      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
      <button
        onClick={handleSubmit}
        className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Register parent + child
      </button>
    </div>
  )
}
