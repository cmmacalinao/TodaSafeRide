import { useState } from 'react'
import { useRides } from '../context/RideContext'
import { DATE_RANGE_PRESET_LABELS, inRange, resolveDateRange, type DateRangePreset } from '../lib/incomePromotion'

const PRESETS: DateRangePreset[] = ['today', '7d', '30d', 'this_month', 'this_quarter', 'this_year', 'custom']
const COMPARISON_RATES = [5, 7.5, 10]

function StatRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
      <div>
        <p className="text-xs text-slate-600">{label}</p>
        {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
      </div>
      <p className="text-sm font-semibold text-slate-800">{value}</p>
    </div>
  )
}

// "IP · " tag — see IncomePromotionSettingsSection for why every Income &
// Promotion logActivity call uses this prefix.
export function IncomePromotionRevenue() {
  const {
    rides,
    advertisers,
    campaigns,
    partnershipRevenue,
    incomePromotionSettings,
    addPartnershipRevenue,
    removePartnershipRevenue,
    logActivity,
  } = useRides()
  const [preset, setPreset] = useState<DateRangePreset>('30d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [partnerName, setPartnerName] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')

  const { start, end } = resolveDateRange(preset, customStart, customEnd)

  const completedInRange = rides.filter(
    (r) => r.status === 'completed' && r.completedAt && r.payment && inRange(r.completedAt, start, end),
  )
  const rideRevenue = completedInRange.reduce((sum, r) => sum + (r.payment?.amount ?? 0), 0)
  const actualCommission = completedInRange.reduce((sum, r) => sum + (r.payment?.platformFee ?? 0), 0)
  const advertisingRevenue = advertisers.filter((a) => a.status === 'active').reduce((sum, a) => sum + a.monthlyValue, 0)
  const productPromotionRevenue = campaigns
    .filter((c) => c.type === 'merchant_promotion' && c.status === 'active')
    .reduce((sum, c) => sum + c.budget, 0)
  const partnershipInRange = partnershipRevenue.filter((p) => inRange(p.recordedAt, start, end))
  const partnershipTotal = partnershipInRange.reduce((sum, p) => sum + p.amount, 0)

  function handleAddPartnership() {
    const amt = Number(amount)
    if (!partnerName.trim()) {
      setError('Enter the partner name.')
      return
    }
    if (!description.trim()) {
      setError('Add a short description.')
      return
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a valid amount greater than 0.')
      return
    }
    setError('')
    addPartnershipRevenue({ partnerName: partnerName.trim(), description: description.trim(), amount: amt, recordedBy: 'Admin' })
    logActivity({
      actorRole: 'admin',
      actorName: 'Admin',
      todaOrgId: null,
      action: 'IP · Recorded partnership revenue',
      summary: `${partnerName.trim()} — ₱${amt.toLocaleString()}: "${description.trim()}".`,
    })
    setPartnerName('')
    setDescription('')
    setAmount('')
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className="mb-1.5 text-xs font-medium text-slate-500">Date range</p>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPreset(p)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                preset === p ? 'bg-brand-600 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {DATE_RANGE_PRESET_LABELS[p]}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          </div>
        )}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-slate-700">Revenue breakdown</h3>
        <div>
          <StatRow label="Ride revenue" value={`₱${rideRevenue.toLocaleString()}`} />
          <StatRow
            label="Actual platform commission"
            value={`₱${actualCommission.toLocaleString()}`}
            hint="Real, already collected — ₱0 during the pilot if commissionPerRide is 0."
          />
          <StatRow label="Advertising revenue" value={`₱${advertisingRevenue.toLocaleString()}`} hint="Active advertisers, monthly value" />
          <StatRow label="Product promotion revenue" value={`₱${productPromotionRevenue.toLocaleString()}`} hint="Active merchant-promotion campaigns' budget" />
          <StatRow label="Partnership revenue" value={`₱${partnershipTotal.toLocaleString()}`} />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-slate-700">Theoretical commission comparison</h3>
        <p className="mb-3 text-xs text-slate-500">
          What platform commission would be at each rate, applied to ride revenue in this date range — never the
          real, actually-collected figure above.
        </p>
        <div>
          {COMPARISON_RATES.map((rate) => (
            <StatRow
              key={rate}
              label={`At ${rate}%${rate === incomePromotionSettings.theoreticalCommissionRatePct ? ' (configured)' : ''}`}
              value={`₱${Math.round(rideRevenue * (rate / 100)).toLocaleString()}`}
            />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">Change the configured rate from the Settings tab.</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-slate-700">Log partnership revenue</h3>
        <p className="mb-3 text-xs text-slate-500">Sponsorships, one-off partner payments — separate from recurring advertiser plans.</p>
        <div className="space-y-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
          <div className="grid grid-cols-2 gap-2">
            <input value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="Partner name" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="₱ amount" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          </div>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
          <button onClick={handleAddPartnership} className="w-full rounded-lg bg-brand-600 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
            Add entry
          </button>
        </div>

        {partnershipRevenue.length > 0 && (
          <div className="mt-3 space-y-2">
            {partnershipRevenue.map((p) => (
              <div key={p.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 p-2.5 text-xs">
                <div>
                  <p className="font-medium text-slate-700">
                    {p.partnerName} · ₱{p.amount.toLocaleString()}
                  </p>
                  <p className="mt-0.5 text-slate-500">{p.description}</p>
                  <p className="mt-0.5 text-slate-400">{new Date(p.recordedAt).toLocaleDateString()} · by {p.recordedBy}</p>
                </div>
                <button
                  onClick={() => {
                    removePartnershipRevenue(p.id)
                    logActivity({
                      actorRole: 'admin',
                      actorName: 'Admin',
                      todaOrgId: null,
                      action: 'IP · Deleted partnership revenue',
                      summary: `Removed ${p.partnerName} — ₱${p.amount.toLocaleString()}.`,
                    })
                  }}
                  className="shrink-0 rounded-md px-2 py-1 text-rose-600 hover:bg-rose-50"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
