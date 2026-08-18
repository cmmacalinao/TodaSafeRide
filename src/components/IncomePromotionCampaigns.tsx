import { useState } from 'react'
import { useRides } from '../context/RideContext'
import type { Campaign, CampaignAudience, CampaignStatus, CampaignType } from '../types'

const TYPE_OPTIONS: CampaignType[] = [
  'social_share',
  'referral',
  'ride_challenge',
  'safety',
  'rating',
  'merchant_promotion',
  'community_campaign',
  'driver_recruitment',
  'passenger_recruitment',
]
const AUDIENCE_OPTIONS: CampaignAudience[] = ['passengers', 'drivers', 'both', 'public']
const STATUS_OPTIONS: CampaignStatus[] = ['draft', 'active', 'paused', 'ended', 'archived']

const STATUS_BADGE_CLASSES: Record<CampaignStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-amber-100 text-amber-700',
  ended: 'bg-slate-200 text-slate-600',
  archived: 'bg-slate-100 text-slate-400',
}

const todayIso = () => new Date().toISOString().slice(0, 10)

export function IncomePromotionCampaigns() {
  const {
    campaigns,
    advertisers,
    referrals,
    coinTransactions,
    incomePromotionSettings,
    addCampaign,
    updateCampaign,
    setCampaignStatus,
    updateCampaignMetrics,
    removeCampaign,
    logActivity,
  } = useRides()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [campaignType, setCampaignType] = useState<CampaignType>('social_share')
  const [targetAudience, setTargetAudience] = useState<CampaignAudience>('both')
  const [startDate, setStartDate] = useState(todayIso())
  const [endDate, setEndDate] = useState('')
  const [rewardCoins, setRewardCoins] = useState(String(incomePromotionSettings.defaultCampaignDailyLimit ?? ''))
  const [rewardNote, setRewardNote] = useState('')
  const [budget, setBudget] = useState('')
  const [dailyLimit, setDailyLimit] = useState(incomePromotionSettings.defaultCampaignDailyLimit != null ? String(incomePromotionSettings.defaultCampaignDailyLimit) : '')
  const [weeklyLimit, setWeeklyLimit] = useState(incomePromotionSettings.defaultCampaignWeeklyLimit != null ? String(incomePromotionSettings.defaultCampaignWeeklyLimit) : '')
  const [monthlyLimit, setMonthlyLimit] = useState(incomePromotionSettings.defaultCampaignMonthlyLimit != null ? String(incomePromotionSettings.defaultCampaignMonthlyLimit) : '')
  const [status, setStatus] = useState<CampaignStatus>('draft')
  const [advertiserId, setAdvertiserId] = useState('')
  const [error, setError] = useState('')

  const [metricsDrafts, setMetricsDrafts] = useState<Record<string, { reach: string; clicks: string; shares: string; participants: string }>>({})

  function resetForm() {
    setEditingId(null)
    setName('')
    setDescription('')
    setCampaignType('social_share')
    setTargetAudience('both')
    setStartDate(todayIso())
    setEndDate('')
    setRewardCoins('')
    setRewardNote('')
    setBudget('')
    setDailyLimit('')
    setWeeklyLimit('')
    setMonthlyLimit('')
    setStatus('draft')
    setAdvertiserId('')
    setError('')
  }

  function handleStartEdit(c: Campaign) {
    setEditingId(c.id)
    setName(c.name)
    setDescription(c.description)
    setCampaignType(c.type)
    setTargetAudience(c.targetAudience)
    setStartDate(c.startDate)
    setEndDate(c.endDate ?? '')
    setRewardCoins(String(c.rewardCoins))
    setRewardNote(c.rewardNote ?? '')
    setBudget(String(c.budget))
    setDailyLimit(c.dailyLimit != null ? String(c.dailyLimit) : '')
    setWeeklyLimit(c.weeklyLimit != null ? String(c.weeklyLimit) : '')
    setMonthlyLimit(c.monthlyLimit != null ? String(c.monthlyLimit) : '')
    setStatus(c.status)
    setAdvertiserId(c.advertiserId ?? '')
    setError('')
  }

  function handleSave() {
    const rewardCoinsNum = Number(rewardCoins) || 0
    const budgetNum = Number(budget)
    if (!name.trim()) {
      setError('Enter the campaign name.')
      return
    }
    if (!Number.isFinite(budgetNum) || budgetNum < 0) {
      setError('Enter a valid budget of 0 or more.')
      return
    }
    setError('')
    const args = {
      name: name.trim(),
      description: description.trim(),
      campaignType,
      targetAudience,
      startDate,
      endDate: endDate || null,
      rewardCoins: rewardCoinsNum,
      rewardNote: rewardNote.trim() || null,
      budget: budgetNum,
      dailyLimit: dailyLimit.trim() === '' ? null : Number(dailyLimit),
      weeklyLimit: weeklyLimit.trim() === '' ? null : Number(weeklyLimit),
      monthlyLimit: monthlyLimit.trim() === '' ? null : Number(monthlyLimit),
      status,
      advertiserId: advertiserId || null,
    }
    if (editingId) {
      updateCampaign(editingId, args)
      logActivity({ actorRole: 'admin', actorName: 'Admin', todaOrgId: null, action: 'IP · Updated campaign', summary: `${args.name} — ${args.campaignType}, ${args.status}.` })
    } else {
      addCampaign(args)
      logActivity({ actorRole: 'admin', actorName: 'Admin', todaOrgId: null, action: 'IP · Added campaign', summary: `${args.name} — ${args.campaignType}, ${args.status}.` })
    }
    resetForm()
  }

  function handleSaveMetrics(campaign: Campaign) {
    const draft = metricsDrafts[campaign.id]
    if (!draft) return
    const reach = Number(draft.reach) || 0
    const clicks = Number(draft.clicks) || 0
    const shares = Number(draft.shares) || 0
    const participants = Number(draft.participants) || 0
    updateCampaignMetrics(campaign.id, { reach, clicks, shares, participants })
    logActivity({ actorRole: 'admin', actorName: 'Admin', todaOrgId: null, action: 'IP · Updated campaign metrics', summary: `${campaign.name} — reach ${reach}, clicks ${clicks}, shares ${shares}, participants ${participants}.` })
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-slate-700">{editingId ? 'Edit campaign' : 'Create campaign'}</h3>
        <div className="space-y-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaign name" className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={2} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          <div className="grid grid-cols-2 gap-2">
            <select value={campaignType} onChange={(e) => setCampaignType(e.target.value as CampaignType)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs">
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <select value={targetAudience} onChange={(e) => setTargetAudience(e.target.value as CampaignAudience)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs">
              {AUDIENCE_OPTIONS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[11px] text-slate-500">Start date</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-slate-500">End date (optional)</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min={0} value={rewardCoins} onChange={(e) => setRewardCoins(e.target.value)} placeholder="Reward coins" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            <input type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="₱ budget" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          </div>
          <input value={rewardNote} onChange={(e) => setRewardNote(e.target.value)} placeholder="Reward note (optional)" className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          <div className="grid grid-cols-3 gap-2">
            <input type="number" min={0} value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} placeholder="Daily limit" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            <input type="number" min={0} value={weeklyLimit} onChange={(e) => setWeeklyLimit(e.target.value)} placeholder="Weekly limit" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
            <input type="number" min={0} value={monthlyLimit} onChange={(e) => setMonthlyLimit(e.target.value)} placeholder="Monthly limit" className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={status} onChange={(e) => setStatus(e.target.value as CampaignStatus)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs">
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select value={advertiserId} onChange={(e) => setAdvertiserId(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs">
              <option value="">No linked advertiser</option>
              {advertisers.map((a) => (
                <option key={a.id} value={a.id}>{a.businessName}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleSave} className="flex-1 rounded-lg bg-brand-600 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
              {editingId ? 'Save changes' : 'Create campaign'}
            </button>
            {editingId && (
              <button onClick={resetForm} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Campaigns ({campaigns.length})</h3>
        {campaigns.length === 0 && <p className="text-xs text-slate-400">No campaigns yet.</p>}
        <div className="space-y-3">
          {campaigns.map((c) => {
            const campaignReferrals = referrals.filter((r) => r.campaignId === c.id)
            const completedFromReferrals = campaignReferrals.filter((r) => r.firstRideAt).length
            const rewardsIssuedCoins = coinTransactions.filter((t) => t.campaignId === c.id && t.direction === 'issued').reduce((s, t) => s + t.amount, 0)
            const draft = metricsDrafts[c.id] ?? {
              reach: String(c.reach),
              clicks: String(c.clicks),
              shares: String(c.shares),
              participants: String(c.participants),
            }
            return (
              <div key={c.id} className="rounded-lg border border-slate-200 p-2.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-700">{c.name}</p>
                    <p className="mt-0.5 text-slate-500">
                      {c.type.replace(/_/g, ' ')} · {c.targetAudience} · {c.startDate}
                      {c.endDate ? ` – ${c.endDate}` : ' – ongoing'}
                    </p>
                    <p className="mt-0.5 text-slate-400">
                      Budget ₱{c.budget.toLocaleString()} · Reward {c.rewardCoins} coins
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE_CLASSES[c.status]}`}>{c.status}</span>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">
                  <span>Reach: {c.reach}</span>
                  <span>Clicks: {c.clicks}</span>
                  <span>Shares: {c.shares}</span>
                  <span>Participants: {c.participants}</span>
                  <span>Referrals: {campaignReferrals.length}</span>
                  <span>Rewards: {rewardsIssuedCoins} coins</span>
                  <span className="col-span-3 text-slate-400">
                    Completed rides (via referrals): {completedFromReferrals} · Revenue/ROI need ride-level campaign
                    attribution, not tracked yet.
                  </span>
                </div>

                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  <input
                    type="number"
                    min={0}
                    value={draft.reach}
                    onChange={(e) => setMetricsDrafts((prev) => ({ ...prev, [c.id]: { ...draft, reach: e.target.value } }))}
                    placeholder="Reach"
                    className="rounded-lg border border-slate-300 px-1.5 py-1 text-[11px]"
                  />
                  <input
                    type="number"
                    min={0}
                    value={draft.clicks}
                    onChange={(e) => setMetricsDrafts((prev) => ({ ...prev, [c.id]: { ...draft, clicks: e.target.value } }))}
                    placeholder="Clicks"
                    className="rounded-lg border border-slate-300 px-1.5 py-1 text-[11px]"
                  />
                  <input
                    type="number"
                    min={0}
                    value={draft.shares}
                    onChange={(e) => setMetricsDrafts((prev) => ({ ...prev, [c.id]: { ...draft, shares: e.target.value } }))}
                    placeholder="Shares"
                    className="rounded-lg border border-slate-300 px-1.5 py-1 text-[11px]"
                  />
                  <input
                    type="number"
                    min={0}
                    value={draft.participants}
                    onChange={(e) => setMetricsDrafts((prev) => ({ ...prev, [c.id]: { ...draft, participants: e.target.value } }))}
                    placeholder="Participants"
                    className="rounded-lg border border-slate-300 px-1.5 py-1 text-[11px]"
                  />
                </div>
                <button
                  onClick={() => handleSaveMetrics(c)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                >
                  Update metrics
                </button>

                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={() => handleStartEdit(c)} className="rounded-md px-2 py-1 font-medium text-brand-600 underline hover:bg-brand-50">
                    Edit
                  </button>
                  {c.status !== 'active' && (
                    <button
                      onClick={() => {
                        setCampaignStatus(c.id, 'active')
                        logActivity({ actorRole: 'admin', actorName: 'Admin', todaOrgId: null, action: 'IP · Activated campaign', summary: c.name })
                      }}
                      className="rounded-md px-2 py-1 font-medium text-emerald-600 underline hover:bg-emerald-50"
                    >
                      Activate
                    </button>
                  )}
                  {c.status === 'active' && (
                    <button
                      onClick={() => {
                        setCampaignStatus(c.id, 'paused')
                        logActivity({ actorRole: 'admin', actorName: 'Admin', todaOrgId: null, action: 'IP · Paused campaign', summary: c.name })
                      }}
                      className="rounded-md px-2 py-1 font-medium text-amber-600 underline hover:bg-amber-50"
                    >
                      Pause
                    </button>
                  )}
                  {c.status !== 'ended' && c.status !== 'archived' && (
                    <button
                      onClick={() => {
                        setCampaignStatus(c.id, 'ended')
                        logActivity({ actorRole: 'admin', actorName: 'Admin', todaOrgId: null, action: 'IP · Ended campaign', summary: c.name })
                      }}
                      className="rounded-md px-2 py-1 font-medium text-slate-600 underline hover:bg-slate-100"
                    >
                      End
                    </button>
                  )}
                  {c.status !== 'archived' && (
                    <button
                      onClick={() => {
                        setCampaignStatus(c.id, 'archived')
                        logActivity({ actorRole: 'admin', actorName: 'Admin', todaOrgId: null, action: 'IP · Archived campaign', summary: c.name })
                      }}
                      className="rounded-md px-2 py-1 font-medium text-slate-500 underline hover:bg-slate-100"
                    >
                      Archive
                    </button>
                  )}
                  <button
                    onClick={() => {
                      removeCampaign(c.id)
                      logActivity({ actorRole: 'admin', actorName: 'Admin', todaOrgId: null, action: 'IP · Deleted campaign', summary: `Removed ${c.name}.` })
                    }}
                    className="rounded-md px-2 py-1 font-medium text-rose-600 underline hover:bg-rose-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
