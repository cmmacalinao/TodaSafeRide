import { useState } from 'react'
import { sendRealOtp, verifyRealOtp } from '../lib/otpApi'

interface RegistrationOtpStepProps {
  title: string
  description?: string
  nameLabel?: string
  onVerified: (name: string, phone: string) => void
}

// First step of every registration flow (Passenger, Parent, Driver): collect
// just a name and phone number, text a real OTP via the local server (see
// server/index.js), and require it to be typed back correctly before moving
// on to the rest of the profile. If that server isn't running, silently
// falls back to the old on-screen simulated code instead of showing a
// connection error — see OtpVerify.tsx for the same pattern on the login side.
export function RegistrationOtpStep({ title, description, nameLabel = 'Full name', onVerified }: RegistrationOtpStepProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [sent, setSent] = useState(false)
  const [localCode, setLocalCode] = useState<string | null>(null)
  const [inputCode, setInputCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function handlePhoneChange(value: string) {
    setPhone(value)
    setSent(false)
    setLocalCode(null)
    setInputCode('')
  }

  async function handleSendOtp() {
    if (!name.trim() || !phone.trim()) {
      setError('Enter your name and mobile number first.')
      return
    }
    setBusy(true)
    setError('')
    const result = await sendRealOtp(phone)
    setBusy(false)
    if (result.unreachable) {
      setLocalCode(String(Math.floor(1000 + Math.random() * 9000)))
      setSent(true)
      setInputCode('')
      return
    }
    if (!result.ok) {
      setError(result.error ?? 'Failed to send code.')
      return
    }
    setLocalCode(null)
    setSent(true)
    setInputCode('')
  }

  async function handleVerify() {
    if (localCode !== null) {
      if (inputCode.trim() !== localCode) {
        setError('Incorrect code — check the number above and try again.')
        return
      }
      onVerified(name.trim(), phone.trim())
      return
    }
    setBusy(true)
    setError('')
    const result = await verifyRealOtp(phone, inputCode)
    setBusy(false)
    if (!result.ok) {
      setError(result.error ?? (result.unreachable ? 'Could not reach the OTP server.' : 'Incorrect code — check the number above and try again.'))
      return
    }
    onVerified(name.trim(), phone.trim())
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
      <div>
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">{nameLabel}</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={sent}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Mobile number</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => handlePhoneChange(e.target.value)}
          disabled={sent}
          placeholder="09XX-XXX-XXXX"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400"
        />
      </div>

      {!sent ? (
        <button
          type="button"
          onClick={handleSendOtp}
          disabled={busy}
          className="w-full rounded-lg border border-brand-300 bg-brand-50 py-2 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Sending…' : '🔐 Send OTP'}
        </button>
      ) : (
        <div className="space-y-2">
          {localCode !== null ? (
            <p className="rounded-lg bg-emerald-50 p-2 text-xs text-emerald-700">
              📱 Simulated SMS sent to {phone} — prototype shortcut: your code is{' '}
              <span className="font-mono font-semibold">{localCode}</span>
            </p>
          ) : (
            <p className="rounded-lg bg-emerald-50 p-2 text-xs text-emerald-700">📱 Code sent to {phone} — check your phone.</p>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Enter the 4-digit code</label>
            <input
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              inputMode="numeric"
              maxLength={4}
              placeholder="••••"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-widest"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleVerify}
              disabled={busy || inputCode.trim().length !== 4}
              className="flex-1 rounded-lg bg-brand-600 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Verifying…' : 'Verify & continue'}
            </button>
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={busy}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Resend
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
    </div>
  )
}
