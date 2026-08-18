import { useState } from 'react'
import { useRides } from '../context/RideContext'
import type { PromoDiscountType, PromoOffer, PromoOfferKind, PromoOfferStatus } from '../types'

const KIND_OPTIONS: PromoOfferKind[] = [
  'promotional_offer',
  'merchant_offer',
  'ride_campaign',
  'passenger_campaign',
  'driver_campaign',
  'referral_campaign',
  'social_media_campaign',
  'safety_campaign',
]
const DISCOUNT_TYPE_OPTIONS: PromoDiscountType[] = ['percent_off', 'flat_off', 'free_ride_credit']
const STATUS_OPTIONS: PromoOfferStatus[] = ['draft', 'active', 'paused', 'ended', 'archived']

const STATUS_BADGE_CLASSES: Record<PromoOfferStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-amber-100 text-amber-700',
  ended: 'bg-slate-200 text-slate-600',
  archived: 'bg-slate-100 text-slate-400',
}

const DISCOUNT_LABELS: Record<PromoDiscountType, string> = {
  percent_off: '% off',
  flat_off: '₱ off',
  free_ride_credit: 'Free ride credit',
}

const todayIso = () => new Date().toISOString().slice(0, 10)

export function IncomePromotionPromotions() {
  const { promoOffers, addPromoOffer, updatePromoOffer, setPromoOfferStatus, removePromoOffer, logActivity } = useRides()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState<PromoOfferKind>('promotional_offer')
  const [discountType, setDiscountType] = useState<PromoDiscountType>('percent_off')
  const [discountValue, setDiscountValue] = useState('')
  const [code, setCode] = useState('')
  const [startDate, setStartDate] = useState(todayIso())
  const [endDate, setEndDate] = useState('')
  const [usageLimit, setUsageLimit] = useState('')
  const [status, setStatus] = useState<PromoOfferStatus>('draft')
  const [error, setError] = useState('')

  function resetForm() {
    setEditingId(null)
    setTitle('')
    setDescription('')
    setKind('promotional_offer')
    setDiscountType('percent_off')
    setDiscountValue('')
    setCode('')
    setStartDate(todayIso())
    setEndDate('')
    setUsageLimit('')
    setStatus('draft')
    setError('')
  }

  function handleStartEdit(o: PromoOffer) {
    setEditingId(o.id)
    setTitle(o.title)
    setDescription(o.description)
    setKind(o.kind)
    setDiscountType(o.discountType)
    setDiscountValue(String(o.discountValue))
    setCode(o.code ?? '')
    setStartDate(o.startDate)
    setEndDate(o.endDate ?? '')
    setUsageLimit(o.usageLimit != null ? String(o.usageLimit) : '')
    setStatus(o.status)
    setError('')
  }

  function handleSave() {
    const value = Number(discountValue)
    if (!title.trim()) {
      setError('Enter a title.')
      return
    }
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter a valid discount value greater than 0.')
      return
    }
    setError('')
    const args = {
      title: title.trim(),
      description: description.trim(),
      kind,
      discountType,
      discountValue: value,
      code: code.trim() || null,
      startDate,
      endDate: endDate || null,
      usageLimit: usageLimit.trim() === '' ? null : Number(usageLimit),
      status,
    }
    if (editingId) {
      updatePromoOffer(editingId, args)
      logActivity({ actorRole: 'admin', actorName: 'Admin', todaOrgId: null, action: 'IP · Updated promotion', summary: `${args.title} — ${args.status}.` })
    } else {
      addPromoOffer(args)
      logActivity({ actorRole: 'admin', actorName: 'Admin', todaOrgId: null, action: 'IP · Added promotion', summary: `${args.title} — ${args.status}.` })
    }
    resetForm()
  }

  function handleSetStatus(o: PromoOffer, next: PromoOfferStatus) {
    setPromoOfferStatus(o.id, next)
    logActivity({ actorRole: 'admin', actorName: 'Admin', todaOrgId: null, action: `IP · Set promotion to ${next}`, summary: o.title })
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-slate-700">{editingId ? 'Edit promotion' : 'Create promotion'}</h3>
        <div className="space-y-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title, e.g. '10% off Pabili this week'" className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={2} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          <select value={kind} onChange={(e) => setKind(e.target.value as PromoOfferKind)} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs">
            {KIND_OPTIONS.map((k) => (
              <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <select value={discountType} onChange={(e) => setDiscountType(e.target.value as PromoDiscountType)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs">
              {DISCOUNT_TYPE_OPTIONS.map((d) => (
                <option key={d} value={d}>{DISCOUNT_LABELS[d]}</option>
              ))}
            </select>
            <input type="number" min={0} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder={discountType === 'percent_off' ? '% value' : '₱ value'} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          </div>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Promo code (optional)" className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[11px] text-slate-500">Start date</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-slate-500">End date (optional)</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min={1} value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} placeholder="Usage limit (optional)" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            <select value={status} onChange={(e) => setStatus(e.target.value as PromoOfferStatus)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs">
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleSave} className="flex-1 rounded-lg bg-brand-600 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
              {editingId ? 'Save changes' : 'Create promotion'}
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
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Promotions ({promoOffers.length})</h3>
        {promoOffers.length === 0 && <p className="text-xs text-slate-400">No promotions yet.</p>}
        <div className="space-y-2">
          {promoOffers.map((o) => (
            <div key={o.id} className="rounded-lg border border-slate-200 p-2.5 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-700">{o.title}</p>
                  <p className="mt-0.5 text-slate-500">
                    {o.kind.replace(/_/g, ' ')} · {DISCOUNT_LABELS[o.discountType]}: {o.discountValue}
                    {o.discountType === 'percent_off' ? '%' : o.discountType === 'flat_off' ? '₱' : ''}
                  </p>
                  <p className="mt-0.5 text-slate-400">
                    {o.code ? `Code: ${o.code} · ` : ''}
                    {o.timesRedeemed} redeemed{o.usageLimit ? ` / ${o.usageLimit}` : ''} · {o.startDate}
                    {o.endDate ? ` – ${o.endDate}` : ' – ongoing'}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE_CLASSES[o.status]}`}>{o.status}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={() => handleStartEdit(o)} className="rounded-md px-2 py-1 font-medium text-brand-600 underline hover:bg-brand-50">
                  Edit
                </button>
                {o.status !== 'active' && (
                  <button onClick={() => handleSetStatus(o, 'active')} className="rounded-md px-2 py-1 font-medium text-emerald-600 underline hover:bg-emerald-50">
                    Activate
                  </button>
                )}
                {o.status === 'active' && (
                  <button onClick={() => handleSetStatus(o, 'paused')} className="rounded-md px-2 py-1 font-medium text-amber-600 underline hover:bg-amber-50">
                    Pause
                  </button>
                )}
                {o.status !== 'ended' && o.status !== 'archived' && (
                  <button onClick={() => handleSetStatus(o, 'ended')} className="rounded-md px-2 py-1 font-medium text-slate-600 underline hover:bg-slate-100">
                    End
                  </button>
                )}
                {o.status !== 'archived' && (
                  <button onClick={() => handleSetStatus(o, 'archived')} className="rounded-md px-2 py-1 font-medium text-slate-500 underline hover:bg-slate-100">
                    Archive
                  </button>
                )}
                <button
                  onClick={() => {
                    removePromoOffer(o.id)
                    logActivity({ actorRole: 'admin', actorName: 'Admin', todaOrgId: null, action: 'IP · Deleted promotion', summary: `Removed ${o.title}.` })
                  }}
                  className="rounded-md px-2 py-1 font-medium text-rose-600 underline hover:bg-rose-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
