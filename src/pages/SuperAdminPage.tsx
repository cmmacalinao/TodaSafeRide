import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useRides } from '../context/RideContext'
import { TodaAdminPage } from './TodaAdminPage'
import { OperatorPortalPage } from './OperatorPortalPage'
import { FranchisePage } from './FranchisePage'

type SuperAdminTab = 'hub' | 'todas' | 'operators' | 'franchises'

// Hub for the extra-gated admin areas (Accounting & Compliance, Income &
// Promotion) plus read-only oversight into any Level-1 TODA's, Level-2
// Operator's, or Level-3 Franchise's own dashboard — reuses
// TodaAdminPage/OperatorPortalPage/FranchisePage directly (passing
// orgId/operatorId/franchiseId overrides their normal session-based
// self-lookup and forces them into view-only mode) rather than duplicating
// those dashboards' layout here.
export function SuperAdminPage() {
  const { todaOrganizations, operators, franchises } = useRides()
  const [tab, setTab] = useState<SuperAdminTab>('hub')
  const [selectedTodaOrgId, setSelectedTodaOrgId] = useState(todaOrganizations[0]?.id ?? '')
  const [selectedOperatorId, setSelectedOperatorId] = useState(operators[0]?.id ?? '')
  const [selectedFranchiseId, setSelectedFranchiseId] = useState(franchises[0]?.id ?? '')

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <div>
        <h1 className="text-sm font-semibold text-slate-700">Super Admin</h1>
        <p className="mt-1 text-xs text-slate-500">
          Extra-gated areas beyond day-to-day Admin operations, plus read-only oversight of any Level-1/2/3 TaaS
          partner's own dashboard.
        </p>
      </div>

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setTab('hub')}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${tab === 'hub' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'}`}
        >
          Hub
        </button>
        <button
          type="button"
          onClick={() => setTab('todas')}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${tab === 'todas' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'}`}
        >
          TODAs (Lvl 1)
        </button>
        <button
          type="button"
          onClick={() => setTab('operators')}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${tab === 'operators' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'}`}
        >
          Operators (Lvl 2)
        </button>
        <button
          type="button"
          onClick={() => setTab('franchises')}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${tab === 'franchises' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'}`}
        >
          Franchises (Lvl 3)
        </button>
      </div>

      {tab === 'hub' && (
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/admin/accounting"
            className="rounded-xl border border-amber-300 bg-amber-50 p-3 shadow-sm transition hover:bg-amber-100"
          >
            <p className="text-xs font-semibold text-amber-800">🔒 Accounting &amp; Compliance</p>
            <p className="mt-0.5 text-[11px] text-amber-700">Restricted — finance officer login required</p>
          </Link>
          <Link
            to="/admin/income-promotion"
            className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 shadow-sm transition hover:bg-emerald-100"
          >
            <p className="text-xs font-semibold text-emerald-800">💰 Income &amp; Promotion</p>
            <p className="mt-0.5 text-[11px] text-emerald-700">Revenue, campaigns, rewards &amp; ads</p>
          </Link>
        </div>
      )}

      {tab === 'todas' && (
        <div className="space-y-4">
          {todaOrganizations.length === 0 ? (
            <p className="text-sm text-slate-400">No TODAs have registered yet.</p>
          ) : (
            <>
              <div className="-mx-4 overflow-x-auto px-4">
                <div className="flex gap-1.5">
                  {todaOrganizations.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setSelectedTodaOrgId(o.id)}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        selectedTodaOrgId === o.id
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {o.name}
                      {o.verificationStatus !== 'approved' ? ` (${o.verificationStatus})` : ''}
                    </button>
                  ))}
                </div>
              </div>
              {selectedTodaOrgId && (
                <div className="-mx-4">
                  <TodaAdminPage orgId={selectedTodaOrgId} readOnly />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'operators' && (
        <div className="space-y-4">
          {operators.length === 0 ? (
            <p className="text-sm text-slate-400">No Operators have applied yet.</p>
          ) : (
            <>
              <div className="-mx-4 overflow-x-auto px-4">
                <div className="flex gap-1.5">
                  {operators.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setSelectedOperatorId(o.id)}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        selectedOperatorId === o.id
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {o.name}
                      {o.verificationStatus !== 'approved' ? ` (${o.verificationStatus})` : ''}
                    </button>
                  ))}
                </div>
              </div>
              {selectedOperatorId && (
                <div className="-mx-4">
                  <OperatorPortalPage operatorId={selectedOperatorId} />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'franchises' && (
        <div className="space-y-4">
          {franchises.length === 0 ? (
            <p className="text-sm text-slate-400">No Franchises have applied yet.</p>
          ) : (
            <>
              <div className="-mx-4 overflow-x-auto px-4">
                <div className="flex gap-1.5">
                  {franchises.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setSelectedFranchiseId(f.id)}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        selectedFranchiseId === f.id
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {f.name}
                      {f.verificationStatus !== 'approved' ? ` (${f.verificationStatus})` : ''}
                    </button>
                  ))}
                </div>
              </div>
              {selectedFranchiseId && (
                <div className="-mx-4">
                  <FranchisePage franchiseId={selectedFranchiseId} />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
