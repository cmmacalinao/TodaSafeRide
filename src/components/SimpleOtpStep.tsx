import { useState } from 'react'

interface SimpleOtpStepProps {
  // Where the (simulated) code was "sent" — shown in the confirmation
  // message only, e.g. an email address or username.
  destination: string
  onVerified: () => void
  onCancel?: () => void
}

// A lighter sibling of OtpVerify/RegistrationOtpStep for logins that have no
// phone number to text a real code to (Admin username/password, Accounting
// officer email) — same "prototype shortcut: your code is shown right here"
// simulated pattern those already fall back to when the real SMS server is
// unreachable, just without ever attempting the real send.
export function SimpleOtpStep({ destination, onVerified, onCancel }: SimpleOtpStepProps) {
  const [sent, setSent] = useState(false)
  const [localCode, setLocalCode] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  function handleSend() {
    setLocalCode(String(Math.floor(1000 + Math.random() * 9000)))
    setSent(true)
    setCode('')
    setError('')
  }

  function handleVerify() {
    if (code.trim() !== localCode) {
      setError('Incorrect code.')
      return
    }
    onVerified()
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
      <p className="text-xs font-medium text-slate-600">One-time code verification</p>
      {!sent ? (
        <div>
          <button
            type="button"
            onClick={handleSend}
            className="w-full rounded-lg border border-brand-300 bg-brand-50 py-2 text-xs font-medium text-brand-700 hover:bg-brand-100"
          >
            🔐 Send OTP
          </button>
          <p className="mt-1 text-[11px] text-slate-400">Sends a one-time code to {destination} to enter here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="rounded-lg bg-emerald-50 p-2 text-xs text-emerald-700">
            📧 Simulated code sent to {destination} — prototype shortcut: your code is{' '}
            <span className="font-mono font-semibold">{localCode}</span>
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            maxLength={4}
            placeholder="••••"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-widest"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleVerify}
              disabled={code.trim().length !== 4}
              className="flex-1 rounded-lg bg-brand-600 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Verify & continue
            </button>
            <button
              type="button"
              onClick={handleSend}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Resend
            </button>
          </div>
          {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
        </div>
      )}
      {onCancel && (
        <button type="button" onClick={onCancel} className="text-[11px] font-medium text-slate-500 underline">
          ← Back
        </button>
      )}
    </div>
  )
}
