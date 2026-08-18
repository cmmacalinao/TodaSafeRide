import type { Driver, Parent, Passenger, Ride, TodaOrganization } from '../types'

export interface CategoryDatum {
  label: string
  value: number
}

export interface DayDatum {
  // 'YYYY-MM-DD', used as a stable key; label is the short display form.
  key: string
  label: string
  value: number
}

const DAY_MS = 24 * 60 * 60 * 1000

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

// Buckets a timestamped, numeric-valued series into the trailing N calendar
// days (including empty days, so a quiet day reads as a real zero rather
// than a gap) — shared by "rides per day" and "gross fare per day".
function bucketByDay(
  entries: { at: string; value: number }[],
  days: number,
  now: Date = new Date(),
): DayDatum[] {
  const buckets = new Map<string, number>()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY_MS)
    buckets.set(d.toISOString().slice(0, 10), 0)
  }
  for (const e of entries) {
    const key = dayKey(e.at)
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + e.value)
  }
  return Array.from(buckets.entries()).map(([key, value]) => ({
    key,
    label: new Date(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    value,
  }))
}

export function ridesPerDay(rides: Ride[], days = 14): DayDatum[] {
  return bucketByDay(
    rides.map((r) => ({ at: r.requestedAt, value: 1 })),
    days,
  )
}

export function grossFarePerDay(rides: Ride[], days = 14): DayDatum[] {
  const completed = rides.filter((r) => r.status === 'completed' && r.completedAt && r.payment)
  return bucketByDay(
    completed.map((r) => ({ at: r.completedAt!, value: r.payment!.amount })),
    days,
  )
}

// How many distinct calendar days actually have a nonzero value — below 2,
// a day-bucketed chart is just a single bar wearing a chart's clothes (see
// dataviz skill's "is it even a chart?" table), so callers show a stat
// tile / fallback message instead.
export function distinctActiveDays(series: DayDatum[]): number {
  return series.filter((d) => d.value > 0).length
}

export function incomeBreakdown(rides: Ride[]): CategoryDatum[] {
  const completed = rides.filter((r) => r.status === 'completed' && r.payment)
  const driverPayouts = completed.reduce((sum, r) => sum + r.payment!.driverPayout, 0)
  const platformRevenue = completed.reduce((sum, r) => sum + r.payment!.platformFee, 0)
  const todaCommissions = completed.reduce((sum, r) => sum + r.payment!.todaCommission, 0)
  const tips = completed.reduce((sum, r) => sum + r.payment!.tip, 0)
  return [
    { label: 'Driver payouts', value: driverPayouts },
    { label: 'Platform revenue', value: platformRevenue },
    { label: 'TODA commissions', value: todaCommissions },
    { label: 'Tips', value: tips },
  ]
}

export function serviceTypeBreakdown(rides: Ride[]): CategoryDatum[] {
  return [
    { label: 'Ride', value: rides.filter((r) => r.serviceType === 'ride').length },
    { label: 'Pabili', value: rides.filter((r) => r.serviceType === 'pabili').length },
    { label: 'Buy Medicine', value: rides.filter((r) => r.serviceType === 'buy_medicine').length },
  ]
}

export function fareCategoryBreakdown(rides: Ride[]): CategoryDatum[] {
  const pwdSenior = rides.filter((r) => r.isPwdSeniorRide).length
  const student = rides.filter((r) => r.isStudentRide && !r.isPwdSeniorRide).length
  const standard = rides.length - pwdSenior - student
  return [
    { label: 'Standard', value: standard },
    { label: 'Student', value: student },
    { label: 'PWD/Senior', value: pwdSenior },
  ]
}

export function rideOutcomeBreakdown(rides: Ride[]): CategoryDatum[] {
  const inProgress = rides.filter((r) =>
    ['requested', 'accepted', 'driver_arriving', 'ongoing'].includes(r.status),
  ).length
  return [
    { label: 'Completed', value: rides.filter((r) => r.status === 'completed').length },
    { label: 'Cancelled', value: rides.filter((r) => r.status === 'cancelled').length },
    { label: 'Declined', value: rides.filter((r) => r.status === 'declined').length },
    { label: 'In progress', value: inProgress },
  ]
}

export function platformPeopleBreakdown(
  passengers: Passenger[],
  parents: Parent[],
  drivers: Driver[],
  todaOrganizations: TodaOrganization[],
): CategoryDatum[] {
  return [
    { label: 'Passengers', value: passengers.length },
    { label: 'Parents', value: parents.length },
    { label: 'Drivers', value: drivers.length },
    { label: 'TODA orgs', value: todaOrganizations.length },
  ]
}

