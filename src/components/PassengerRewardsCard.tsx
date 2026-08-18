import { useState } from 'react'
import { useRides } from '../context/RideContext'
import { coinBalance } from '../lib/incomePromotion'
import type { Passenger } from '../types'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  qualified: 'Qualified',
  rewarded: 'Rewarded',
  rejected: 'Not eligible',
  fraud_review: 'Under review',
}

// Passenger-facing summary of the Income & Promotion module — deliberately
// thin. Shows only what's this passenger's own (coin balance, their own
// referrals, promos/campaigns actually open to passengers) — never
// revenue, advertiser data, commission settings, reward administration, or
// campaign budgets, all of which stay behind /admin/income-promotion.
// Rendered only while the passenger has the "Rewards & Referrals" tab
// selected (see PassengerPage) — no internal show/hide of its own.
export function PassengerRewardsCard({ passenger }: { passenger: Passenger }) {
  const { coinTransactions, referrals, promoOffers, campaigns, rideCreditTiers, rewardRules, addCoinTransaction } =
    useRides()
  const [redeemError, setRedeemError] = useState('')
  const [copied, setCopied] = useState(false)

  const balance = coinBalance(coinTransactions, passenger.id)
  const myReferrals = referrals.filter((r) => r.referrerId === passenger.id)
  const myCode = myReferrals[0]?.code ?? `REF-${passenger.id.slice(-6).toUpperCase()}`
  const shareText = `Ride safe and save with TodaRide! Use my referral code ${myCode} when you sign up. 🛵`
  const shareUrl = typeof window !== 'undefined' ? window.location.origin : ''

  function handleCopy() {
    navigator.clipboard.writeText(`${shareText} ${shareUrl}`).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // One-time bonus the first time this passenger shares their referral link
  // anywhere — there's no way to verify a share actually posted from the
  // client, so this trusts the click itself (same trust model as the rest
  // of this prototype's simulated data) and only ever fires once per
  // passenger, so repeat clicks can't farm coins.
  const hasSocialShareReward = coinTransactions.some(
    (t) => t.actorId === passenger.id && t.source === 'social_share' && t.direction === 'issued',
  )
  function grantSocialShareRewardOnce() {
    if (hasSocialShareReward || rewardRules.socialShare <= 0) return
    addCoinTransaction({
      actorType: 'passenger',
      actorId: passenger.id,
      actorName: passenger.name,
      direction: 'issued',
      source: 'social_share',
      amount: rewardRules.socialShare,
      note: 'Shared referral link to a social platform',
      recordedBy: passenger.name,
    })
  }

  const today = new Date().toISOString().slice(0, 10)
  const activePromos = promoOffers.filter(
    (o) =>
      o.status === 'active' &&
      o.startDate <= today &&
      (!o.endDate || o.endDate >= today) &&
      ['promotional_offer', 'passenger_campaign', 'referral_campaign', 'social_media_campaign', 'safety_campaign'].includes(o.kind),
  )
  const activeCampaigns = campaigns.filter(
    (c) =>
      c.status === 'active' &&
      (c.targetAudience === 'passengers' || c.targetAudience === 'both' || c.targetAudience === 'public') &&
      c.startDate <= today &&
      (!c.endDate || c.endDate >= today),
  )

  function handleRedeem(tierId: string) {
    const tier = rideCreditTiers.find((t) => t.id === tierId)
    if (!tier) return
    if (balance < tier.coins) {
      setRedeemError(`You need ${tier.coins} coins — you have ${balance}.`)
      return
    }
    setRedeemError('')
    addCoinTransaction({
      actorType: 'passenger',
      actorId: passenger.id,
      actorName: passenger.name,
      direction: 'redeemed',
      source: 'ride_credit_redemption',
      amount: tier.coins,
      note: `Converted to ₱${tier.pesoValue} ride credit`,
      recordedBy: passenger.name,
    })
  }

  return (
    <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-amber-900">🎁 Rewards & Referrals</span>
        <span className="text-xs font-medium text-amber-700">{balance.toLocaleString()} coins</span>
      </div>

      <div className="rounded-lg bg-white p-3">
        <p className="text-xs text-slate-500">Your TODARIDE COINS balance</p>
        <p className="text-lg font-semibold text-brand-700">{balance.toLocaleString()} coins</p>
      </div>

      <div className="rounded-lg bg-white p-3">
        <p className="text-xs text-slate-500">Your referral code — share it with friends</p>
        <p className="text-base font-semibold tracking-wide text-slate-800">{myCode}</p>
        <p className="mt-0.5 text-xs font-medium text-emerald-600">
          Earn {rewardRules.referral} coins for every friend who signs up and qualifies 🎉
        </p>
        {rewardRules.socialShare > 0 && (
          <p className="mt-0.5 text-xs font-medium text-emerald-600">
            {hasSocialShareReward
              ? '✓ Social share bonus already earned'
              : `+${rewardRules.socialShare} bonus coins the first time you share this to your page 📢`}
          </p>
        )}

        <div className="mt-2 flex flex-wrap gap-1.5">
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={grantSocialShareRewardOnce}
            className="flex items-center gap-1 rounded-full border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
          >
            📘 Facebook
          </a>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={grantSocialShareRewardOnce}
            className="flex items-center gap-1 rounded-full border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
          >
            🐦 Twitter
          </a>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={grantSocialShareRewardOnce}
            className="flex items-center gap-1 rounded-full border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
          >
            💬 WhatsApp
          </a>
          <a
            href={`viber://forward?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`}
            onClick={grantSocialShareRewardOnce}
            className="flex items-center gap-1 rounded-full border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
          >
            📞 Viber
          </a>
          <button
            type="button"
            onClick={() => {
              handleCopy()
              grantSocialShareRewardOnce()
            }}
            className="flex items-center gap-1 rounded-full border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
          >
            {copied ? '✓ Copied' : '📋 Copy link'}
          </button>
        </div>

        {myReferrals.length > 0 && (
          <div className="mt-2 space-y-1">
            {myReferrals.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs text-slate-500">
                <span>{r.referredName}</span>
                <span className="font-medium text-slate-600">{STATUS_LABELS[r.status] ?? r.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {rideCreditTiers.length > 0 && (
        <div className="rounded-lg bg-white p-3">
          <p className="mb-1.5 text-xs text-slate-500">Convert coins to ride credit</p>
          <div className="flex flex-wrap gap-1.5">
            {rideCreditTiers.map((tier) => (
              <button
                key={tier.id}
                type="button"
                onClick={() => handleRedeem(tier.id)}
                disabled={balance < tier.coins}
                className="rounded-full border border-brand-300 px-2.5 py-1 text-[11px] font-medium text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {tier.coins} coins → ₱{tier.pesoValue}
              </button>
            ))}
          </div>
          {redeemError && <p className="mt-1.5 text-[11px] font-medium text-rose-600">{redeemError}</p>}
          <p className="mt-1.5 text-[10px] text-slate-400">
            Applying a ride credit at checkout isn't available yet — converted credit is tracked as issued for now.
          </p>
        </div>
      )}

      {(activePromos.length > 0 || activeCampaigns.length > 0) && (
        <div className="rounded-lg bg-white p-3">
          <p className="mb-1.5 text-xs text-slate-500">Active promotions</p>
          <div className="space-y-1.5">
            {activePromos.map((o) => (
              <div key={o.id} className="text-xs">
                <p className="font-medium text-slate-700">{o.title}</p>
                {o.description && <p className="text-slate-500">{o.description}</p>}
              </div>
            ))}
            {activeCampaigns.map((c) => (
              <div key={c.id} className="text-xs">
                <p className="font-medium text-slate-700">{c.name}</p>
                {c.description && <p className="text-slate-500">{c.description}</p>}
                {c.rewardCoins > 0 && <p className="text-slate-400">Earn {c.rewardCoins} coins</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
