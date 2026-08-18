import { useState } from 'react'
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { useRides } from '../context/RideContext'
import { AdBanner } from './AdBanner'
import { NavDrawer, type DrawerRole, type DrawerSection } from './NavDrawer'
import { AccountPanels, type AccountPanelKind, type AccountPanelInfo, type ProfileSaveValues } from './AccountPanels'
import type { Role } from '../types'

// matchByRole controls the "stay highlighted while role === tab.role" fallback
// below — needed since each tab owns a distinct role. Accounting & Compliance
// and Income & Promotion are no longer separate top-level tabs here — both
// live as a paired entry-card row at the top of AdminPage instead (see
// AdminPage.tsx), reachable only once already inside the Admin area.
const TABS: { role: Role; path: string; label: string; matchByRole?: boolean; restricted?: boolean }[] = [
  { role: 'passenger', path: '/passenger', label: 'Passenger', matchByRole: true },
  { role: 'driver', path: '/driver', label: 'Driver', matchByRole: true },
  { role: 'parent', path: '/parent', label: 'Parent', matchByRole: true },
  { role: 'admin', path: '/admin', label: 'Admin', matchByRole: true },
  { role: 'admin', path: '/admin/super', label: 'Super Admin' },
]

const DRAWER_ROLE_LABELS: Record<DrawerRole, string> = {
  passenger: 'Passenger',
  parent: 'Parent',
  driver: 'Driver',
  pharmacy: 'Pharmacy',
  toda_admin: 'TODA Admin',
  admin: 'Admin',
  operator_admin: 'Operator',
  franchise_admin: 'Franchise',
}

