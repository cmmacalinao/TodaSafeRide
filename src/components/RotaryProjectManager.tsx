import { useState } from 'react'
import { useRides } from '../context/RideContext'
import { useSession } from '../context/SessionContext'
import { projectAmountSpent, projectRemainingBalance } from '../lib/socialImpact'
import type { RotaryProject, RotaryProjectCategory, RotaryProjectStatus } from '../types'

const CATEGORIES: RotaryProjectCategory[] = [
  'Community Partner Project',
  'NGO-Supported Project',
  'Grant-Funded Project',
  'Passenger Safety',
  'Student Safety',
  'Road Safety',
  'Health',
  'Education',
  'Water',
  'Other Community Project',
]

const STATUS_LABELS: Record<RotaryProjectStatus, string> = {
  proposed: 'Proposed',
  approved: 'Approved',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const STATUS_BADGE_CLASSES: Record<RotaryProjectStatus, string> = {
  proposed: 'bg-slate-100 text-slate-600',
  approved: 'bg-sky-100 text-sky-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-rose-100 text-rose-700',
}

const DEFAULT_PARTNER = ''

// Community projects funded from the Social Impact Fund — the partner
// (a Community Partner/NGO — the actual organization name is entered per
// project since it differs per city, never hard-coded) holds 0% in the cap
// table, same as everywhere else this kind of partner is tracked. Category
// is never auto-classified as grant-funded — that must be a deliberate choice.
export function RotaryProjectManager() {
  const {
    rotaryProjects,
    socialImpactTransactions,
    addRotaryProject,
    updateRotaryProject,
    removeRotaryProject,
    addSocialImpactTransaction,
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

  const [editingId, setEditingId] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('')
  const [partner, setPartner] = useState(DEFAULT_PARTNER)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<RotaryProjectCategory>('Community Partner Project')
  const [approvedBudget, setApprovedBudget] = useState('')
  const [sifAllocation, setSifAllocation] = useState('')
  const [additionalFunding, setAdditionalFunding] = useState('')
  const [status, setStatus] = useState<RotaryProjectStatus>('proposed')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState('')

  const [expenseDrafts, setExpenseDrafts] = useState<Record<string, { description: string; amount: string }>>({})

  function resetForm() {
    setEditingId(null)
    setProjectName('')
    setPartner(DEFAULT_PARTNER)
    setDescription('')
    setCategory('Community Partner Project')
    setApprovedBudget('')
    setSifAllocation('')
    setAdditionalFunding('')
    setStatus('proposed')
    setStartDate('')
    setEndDate('')
    setError('')
  }

  function handleStartEdit(p: RotaryProject) {
    setEditingId(p.id)
    setProjectName(p.projectName)
    setPartner(p.partner)
    setDescription(p.description)
    setCategory(p.category)
    setApprovedBudget(String(p.approvedBudget))
    setSifAllocation(String(p.socialImpactFundAllocation))
    setAdditionalFunding(String(p.additionalFunding))
    setStatus(p.status)
    setStartDate(p.startDate ?? '')
    setEndDate(p.endDate ?? '')
    setError('')
  }

  function handleSave() {
    const budget = Number(approvedBudget) || 0
    const sif = Number(sifAllocation) || 0
    const additional = Number(additionalFunding) || 0
    if (!projectName.trim()) {
      setError('Enter the project name.')
      return
    }
    if (!partner.trim()) {
      setError('Enter the partner organization.')
      return
    }
    const args = {
      projectName: projectName.trim(),
      partner: partner.trim(),
      description: description.trim(),
      category,
      approvedBudget: budget,
      socialImpactFundAllocation: sif,
      additionalFunding: additional,
      status,
      startDate: startDate || null,
      endDate: endDate || null,
    }
    if (editingId) {
      updateRotaryProject(editingId, args)
      logSuperAdmin('Updated Community Partner/NGO project', `"${args.projectName}" — ${args.partner}, ${args.status}.`)
    } else {
      addRotaryProject(args)
      logSuperAdmin('Added Community Partner/NGO project', `"${args.projectName}" — ${args.partner}, ${args.status}.`)
    }
    resetForm()
  }

  function handleLogExpense(project: RotaryProject) {
    const draft = expenseDrafts[project.id]
    const amt = Number(draft?.amount)
    if (!draft?.description?.trim() || !Number.isFinite(amt) || amt <= 0) return
    addSocialImpactTransaction({
      date: new Date().toISOString().slice(0, 10),
      description: `${project.projectName} — ${draft.description.trim()}`,
      amount: amt,
      projectId: project.id,
      category: 'project_expense',
      status: 'disbursed',
      approvedBy: accountingOfficerName ?? 'Officer',
    })
    logSuperAdmin('Logged project expense', `${project.projectName} — ₱${amt.toLocaleString()}: "${draft.description.trim()}".`)
    setExpenseDrafts((prev) => ({ ...prev, [project.id]: { description: '', amount: '' } }))
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-1 text-sm font-semibold text-slate-700">Community Partner/NGO projects</h3>
      <p className="mb-3 text-xs text-slate-500">
        Funded wholly or partly from the Social Impact Fund above — spend is tracked via that fund's transaction
        log, not a separate total, so a project's balance can never drift from the fund's own records. Enter the
        beneficiary organization's name below — it can be a different Community Partner/NGO per city.
      </p>

      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        {editingId && <p className="text-xs font-medium text-brand-700">Editing project</p>}
        <div className="grid grid-cols-2 gap-2">
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Project name"
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
          <input
            value={partner}
            onChange={(e) => setPartner(e.target.value)}
            placeholder="Beneficiary organization name (Community Partner/NGO)"
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          rows={2}
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as RotaryProjectCategory)}
          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-500">Approved budget</span>
            <input
              type="number"
              min={0}
              value={approvedBudget}
              onChange={(e) => setApprovedBudget(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-500">SIF allocation</span>
            <input
              type="number"
              min={0}
              value={sifAllocation}
              onChange={(e) => setSifAllocation(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-slate-500">Additional funding</span>
            <input
              type="number"
              min={0}
              value={additionalFunding}
              onChange={(e) => setAdditionalFunding(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            />
          </label>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as RotaryProjectStatus)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
          >
            {(Object.keys(STATUS_LABELS) as RotaryProjectStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          />
        </div>
        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            {editingId ? 'Save changes' : 'Add project'}
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

      {rotaryProjects.length > 0 && (
        <div className="mt-3 space-y-2">
          {rotaryProjects.map((p) => {
            const spent = projectAmountSpent(p.id, socialImpactTransactions)
            const remaining = projectRemainingBalance(p, socialImpactTransactions)
            const totalFunding = p.socialImpactFundAllocation + p.additionalFunding
            const draft = expenseDrafts[p.id] ?? { description: '', amount: '' }
            return (
              <div key={p.id} className="rounded-lg border border-slate-200 p-2.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-700">
                      {p.projectName} <span className="font-normal text-slate-400">· {p.category}</span>
                    </p>
                    <p className="mt-0.5 text-slate-500">
                      {p.partner} · Budget ₱{p.approvedBudget.toLocaleString()}
                    </p>
                    <p className="mt-0.5 text-slate-500">
                      Funding ₱{totalFunding.toLocaleString()} (SIF ₱{p.socialImpactFundAllocation.toLocaleString()} +
                      other ₱{p.additionalFunding.toLocaleString()}) · Spent ₱{spent.toLocaleString()} · Remaining{' '}
                      <span className={remaining < 0 ? 'font-semibold text-rose-600' : 'font-semibold text-emerald-700'}>
                        ₱{remaining.toLocaleString()}
                      </span>
                    </p>
                    {p.description && <p className="mt-0.5 text-slate-400">{p.description}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE_CLASSES[p.status]}`}>
                    {STATUS_LABELS[p.status]}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <input
                    value={draft.description}
                    onChange={(e) =>
                      setExpenseDrafts((prev) => ({ ...prev, [p.id]: { ...draft, description: e.target.value } }))
                    }
                    placeholder="Expense description"
                    className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-[11px]"
                  />
                  <input
                    type="number"
                    min={0}
                    value={draft.amount}
                    onChange={(e) => setExpenseDrafts((prev) => ({ ...prev, [p.id]: { ...draft, amount: e.target.value } }))}
                    placeholder="₱"
                    className="w-20 rounded-md border border-slate-300 px-2 py-1 text-[11px]"
                  />
                  <button
                    onClick={() => handleLogExpense(p)}
                    className="rounded-md bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-700"
                  >
                    Log expense
                  </button>
                </div>
                <div className="mt-1.5 flex gap-2">
                  <button
                    onClick={() => handleStartEdit(p)}
                    className="rounded-md px-2 py-1 font-medium text-brand-600 underline hover:bg-brand-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      removeRotaryProject(p.id)
                      logSuperAdmin('Deleted Community Partner/NGO project', `Removed "${p.projectName}" — ${p.partner}.`)
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
      )}
    </section>
  )
}
