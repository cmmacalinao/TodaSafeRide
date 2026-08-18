import { useState } from 'react'
import { useRides } from '../context/RideContext'
import { useSession } from '../context/SessionContext'
import { DocumentUploadField } from './DocumentUploadField'
import type { FounderContribution, FounderContributionKind } from '../types'

const KIND_LABELS: Record<FounderContributionKind, string> = {
  cash: 'Cash',
  non_cash: 'Non-cash (IP, software, services)',
}

const STATUS_BADGE_CLASSES: Record<FounderContribution['status'], string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
}

const CONTRIBUTION_TYPE_PRESETS = [
  'Business concept',
  'Software development',
  'Source code / IP assignment',
  'Product development',
  'Technical leadership',
  'Business development',
  'Other',
]

const todayIso = () => new Date().toISOString().slice(0, 10)

// What backs the Founder's cap-table percentage — per the master structure
// doc, that percentage is contribution-based (concept, software, IP,
// leadership), not automatically a cash requirement, so cash and non-cash
// contributions are tracked and approved side by side rather than assumed
// equal to the equity percentage.
export function FounderContributionManager() {
  const {
    founderContributions,
    equityAllocations,
    addFounderContribution,
    updateFounderContribution,
    setFounderContributionStatus,
    removeFounderContribution,
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
  const founderHolder = equityAllocations.find((a) => a.category === 'Founder')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [founderName, setFounderName] = useState(founderHolder?.holderName ?? '')
  const [date, setDate] = useState(todayIso())
  const [contributionType, setContributionType] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState<FounderContributionKind>('non_cash')
  const [estimatedValue, setEstimatedValue] = useState('')
  const [docDataUrl, setDocDataUrl] = useState<string | null>(null)
  const [error, setError] = useState('')

  const [approvedValueDrafts, setApprovedValueDrafts] = useState<Record<string, string>>({})

  const totalCash = founderContributions
    .filter((c) => c.kind === 'cash' && c.status === 'approved')
    .reduce((sum, c) => sum + (c.approvedValue ?? c.estimatedValue), 0)
  const totalNonCash = founderContributions
    .filter((c) => c.kind === 'non_cash' && c.status === 'approved')
    .reduce((sum, c) => sum + (c.approvedValue ?? c.estimatedValue), 0)

  function resetForm() {
    setEditingId(null)
    setFounderName(founderHolder?.holderName ?? '')
    setDate(todayIso())
    setContributionType('')
    setDescription('')
    setKind('non_cash')
    setEstimatedValue('')
    setDocDataUrl(null)
    setError('')
  }

  function handleStartEdit(c: FounderContribution) {
    setEditingId(c.id)
    setFounderName(c.founderName)
    setDate(c.date)
    setContributionType(c.contributionType)
    setDescription(c.description)
    setKind(c.kind)
    setEstimatedValue(String(c.estimatedValue))
    setDocDataUrl(c.supportingDocDataUrl)
    setError('')
  }

  function handleSave() {
    const value = Number(estimatedValue)
    if (!founderName.trim()) {
      setError('Enter the founder name.')
      return
    }
    if (!contributionType.trim()) {
      setError('Enter or select a contribution type.')
      return
    }
    if (!description.trim()) {
      setError('Add a short description.')
      return
    }
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter a valid estimated value greater than 0.')
      return
    }
    const args = {
      founderName: founderName.trim(),
      date,
      contributionType: contributionType.trim(),
      description: description.trim(),
      kind,
      estimatedValue: value,
      supportingDocDataUrl: docDataUrl,
    }
    if (editingId) {
      updateFounderContribution(editingId, args)
      logSuperAdmin('Updated founder contribution', `${args.founderName} — ${args.contributionType}, est. ₱${args.estimatedValue.toLocaleString()}.`)
    } else {
      addFounderContribution(args)
      logSuperAdmin('Added founder contribution', `${args.founderName} — ${args.contributionType}, est. ₱${args.estimatedValue.toLocaleString()}.`)
    }
    resetForm()
  }

  function handleApprove(c: FounderContribution) {
    const draft = approvedValueDrafts[c.id]
    const approvedValue = draft !== undefined && draft !== '' ? Number(draft) : c.estimatedValue
    if (!Number.isFinite(approvedValue) || approvedValue <= 0) return
    setFounderContributionStatus(c.id, 'approved', approvedValue, accountingOfficerName ?? 'Officer')
    logSuperAdmin('Approved founder contribution', `${c.founderName}'s "${c.contributionType}" approved at ₱${approvedValue.toLocaleString()}.`)
  }

  function handleReject(c: FounderContribution) {
    setFounderContributionStatus(c.id, 'rejected', null, accountingOfficerName ?? 'Officer')
    logSuperAdmin('Rejected founder contribution', `${c.founderName}'s "${c.contributionType}" rejected.`)
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-1 text-sm font-semibold text-slate-700">Founder contributions</h3>
      <p className="mb-3 text-xs text-slate-500">
        What backs the Founder's cap-table percentage — cash and non-cash (concept, software, IP, leadership) are
        tracked and approved separately, since the Founder allocation isn't automatically a cash requirement.
      </p>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Approved cash</p>
          <p className="text-lg font-semibold text-emerald-700">₱{totalCash.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Approved non-cash</p>
          <p className="text-lg font-semibold text-indigo-700">₱{totalNonCash.toLocaleString()}</p>
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        {editingId && <p className="text-xs font-medium text-brand-700">Editing contribution</p>}
        <div className="grid grid-cols-2 gap-2">
          <input
            value={founderName}
            onChange={(e) => setFounderName(e.target.value)}
            placeholder="Founder name"
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-500">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-[11px] text-slate-500">Contribution type</span>
          <input
            list="founder-contribution-types"
            value={contributionType}
            onChange={(e) => setContributionType(e.target.value)}
            placeholder="e.g. Software development"
            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
          <datalist id="founder-contribution-types">
            {CONTRIBUTION_TYPE_PRESETS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          rows={2}
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as FounderContributionKind)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
          >
            {(Object.keys(KIND_LABELS) as FounderContributionKind[]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500">₱</span>
            <input
              type="number"
              min={0}
              value={estimatedValue}
              onChange={(e) => setEstimatedValue(e.target.value)}
              placeholder="Estimated value"
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />
          </div>
        </div>
        <DocumentUploadField label="Supporting document (optional)" dataUrl={docDataUrl} onUpload={setDocDataUrl} />
        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            {editingId ? 'Save changes' : 'Log contribution'}
          </button>
          {editingId && (
            <button
              onClick={resetForm}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {founderContributions.length > 0 && (
        <div className="mt-3 space-y-2">
          {founderContributions.map((c) => (
            <div key={c.id} className="rounded-lg border border-slate-200 p-2.5 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-700">
                    {c.contributionType} <span className="font-normal text-slate-400">· {KIND_LABELS[c.kind]}</span>
                  </p>
                  <p className="mt-0.5 text-slate-500">{c.description}</p>
                  <p className="mt-0.5 text-slate-400">
                    {c.founderName} · {new Date(c.date).toLocaleDateString()} · Est. ₱{c.estimatedValue.toLocaleString()}
                  </p>
                  {c.status !== 'pending' && (
                    <p className="mt-0.5 text-slate-400">
                      {c.status === 'approved' ? `Approved at ₱${c.approvedValue?.toLocaleString()}` : 'Rejected'} by{' '}
                      {c.approvedBy} on {c.approvalDate ? new Date(c.approvalDate).toLocaleDateString() : ''}
                    </p>
                  )}
                  {c.supportingDocDataUrl && (
                    <img src={c.supportingDocDataUrl} alt="Supporting document" className="mt-1 h-10 w-10 rounded object-cover" />
                  )}
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE_CLASSES[c.status]}`}>
                  {c.status[0].toUpperCase() + c.status.slice(1)}
                </span>
              </div>

              {c.status === 'pending' && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500">Approve at ₱</span>
                    <input
                      type="number"
                      min={0}
                      value={approvedValueDrafts[c.id] ?? String(c.estimatedValue)}
                      onChange={(e) => setApprovedValueDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                      className="w-24 rounded-lg border border-slate-300 px-2 py-1"
                    />
                  </div>
                  <button
                    onClick={() => handleApprove(c)}
                    className="rounded-md bg-brand-600 px-2 py-1 font-semibold text-white hover:bg-brand-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(c)}
                    className="rounded-md border border-slate-300 px-2 py-1 font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleStartEdit(c)}
                    className="rounded-md px-2 py-1 font-medium text-brand-600 underline hover:bg-brand-50"
                  >
                    Edit
                  </button>
                </div>
              )}
              <div className="mt-1">
                <button
                  onClick={() => {
                    removeFounderContribution(c.id)
                    logSuperAdmin('Deleted founder contribution', `Removed ${c.founderName}'s "${c.contributionType}".`)
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
  )
}