export function driverVerificationBreakdown(drivers: Driver[]): CategoryDatum[] {
  return [
    { label: 'Approved', value: drivers.filter((d) => d.verificationStatus === 'approved').length },
    { label: 'Pending', value: drivers.filter((d) => d.verificationStatus === 'pending').length },
    { label: 'Rejected', value: drivers.filter((d) => d.verificationStatus === 'rejected').length },
  ]
}

export function driverAccessBreakdown(drivers: Driver[]): CategoryDatum[] {
  return [
    { label: 'Active', value: drivers.filter((d) => d.accessStatus === 'active').length },
    { label: 'Paused', value: drivers.filter((d) => d.accessStatus === 'paused').length },
    { label: 'Terminated', value: drivers.filter((d) => d.accessStatus === 'terminated').length },
  ]
}

export type ReportPeriod = 'all' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'

export const REPORT_PERIOD_LABELS: Record<ReportPeriod, string> = {
  all: 'All (entire report)',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
}

// How many trailing buckets to show by default per granularity — short
// enough that bars/labels stay readable (see dataviz: thin the x-axis
// rather than cram it). 'all' is always a single bucket by definition.
export const REPORT_PERIOD_DEFAULT_COUNT: Record<ReportPeriod, number> = {
  all: 1,
  daily: 14,
  weekly: 8,
  monthly: 12,
  quarterly: 8,
  yearly: 5,
}

function periodStart(date: Date, period: ReportPeriod): Date {
  const d = new Date(date)
  switch (period) {
    case 'all':
      return d
    case 'daily':
      d.setHours(0, 0, 0, 0)
      return d
    case 'weekly': {
      d.setHours(0, 0, 0, 0)
      const dow = (d.getDay() + 6) % 7 // Monday = 0
      d.setDate(d.getDate() - dow)
      return d
    }
    case 'monthly':
      return new Date(d.getFullYear(), d.getMonth(), 1)
    case 'quarterly':
      return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1)
    case 'yearly':
      return new Date(d.getFullYear(), 0, 1)
  }
}

function stepPeriod(date: Date, period: ReportPeriod, count: number): Date {
  const d = new Date(date)
  switch (period) {
    case 'all':
      return d
    case 'daily':
      d.setDate(d.getDate() + count)
      return d
    case 'weekly':
      d.setDate(d.getDate() + count * 7)
      return d
    case 'monthly':
      d.setMonth(d.getMonth() + count)
      return d
    case 'quarterly':
      d.setMonth(d.getMonth() + count * 3)
      return d
    case 'yearly':
      d.setFullYear(d.getFullYear() + count)
      return d
  }
}

// Every entry maps to the same key under 'all' — the whole report collapses
// into a single bucket, which is the point (see hasEnoughData below for why
// that single bucket skips the trend chart instead of trying to draw one).
function periodKeyOf(date: Date, period: ReportPeriod): string {
  switch (period) {
    case 'all':
      return 'all'
    case 'daily':
      return date.toISOString().slice(0, 10)
    case 'weekly':
      return periodStart(date, 'weekly').toISOString().slice(0, 10)
    case 'monthly':
      return date.toISOString().slice(0, 7)
    case 'quarterly':
      return `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`
    case 'yearly':
      return String(date.getFullYear())
  }
}

function periodLabel(date: Date, period: ReportPeriod): string {
  switch (period) {
    case 'all':
      return 'All time'
    case 'daily':
    case 'weekly':
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    case 'monthly':
      return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
    case 'quarterly':
      return `Q${Math.floor(date.getMonth() / 3) + 1} '${String(date.getFullYear()).slice(-2)}`
    case 'yearly':
      return String(date.getFullYear())
  }
}

// The general-purpose, any-granularity version of bucketByDay above — sums a
// timestamped, numeric-valued series into `count` trailing periods
// (including empty ones, so a quiet period reads as a real zero rather than
// a gap). Powers the Admin financial report's period selector.
export function amountsByPeriod(
  entries: { at: string; value: number }[],
  period: ReportPeriod,
  count: number,
  now: Date = new Date(),
): DayDatum[] {
  const start = periodStart(now, period)
  const buckets: DayDatum[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = stepPeriod(start, period, -i)
    buckets.push({ key: periodKeyOf(d, period), label: periodLabel(d, period), value: 0 })
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]))
  for (const e of entries) {
    const bucket = byKey.get(periodKeyOf(new Date(e.at), period))
    if (bucket) bucket.value += e.value
  }
  return buckets
}

export interface Insight {
  level: 'opportunity' | 'warning' | 'info'
  text: string
}

