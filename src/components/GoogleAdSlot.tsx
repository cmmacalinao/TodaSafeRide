import { useEffect, useRef } from 'react'
import { useRides } from '../context/RideContext'
import type { AdSensePlacementSlots } from '../types'

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

const PLACEMENT_LABELS: Record<keyof AdSensePlacementSlots, string> = {
  landing: 'Landing page',
  passengerTop: 'Passenger page (top)',
  passengerBottom: 'Passenger page (bottom)',
  driverTop: 'Driver page (top)',
  driverBottom: 'Driver page (bottom)',
  parentBottom: 'Parent page (bottom)',
}

let adsbygoogleScriptRequested = false

// Real Google AdSense ad unit — renders nothing until Admin has entered a
// genuine Publisher ID and a slot ID for this exact placement under
// Income & Promotion → Settings → Google AdSense (see
// IncomePromotionSettingsSection.tsx). There is no fallback demo ad here on
// purpose: an ad network account, domain verification, and Google's review
// are all things only the site owner can complete — this component is only
// ever the wiring, never a stand-in for that account.
export function GoogleAdSlot({ placement }: { placement: keyof AdSensePlacementSlots }) {
  const { adSenseSettings } = useRides()
  const slotId = adSenseSettings.slots[placement]
  const active = adSenseSettings.enabled && !!adSenseSettings.publisherId && !!slotId
  const insRef = useRef<HTMLModElement>(null)

  useEffect(() => {
    if (!active || !adSenseSettings.publisherId) return
    if (!adsbygoogleScriptRequested) {
      adsbygoogleScriptRequested = true
      const script = document.createElement('script')
      script.async = true
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adSenseSettings.publisherId}`
      script.crossOrigin = 'anonymous'
      document.head.appendChild(script)
    }
    try {
      window.adsbygoogle = window.adsbygoogle || []
      window.adsbygoogle.push({})
    } catch {
      // AdSense script blocked (ad blocker, offline, not yet loaded) —
      // nothing to recover from here, the slot just stays empty.
    }
  }, [active, adSenseSettings.publisherId, slotId])

  if (!active) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-3 text-center text-[11px] text-slate-300">
        Ad space — {PLACEMENT_LABELS[placement]}
      </div>
    )
  }

  return (
    <ins
      ref={insRef}
      className="adsbygoogle block"
      style={{ display: 'block' }}
      data-ad-client={adSenseSettings.publisherId ?? undefined}
      data-ad-slot={slotId ?? undefined}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  )
}
