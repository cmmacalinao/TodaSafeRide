import { useState } from 'react'
import { useRides } from '../context/RideContext'
import { useSession } from '../context/SessionContext'
import type { CorporateRegistrationInfo, Stockholder, StockholderType } from '../types'

const STOCKHOLDER_TYPES: StockholderType[] = ['Individual', 'Corporation', 'Other']

function toRegForm(info: CorporateRegistrationInfo) {
  return {
    companyName: info.companyName,
    secRegistrationNo: info.secRegistrationNo,
    registrationDate: info.registrationDate ?? '',
    tin: info.tin,
    principalOfficeAddress: info.principalOfficeAddress,
    primaryPurpose: info.primaryPurpose,
    corporateTermYears: info.corporateTermYears != null ? String(info.corporateTermYears) : '',
    perpetual: info.corporateTermYears == null,
    authorizedCapitalStock: String(info.authorizedCapitalStock || ''),
    parValuePerShare: String(info.parValuePerShare || ''),
    numberOfSharesAuthorized: String(info.numberOfSharesAuthorized || ''),
    subscribedCapitalStock: String(info.subscribedCapitalStock || ''),
    paidUpCapitalStock: String(info.paidUpCapitalStock || ''),
    treasurerInTrust: info.treasurerInTrust ?? '',
  }
}

