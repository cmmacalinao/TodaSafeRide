import { useState } from 'react'
import { useRides } from '../context/RideContext'
import { CategoryBarChart } from './charts/CategoryBarChart'
import { DailyBarChart } from './charts/DailyBarChart'
import { amountsByPeriod } from '../lib/insights'
import { DATE_RANGE_PRESET_LABELS, inRange, resolveDateRange, type DateRangePreset } from '../lib/incomePromotion'

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-brand-700">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-slate-400">{hint}</p>}
    </div>
  )
}

const PRESETS: DateRangePreset[] = ['today', '7d', '30d', 'this_month', 'this_quarter', 'this_year', 'custom']

export function IncomePromotionOverview() {
  const { rides, campaigns, advertisers, coinTransactions, referrals, incomePromotionSettings } = useRides()
  const [preset, setPreset] = useState<DateRangePreset>('30d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const { start, end } = resolveDateRange(preset, customStart, customEnd)

  const completedRidesInRange = rides.filter(
    (r) => r.status === 'completed' && r.completedAt && r.payment && inRange(r.completedAt, start, end),
  )
  const grossRideRevenue = completedRidesInRange.reduce((sum, r) => sum + (r.payment?.amount ?? 0), 0)
  const actualCommission = completedRidesInRange.reduce((sum, r) => sum + (r.payment?.platformFee ?? 0), 0)
  const theoreticalCommission = Math.round(grossRideRevenue * (incomePromotionSettings.theoreticalCommissionRatePct / 100))

  const advertisingRevenue = advertisers
    .filter((a) => a.status === 'active')
    .reduce((sum, a) => sum + a.monthlyValue, 0)
  const promotionRevenue = campaigns
    .filter((c) => c.type === 'merchant_promotion' && c.status === 'active')
    .reduce((sum, c) => sum + c.budget, 0)

  const coinsInRange = coinTransactions.filter((t) => inRange(t.at, start, end))
  const rewardsIssued = coinsInRange.filter((t) => t.direction === 'issued').reduce((sum, t) => sum + t.amount, 0)
  const rewardsRedeemed = coinsInRange.filter((t) => t.direction === 'redeemed').reduce((sum, t) => sum + t.amount, 0)

  const activeCampaigns = campaigns.filter((c) => c.status === 'active').length
  const activeAdvertisers = advertisers.filter((a) => a.status === 'active').length
  const qualifiedReferrals = referrals.filter(
    (r) => (r.status === 'qualified' || r.status === 'rewarded') && inRange(r.createdAt, start, end),
  ).length

  const revenueTrend = amountsByPeriod(
    rides
      .filter((r) => r.status === 'completed' && r.completedAt && r.payment)
      .map((r) => ({ at: r.completedAt!, value: r.payment!.amount })),
    'daily',
    14,
  )
  const rewardsIssuedTrend = amountsByPeriod(
    coinTransactions.filter((t) => t.direction === 'issued').map((t) => ({ at: t.at, value: t.amount })),
    'daily',
    14,
  )
  const referralTrend = amountsByPeriod(
    referrals.map((r) => ({ at: r.createdAt, value: 1 })),
    'daily',
    14,
  )

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
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Gross ride revenue" value={`₱${grossRideRevenue.toLocaleString()}`} />
        <StatTile
          label="Theoretical commission"
          value={`₱${theoreticalCommission.toLocaleString()}`}
          hint={`at ${incomePromotionSettings.theoreticalCommissionRatePct}% (see Settings)`}
        />
        <StatTile label="Actual commission" value={`₱${actualCommission.toLocaleString()}`} hint="real, already collected" />
        <StatTile label="Advertising revenue" value={`₱${advertisingRevenue.toLocaleString()}`} hint="active advertisers, monthly" />
        <StatTile label="Promotion revenue" value={`₱${promotionRevenue.toLocaleString()}`} />
        <StatTile label="Rewards issued" value={`${rewardsIssued.toLocaleString()} coins`} />
        <StatTile label="Rewards redeemed" value={`${rewardsRedeemed.toLocaleString()} coins`} />
        <StatTile label="Active campaigns" value={String(activeCampaigns)} />
        <StatTile label="Active advertisers" value={String(activeAdvertisers)} />
        <StatTile label="Qualified referrals" value={String(qualifiedReferrals)} />
      </div>

      <DailyBarChart title="Revenue trend (last 14 days)" data={revenueTrend} valuePrefix="₱" emptyMessage="No completed rides yet." />
      <DailyBarChart title="Reward activity — coins issued (last 14 days)" data={rewardsIssuedTrend} emptyMessage="No rewards issued yet — see the Rewards tab." />
      <DailyBarChart title="Referral growth (last 14 days)" data={referralTrend} emptyMessage="No referrals recorded yet — see the Referrals tab." />

      <CategoryBarChart
        title="Advertisers by plan"
        data={(['basic', 'standard', 'premium', 'custom'] as const).map((plan) => ({
          label: plan,
          value: advertisers.filter((a) => a.plan === plan && a.status === 'active').length,
        }))}
        emptyMessage="No advertisers yet — see the Advertisers tab."
      />

      <p className="rounded-lg bg-slate-100 p-2 text-[11px] leading-snug text-slate-500">
        Passenger/driver growth trends need registration timestamps this prototype doesn't track on every seed
        account yet — once available they'll appear here the same way ride revenue does now.
      </p>
    </div>
  )
}
