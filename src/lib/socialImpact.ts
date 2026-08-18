import type { RotaryProject, SocialImpactTransaction } from '../types'

// A transaction's category alone decides inflow vs. outflow — amount is
// always stored as a positive magnitude (see SocialImpactTransaction in
// types), so this is the one place that decides sign, instead of every
// caller having to remember which categories subtract.
function signedAmount(t: SocialImpactTransaction): number {
  switch (t.category) {
    case 'fund_allocation':
      return t.amount
    case 'project_expense':
    case 'transfer':
      return -t.amount
    case 'adjustment':
      // Adjustments correct a mistake either direction — the amount itself
      // carries the sign here (can be negative), unlike the other categories.
      return t.amount
    case 'project_commitment':
      // A commitment reserves intent, not cash — it shows up in
      // totalCommitted() below, not the closing balance.
      return 0
  }
}

export function fundClosingBalance(transactions: SocialImpactTransaction[]): number {
  return transactions.reduce((sum, t) => sum + signedAmount(t), 0)
}

export function fundTotalAllocations(transactions: SocialImpactTransaction[]): number {
  return transactions.filter((t) => t.category === 'fund_allocation').reduce((sum, t) => sum + t.amount, 0)
}

export function fundTotalCommitted(transactions: SocialImpactTransaction[]): number {
  return transactions.filter((t) => t.category === 'project_commitment').reduce((sum, t) => sum + t.amount, 0)
}

export function fundTotalSpent(transactions: SocialImpactTransaction[]): number {
  return transactions.filter((t) => t.category === 'project_expense').reduce((sum, t) => sum + t.amount, 0)
}

// A project's actual spend, derived from its linked transactions rather
// than a stored field — see RotaryProject in types for why.
export function projectAmountSpent(projectId: string, transactions: SocialImpactTransaction[]): number {
  return transactions
    .filter((t) => t.projectId === projectId && t.category === 'project_expense')
    .reduce((sum, t) => sum + t.amount, 0)
}

export function projectRemainingBalance(project: RotaryProject, transactions: SocialImpactTransaction[]): number {
  const totalFunding = project.socialImpactFundAllocation + project.additionalFunding
  return totalFunding - projectAmountSpent(project.id, transactions)
}
