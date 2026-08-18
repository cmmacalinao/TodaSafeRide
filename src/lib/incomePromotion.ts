import type { CoinTransaction, RideCreditTier } from '../types'

export type DateRangePreset = 'today' | '7d' | '30d' | 'this_month' | 'this_quarter' | 'this_year' | 'custom'

export const DATE_RANGE_PRESET_LABELS: Record<DateRangePreset, string> = {
  today: 'Today',
  '7d': '7 Days',
  '30d': '30 Days',
  this_month: 'This Month',
  this_quarter: 'This Quarter',
  this_year: 'This Year',
  custom: 'Custom',
}

// Resolves an Overview/Revenue-tab date-filter preset into an actual
// [start, end] window. Custom uses the two admin-picked ISO date strings
// as-is (end is treated as end-of-day so the selected day is inclusive).
export function resolveDateRange(
  preset: DateRangePreset,
  customStart: string,
  customEnd: string,
  now: Date = new Date(),
): { start: Date; end: Date } {
  const end = new Date(now)
  const start = new Date(now)
  switch (preset) {
    case 'today':
      start.setHours(0, 0, 0, 0)
      return { start, end }
    case '7d':
      start.setDate(start.getDate() - 6)
      start.setHours(0, 0, 0, 0)
      return { start, end }
    case '30d':
      start.setDate(start.getDate() - 29)
      start.setHours(0, 0, 0, 0)
      return { start, end }
    case 'this_month':
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      return { start, end }
    case 'this_quarter': {
      const quarterStartMonth = Math.floor(start.getMonth() / 3) * 3
      start.setMonth(quarterStartMonth, 1)
      start.setHours(0, 0, 0, 0)
      return { start, end }
    }
    case 'this_year':
      start.setMonth(0, 1)
      start.setHours(0, 0, 0, 0)
      return { start, end }
    case 'custom': {
      const customStartDate = customStart ? new Date(customStart) : new Date(0)
      const customEndDate = customEnd ? new Date(customEnd) : new Date(now)
      customStartDate.setHours(0, 0, 0, 0)
      customEndDate.setHours(23, 59, 59, 999)
      return { start: customStartDate, end: customEndDate }
    }
  }
}

export function inRange(iso: string, start: Date, end: Date): boolean {
  const t = new Date(iso).getTime()
  return t >= start.getTime() && t <= end.getTime()
}

// Net coin balance for one actor — issued/adjusted add, redeemed/expired
// subtract. Single source of truth for "how many coins does X have", used
// by both the Rewards tab (admin view) and the passenger-facing coin
// balance card, so the two can never disagree.
export function coinBalance(transactions: CoinTransaction[], actorId: string): number {
  return transactions
    .filter((t) => t.actorId === actorId)
    .reduce((sum, t) => {
      const signed = t.direction === 'issued' || t.direction === 'adjusted' ? t.amount : -t.amount
      return sum + signed
    }, 0)
}

export interface CoinTotals {
  issued: number
  redeemed: number
  adjusted: number
  expired: number
  outstanding: number
}

export function coinTotals(transactions: CoinTransaction[]): CoinTotals {
  const issued = transactions.filter((t) => t.direction === 'issued').reduce((s, t) => s + t.amount, 0)
  const redeemed = transactions.filter((t) => t.direction === 'redeemed').reduce((s, t) => s + t.amount, 0)
  const adjusted = transactions.filter((t) => t.direction === 'adjusted').reduce((s, t) => s + t.amount, 0)
  const expired = transactions.filter((t) => t.direction === 'expired').reduce((s, t) => s + t.amount, 0)
  return { issued, redeemed, adjusted, expired, outstanding: issued + adjusted - redeemed - expired }
}

// Converts a coin amount to its peso value using the average rate across
// configured RideCreditTiers (e.g. 100=₱5, 200=₱10, 500=₱25 all resolve to
// the same 20-coins-per-peso rate — this averages so a non-linear tier list
// still produces a sane blended estimate rather than picking one arbitrary
// tier). Returns 0 if no tiers are configured (nothing to convert against).
export function coinsToPesos(coins: number, tiers: RideCreditTier[]): number {
  if (tiers.length === 0 || coins <= 0) return 0
  const avgRate = tiers.reduce((sum, t) => sum + t.pesoValue / t.coins, 0) / tiers.length
  return Math.round(coins * avgRate * 100) / 100
}
