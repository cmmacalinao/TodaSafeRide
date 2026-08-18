import { useState } from 'react'
import { useRides } from '../context/RideContext'
import { CategoryBarChart } from './charts/CategoryBarChart'
import { DailyBarChart } from './charts/DailyBarChart'
import {
  amountsByPeriod,
  driverAccessBreakdown,
  driverVerificationBreakdown,
  fareCategoryBreakdown,
  generateInsights,
  incomeBreakdown,
  platformPeopleBreakdown,
  REPORT_PERIOD_DEFAULT_COUNT,
  REPORT_PERIOD_LABELS,
  rideOutcomeBreakdown,
  serviceTypeBreakdown,
  type ReportPeriod,
} from '../lib/insights'

const INSIGHT_STYLES = {
  opportunity: { icon: '💡', border: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-800' },
  warning: { icon: '⚠️', border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-800' },
  info: { icon: 'ℹ️', border: 'border-slate-200', bg: 'bg-slate-50', text: 'text-slate-600' },
} as const

// The business-insight dashboard: a handful of charts answering "what's
// happening" (income, ride volume, who's on the platform, driver pipeline
// health) plus a threshold-driven "what to do about it" panel — the actual
// guide for future development, not just a gallery of numbers. Everything
// here is derived from the same RideContext data already powering the rest
// of the Admin page; nothing is fabricated or fetched separately.
export function AdminInsights() {
  const { rides, drivers, passengers, parents, todaOrganizations, alerts, driverReports } = useRides()
  const [trendPeriod, setTrendPeriod] = useState<ReportPeriod>('daily')

  const openAlertsCount = alerts.filter((a) => a.status === 'open').length
  const openReportsCount = driverReports.filter((r) => r.status === 'open').length

  const insights = generateInsights({
    rides,
    drivers,
    passengers,
    todaOrganizations,
    openAlertsCount,
    openReportsCount,
  })

  const ridesEntries = rides.map((r) => ({ at: r.requestedAt, value: 1 }))
  const fareEntries = rides
    .filter((r) => r.status === 'completed' && r.completedAt && r.payment)
    .map((r) => ({ at: r.completedAt!, value: r.payment!.amount }))
  const trendCount = REPORT_PERIOD_DEFAULT_COUNT[trendPeriod]
  const ridesTrend = amountsByPeriod(ridesEntries, trendPeriod, trendCount)
  const fareTrend = amountsByPeriod(fareEntries, trendPeriod, trendCount)

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-700">Business insights</h2>
        <p className="mt-0.5 text-xs text-slate-400">
          Derived from every ride, driver, and passenger record below — updates live as the platform is used.
        </p>
      </div>

      <div className="space-y-2">
        {insights.map((insight, i) => {
          const style = INSIGHT_STYLES[insight.level]
          return (
            <div key={i} className={`flex items-start gap-2 rounded-lg border ${style.border} ${style.bg} p-3 text-xs`}>
              <span className="leading-none">{style.icon}</span>
              <p className={style.text}>{insight.text}</p>
            </div>
          )
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <label className="block max-w-[10rem]">
          <span className="mb-1 block text-xs font-medium text-slate-500">Group rides/fares by</span>
          <select
            value={trendPeriod}
            onChange={(e) => setTrendPeriod(e.target.value as ReportPeriod)}
            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          >
            {(Object.keys(REPORT_PERIOD_LABELS) as ReportPeriod[]).map((p) => (
              <option key={p} value={p}>
                {REPORT_PERIOD_LABELS[p]}
              </option>
            ))}
          </select>
        </label>

        {trendPeriod === 'all' ? (
          <p className="mt-3 text-xs text-slate-500">
            "All" collapses every ride into one total, with no time breakdown — switch to a period to see a trend.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            <DailyBarChart title={`Rides requested — ${REPORT_PERIOD_LABELS[trendPeriod].toLowerCase()}`} data={ridesTrend} />
            <DailyBarChart
              title={`Gross fares collected — ${REPORT_PERIOD_LABELS[trendPeriod].toLowerCase()}`}
              data={fareTrend}
              valuePrefix="₱"
            />
          </div>
        )}
      </div>

      <CategoryBarChart
        title="Where the fare goes (completed rides)"
        data={incomeBreakdown(rides)}
        valuePrefix="₱"
        emptyMessage="No completed rides yet."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CategoryBarChart title="Ride vs. Pabili" data={serviceTypeBreakdown(rides)} />
        <CategoryBarChart title="Fare category" data={fareCategoryBreakdown(rides)} />
      </div>

      <CategoryBarChart title="Ride outcomes" data={rideOutcomeBreakdown(rides)} />

      <CategoryBarChart
        title="Who's on the platform"
        data={platformPeopleBreakdown(passengers, parents, drivers, todaOrganizations)}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CategoryBarChart title="Driver verification" data={driverVerificationBreakdown(drivers)} />
        <CategoryBarChart title="Driver access status" data={driverAccessBreakdown(drivers)} />
      </div>
    </section>
  )
}
