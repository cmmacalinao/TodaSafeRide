import { useState } from 'react'
import { useRides } from '../context/RideContext'
import { PhAddressFields, type PhAddressValue } from './PhAddressFields'
import type { AdvertiserPlan, AdvertiserStatus } from '../types'

const PLAN_OPTIONS: AdvertiserPlan[] = ['basic', 'standard', 'premium', 'custom']
const STATUS_OPTIONS: AdvertiserStatus[] = ['pending', 'active', 'paused', 'expired']

const STATUS_BADGE_CLASSES: Record<AdvertiserStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  paused: 'bg-slate-100 text-slate-600',
  expired: 'bg-rose-100 text-rose-700',
}

const emptyAddress: PhAddressValue = { province: '', city: '', barangay: '', addressDetail: '' }

export function IncomePromotionAdvertisers() {
  const { advertisers, campaigns, addAdvertiser, updateAdvertiser, removeAdvertiser, logActivity } = useRides()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [businessName, setBusinessName] = useState('')
  const [category, setCategory] = useState('')
  const [address, setAddress] = useState<PhAddressValue>(emptyAddress)
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [plan, setPlan] = useState<AdvertiserPlan>('basic')
  const [monthlyValue, setMonthlyValue] = useState('')
  const [status, setStatus] = useState<AdvertiserStatus>('pending')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  function resetForm() {
    setEditingId(null)
    setBusinessName('')
    setCategory('')
    setAddress(emptyAddress)
    setContactName('')
    setContactPhone('')
    setContactEmail('')
    setPlan('basic')
    setMonthlyValue('')
    setStatus('pending')
    setNotes('')
    setError('')
  }

  function handleStartEdit(id: string) {
    const a = advertisers.find((x) => x.id === id)
    if (!a) return
    setEditingId(a.id)
    setBusinessName(a.businessName)
    setCategory(a.category)
    setAddress({ province: a.province, city: a.city, barangay: a.barangay, addressDetail: a.addressDetail })
    setContactName(a.contactName)
    setContactPhone(a.contactPhone)
    setContactEmail(a.contactEmail ?? '')
    setPlan(a.plan)
    setMonthlyValue(String(a.monthlyValue))
    setStatus(a.status)
    setNotes(a.notes ?? '')
    setError('')
  }

  function handleSave() {
    const value = Number(monthlyValue)
    if (!businessName.trim()) {
      setError('Enter the business name.')
      return
    }
    if (!category.trim()) {
      setError('Enter a category.')
      return
    }
    if (!address.province || !address.city || !address.barangay) {
      setError('Complete the location (province/city/barangay).')
      return
    }
    if (!contactName.trim() || !contactPhone.trim()) {
      setError('Enter a contact name and phone.')
      return
    }
    if (!Number.isFinite(value) || value < 0) {
      setError('Enter a valid monthly value of 0 or more.')
      return
    }
    setError('')
    const args = {
      businessName: businessName.trim(),
      category: category.trim(),
      province: address.province,
      city: address.city,
      barangay: address.barangay,
      addressDetail: address.addressDetail.trim(),
      contactName: contactName.trim(),
      contactPhone: contactPhone.trim(),
      contactEmail: contactEmail.trim() || null,
      plan,
      monthlyValue: value,
      status,
      notes: notes.trim() || null,
    }
    if (editingId) {
      updateAdvertiser(editingId, args)
      logActivity({ actorRole: 'admin', actorName: 'Admin', todaOrgId: null, action: 'IP · Updated advertiser', summary: `${args.businessName} — ${args.plan}, ₱${value.toLocaleString()}/mo, ${args.status}.` })
    } else {
      addAdvertiser(args)
      logActivity({ actorRole: 'admin', actorName: 'Admin', todaOrgId: null, action: 'IP · Added advertiser', summary: `${args.businessName} — ${args.plan}, ₱${value.toLocaleString()}/mo, ${args.status}.` })
    }
    resetForm()
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-slate-700">{editingId ? 'Edit advertiser' : 'Add advertiser'}</h3>
        <div className="space-y-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
          <div className="grid grid-cols-2 gap-2">
            <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Business name" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category (e.g. Food, Retail)" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          </div>
          <PhAddressFields value={address} onChange={setAddress} addressDetailLabel="Business address detail" addressDetailPlaceholder="e.g. Unit 2, Public Market" />
          <div className="grid grid-cols-2 gap-2">
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Contact name" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Contact phone" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          </div>
          <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Contact email (optional)" className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          <div className="grid grid-cols-3 gap-2">
            <select value={plan} onChange={(e) => setPlan(e.target.value as AdvertiserPlan)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs">
              {PLAN_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <input type="number" min={0} value={monthlyValue} onChange={(e) => setMonthlyValue(e.target.value)} placeholder="₱/month" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            <select value={status} onChange={(e) => setStatus(e.target.value as AdvertiserStatus)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs">
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleSave} className="flex-1 rounded-lg bg-brand-600 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
              {editingId ? 'Save changes' : 'Add advertiser'}
            </button>
            {editingId && (
              <button onClick={resetForm} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Advertisers ({advertisers.length})</h3>
        {advertisers.length === 0 && <p className="text-xs text-slate-400">No advertisers yet.</p>}
        <div className="space-y-2">
          {advertisers.map((a) => {
            const activeCampaignsCount = campaigns.filter((c) => c.advertiserId === a.id && c.status === 'active').length
            return (
              <div key={a.id} className="rounded-lg border border-slate-200 p-2.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-700">{a.businessName}</p>
                    <p className="mt-0.5 text-slate-500">
                      {a.category} · {a.barangay}, {a.city}
                    </p>
                    <p className="mt-0.5 text-slate-400">
                      {a.plan} · ₱{a.monthlyValue.toLocaleString()}/mo · {activeCampaignsCount} active campaign(s)
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE_CLASSES[a.status]}`}>{a.status}</span>
                </div>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => handleStartEdit(a.id)} className="rounded-md px-2 py-1 font-medium text-brand-600 underline hover:bg-brand-50">
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      removeAdvertiser(a.id)
                      logActivity({ actorRole: 'admin', actorName: 'Admin', todaOrgId: null, action: 'IP · Removed advertiser', summary: `Removed ${a.businessName}.` })
                    }}
                    className="rounded-md px-2 py-1 font-medium text-rose-600 underline hover:bg-rose-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