// Turns the raw numbers into plain-English, threshold-driven observations —
// this is the "guide for future development" half of the dashboard, not
// just a chart gallery. Deliberately conservative: every rule fires off a
// real ratio/count already computed above, nothing fabricated.
export function generateInsights(args: {
  rides: Ride[]
  drivers: Driver[]
  passengers: Passenger[]
  todaOrganizations: TodaOrganization[]
  openAlertsCount: number
  openReportsCount: number
}): Insight[] {
  const { rides, drivers, passengers, todaOrganizations, openAlertsCount, openReportsCount } = args
  const insights: Insight[] = []

  const completed = rides.filter((r) => r.status === 'completed')
  if (rides.length === 0) {
    insights.push({
      level: 'info',
      text: 'No rides yet — the charts below will fill in once passengers start booking. Come back after a few days of real activity for trend data.',
    })
    return insights
  }

  const cancelledOrDeclined = rides.filter((r) => r.status === 'cancelled' || r.status === 'declined').length
  const cancelRate = cancelledOrDeclined / rides.length
  if (cancelRate > 0.2) {
    insights.push({
      level: 'warning',
      text: `${Math.round(cancelRate * 100)}% of rides are cancelled or declined — worth digging into whether it's slow driver pickup, unclear fares, or a specific TODA/area before it costs rider trust.`,
    })
  }

  const pabiliShare = rides.filter((r) => r.serviceType === 'pabili').length / rides.length
  if (pabiliShare > 0.25) {
    insights.push({
      level: 'opportunity',
      text: `Pabili already makes up ${Math.round(pabiliShare * 100)}% of requests — consider a dedicated Pabili queue priority or driver incentive, since it's clearly wanted, not just a side feature.`,
    })
  }

  const pendingDrivers = drivers.filter((d) => d.verificationStatus === 'pending').length
  if (pendingDrivers > 0) {
    insights.push({
      level: 'warning',
      text: `${pendingDrivers} driver application${pendingDrivers === 1 ? '' : 's'} still pending verification — clearing the queue directly grows ride capacity.`,
    })
  }

  const pendingTodas = todaOrganizations.filter((o) => o.verificationStatus === 'pending').length
  if (pendingTodas > 0) {
    insights.push({
      level: 'info',
      text: `${pendingTodas} TODA organization${pendingTodas === 1 ? '' : 's'} awaiting registration approval, in the TODA registration queue above.`,
    })
  }

  const onlineDrivers = drivers.filter((d) => d.verificationStatus === 'approved' && d.online).length
  const ridersPerOnlineDriver = onlineDrivers > 0 ? passengers.length / onlineDrivers : null
  if (ridersPerOnlineDriver !== null && ridersPerOnlineDriver > 15) {
    insights.push({
      level: 'warning',
      text: `${passengers.length} registered passengers are currently served by only ${onlineDrivers} online driver${onlineDrivers === 1 ? '' : 's'} — driver recruitment is likely the bottleneck to growth right now, not passenger demand.`,
    })
  }

  if (openAlertsCount > 0) {
    insights.push({
      level: 'warning',
      text: `${openAlertsCount} open safety alert${openAlertsCount === 1 ? '' : 's'} (SOS / route deviation) — resolve these before anything else; they're the incident feed above.`,
    })
  }

  if (openReportsCount > 0) {
    insights.push({
      level: 'warning',
      text: `${openReportsCount} driver report${openReportsCount === 1 ? '' : 's'} awaiting review — repeated reports against the same driver are worth flagging to their TODA.`,
    })
  }

  const ratedRides = completed.filter((r) => r.driverRating !== null)
  if (ratedRides.length > 0) {
    const avgRating = ratedRides.reduce((sum, r) => sum + (r.driverRating ?? 0), 0) / ratedRides.length
    if (avgRating < 4) {
      insights.push({
        level: 'warning',
        text: `Average driver rating across ${ratedRides.length} rated ride${ratedRides.length === 1 ? '' : 's'} is ${avgRating.toFixed(1)}/5 — below the usual 4.0+ bar riders expect from a trusted service.`,
      })
    }
  } else if (completed.length >= 5) {
    insights.push({
      level: 'info',
      text: `${completed.length} completed rides but none rated yet — consider prompting passengers to rate right after drop-off, since ratings are what the driver directory and future matching lean on.`,
    })
  }

  const discountShare =
    rides.filter((r) => r.isStudentRide || r.isPwdSeniorRide).length / rides.length
  if (discountShare > 0.3) {
    insights.push({
      level: 'info',
      text: `${Math.round(discountShare * 100)}% of rides use a student or PWD/Senior discount — factor that mix into fare-rate changes, since it's a meaningful share of ridership, not an edge case.`,
    })
  }

  if (insights.length === 0) {
    insights.push({
      level: 'info',
      text: 'No thresholds tripped right now — operations look steady. Keep an eye on cancellation rate and driver verification queue as volume grows.',
    })
  }

  return insights
}
