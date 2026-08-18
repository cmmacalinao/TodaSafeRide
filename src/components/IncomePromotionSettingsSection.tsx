import { useState } from 'react'
import { useRides } from '../context/RideContext'
import { ActivityLogPanel } from './ActivityLogPanel'

const RATE_PRESETS = [5, 7.5, 10]

// Settings for the whole Income & Promotion module — reached from /admin
// (plain "Admin" actor, same as the rest of AdminPage; this page isn't
// behind the extra Accounting officer gate, so it doesn't use the
// 'super_admin' log persona). Every change is audited via logActivity, per
// the module's own "every setting change must be audited" requirement.
const ADSENSE_PLACEMENT_LABELS: Record<string, string> = {
  landing: 'Landing page',
  passengerTop: 'Passenger page (top)',
  passengerBottom: 'Passenger page (bottom)',
  driverTop: 'Driver page (top)',
  driverBottom: 'Driver page (bottom)',
  parentBottom: 'Parent page (bottom)',
}

export function IncomePromotionSettingsSection() {
  const { incomePromotionSettings, setIncomePromotionSettings, adSenseSettings, setAdSenseSettings, activityLog, logActivity } =
    useRides()
  const [publisherIdInput, setPublisherIdInput] = useState(adSenseSettings.publisherId ?? '')
  const [slotInputs, setSlotInputs] = useState<Record<string, string>>({
    landing: adSenseSettings.slots.landing ?? '',
    passengerTop: adSenseSettings.slots.passengerTop ?? '',
    passengerBottom: adSenseSettings.slots.passengerBottom ?? '',
    driverTop: adSenseSettings.slots.driverTop ?? '',
    driverBottom: adSenseSettings.slots.driverBottom ?? '',
    parentBottom: adSenseSettings.slots.parentBottom ?? '',
  })
  const [adSenseError, setAdSenseError] = useState('')
  const [rateInput, setRateInput] = useState(String(incomePromotionSettings.theoreticalCommissionRatePct))
  const [expirationInput, setExpirationInput] = useState(
    incomePromotionSettings.coinExpirationDays != null ? String(incomePromotionSettings.coinExpirationDays) : '',
  )
  const [fraudInput, setFraudInput] = useState(String(incomePromotionSettings.fraudReferralThreshold))
  const [dailyLimitInput, setDailyLimitInput] = useState(
    incomePromotionSettings.defaultCampaignDailyLimit != null ? String(incomePromotionSettings.defaultCampaignDailyLimit) : '',
  )
  const [weeklyLimitInput, setWeeklyLimitInput] = useState(
    incomePromotionSettings.defaultCampaignWeeklyLimit != null ? String(incomePromotionSettings.defaultCampaignWeeklyLimit) : '',
  )
  const [monthlyLimitInput, setMonthlyLimitInput] = useState(
    incomePromotionSettings.defaultCampaignMonthlyLimit != null ? String(incomePromotionSettings.defaultCampaignMonthlyLimit) : '',
  )
  const [error, setError] = useState('')

  // "IP · " tags every Income & Promotion log entry with a stable, greppable
  // prefix — lets this module's own log panel (below) filter to just its own
  // history without guessing at action text, while every entry still shows
  // up in AdminPage's general "Admin — Log History" too (same actorRole).
  function logSettings(action: string, summary: string) {
    logActivity({ actorRole: 'admin', actorName: 'Admin', todaOrgId: null, action: `IP · ${action}`, summary })
  }

  function handleSaveRate() {
    const rate = Number(rateInput)
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      setError('Enter a commission rate between 0 and 100.')
      return
    }
    setError('')
    setIncomePromotionSettings({ ...incomePromotionSettings, theoreticalCommissionRatePct: rate })
    logSettings('Updated theoretical commission rate', `Set to ${rate}% for the Overview/Revenue comparison.`)
  }

  function handleSaveRewardLimits() {
    const expirationDays = expirationInput.trim() === '' ? null : Number(expirationInput)
    const fraudThreshold = Number(fraudInput)
    if (expirationDays !== null && (!Number.isFinite(expirationDays) || expirationDays <= 0)) {
      setError('Coin expiration must be blank (never expires) or a positive number of days.')
      return
    }
    if (!Number.isFinite(fraudThreshold) || fraudThreshold <= 0) {
      setError('Enter a valid fraud referral threshold greater than 0.')
      return
    }
    setError('')
    setIncomePromotionSettings({
      ...incomePromotionSettings,
      coinExpirationDays: expirationDays,
      fraudReferralThreshold: fraudThreshold,
    })
    logSettings(
      'Updated reward/fraud rules',
      `Coin expiration: ${expirationDays ? `${expirationDays} days` : 'never'}. Fraud review threshold: ${fraudThreshold} referrals/day.`,
    )
  }

  function handleSaveCampaignLimits() {
    const daily = dailyLimitInput.trim() === '' ? null : Number(dailyLimitInput)
    const weekly = weeklyLimitInput.trim() === '' ? null : Number(weeklyLimitInput)
    const monthly = monthlyLimitInput.trim() === '' ? null : Number(monthlyLimitInput)
    if ([daily, weekly, monthly].some((n) => n !== null && (!Number.isFinite(n) || n <= 0))) {
      setError('Campaign limits must be blank (no limit) or a positive number.')
      return
    }
    setError('')
    setIncomePromotionSettings({
      ...incomePromotionSettings,
      defaultCampaignDailyLimit: daily,
      defaultCampaignWeeklyLimit: weekly,
      defaultCampaignMonthlyLimit: monthly,
    })
    logSettings(
      'Updated default campaign limits',
      `Daily ${daily ?? '—'}, weekly ${weekly ?? '—'}, monthly ${monthly ?? '—'}.`,
    )
  }

  function handleSaveAdSense() {
    const publisherId = publisherIdInput.trim()
    if (publisherId && !/^ca-pub-\d{10,20}$/.test(publisherId)) {
      setAdSenseError('Publisher ID should look like ca-pub-1234567890123456 (from your AdSense account).')
      return
    }
    setAdSenseError('')
    const enteredSlotCount = Object.values(slotInputs).filter((v) => v.trim() !== '').length
    setAdSenseSettings({
      enabled: !!publisherId && enteredSlotCount > 0,
      publisherId: publisherId || null,
      slots: {
        landing: slotInputs.landing.trim() || null,
        passengerTop: slotInputs.passengerTop.trim() || null,
        passengerBottom: slotInputs.passengerBottom.trim() || null,
        driverTop: slotInputs.driverTop.trim() || null,
        driverBottom: slotInputs.driverBottom.trim() || null,
        parentBottom: slotInputs.parentBottom.trim() || null,
      },
    })
    logSettings(
      'Updated Google AdSense settings',
      publisherId
        ? `Publisher ${publisherId}, ${enteredSlotCount} slot(s) configured.`
        : 'Cleared Google AdSense configuration — ad slots back to placeholders.',
    )
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-slate-700">Platform commission comparison</h3>
        <p className="mb-3 text-xs text-slate-500">
          During the pilot, actual commission is whatever the platform's real per-ride fee already collects (see
          Admin → Commission settings) — this rate only drives the Overview/Revenue tabs' "what commission WOULD be
          at X%" theoretical comparison; it never changes real fares or payouts.
        </p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {RATE_PRESETS.map((rate) => (
            <button
              key={rate}
              type="button"
              onClick={() => setRateInput(String(rate))}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                Number(rateInput) === rate
                  ? 'bg-brand-600 text-white'
                  : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {rate}%
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={rateInput}
            onChange={(e) => setRateInput(e.target.value)}
            className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
          <span className="text-xs text-slate-500">%</span>
          <button
            onClick={handleSaveRate}
            className="ml-auto rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
          >
            Save
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">Current: {incomePromotionSettings.theoreticalCommissionRatePct}%</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-slate-700">Coin expiration & fraud rules</h3>
        <p className="mb-3 text-xs text-slate-500">
          How long TODARIDE COINS stay valid, and how many referrals from one referrer in a day trigger fraud review
          (see the Referrals tab's FRAUD REVIEW status).
        </p>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-500">Coin expiration (days, blank = never)</span>
            <input
              type="number"
              min={1}
              value={expirationInput}
              onChange={(e) => setExpirationInput(e.target.value)}
              placeholder="Never"
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-500">Fraud review threshold (referrals/day)</span>
            <input
              type="number"
              min={1}
              value={fraudInput}
              onChange={(e) => setFraudInput(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
        </div>
        <button
          onClick={handleSaveRewardLimits}
          className="mt-2 w-full rounded-lg bg-brand-600 py-2 text-xs font-semibold text-white hover:bg-brand-700"
        >
          Save
        </button>
        <p className="mt-2 text-xs text-slate-400">
          Current: {incomePromotionSettings.coinExpirationDays ? `${incomePromotionSettings.coinExpirationDays} days` : 'never expires'} ·{' '}
          {incomePromotionSettings.fraudReferralThreshold} referrals/day flags review
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-slate-700">Default campaign limits</h3>
        <p className="mb-3 text-xs text-slate-500">
          Suggested spend/reward caps a new Campaign starts with (Campaigns tab) — each campaign can still override
          these individually.
        </p>
        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-500">Daily</span>
            <input
              type="number"
              min={1}
              value={dailyLimitInput}
              onChange={(e) => setDailyLimitInput(e.target.value)}
              placeholder="No limit"
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-500">Weekly</span>
            <input
              type="number"
              min={1}
              value={weeklyLimitInput}
              onChange={(e) => setWeeklyLimitInput(e.target.value)}
              placeholder="No limit"
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-500">Monthly</span>
            <input
              type="number"
              min={1}
              value={monthlyLimitInput}
              onChange={(e) => setMonthlyLimitInput(e.target.value)}
              placeholder="No limit"
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
        </div>
        <button
          onClick={handleSaveCampaignLimits}
          className="mt-2 w-full rounded-lg bg-brand-600 py-2 text-xs font-semibold text-white hover:bg-brand-700"
        >
          Save
        </button>
        {error && <p className="mt-2 text-xs font-medium text-rose-600">{error}</p>}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-slate-700">Google AdSense</h3>
        <p className="mb-3 text-xs text-slate-500">
          Third-party ad-network income — separate from the Advertisers/Campaigns marketplace above. This only ever
          wires in a <em>real</em> AdSense account: paste your actual Publisher ID and per-placement slot IDs from{' '}
          <a
            href="https://www.google.com/adsense/start/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 underline"
          >
            adsense.google.com
          </a>{' '}
          once your site is approved. Leave blank and every placement below shows only a quiet "Ad space" placeholder
          — nothing here can fabricate a working account or earn income by itself.
        </p>
        <label className="mb-2 block">
          <span className="mb-1 block text-[11px] text-slate-500">Publisher ID</span>
          <input
            value={publisherIdInput}
            onChange={(e) => setPublisherIdInput(e.target.value)}
            placeholder="ca-pub-1234567890123456"
            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(ADSENSE_PLACEMENT_LABELS) as (keyof typeof ADSENSE_PLACEMENT_LABELS)[]).map((key) => (
            <label key={key} className="block">
              <span className="mb-1 block text-[11px] text-slate-500">{ADSENSE_PLACEMENT_LABELS[key]} slot ID</span>
              <input
                value={slotInputs[key]}
                onChange={(e) => setSlotInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder="1234567890"
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
          ))}
        </div>
        {adSenseError && <p className="mt-2 text-xs font-medium text-rose-600">{adSenseError}</p>}
        <button
          onClick={handleSaveAdSense}
          className="mt-3 w-full rounded-lg bg-brand-600 py-2 text-xs font-semibold text-white hover:bg-brand-700"
        >
          Save
        </button>
        <p className="mt-2 text-xs text-slate-400">
          Status: {adSenseSettings.enabled ? '✓ Active — real ads will attempt to load' : 'Not active — showing placeholders only'}
        </p>
      </section>

      <ActivityLogPanel
        title="Income & Promotion — Log History"
        entries={activityLog.filter((e) => e.action.startsWith('IP · '))}
        emptyMessage="No Income & Promotion changes logged yet."
      />
    </div>
  )
}
