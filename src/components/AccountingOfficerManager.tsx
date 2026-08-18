import { useState } from 'react'
import { useRides } from '../context/RideContext'
import type { AccountingOfficerPosition } from '../types'

const POSITIONS: AccountingOfficerPosition[] = ['President', 'Treasurer', 'Other']

// Managed here (main Admin dashboard) rather than inside the restricted
// Accounting & Compliance page itself — that page's lock screen now only
// accepts a registered officer's email, so the roster has to be editable by
// someone who doesn't need to already be on it.
export function AccountingOfficerManager() {
  const { accountingOfficers, addAccountingOfficer, removeAccountingOfficer, updateAccountingOfficer } = useRides()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [position, setPosition] = useState<AccountingOfficerPosition>('President')
  const [otherLabel, setOtherLabel] = useState('')
  const [error, setError] = useState('')

  function resetForm() {
    setEditingId(null)
    setName('')
    setEmail('')
    setOtherLabel('')
    setPosition('President')
    setError('')
  }

  function handleStartEdit(officerId: string) {
    const officer = accountingOfficers.find((o) => o.id === officerId)
    if (!officer) return
    setEditingId(officer.id)
    setName(officer.name)
    setEmail(officer.email)
    setPosition(officer.position)
    setOtherLabel(officer.otherPositionLabel ?? '')
    setError('')
  }

  function handleSave() {
    if (!name.trim() || !email.trim()) {
      setError('Enter both the name and email of the officer.')
      return
    }
    if (position === 'Other' && !otherLabel.trim()) {
      setError('Enter a title for this officer position.')
      return
    }
    const emailTaken = accountingOfficers.some(
      (o) => o.id !== editingId && o.email.toLowerCase() === email.trim().toLowerCase(),
    )
    if (emailTaken) {
      setError('An officer with that email is already registered.')
      return
    }
    const args = {
      name: name.trim(),
      email: email.trim(),
      position,
      otherPositionLabel: position === 'Other' ? otherLabel.trim() : null,
    }
    if (editingId) {
      updateAccountingOfficer(editingId, args)
    } else {
      addAccountingOfficer(args)
    }
    resetForm()
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-slate-700">Accounting &amp; Compliance officers</h2>
      <p className="mb-3 text-xs text-slate-500">
        Only these registered officers can log in to the Accounting &amp; Compliance ("Super Admin") page — their
        email is checked against this list at the lock screen, on top of the shared access password.
      </p>

      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        {editingId && <p className="text-xs font-medium text-brand-700">Editing officer</p>}
        <div className="grid grid-cols-2 gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Officer's name"
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Officer's email"
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value as AccountingOfficerPosition)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {position === 'Other' ? (
            <input
              value={otherLabel}
              onChange={(e) => setOtherLabel(e.target.value)}
              placeholder="e.g. Auditor"
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          ) : (
            <div />
          )}
        </div>
        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 rounded-lg bg-brand-600 py-2 text-xs font-semibold text-white hover:bg-brand-700"
          >
            {editingId ? 'Save changes' : 'Add officer'}
          </button>
          {editingId && (
            <button
              onClick={resetForm}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {accountingOfficers.length === 0 && (
          <p className="text-xs text-slate-400">No officers registered yet — nobody can unlock the page.</p>
        )}
        {accountingOfficers.map((o) => (
          <div
            key={o.id}
            className="flex items-center justify-between rounded-lg border border-slate-200 p-2 text-xs"
          >
            <div>
              <p className="font-medium text-slate-700">{o.name}</p>
              <p className="text-slate-400">
                {o.email} · {o.position === 'Other' ? o.otherPositionLabel || 'Other' : o.position}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                onClick={() => handleStartEdit(o.id)}
                className="rounded-md px-2 py-1 font-medium text-brand-600 underline hover:bg-brand-50"
              >
                Edit
              </button>
              <button
                onClick={() => removeAccountingOfficer(o.id)}
                className="rounded-md px-2 py-1 font-medium text-rose-600 underline hover:bg-rose-50"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
