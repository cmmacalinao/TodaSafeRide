import { useState } from 'react'
import { IncomePromotionOverview } from './IncomePromotionOverview'
import { IncomePromotionRevenue } from './IncomePromotionRevenue'
import { IncomePromotionPromotions } from './IncomePromotionPromotions'
import { IncomePromotionAdvertisers } from './IncomePromotionAdvertisers'
import { IncomePromotionCampaigns } from './IncomePromotionCampaigns'
import { IncomePromotionRewards } from './IncomePromotionRewards'
import { IncomePromotionReferrals } from './IncomePromotionReferrals'
import { IncomePromotionRideCredits } from './IncomePromotionRideCredits'
import { IncomePromotionAnalytics } from './IncomePromotionAnalytics'
import { IncomePromotionSettingsSection } from './IncomePromotionSettingsSection'

type IncomePromotionTab =
  | 'overview'
  | 'revenue'
  | 'promotions'
  | 'advertisers'
  | 'campaigns'
  | 'rewards'
  | 'referrals'
  | 'ride_credits'
  | 'analytics'
  | 'settings'

const TABS: { id: IncomePromotionTab; icon: string; label: string }[] = [
  { id: 'overview', icon: '📊', label: 'Overview' },
  { id: 'revenue', icon: '💵', label: 'Revenue' },
  { id: 'promotions', icon: '🏷️', label: 'Promotions' },
  { id: 'advertisers', icon: '📢', label: 'Advertisers' },
  { id: 'campaigns', icon: '🚀', label: 'Campaigns' },
  { id: 'rewards', icon: '🎁', label: 'Rewards' },
  { id: 'referrals', icon: '🤝', label: 'Referrals' },
  { id: 'ride_credits', icon: '🎫', label: 'Ride Credits' },
  { id: 'analytics', icon: '📈', label: 'Analytics' },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
]

// Top-level Admin/Super Admin page for Income & Promotion — reached via the
// 💰 Income & Promotion link in the top NavBar (admin role, same
// authentication as the rest of /admin — no separate login). Sub-tabs live
// entirely inside this one page/route rather than as separate top-level
// Admin nav entries, per the module's own "one dedicated tab, many
// sub-tabs" requirement.
export function IncomePromotion() {
  const [tab, setTab] = useState<IncomePromotionTab>('overview')

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-base font-bold text-slate-800">💰 Income & Promotion</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Revenue, advertising, campaigns, rewards, referrals, and ride credits — management and analytics only.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              tab === t.id ? 'bg-brand-600 text-white' : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <IncomePromotionOverview />}
      {tab === 'revenue' && <IncomePromotionRevenue />}
      {tab === 'promotions' && <IncomePromotionPromotions />}
      {tab === 'advertisers' && <IncomePromotionAdvertisers />}
      {tab === 'campaigns' && <IncomePromotionCampaigns />}
      {tab === 'rewards' && <IncomePromotionRewards />}
      {tab === 'referrals' && <IncomePromotionReferrals />}
      {tab === 'ride_credits' && <IncomePromotionRideCredits />}
      {tab === 'analytics' && <IncomePromotionAnalytics />}
      {tab === 'settings' && <IncomePromotionSettingsSection />}
    </section>
  )
}
