import { useState } from 'react'
import { useRides } from '../context/RideContext'
import { coinsToPesos } from '../lib/incomePromotion'

export function IncomePromotionRideCredits() {
  const { rideCreditTiers, coinTransactions, addRideCreditTier, updateRideCreditTier, removeRideCreditTier, logActivity } =
    useRides()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [coinsInput, setCoinsInput] = useState('')
  const [pesoInput, setPesoInput] = useState('')
  const [error, setError] = useState('')

  const creditTxns = coinTransactions.filter((t) => t.source === 'ride_credit_redemption')
  const totalCoinsUsed = creditTxns.filter((t) => t.direction === 'redeemed').reduce((s, t) => s + t.amount, 0)
  const totalCreditsIssued = coinsToPesos(totalCoinsUsed, rideCreditTiers)
  // Redemption against an actual ride fare at checkout isn't wired into the
  // booking flow yet (that's a passenger-facing/payment integration, a
  // separate later phase) — every credit "issued" here is still
  // outstanding until that exists, so redeemed/remaining split is honest
  // rather than faked.
  const totalCreditsRedeemedAtCheckout = 0
  const creditsRemaining = totalCreditsIssued - totalCreditsRedeemedAtCheckout

  function resetForm() {
    setEditingId(null)
    setCoinsInput('')
    setPesoInput('')
    setError('')
  }

  function handleSave() {
    const coins = Number(coinsInput)
    const peso = Number(pesoInput)
    if (!Number.isFinite(coins) || coins <= 0) {
      setError('Enter a valid coin amount greater than 0.')
      return
    }
    if (!Number.isFinite(peso) || peso <= 0) {
      setError('Enter a valid peso value greater than 0.')
      return
    }
    setError('')
    if (editingId) {
      updateRideCreditTier(editingId, coins, peso)
      logActivity({
        actorRole: 'admin',
        actorName: 'Admin',
        todaOrgId: null,
        action: 'IP · Updated ride credit tier',
        summary: `${coins} coins = ₱${peso}.`,
      })
    } else {
      addRideCreditTier(coins, peso)
      logActivity({
        actorRole: 'admin',
        actorName: 'Admin',
        todaOrgId: null,
        action: 'IP · Added ride credit tier',
        summary: `${coins} coins = ₱${peso}.`,
      })
    }
    resetForm()
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs text-slate-500">Coins used for credit</p>
          <p className="text-lg font-semibold text-brand-700">{totalCoinsUsed.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs text-slate-500">Total credits issued</p>
          <p className="text-lg font-semibold text-brand-700">₱{totalCreditsIssued.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs text-slate-500">Credits redeemed at checkout</p>
          <p className="text-lg font-semibold text-brand-700">₱{totalCreditsRedeemedAtCheckout.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-xs text-slate-500">Credits remaining</p>
          <p className="text-lg font-semibold text-brand-700">₱{creditsRemaining.toLocaleString()}</p>
        </div>
      </div>
      <p className="rounded-lg bg-slate-100 p-2 text-[11px] leading-snug text-slate-500">
        Paying a ride fare with credit isn't wired into checkout yet — every credit converted from coins (see the
        Rewards tab) is tracked as issued and outstanding here until that integration exists.
      </p>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-slate-700">Coin → credit conversion tiers</h3>
        <p className="mb-3 text-xs text-slate-500">e.g. 100 coins = ₱5 — passengers/drivers pick one of these when converting coins to ride credit.</p>
        <div className="space-y-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
          {editingId && <p className="text-xs font-medium text-brand-700">Editing tier</p>}
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min={1} value={coinsInput} onChange={(e) => setCoinsInput(e.target.value)} placeholder="Coins" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
            <input type="number" min={1} value={pesoInput} onChange={(e) => setPesoInput(e.target.value)} placeholder="₱ value" className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleSave} className="flex-1 rounded-lg bg-brand-600 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
              {editingId ? 'Save changes' : 'Add tier'}
            </button>
            {editingId && (
              <button onClick={resetForm} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
            )}
          </div>
        </div>

        {rideCreditTiers.length > 0 && (
          <div className="mt-3 space-y-2">
            {rideCreditTiers.map((tier) => (
              <div key={tier.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2.5 text-xs">
                <p className="font-medium text-slate-700">
                  {tier.coins.toLocaleString()} coins = ₱{tier.pesoValue.toLocaleString()}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingId(tier.id)
                      setCoinsInput(String(tier.coins))
                      setPesoInput(String(tier.pesoValue))
                      setError('')
                    }}
                    className="rounded-md px-2 py-1 font-medium text-brand-600 underline hover:bg-brand-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      removeRideCreditTier(tier.id)
                      logActivity({
                        actorRole: 'admin',
                        actorName: 'Admin',
                        todaOrgId: null,
                        action: 'IP · Removed ride credit tier',
                        summary: `Removed ${tier.coins} coins = ₱${tier.pesoValue}.`,
                      })
                    }}
                    className="rounded-md px-2 py-1 font-medium text-rose-600 underline hover:bg-rose-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
