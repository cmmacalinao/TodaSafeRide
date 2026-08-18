import { useState } from 'react'
import { sendRealOtp, verifyRealOtp } from '../lib/otpApi'

interface OtpVerifyProps {
  phone: string
  verified: boolean
  onVerifiedChange: (verified: boolean) => void
}

// Sends a real SMS via the local OTP server (see server/index.js) so you can
// verify login with the code texted to your actual phone. If that server
// isn't running, silently falls back to the old on-screen simulated code
// instead of showing a connection error — so the app stays testable either
// way, and starts sending real texts automatically once the server (with a
// Semaphore key) is up.
export function OtpVerify({ phone, verified, onVerifiedChange }: OtpVerifyProps) {
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [localCode, setLocalCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (verified) {
    return <p className="text-xs font-medium text-emerald-700">✓ Mobile number verified</p>
  }

  async function handleSend() {
    setBusy(true)
    setError('')
    const result = await sendRealOtp(phone)
    setBusy(false)
    if (result.unreachable) {
      setLocalCode(String(Math.floor(1000 + Math.random() * 9000)))
      setSent(true)
      setCode('')
      return
    }
    if (!result.ok) {
      setError(result.error ?? 'Failed to send code.')
      return
    }
    setLocalCode(null)
    setSent(true)
    setCode('')
  }

  async function handleVerify() {
    if (localCode !== null) {
      if (code.trim() !== localCode) {
        setError('Incorrect code.')
        return
      }
      onVerifiedChange(true)
      return
    }
    setBusy(true)
    setError('')
    const result = await verifyRealOtp(phone, code)
    setBusy(false)
    if (!result.ok) {
      setError(result.error ?? (result.unreachable ? 'Could not reach the OTP server.' : 'Incorrect code.'))
      return
    }
    onVerifiedChange(true)
  }

  if (!sent) {
    return (
      <div>
        <button
          type="button"
          disabled={!phone.trim() || busy}
          onClick={handleSend}
          className="w-full rounded-lg border border-brand-300 bg-brand-50 py-2 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Sending…' : '🔐 Send OTP'}
        </button>
        <p className="mt-1 text-[11px] text-slate-400">
          Texts a one-time code to {phone.trim() || 'this number'} for you to enter here.
        </p>
        {error && <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>}
      </div>
    )
  }

  return (
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
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
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
          disabled={busy || code.trim().length !== 4}
          className="flex-1 rounded-lg bg-brand-600 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Verifying…' : 'Verify'}
        </button>
        <button
          type="button"
          onClick={handleSend}
          disabled={busy}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Resend
        </button>
      </div>
      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
    </div>
  )
}