export function NavBar() {
  const {
    role,
    setRole,
    currentPassengerId,
    currentParentId,
    loggedInDriverId,
    loggedInPharmacyId,
    loggedInTodaAdminOrgId,
    loggedInOperatorAdminId,
    loggedInFranchiseAdminId,
    authedAccount,
    accountingOfficerName,
    logOut,
  } = useSession()
  const {
    passengers,
    parents,
    drivers,
    pharmacies,
    todaOrganizations,
    operators,
    franchises,
    rides,
    setDriverOnline,
    updatePassengerProfile,
    updateDriverProfile,
    updateParentProfile,
    updatePharmacyProfile,
  } = useRides()
  const location = useLocation()
  const navigate = useNavigate()
  const currentPassenger = passengers.find((p) => p.id === currentPassengerId)
  const currentParent = parents.find((p) => p.id === currentParentId)
  const currentDriver = drivers.find((d) => d.id === loggedInDriverId)
  const currentPharmacy = pharmacies.find((p) => p.id === loggedInPharmacyId)
  const currentTodaOrg = todaOrganizations.find((o) => o.id === loggedInTodaAdminOrgId)
  const currentOperator = operators.find((o) => o.id === loggedInOperatorAdminId)
  const currentFranchise = franchises.find((f) => f.id === loggedInFranchiseAdminId)

  // Hamburger drawer + its two overlay concerns (the slide-out menu itself,
  // and the stub panels its menu items open — Profile/Settings/Help/Privacy/
  // Safety — none of which exist as real pages yet). Covers every logged-in
  // account type that reaches one of the three minimal headers below
  // (passenger, parent, driver, toda_admin, pharmacy) — App Admin/Super
  // Admin use the other, full-nav header further down instead.
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activePanel, setActivePanel] = useState<AccountPanelKind | null>(null)
  const [activeSection, setActiveSection] = useState<DrawerSection>('home')
  // The /book header badge must reflect whoever actually authenticated, not
  // whichever mock identity currentPassengerId/currentParentId happen to
  // still hold from a previous session — otherwise a parent login can show
  // the previous passenger's name (or vice versa) next to the correct
  // "Viewing as"/"Booking as" name shown further down the page.
  const riderAppName = authedAccount?.role === 'parent' ? currentParent?.name : currentPassenger?.name

  // Whatever URL a role was confined to (e.g. a rider stuck on /book) has no
  // meaning once nobody's logged in — reset it so the next login (as any
  // role, including a different one) doesn't inherit a stale path and end
  // up trapped in the previous account's view.
  function handleLogOut() {
    logOut()
    navigate('/', { replace: true })
  }

  // /book, /drive, and /pharmacy are the public, single-purpose rider,
  // driver, and pharmacy-portal apps — they intentionally don't expose the
  // other roles' tabs (or each other's). Every other route keeps the
  // original full nav, which doubles as the internal/operations view where
  // Admin (and anyone testing) can reach every role from one place.
  const isRiderApp = location.pathname.startsWith('/book')
  const isDriverApp = location.pathname.startsWith('/drive')
  const isPharmacyApp = location.pathname.startsWith('/pharmacy')
  const isOperatorApp = location.pathname.startsWith('/operator')
  const isFranchiseApp = location.pathname.startsWith('/franchise')

  const showHamburger =
    (isRiderApp && (authedAccount?.role === 'passenger' || authedAccount?.role === 'parent')) ||
    (isDriverApp && (authedAccount?.role === 'driver' || authedAccount?.role === 'toda_admin')) ||
    (isPharmacyApp && authedAccount?.role === 'pharmacy') ||
    (isOperatorApp && authedAccount?.role === 'operator_admin') ||
    (isFranchiseApp && authedAccount?.role === 'franchise_admin')

  // Rough "does this account have a ride in flight" check — good enough to
  // decide whether Emergency/SOS deep-links to the real TripMonitor SOS
  // button or opens the read-only safety panel instead. Doesn't need to be
  // as precise as PassengerPage's own activeRide (which also excludes
  // dismissed/unacknowledged rides) since the worst case here is just
  // landing on the top of the page instead of exactly on the ride card.
  // Pharmacy/TODA Admin are org accounts with no ride of their own.
  const hasActiveRide = authedAccount?.role === 'passenger'
    ? rides.some((r) => r.passengerId === currentPassengerId && !['completed', 'cancelled', 'declined'].includes(r.status))
    : authedAccount?.role === 'parent'
      ? rides.some((r) => r.passengerId === currentParent?.id && !['completed', 'cancelled', 'declined'].includes(r.status))
      : authedAccount?.role === 'driver'
        ? rides.some((r) => r.driverId === currentDriver?.id && !['completed', 'cancelled', 'declined'].includes(r.status))
        : false

  const panelInfo: AccountPanelInfo | null =
    authedAccount?.role === 'passenger' && currentPassenger
      ? {
          id: currentPassenger.id,
          role: 'passenger',
          name: currentPassenger.name,
          phone: currentPassenger.phone,
          email: currentPassenger.email,
          province: currentPassenger.province,
          city: currentPassenger.city,
          barangay: currentPassenger.barangay,
          paymentDetail: currentPassenger.paymentDetail ?? null,
          emergencyContact: currentPassenger.guardianPhone,
          hasActiveRide,
        }
      : authedAccount?.role === 'parent' && currentParent
        ? {
            id: currentParent.id,
            role: 'parent',
            name: currentParent.name,
            phone: currentParent.phone,
            email: currentParent.email,
            province: currentParent.province,
            city: currentParent.city,
            barangay: currentParent.barangay,
            paymentDetail: currentParent.paymentDetail ?? null,
            emergencyContact: currentParent.emergencyContact ?? null,
            hasActiveRide,
          }
        : authedAccount?.role === 'driver' && currentDriver
          ? {
              id: currentDriver.id,
              role: 'driver',
              name: currentDriver.name,
              phone: currentDriver.phone,
              email: currentDriver.email,
              province: currentDriver.province,
              city: currentDriver.city,
              barangay: currentDriver.barangay,
              paymentDetail: currentDriver.paymentDetail ?? null,
              emergencyContact: currentDriver.emergencyContact ?? null,
              rating: currentDriver.rating,
              ratingCount: currentDriver.ratingCount,
              verificationStatus: currentDriver.verificationStatus,
              plateNumber: currentDriver.plateNumber,
              hasActiveRide,
            }
          : authedAccount?.role === 'pharmacy' && currentPharmacy
            ? {
                id: currentPharmacy.id,
                role: 'pharmacy',
                name: currentPharmacy.name,
                phone: currentPharmacy.contactPhone,
                email: currentPharmacy.email ?? null,
                province: currentPharmacy.province,
                city: currentPharmacy.city,
                barangay: currentPharmacy.barangay,
                paymentDetail: currentPharmacy.paymentDetail ?? null,
                emergencyContact: currentPharmacy.emergencyContact ?? null,
                hasActiveRide: false,
              }
            : authedAccount?.role === 'toda_admin' && currentTodaOrg
              ? {
                  id: currentTodaOrg.id,
                  role: 'toda_admin',
                  name: currentTodaOrg.name,
                  phone: '',
                  email: null,
                  province: currentTodaOrg.province,
                  city: currentTodaOrg.city,
                  barangay: currentTodaOrg.barangay,
                  paymentDetail: null,
                  emergencyContact: null,
                  hasActiveRide: false,
                }
              : authedAccount?.role === 'operator_admin' && currentOperator
                ? {
                    id: currentOperator.id,
                    role: 'operator_admin',
                    name: currentOperator.name,
                    phone: currentOperator.contactPhone,
                    email: null,
                    province: currentOperator.province,
                    city: currentOperator.city,
                    barangay: '',
                    paymentDetail: null,
                    emergencyContact: null,
                    hasActiveRide: false,
                  }
                : authedAccount?.role === 'franchise_admin' && currentFranchise
                  ? {
                      id: currentFranchise.id,
                      role: 'franchise_admin',
                      name: currentFranchise.name,
                      phone: currentFranchise.contactPhone,
                      email: null,
                      province: currentFranchise.province,
                      city: currentFranchise.city,
                      barangay: '',
                      paymentDetail: null,
                      emergencyContact: null,
                      hasActiveRide: false,
                    }
                  : null

  // Credential fields are "leave blank to keep current" in the form (see
  // ProfilePanel) — undefined here means don't touch that value, so it
  // falls back to whatever's already on the account record. Never called
  // for toda_admin (its My Profile is the read-only OrgProfilePanel instead
  // — see AccountPanels.tsx).
  function handleSaveProfile(values: ProfileSaveValues) {
    if (authedAccount?.role === 'passenger' && currentPassenger) {
      updatePassengerProfile(currentPassenger.id, {
        name: values.name,
        phone: values.phone,
        email: values.email,
        pin: values.newPin ?? currentPassenger.pin,
        paymentDetail: values.paymentDetail,
        password: values.newPassword ?? currentPassenger.password ?? null,
        guardianPhone: values.emergencyContact,
      })
    } else if (authedAccount?.role === 'parent' && currentParent) {
      updateParentProfile(currentParent.id, {
        name: values.name,
        phone: values.phone,
        email: values.email,
        pin: values.newPin ?? currentParent.pin,
        paymentDetail: values.paymentDetail,
        password: values.newPassword ?? currentParent.password ?? null,
        emergencyContact: values.emergencyContact,
      })
    } else if (authedAccount?.role === 'driver' && currentDriver) {
      updateDriverProfile(currentDriver.id, {
        name: values.name,
        phone: values.phone,
        email: values.email,
        pin: values.newPin ?? currentDriver.pin,
        paymentDetail: values.paymentDetail,
        password: values.newPassword ?? currentDriver.password ?? null,
        emergencyContact: values.emergencyContact,
      })
    } else if (authedAccount?.role === 'pharmacy' && currentPharmacy) {
      updatePharmacyProfile(currentPharmacy.id, {
        name: values.name,
        phone: values.phone,
        email: values.email,
        pin: values.newPin ?? currentPharmacy.adminPin,
        paymentDetail: values.paymentDetail,
        password: values.newPassword ?? currentPharmacy.password ?? null,
        emergencyContact: values.emergencyContact,
      })
    }
  }

  function handleDrawerNavigate(section: DrawerSection) {
    setActiveSection(section)
    navigate(
      isRiderApp ? '/book' : isPharmacyApp ? '/pharmacy' : isOperatorApp ? '/operator' : isFranchiseApp ? '/franchise' : '/drive',
      { state: { section } },
    )
  }

  function handleDrawerLogout() {
    setDrawerOpen(false)
    handleLogOut()
  }

  // TODA Admin is a wholly separate account (the org's own admin PIN, not
  // this driver's — see TodaAdminLoginForm in DriverAuthGate.tsx), so there's
  // no "switch into it" while staying logged in as the driver. This logs the
  // driver out and lands directly on the TODA Admin login tab instead of the
  // default Driver login one (DriverAuthGate reads ?mode=toda_admin).
  function handleSwitchToTodaAdmin() {
    setDrawerOpen(false)
    logOut()
    navigate('/drive?mode=toda_admin', { replace: true })
  }

  const hamburgerButton = showHamburger && (
    <button
      type="button"
      onClick={() => setDrawerOpen(true)}
      aria-label="Menu"
      title="Menu"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-2xl text-slate-600 hover:bg-slate-100 active:bg-slate-200"
    >
      ☰
    </button>
  )

  const hamburgerOverlay = showHamburger && panelInfo && (
    <>
      <NavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        role={panelInfo.role}
        name={panelInfo.name}
        roleLabel={DRAWER_ROLE_LABELS[panelInfo.role]}
        verifiedLabel={panelInfo.role === 'driver' && panelInfo.verificationStatus === 'approved' ? '✓ Verified Driver' : null}
        driverOnline={currentDriver?.online ?? false}
        onToggleOnline={() => currentDriver && setDriverOnline(currentDriver.id, !currentDriver.online)}
        activeSection={activeSection}
        hasActiveRide={hasActiveRide}
        onNavigate={handleDrawerNavigate}
        onSwitchToTodaAdmin={handleSwitchToTodaAdmin}
        onOpenPanel={(panel) => setActivePanel(panel)}
        onLogout={handleDrawerLogout}
      />
      <AccountPanels
        panel={activePanel}
        onClose={() => setActivePanel(null)}
        info={panelInfo}
        onSaveProfile={handleSaveProfile}
      />
    </>
  )

  if (isRiderApp || isDriverApp || isPharmacyApp || isOperatorApp || isFranchiseApp) {
    return (
      <>
      <header className="fixed inset-x-0 top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="flex min-w-0 items-start gap-2">
            {hamburgerButton}
            <div className="flex shrink-0 flex-col items-center gap-1">
              <Link to="/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                <img src="/logo.png" alt="TodaRide" className="h-12 w-auto rounded-lg object-contain" />
              </Link>
              <BackForwardControls />
            </div>
            <Link
              to="/"
              className="min-w-0 truncate self-center text-sm font-semibold text-slate-700"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              {isRiderApp
                ? 'Book a Ride'
                : isDriverApp
                  ? 'Driver App'
                  : isPharmacyApp
                    ? '🏪 Pharmacy/Store Portal'
                    : isOperatorApp
                      ? '🏢 Operator Portal'
                      : '🗺️ Franchise Portal'}
            </Link>
          </div>
          <div className="flex flex-col items-end gap-1">
            {isRiderApp && riderAppName && (
              <span className="rounded-full bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-700">
                👤 {riderAppName}
              </span>
            )}
            <div className="flex items-center gap-1.5">
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-500">
                Prototype · Simulated data
              </span>
              <button
                type="button"
                onClick={handleLogOut}
                className="rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 underline hover:bg-slate-100 hover:text-slate-700 active:bg-slate-200"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      </header>
      {hamburgerOverlay}
      </>
    )
  }

  // App Admin/Super Admin — the internal/ops view's own hamburger. Only an
  // 'admin' authedAccount ever reaches this header branch (every other role
  // is redirected off /passenger, /driver, /parent, /admin, /admin/accounting
  // by App.tsx), so it's safe to build unconditionally here.
  const isSuperAdminView = location.pathname === '/admin/accounting'
  const adminPanelInfo: AccountPanelInfo = {
    id: 'app-admin',
    role: 'admin',
    name: isSuperAdminView ? `Super Admin${accountingOfficerName ? `-${accountingOfficerName}` : ''}` : 'Admin',
    phone: '',
    email: null,
    province: '',
    city: '',
    barangay: '',
    paymentDetail: null,
    emergencyContact: null,
    hasActiveRide: false,
  }

  const adminHamburgerOverlay = authedAccount?.role === 'admin' && (
    <>
      <NavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        role="admin"
        name={adminPanelInfo.name}
        roleLabel={DRAWER_ROLE_LABELS.admin}
        verifiedLabel={null}
        driverOnline={false}
        onToggleOnline={() => {}}
        activeSection={activeSection}
        hasActiveRide={false}
        onNavigate={handleDrawerNavigate}
        onSwitchToTodaAdmin={handleSwitchToTodaAdmin}
        onOpenPanel={(panel) => setActivePanel(panel)}
        onLogout={handleDrawerLogout}
      />
      <AccountPanels panel={activePanel} onClose={() => setActivePanel(null)} info={adminPanelInfo} onSaveProfile={() => {}} />
    </>
  )

  return (
    <>
    <header className="fixed inset-x-0 top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-2 px-4 py-3">
        <div className="flex shrink-0 items-start gap-2">
          {authedAccount?.role === 'admin' && (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Menu"
              title="Menu"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-2xl text-slate-600 hover:bg-slate-100 active:bg-slate-200"
            >
              ☰
            </button>
          )}
          <div className="flex shrink-0 flex-col items-center gap-1">
            <Link to="/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <img src="/logo.png" alt="TodaRide" className="h-12 w-auto rounded-lg object-contain" />
            </Link>
            <BackForwardControls />
          </div>
        </div>
        <AdBanner />
        <div className="flex shrink-0 flex-col items-end gap-1">
          {/* This is the internal/ops view (only an Admin account reaches
              it) — the badge must track whichever of the four tabs below is
              actually selected, not always show the mock passenger identity
              regardless of tab. Admin has no separate display name beyond
              the login itself, so it gets a static "Admin" badge instead of
              borrowing a passenger/parent's name. */}
          {role === 'passenger' && currentPassenger && (
            <span className="rounded-full bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-700">
              👤 {currentPassenger.name}
            </span>
          )}
          {role === 'parent' && currentParent && (
            <span className="rounded-full bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-700">
              👤 {currentParent.name}
            </span>
          )}
          {role === 'admin' && (
            <span className="rounded-full bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-700">
              👤{' '}
              {location.pathname === '/admin/accounting'
                ? `Super Admin${accountingOfficerName ? `-${accountingOfficerName}` : ''}`
                : 'Admin'}
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-500">
              Prototype · Simulated data
            </span>
            <button
              type="button"
              onClick={handleLogOut}
              className="rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 underline hover:bg-slate-100 hover:text-slate-700 active:bg-slate-200"
            >
              Log out
            </button>
          </div>
        </div>
      </div>
      <nav className="mx-auto flex max-w-lg flex-wrap gap-1 px-4 pb-2">
        {TABS.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            end
            onClick={() => setRole(tab.role)}
            className={({ isActive }) => {
              const active = isActive || (tab.matchByRole && role === tab.role)
              if (tab.restricted) {
                return `flex-1 rounded-lg px-2 py-2 text-center text-[11px] font-medium leading-tight transition ${
                  active ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`
              }
              return `flex-1 rounded-lg px-2 py-2 text-center text-sm font-medium transition ${
                active ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`
            }}
          >
            {tab.restricted ? `🔒 ${tab.label}` : tab.label}
          </NavLink>
        ))}
      </nav>
    </header>
    {adminHamburgerOverlay}
    </>
  )
}

// Browser-style "‹ ›" history navigation, below the logo on every page.
// Plain history.length/-1/+1 calls — SPA routing already updates the URL via
// pushState, so the browser's own history stack is the source of truth here;
// no need to track an app-level page stack.
function BackForwardControls() {
  const navigate = useNavigate()
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={() => navigate(-1)}
        aria-label="Go back"
        className="flex h-5 w-5 items-center justify-center rounded border border-slate-200 text-[11px] text-slate-500 hover:bg-slate-100 active:bg-slate-200"
      >
        ‹
      </button>
      <button
        type="button"
        onClick={() => navigate(1)}
        aria-label="Go forward"
        className="flex h-5 w-5 items-center justify-center rounded border border-slate-200 text-[11px] text-slate-500 hover:bg-slate-100 active:bg-slate-200"
      >
        ›
      </button>
    </div>
  )
}
