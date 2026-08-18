import { useState } from 'react'
import { useRides } from '../context/RideContext'
import { MINOR_AGE_LIMIT } from '../mock/data'
import { EMPTY_PH_ADDRESS, PhAddressFields, type PhAddressValue } from './PhAddressFields'
import { RegistrationOtpStep } from './RegistrationOtpStep'

export function PassengerRegisterForm({ onRegistered }: { onRegistered: (passengerId: string) => void }) {
  const { registerPassenger } = useRides()
  const [step, setStep] = useState<'otp' | 'profile'>('otp')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [age, setAge] = useState('')
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [address, setAddress] = useState<PhAddressValue>(EMPTY_PH_ADDRESS)
  const [guardianPhone, setGuardianPhone] = useState('')
  const [error, setError] = useState('')

  function handleVerified(verifiedName: string, verifiedPhone: string) {
    setName(verifiedName)
    setPhone(verifiedPhone)
    setStep('profile')
  }

  function handleSubmit() {
    const ageNum = Number(age)
    if (!Number.isFinite(ageNum) || ageNum <= 0) {
      setError('Enter your age.')
      return
    }
    if (ageNum < MINOR_AGE_LIMIT) {
      setError(
        `Passengers under ${MINOR_AGE_LIMIT} can't register on their own — a parent/guardian needs to register them together on the Parent tab.`,
      )
      return
    }
    if (!address.province || !address.city || !address.barangay || !address.addressDetail.trim()) {
      setError('Fill in your full address (province/city/barangay/detail).')
      return
    }
    if (pin.trim().length !== 4) {
      setError('Create a 4-digit PIN — you can use it to log in instead of OTP.')
      return
    }
    const id = registerPassenger({
      name,
      age: ageNum,
      phone,
      email: email.trim() || null,
      pin: pin.trim(),
      province: address.province,
      city: address.city,
      barangay: address.barangay,
      addressDetail: address.addressDetail.trim(),
      guardianPhone: guardianPhone.trim() || null,
    })
    if (!id) {
      setError('Registration failed. Please try again.')
      return
    }
    setError('')
    onRegistered(id)
  }

  if (step === 'otp') {
    return (
      <RegistrationOtpStep
        title="Register as a passenger"
        description={`Registering for yourself, as an adult passenger. Registering a child under ${MINOR_AGE_LIMIT}? Use the Parent tab instead.`}
        onVerified={handleVerified}
      />
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
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
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Age</label>
        <input
          type="number"
          min={1}
          value={age}
          onChange={(e) => setAge(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <PhAddressFields value={address} onChange={setAddress} />

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
        <p className="mt-1 text-[11px] text-slate-400">Use this to log in instead of OTP next time.</p>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">
          Emergency contact / guardian mobile number (optional)
        </label>
        <input
          type="tel"
          value={guardianPhone}
          onChange={(e) => setGuardianPhone(e.target.value)}
          placeholder="09XX-XXX-XXXX"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-[11px] text-slate-400">
          You don't have a linked parent account, so if you ever trigger SOS, we'll notify this number instead.
        </p>
      </div>
      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
      <button
        onClick={handleSubmit}
        className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Register
      </button>
    </div>
  )
}
