import { useEffect, useState } from 'react'
import { useRides } from '../context/RideContext'

// Header ad placement — the actual monetization surface for the Advertisers/
// Campaigns Admin builds under Income & Promotion (see AdvertiserManager/
// CampaignManager). Reads real, active merchant-promotion campaigns rather
// than showing hardcoded copy, so what an admin configures there is exactly
// what shows here — rotates through more than one if several are active.
export function AdBanner() {
  const { advertisers, campaigns } = useRides()
  const [index, setIndex] = useState(0)

  const today = new Date().toISOString().slice(0, 10)
  const activeAds = campaigns.filter(
    (c) => c.type === 'merchant_promotion' && c.status === 'active' && c.startDate <= today && (!c.endDate || c.endDate >= today),
  )

  useEffect(() => {
    if (activeAds.length <= 1) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % activeAds.length), 6000)
    return () => clearInterval(timer)
  }, [activeAds.length])

  if (activeAds.length === 0) {
    return (
      <div className="min-w-0 flex-1 truncate px-2 text-center text-[11px] text-slate-300">
        📢 Advertise your business here
      </div>
    )
  }

  const ad = activeAds[index % activeAds.length]
  const advertiser = advertisers.find((a) => a.id === ad.advertiserId)

  return (
    <a
      href={`tel:${advertiser?.contactPhone ?? ''}`}
      className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-center hover:bg-slate-50"
      title={ad.description}
    >
      <span className="shrink-0 text-sm leading-none">📢</span>
      <span className="min-w-0 truncate text-[11px] font-medium text-slate-600">
        {advertiser?.businessName ?? ad.name}
        <span className="hidden font-normal text-slate-400 sm:inline"> — {ad.description}</span>
      </span>
    </a>
  )
}