// Mirrors the SEC Articles of Incorporation / General Information Sheet —
// company-level capitalization figures plus the per-stockholder shareholding
// table (name, nationality, address, shares, amount subscribed, amount
// paid). Deliberately separate from EquityAllocation (the internal % cap
// table) and CapitalContribution (the running capital-raised ledger) — this
// page is meant to be filled in directly from an actual filed registration,
// not estimated.
export function CapitalizationStockholdingPage() {
  const {
    corporateRegistration,
    stockholders,
    updateCorporateRegistration,
    addStockholder,
    updateStockholder,
    removeStockholder,
    logActivity,
  } = useRides()
  const { accountingOfficerName } = useSession()

  function logSuperAdmin(action: string, summary: string) {
    logActivity({
      actorRole: 'super_admin',
      actorName: `Super Admin${accountingOfficerName ? ` - ${accountingOfficerName}` : ''}`,
      todaOrgId: null,
      action,
      summary,
    })
  }

  const [regForm, setRegForm] = useState(toRegForm(corporateRegistration))
  const [regError, setRegError] = useState('')
  const [regSaved, setRegSaved] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [nationality, setNationality] = useState('Filipino')
  const [address, setAddress] = useState('')
  const [stockholderType, setStockholderType] = useState<StockholderType>('Individual')
  const [sharesSubscribed, setSharesSubscribed] = useState('')
  const [amountSubscribed, setAmountSubscribed] = useState('')
  const [amountPaid, setAmountPaid] = useState('')
  const [dateSubscribed, setDateSubscribed] = useState('')
  const [certificateNo, setCertificateNo] = useState('')
  const [stockholderError, setStockholderError] = useState('')

  const totalSharesSubscribed = stockholders.reduce((sum, s) => sum + s.sharesSubscribed, 0)
  const totalAmountSubscribed = stockholders.reduce((sum, s) => sum + s.amountSubscribed, 0)
  const totalAmountPaid = stockholders.reduce((sum, s) => sum + s.amountPaid, 0)
  const authorizedShares = corporateRegistration.numberOfSharesAuthorized
  const sharesPct = authorizedShares > 0 ? (totalSharesSubscribed / authorizedShares) * 100 : 0

  function handleSaveRegistration() {
    const authorizedCapitalStock = Number(regForm.authorizedCapitalStock) || 0
    const parValuePerShare = Number(regForm.parValuePerShare) || 0
    const numberOfSharesAuthorized = Number(regForm.numberOfSharesAuthorized) || 0
    const subscribedCapitalStock = Number(regForm.subscribedCapitalStock) || 0
    const paidUpCapitalStock = Number(regForm.paidUpCapitalStock) || 0
    if (paidUpCapitalStock > subscribedCapitalStock) {
      setRegError('Paid-up capital cannot exceed subscribed capital.')
      setRegSaved(false)
      return
    }
    if (subscribedCapitalStock > authorizedCapitalStock && authorizedCapitalStock > 0) {
      setRegError('Subscribed capital cannot exceed authorized capital stock.')
      setRegSaved(false)
      return
    }
    setRegError('')
    updateCorporateRegistration({
      companyName: regForm.companyName.trim(),
      secRegistrationNo: regForm.secRegistrationNo.trim(),
      registrationDate: regForm.registrationDate || null,
      tin: regForm.tin.trim(),
      principalOfficeAddress: regForm.principalOfficeAddress.trim(),
      primaryPurpose: regForm.primaryPurpose.trim(),
      corporateTermYears: regForm.perpetual ? null : Number(regForm.corporateTermYears) || null,
      authorizedCapitalStock,
      parValuePerShare,
      numberOfSharesAuthorized,
      subscribedCapitalStock,
      paidUpCapitalStock,
      treasurerInTrust: regForm.treasurerInTrust.trim() || null,
      updatedAt: null,
    })
    logSuperAdmin('Updated SEC registration', `${regForm.companyName.trim() || 'Corporate registration'} — SEC No. ${regForm.secRegistrationNo.trim() || '—'}.`)
    setRegSaved(true)
  }

  function resetStockholderForm() {
    setEditingId(null)
    setName('')
    setNationality('Filipino')
    setAddress('')
    setStockholderType('Individual')
    setSharesSubscribed('')
    setAmountSubscribed('')
    setAmountPaid('')
    setDateSubscribed('')
    setCertificateNo('')
    setStockholderError('')
  }

  function handleStartEdit(s: Stockholder) {
    setEditingId(s.id)
    setName(s.name)
    setNationality(s.nationality)
    setAddress(s.address)
    setStockholderType(s.stockholderType)
    setSharesSubscribed(String(s.sharesSubscribed))
    setAmountSubscribed(String(s.amountSubscribed))
    setAmountPaid(String(s.amountPaid))
    setDateSubscribed(s.dateSubscribed ?? '')
    setCertificateNo(s.certificateNo ?? '')
    setStockholderError('')
  }

  function handleSaveStockholder() {
    const shares = Number(sharesSubscribed)
    const subscribed = Number(amountSubscribed)
    const paid = Number(amountPaid)
    if (!name.trim()) {
      setStockholderError('Enter the stockholder name.')
      return
    }
    if (!Number.isFinite(shares) || shares <= 0) {
      setStockholderError('Enter a valid number of shares subscribed.')
      return
    }
    if (!Number.isFinite(subscribed) || subscribed <= 0) {
      setStockholderError('Enter a valid amount subscribed.')
      return
    }
    if (!Number.isFinite(paid) || paid < 0) {
      setStockholderError('Enter a valid amount paid (0 or more).')
      return
    }
    if (paid > subscribed) {
      setStockholderError('Amount paid cannot exceed amount subscribed.')
      return
    }
    const args = {
      name: name.trim(),
      nationality: nationality.trim(),
      address: address.trim(),
      stockholderType,
      sharesSubscribed: shares,
      amountSubscribed: subscribed,
      amountPaid: paid,
      dateSubscribed: dateSubscribed || null,
      certificateNo: certificateNo.trim() || null,
    }
    if (editingId) {
      updateStockholder(editingId, args)
      logSuperAdmin('Updated stockholder', `${args.name} — ${shares.toLocaleString()} shares subscribed.`)
    } else {
      addStockholder(args)
      logSuperAdmin('Added stockholder', `${args.name} — ${shares.toLocaleString()} shares subscribed.`)
    }
    resetStockholderForm()
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-1 text-sm font-semibold text-slate-700">Capitalization &amp; Stockholding (SEC Registration)</h3>
      <p className="mb-3 text-xs text-slate-500">
        The formal SEC Articles of Incorporation / General Information Sheet figures — filled in from an actual
        filed registration, not estimated. Separate from the internal Cap Table above (percentage-only management
        data) and Shareholder capital (a running ledger of cash paid in).
      </p>

      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-medium text-slate-600">Company &amp; SEC registration details</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={regForm.companyName}
            onChange={(e) => setRegForm((f) => ({ ...f, companyName: e.target.value }))}
            placeholder="Registered company name"
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
          <input
            value={regForm.secRegistrationNo}
            onChange={(e) => setRegForm((f) => ({ ...f, secRegistrationNo: e.target.value }))}
            placeholder="SEC registration no."
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-500">Registration date</span>
            <input
              type="date"
              value={regForm.registrationDate}
              onChange={(e) => setRegForm((f) => ({ ...f, registrationDate: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />
          </label>
          <input
            value={regForm.tin}
            onChange={(e) => setRegForm((f) => ({ ...f, tin: e.target.value }))}
            placeholder="TIN"
            className="mt-[18px] rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
        </div>
        <input
          value={regForm.principalOfficeAddress}
          onChange={(e) => setRegForm((f) => ({ ...f, principalOfficeAddress: e.target.value }))}
          placeholder="Principal office address"
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
        />
        <textarea
          value={regForm.primaryPurpose}
          onChange={(e) => setRegForm((f) => ({ ...f, primaryPurpose: e.target.value }))}
          placeholder="Primary purpose (as stated in the Articles of Incorporation)"
          rows={2}
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
        />
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={regForm.perpetual}
              onChange={(e) => setRegForm((f) => ({ ...f, perpetual: e.target.checked }))}
            />
            Perpetual term
          </label>
          {!regForm.perpetual && (
            <input
              type="number"
              min={1}
              value={regForm.corporateTermYears}
              onChange={(e) => setRegForm((f) => ({ ...f, corporateTermYears: e.target.value }))}
              placeholder="Term (years)"
              className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-xs"
            />
          )}
        </div>

        <p className="pt-1 text-xs font-medium text-slate-600">Capital stock</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-500">Authorized capital stock</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">₱</span>
              <input
                type="number"
                min={0}
                value={regForm.authorizedCapitalStock}
                onChange={(e) => setRegForm((f) => ({ ...f, authorizedCapitalStock: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-500">Par value per share</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">₱</span>
              <input
                type="number"
                min={0}
                value={regForm.parValuePerShare}
                onChange={(e) => setRegForm((f) => ({ ...f, parValuePerShare: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
              />
            </div>
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-[11px] text-slate-500">Number of shares authorized</span>
          <input
            type="number"
            min={0}
            value={regForm.numberOfSharesAuthorized}
            onChange={(e) => setRegForm((f) => ({ ...f, numberOfSharesAuthorized: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-500">Subscribed capital stock</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">₱</span>
              <input
                type="number"
                min={0}
                value={regForm.subscribedCapitalStock}
                onChange={(e) => setRegForm((f) => ({ ...f, subscribedCapitalStock: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-500">Paid-up capital stock</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">₱</span>
              <input
                type="number"
                min={0}
                value={regForm.paidUpCapitalStock}
                onChange={(e) => setRegForm((f) => ({ ...f, paidUpCapitalStock: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
              />
            </div>
          </label>
        </div>
        <input
          value={regForm.treasurerInTrust}
          onChange={(e) => setRegForm((f) => ({ ...f, treasurerInTrust: e.target.value }))}
          placeholder="Treasurer-in-Trust name"
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
        />
        {regError && <p className="text-xs font-medium text-rose-600">{regError}</p>}
        {regSaved && !regError && (
          <p className="text-xs font-medium text-emerald-700">Saved — {new Date().toLocaleString()}</p>
        )}
        <button
          onClick={handleSaveRegistration}
          className="w-full rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          Save registration details
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-slate-200 p-2 text-center">
          <p className="text-[10px] text-slate-500">Shares subscribed</p>
          <p className="text-sm font-semibold text-slate-700">
            {totalSharesSubscribed.toLocaleString()}
            {authorizedShares > 0 && (
              <span className={sharesPct > 100 ? 'text-rose-600' : 'text-slate-400'}> ({sharesPct.toFixed(1)}%)</span>
            )}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 p-2 text-center">
          <p className="text-[10px] text-slate-500">Amount subscribed</p>
          <p className="text-sm font-semibold text-indigo-700">₱{totalAmountSubscribed.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-2 text-center">
          <p className="text-[10px] text-slate-500">Amount paid</p>
          <p className="text-sm font-semibold text-emerald-700">₱{totalAmountPaid.toLocaleString()}</p>
        </div>
      </div>

      <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        {editingId && <p className="text-xs font-medium text-brand-700">Editing stockholder</p>}
        <div className="grid grid-cols-2 gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Stockholder name"
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
          <input
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
            placeholder="Nationality"
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
        </div>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Address"
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
        />
        <select
          value={stockholderType}
          onChange={(e) => setStockholderType(e.target.value as StockholderType)}
          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
        >
          {STOCKHOLDER_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-500">Shares subscribed</span>
            <input
              type="number"
              min={0}
              value={sharesSubscribed}
              onChange={(e) => setSharesSubscribed(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-500">Amount subscribed</span>
            <input
              type="number"
              min={0}
              value={amountSubscribed}
              onChange={(e) => setAmountSubscribed(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-500">Amount paid</span>
            <input
              type="number"
              min={0}
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-500">Date subscribed</span>
            <input
              type="date"
              value={dateSubscribed}
              onChange={(e) => setDateSubscribed(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />
          </label>
          <input
            value={certificateNo}
            onChange={(e) => setCertificateNo(e.target.value)}
            placeholder="Stock certificate no. (optional)"
            className="mt-[18px] rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
        </div>
        {stockholderError && <p className="text-xs font-medium text-rose-600">{stockholderError}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleSaveStockholder}
            className="flex-1 rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            {editingId ? 'Save changes' : 'Add stockholder'}
          </button>
          {editingId && (
            <button
              onClick={resetStockholderForm}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {stockholders.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-2.5 py-1.5 text-left font-medium">Stockholder</th>
                <th className="px-2.5 py-1.5 text-right font-medium">Shares</th>
                <th className="px-2.5 py-1.5 text-right font-medium">Ownership</th>
                <th className="px-2.5 py-1.5 text-right font-medium">Subscribed</th>
                <th className="px-2.5 py-1.5 text-right font-medium">Paid</th>
                <th className="px-2.5 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {stockholders.map((s) => (
                <tr key={s.id} className="border-t border-slate-200 align-top">
                  <td className="px-2.5 py-1.5">
                    <p className="font-medium text-slate-700">{s.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {s.nationality} · {s.stockholderType}
                      {s.certificateNo ? ` · Cert. ${s.certificateNo}` : ''}
                    </p>
                  </td>
                  <td className="px-2.5 py-1.5 text-right text-slate-600">{s.sharesSubscribed.toLocaleString()}</td>
                  <td className="px-2.5 py-1.5 text-right text-slate-600">
                    {totalSharesSubscribed > 0 ? ((s.sharesSubscribed / totalSharesSubscribed) * 100).toFixed(1) : '0.0'}%
                  </td>
                  <td className="px-2.5 py-1.5 text-right text-slate-600">₱{s.amountSubscribed.toLocaleString()}</td>
                  <td className="px-2.5 py-1.5 text-right text-slate-600">₱{s.amountPaid.toLocaleString()}</td>
                  <td className="whitespace-nowrap px-2.5 py-1.5 text-right">
                    <button
                      onClick={() => handleStartEdit(s)}
                      className="rounded-md px-1.5 py-0.5 text-brand-600 hover:bg-brand-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        removeStockholder(s.id)
                        logSuperAdmin('Deleted stockholder', `Removed ${s.name} — ${s.sharesSubscribed.toLocaleString()} shares.`)
                      }}
                      className="rounded-md px-1.5 py-0.5 text-rose-600 hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
