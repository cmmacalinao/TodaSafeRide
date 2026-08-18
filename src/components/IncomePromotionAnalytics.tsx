import { useState, type ReactNode } from 'react'
import { useRides } from '../context/RideContext'
import { coinTotals, coinsToPesos, DATE_RANGE_PRESET_LABELS, inRange, resolveDateRange, type DateRangePreset } from '../lib/incomePromotion'

const PRESETS: DateRangePreset[] = ['today', '7d', '30d', 'this_month', 'this_quarter', 'this_year', 'custom']

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-brand-700">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-slate-400">{hint}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">{title}</h3>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </section>
  )
}

export function IncomePromotionAnalytics() {
  const { passengers, drivers, rides, campaigns, coinTransactions, referrals, advertisers, rideCreditTiers } = useRides()
  const [preset, setPreset] = useState<DateRangePreset>('30d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const { start, end } = resolveDateRange(preset, customStart, customEnd)

  const completedInRange = rides.filter((r) => r.status === 'completed' && r.completedAt && r.payment && inRange(r.completedAt, start, end))
  const grossRideRevenue = completedInRange.reduce((sum, r) => sum + (r.payment?.amount ?? 0), 0)
  const actualCommission = completedInRange.reduce((sum, r) => sum + (r.payment?.platformFee ?? 0), 0)
  const advertisingRevenue = advertisers.filter((a) => a.status === 'active').reduce((sum, a) => sum + a.monthlyValue, 0)
  const promotionRevenue = campaigns.filter((c) => c.type === 'merchant_promotion' && c.status === 'active').reduce((sum, c) => sum + c.budget, 0)

  const activePassengerIds = new Set(completedInRange.map((r) => r.passengerId))
  const rideCountByPassenger = new Map<string, number>()
  rides.filter((r) => r.status === 'completed').forEach((r) => rideCountByPassenger.set(r.passengerId, (rideCountByPassenger.get(r.passengerId) ?? 0) + 1))
  const repeatPassengers = Array.from(rideCountByPassenger.values()).filter((n) => n > 1).length
  const referralsInRange = referrals.filter((r) => inRange(r.createdAt, start, end))
  const qualifiedOrRewarded = referrals.filter((r) => r.status === 'qualified' || r.status === 'rewarded')
  const passengersWithCoins = new Set(coinTransactions.filter((t) => t.actorType === 'passenger').map((t) => t.actorId))

  const activeDriverIds = new Set(completedInRange.map((r) => r.driverId).filter((id): id is string => !!id))
  const retainedDrivers = drivers.filter((d) => d.verificationStatus === 'approved' && d.accessStatus === 'active').length
  const driversWithCoins = new Set(coinTransactions.filter((t) => t.actorType === 'driver').map((t) => t.actorId))

  const campaignCostInRange = campaigns.filter((c) => inRange(c.startDate, start, end)).reduce((sum, c) => sum + c.budget, 0)
  const totals = coinTotals(coinTransactions)
  const rewardCostPesos = coinsToPesos(totals.issued, rideCreditTiers)
  const referredCompletedRides = referrals.filter((r) => r.firstRideAt && inRange(r.firstRideAt, start, end)).length

  const cac = qualifiedOrRewarded.length > 0 ? (campaignCostInRange + rewardCostPesos) / qualifiedOrRewarded.length : null
  const costPerQualifiedPassenger = qualifiedOrRewarded.length > 0 ? rewardCostPesos / qualifiedOrRewarded.length : null
  const revenuePerPassenger = passengers.length > 0 ? grossRideRevenue / passengers.length : null
  const rewardCostPerRide = completedInRange.length > 0 ? rewardCostPesos / completedInRange.length : null
  const referralConversionRate = referrals.length > 0 ? (qualifiedOrRewarded.length / referrals.length) * 100 : null

  const fmtPeso = (n: number | null) => (n === null ? '—' : `₱${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`)
  const fmtPct = (n: number | null) => (n === null ? '—' : `${n.toFixed(1)}%`)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className="mb-1.5 text-xs font-medium text-slate-500">Date range</p>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${preset === p ? 'bg-brand-600 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-50'}`}
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

      <Section title="Passenger">
        <StatTile label="Registered" value={String(passengers.length)} />
        <StatTile label="Active (rode in range)" value={String(activePassengerIds.size)} />
        <StatTile label="Repeat (2+ rides ever)" value={String(repeatPassengers)} />
        <StatTile label="Referral rate" value={fmtPct(passengers.length > 0 ? (qualifiedOrRewarded.length / passengers.length) * 100 : null)} />
        <StatTile label="Rewards participation" value={fmtPct(passengers.length > 0 ? (passengersWithCoins.size / passengers.length) * 100 : null)} />
      </Section>

      <Section title="Driver">
        <StatTile label="Registered" value={String(drivers.length)} />
        <StatTile label="Active (drove in range)" value={String(activeDriverIds.size)} />
        <StatTile label="Retention (approved + active)" value={fmtPct(drivers.length > 0 ? (retainedDrivers / drivers.length) * 100 : null)} />
        <StatTile label="Completed rides (range)" value={String(completedInRange.length)} />
        <StatTile label="Rewards participation" value={fmtPct(drivers.length > 0 ? (driversWithCoins.size / drivers.length) * 100 : null)} />
      </Section>

      <Section title="Revenue">
        <StatTile label="Ride revenue" value={`₱${grossRideRevenue.toLocaleString()}`} />
        <StatTile label="Actual commission" value={`₱${actualCommission.toLocaleString()}`} />
        <StatTile label="Advertising" value={`₱${advertisingRevenue.toLocaleString()}`} hint="Active advertisers, monthly" />
        <StatTile label="Promotion" value={`₱${promotionRevenue.toLocaleString()}`} />
      </Section>

      <Section title="Marketing">
        <StatTile label="Campaign cost (started in range)" value={`₱${campaignCostInRange.toLocaleString()}`} />
        <StatTile label="Reward cost (all-time issued)" value={`₱${rewardCostPesos.toLocaleString()}`} />
        <StatTile label="New referrals (range)" value={String(referralsInRange.length)} />
        <StatTile label="Referred first-rides (range)" value={String(referredCompletedRides)} />
      </Section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">KPIs</h3>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Customer acquisition cost" value={fmtPeso(cac)} hint="(campaign cost + reward cost) / qualified referrals" />
          <StatTile label="Cost per qualified passenger" value={fmtPeso(costPerQualifiedPassenger)} hint="reward cost / qualified referrals" />
          <StatTile label="Revenue per passenger" value={fmtPeso(revenuePerPassenger)} />
          <StatTile label="Reward cost per ride" value={fmtPeso(rewardCostPerRide)} />
          <StatTile label="Referral conversion rate" value={fmtPct(referralConversionRate)} />
          <StatTile label="Campaign ROI" value="—" hint="Needs per-ride campaign attribution — not tracked yet." />
        </div>
      </section>
    </div>
  )
}
