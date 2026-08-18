import { useEffect, useState } from 'react'
import { OtpVerify } from './OtpVerify'
import { matchesNameQuery } from '../lib/fuzzyName'

interface LoginAccount {
  id: string
  name: string
  phone: string
  email: string | null
  pin: string | null
}

interface IdentifierLoginFormProps<T extends LoginAccount> {
  accounts: T[]
  onFound: (id: string) => void
  noAccountHint: string
  // Ids of the pre-seeded demo accounts (not real self-registered ones) —
  // when the typed identifier resolves to exactly one of these, its PIN is
  // auto-filled so testing doesn't require looking it up in mock/data.ts. A
  // real account (not in this set, even if it happens to be the only match)
  // never gets its PIN guessed or shown — the tester still has to type it.
  seedIds?: Set<string>
}

// Masks all but the last 4 digits of a phone number (keeping separators
// as-is) so an OTP-method login can show "we're texting this number"
// without fully revealing another account's number.
function maskPhone(phone: string): string {
  const totalDigits = (phone.match(/\d/g) ?? []).length
  let seen = 0
  return phone.replace(/\d/g, (digit) => {
    seen += 1
    return seen > totalDigits - 4 ? digit : '•'
  })
}

// Email and phone still need an exact match (a partial email or number
// isn't meaningfully "yours"), but the name is matched fuzzily — partial,
// prefix, or phonetically similar — since someone recovering access may not
// type their full name or may misspell it. Can return more than one
// candidate for an ambiguous name query; callers disambiguate either by a
// picker (OTP) or by the correct PIN (PIN) deciding which one is really theirs.
function findAccountMatches<T extends LoginAccount>(accounts: T[], identifier: string): T[] {
  const needle = identifier.trim()
  if (!needle) return []
  const needleLower = needle.toLowerCase()
  return accounts.filter(
    (a) =>
      (a.email && a.email.trim().toLowerCase() === needleLower) ||
      a.phone.trim() === needle ||
      matchesNameQuery(a.name, needle),
  )
}

// Replaces "pick your account from a dropdown of everyone" with a login that
// only ever shows your own identity, matched by name/email/phone — same
// account-privacy shape as the Driver app already had, now shared by
// Driver/Passenger/Parent. Two verification methods: PIN (instant, if the
// account has one) or OTP (texted to the matched account's phone).
export function IdentifierLoginForm<T extends LoginAccount>({
  accounts,
  onFound,
  noAccountHint,
  seedIds,
}: IdentifierLoginFormProps<T>) {
  const [identifier, setIdentifier] = useState('')
  const [method, setMethod] = useState<'pin' | 'otp'>('pin')
  const [pin, setPin] = useState('')
  const [pinAutoFilled, setPinAutoFilled] = useState(false)
  const [candidates, setCandidates] = useState<T[] | null>(null)
  const [resolvedAccount, setResolvedAccount] = useState<T | null>(null)
  const [otpVerified, setOtpVerified] = useState(false)
  const [error, setError] = useState('')

  // Auto-fills the PIN once the typed name/email/number resolves to exactly
  // one *demo* account (see seedIds's comment on IdentifierLoginFormProps) —
  // clears it again the moment that stops being true, so a demo PIN never
  // lingers in the field for a different (possibly real) match.
  useEffect(() => {
    if (method !== 'pin' || !seedIds) return
    const matches = findAccountMatches(accounts, identifier)
    const onlyMatch = matches.length === 1 ? matches[0] : null
    if (onlyMatch && seedIds.has(onlyMatch.id) && onlyMatch.pin) {
      setPin(onlyMatch.pin)
      setPinAutoFilled(true)
    } else if (pinAutoFilled) {
      setPin('')
      setPinAutoFilled(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identifier, method, accounts, seedIds])

  function handleIdentifierChange(value: string) {
    setIdentifier(value)
    setCandidates(null)
    setResolvedAccount(null)
    setOtpVerified(false)
    setError('')
  }

  function handleMethodChange(next: 'pin' | 'otp') {
    setMethod(next)
    setCandidates(null)
    setResolvedAccount(null)
    setOtpVerified(false)
    setPin('')
    setError('')
  }

  function handleFindForOtp() {
    const matches = findAccountMatches(accounts, identifier)
    if (matches.length === 0) {
      setError(noAccountHint)
      return
    }
    setError('')
    if (matches.length === 1) {
      setResolvedAccount(matches[0])
      setCandidates(null)
    } else {
      setCandidates(matches)
    }
  }

  function handlePickCandidate(account: T) {
    setResolvedAccount(account)
    setCandidates(null)
  }

  function handleLogin() {
    if (!identifier.trim()) {
      setError('Enter your name, email, or mobile number.')
      return
    }
    if (method === 'pin') {
      const matches = findAccountMatches(accounts, identifier)
      const match = matches.find((m) => m.pin && m.pin === pin.trim())
      if (!match) {
        setError('Incorrect name/email/mobile number or PIN.')
        return
      }
      setError('')
      onFound(match.id)
      return
    }
    if (!resolvedAccount) {
      setError('Find your account first.')
      return
    }
    if (!otpVerified) {
      setError('Verify the code sent to your number first.')
      return
    }
    setError('')
    onFound(resolvedAccount.id)
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Name, email, or mobile number</label>
        <input
          value={identifier}
          onChange={(e) => handleIdentifierChange(e.target.value)}
          placeholder="Juan Dela Cruz, juan@email.com, or 09XX-XXX-XXXX"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-[11px] text-slate-400">
          A partial or similar-sounding name works too — you don't need to type it exactly.
        </p>
      </div>

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => handleMethodChange('pin')}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
            method === 'pin' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'
          }`}
        >
          PIN
        </button>
        <button
          type="button"
          onClick={() => handleMethodChange('otp')}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
            method === 'otp' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'
          }`}
        >
          OTP
        </button>
      </div>

      {method === 'pin' ? (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            PIN{pinAutoFilled ? ' — auto-filled for this demo account' : ''}
          </label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value)
              setPinAutoFilled(false)
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-widest"
            placeholder="••••"
          />
        </div>
      ) : candidates ? (
        <div className="space-y-1.5">
          <p className="text-xs text-slate-500">Which one is you?</p>
          {candidates.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => handlePickCandidate(c)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              <span className="font-medium text-slate-700">{c.name}</span>{' '}
              <span className="text-xs text-slate-400">· {maskPhone(c.phone)}</span>
            </button>
          ))}
        </div>
      ) : !resolvedAccount ? (
        <button
          type="button"
          onClick={handleFindForOtp}
          className="w-full rounded-lg border border-brand-300 bg-brand-50 py-2 text-xs font-medium text-brand-700 hover:bg-brand-100"
        >
          Find my account
        </button>
      ) : (
        <div className="space-y-1.5">
          <p className="text-xs text-slate-500">
            Found <span className="font-medium text-slate-700">{resolvedAccount.name}</span> ·{' '}
            {maskPhone(resolvedAccount.phone)}
          </p>
          <OtpVerify phone={resolvedAccount.phone} verified={otpVerified} onVerifiedChange={setOtpVerified} />
        </div>
      )}

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
