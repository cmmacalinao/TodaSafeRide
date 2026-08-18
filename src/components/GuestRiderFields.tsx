import { useState } from 'react'

// "Book for others" — lets whoever's booking (a passenger or a parent) put
// the ride under a different name/phone than their own account, e.g. a
// relative or neighbor without the app. No account is created for that
// person; the ride just carries their name/phone directly (see
// makeGuestPassengerId) so the driver can identify and call them.
export interface GuestRiderState {
  bookingFor: 'self' | 'other'
  setBookingFor: (v: 'self' | 'other') => void
  otherName: string
  setOtherName: (v: string) => void
  otherPhone: string
  setOtherPhone: (v: string) => void
  reset: () => void
}

export function useGuestRider(): GuestRiderState {
  const [bookingFor, setBookingFor] = useState<'self' | 'other'>('self')
  const [otherName, setOtherName] = useState('')
  const [otherPhone, setOtherPhone] = useState('')
  function reset() {
    setBookingFor('self')
    setOtherName('')
    setOtherPhone('')
  }
  return { bookingFor, setBookingFor, otherName, setOtherName, otherPhone, setOtherPhone, reset }
}

// Generated fresh per booking, not tied to any real account — a guest ride
// never resolves in the Admin passenger directory or anywhere account
// lookups happen, same as any real ride-hailing app's "book for someone
// else" doesn't create an account for that person either.
export function makeGuestPassengerId(): string {
  return `guest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export function GuestRiderFields({
  state,
  selfLabel,
}: {
  state: GuestRiderState
  selfLabel: string
}) {
  return (
    <div className="space-y-2">
      <div>
        <span className="mb-1 block text-xs font-medium text-slate-500">Who is this for?</span>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => state.setBookingFor('self')}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
              state.bookingFor === 'self' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'
            }`}
          >
            {selfLabel}
          </button>
          <button
            type="button"
            onClick={() => state.setBookingFor('other')}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
              state.bookingFor === 'other' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'
            }`}
          >
            Someone else
          </button>
        </div>
      </div>
      {state.bookingFor === 'other' && (
        <div className="grid grid-cols-2 gap-2">
          <input
            value={state.otherName}
            onChange={(e) => state.setOtherName(e.target.value)}
            placeholder="Their name"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={state.otherPhone}
            onChange={(e) => state.setOtherPhone(e.target.value)}
            placeholder="Their mobile number"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      )}
    </div>
  )
}
