import type { CapitalContribution, ExpenseRecord, Ride } from '../types'
import { EXPENSE_CATEGORY_LABELS } from '../mock/data'

// A computed view over existing records, not a new persisted list — per
// "no duplicate financial transactions," a completed ride's payment split
// (see Payment in types) stays the one source of truth for its amounts.
// This just re-presents what already exists (completed rides, expenses,
// capital contributions) as a single chronological ledger, the same way
// AdminAccounting's totals already derive from these same lists.
export type LedgerEntryType =
  | 'ride_revenue'
  | 'driver_payout'
  | 'toda_commission'
  | 'platform_revenue'
  | 'expense'
  | 'capital_contribution'

export const LEDGER_TYPE_LABELS: Record<LedgerEntryType, string> = {
  ride_revenue: 'Ride revenue',
  driver_payout: 'Driver payout',
  toda_commission: 'TODA commission',
  platform_revenue: 'Platform revenue',
  expense: 'Expense',
  capital_contribution: 'Capital contribution',
}

export interface LedgerEntry {
  id: string
  date: string
  type: LedgerEntryType
  description: string
  // Positive = inflow to the platform, negative = outflow — a ride's gross
  // amount is a full inflow while its driver/TODA shares are outflows from
  // that same amount, so summing every entry nets out to platform revenue +
  // expenses + capital, matching the existing dashboard totals.
  amount: number
}

export function buildLedger(
  rides: Ride[],
  expenses: ExpenseRecord[],
  capitalContributions: CapitalContribution[],
): LedgerEntry[] {
  const entries: LedgerEntry[] = []

  for (const r of rides) {
    if (r.status !== 'completed' || !r.payment) continue
    const when = r.completedAt ?? r.requestedAt
    const route = `${r.pickup.label} → ${r.dropoff.label}`
    entries.push({ id: `${r.id}-revenue`, date: when, type: 'ride_revenue', description: route, amount: r.payment.amount })
    if (r.payment.driverPayout > 0) {
      entries.push({
        id: `${r.id}-driver`,
        date: when,
        type: 'driver_payout',
        description: `Driver payout — ${route}`,
        amount: -r.payment.driverPayout,
      })
    }
    if (r.payment.todaCommission > 0) {
      entries.push({
        id: `${r.id}-toda`,
        date: when,
        type: 'toda_commission',
        description: `TODA commission — ${route}`,
        amount: -r.payment.todaCommission,
      })
    }
    if (r.payment.platformFee > 0) {
      entries.push({
        id: `${r.id}-platform`,
        date: when,
        type: 'platform_revenue',
        description: `Platform commission — ${route}`,
        amount: r.payment.platformFee,
      })
    }
  }

  for (const e of expenses) {
    entries.push({
      id: `expense-${e.id}`,
      date: e.recordedAt,
      type: 'expense',
      description: `${EXPENSE_CATEGORY_LABELS[e.category]} — ${e.description}`,
      amount: -e.amount,
    })
  }

  for (const c of capitalContributions) {
    entries.push({
      id: `capital-${c.id}`,
      date: c.contributedAt,
      type: 'capital_contribution',
      description: `Capital — ${c.stockholderName} (${c.shares} shares)`,
      amount: c.amount,
    })
  }

  return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}
