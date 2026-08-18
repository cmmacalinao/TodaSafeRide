import { useEffect } from 'react'
import type { AccountPanelKind } from './AccountPanels'

export type DrawerSection =
  | 'home'
  | 'ride'
  | 'pabili'
  | 'current'
  | 'history'
  | 'rewards'
  | 'medicine'
  | 'requests'
  | 'earnings'
  | 'queue'
  | 'orders'
  | 'products'
  | 'payments'
  | 'members'
  | 'dues'
  | 'report'

export type DrawerRole = 'passenger' | 'parent' | 'driver' | 'pharmacy' | 'toda_admin' | 'admin' | 'operator_admin' | 'franchise_admin'

interface MenuItem {
  icon: string
  label: string
  section?: DrawerSection
  panel?: AccountPanelKind
  logout?: boolean
  toggleOnline?: boolean
  // "TODA Admin" is a different account entirely (the org's own admin PIN,
  // not this driver's) — see TodaAdminLoginForm in DriverAuthGate.tsx. There's
  // no way to jump straight into it while staying logged in as the driver, so
  // this logs the driver out and lands on the TODA Admin login tab instead.
  switchToTodaAdmin?: boolean
}

const PASSENGER_ITEMS: MenuItem[] = [
  { icon: '🏠', label: 'Home', section: 'home' },
  { icon: '🚗', label: 'Book a Ride', section: 'ride' },
  { icon: '🛍️', label: 'Pabili', section: 'pabili' },
  { icon: '💊', label: 'Buy Medicine', section: 'medicine' },
  { icon: '📍', label: 'My Current Ride', section: 'current' },
  { icon: '🧾', label: 'Ride History', section: 'history' },
  { icon: '🎁', label: 'Rewards, Promos & Wallet', section: 'rewards' },
  { icon: '🆘', label: 'Emergency / SOS', section: 'current' },
  { icon: '👤', label: 'My Profile', panel: 'profile' },
  { icon: '⚙️', label: 'Settings', panel: 'settings' },
  { icon: '❓', label: 'Help & Support', panel: 'help' },
  { icon: '🔒', label: 'Privacy & Safety', panel: 'privacy' },
  { icon: '🚪', label: 'Logout', logout: true },
]

// Parent booking has no coins/rewards system of its own (that's tied to
// Passenger accounts specifically — see PassengerRewardsCard), so it's
// dropped rather than pointing at something that doesn't exist for them.
const PARENT_ITEMS: MenuItem[] = [
  { icon: '🏠', label: 'Home', section: 'home' },
  { icon: '🚗', label: 'Book a Ride', section: 'ride' },
  { icon: '🛍️', label: 'Pabili', section: 'pabili' },
  { icon: '💊', label: 'Buy Medicine', section: 'medicine' },
  { icon: '📍', label: 'My Current Ride', section: 'current' },
  { icon: '🧾', label: 'Ride History', section: 'history' },
  { icon: '🆘', label: 'Emergency / SOS', section: 'current' },
  { icon: '👤', label: 'My Profile', panel: 'profile' },
  { icon: '⚙️', label: 'Settings', panel: 'settings' },
  { icon: '❓', label: 'Help & Support', panel: 'help' },
  { icon: '🔒', label: 'Privacy & Safety', panel: 'privacy' },
  { icon: '🚪', label: 'Logout', logout: true },
]

const DRIVER_ITEMS: MenuItem[] = [
  { icon: '🏠', label: 'Dashboard', section: 'home' },
  { icon: '🟢', label: 'Go Online / Offline', toggleOnline: true },
  { icon: '🚗', label: 'Ride Requests', section: 'requests' },
  { icon: '📍', label: 'Current Ride', section: 'current' },
  { icon: '🧾', label: 'Ride History', section: 'history' },
  { icon: '💰', label: 'Earnings', section: 'earnings' },
  { icon: '⭐', label: 'Ratings', section: 'home' },
  { icon: '🚏', label: 'TODA Terminal Queue (Pila)', section: 'queue' },
  { icon: '🏢', label: 'TODA Admin', switchToTodaAdmin: true },
  { icon: '🆘', label: 'Emergency / SOS', section: 'current' },
  { icon: '👤', label: 'My Profile', panel: 'profile' },
  { icon: '⚙️', label: 'Settings', panel: 'settings' },
  { icon: '❓', label: 'Help & Support', panel: 'help' },
  { icon: '🔒', label: 'Privacy & Safety', panel: 'privacy' },
  { icon: '🚪', label: 'Logout', logout: true },
]

const PHARMACY_ITEMS: MenuItem[] = [
  { icon: '🏠', label: 'Dashboard', section: 'home' },
  { icon: '📥', label: 'Orders Awaiting Quote', section: 'orders' },
  { icon: '💊', label: 'Products', section: 'products' },
  { icon: '💳', label: 'Payment Accounts', section: 'payments' },
  { icon: '🧾', label: 'Order History', section: 'history' },
  { icon: '👤', label: 'My Profile', panel: 'profile' },
  { icon: '⚙️', label: 'Settings', panel: 'settings' },
  { icon: '❓', label: 'Help & Support', panel: 'help' },
  { icon: '🔒', label: 'Privacy & Safety', panel: 'privacy' },
  { icon: '🚪', label: 'Logout', logout: true },
]

// A TODA org account, not an individual — My Profile shows org info
// (name/officers) rather than a single editable person, and there's no
// Emergency/SOS (that's a per-ride, per-rider concept).
const TODA_ADMIN_ITEMS: MenuItem[] = [
  { icon: '🏠', label: 'Dashboard', section: 'home' },
  { icon: '🧑‍🤝‍🧑', label: 'Members', section: 'members' },
  { icon: '💰', label: 'Dues & Contributions', section: 'dues' },
  { icon: '📊', label: 'Financial Report', section: 'report' },
  { icon: '👤', label: 'My Profile', panel: 'profile' },
  { icon: '⚙️', label: 'Settings', panel: 'settings' },
  { icon: '❓', label: 'Help & Support', panel: 'help' },
  { icon: '🔒', label: 'Privacy & Safety', panel: 'privacy' },
  { icon: '🚪', label: 'Logout', logout: true },
]

// TaaS Level 2 — an Operator account, not an individual. Single-section
// portal (see OperatorPortalPage.tsx — no sub-section refs yet), so this
// only needs Dashboard + the standard account items, same shape as
// TODA_ADMIN_ITEMS above it in the hierarchy.
const OPERATOR_ADMIN_ITEMS: MenuItem[] = [
  { icon: '🏠', label: 'Dashboard', section: 'home' },
  { icon: '👤', label: 'My Profile', panel: 'profile' },
  { icon: '⚙️', label: 'Settings', panel: 'settings' },
  { icon: '❓', label: 'Help & Support', panel: 'help' },
  { icon: '🔒', label: 'Privacy & Safety', panel: 'privacy' },
  { icon: '🚪', label: 'Logout', logout: true },
]

// TaaS Level 3 — a Franchise (territory) account. Same shape as
// OPERATOR_ADMIN_ITEMS one level up.
const FRANCHISE_ADMIN_ITEMS: MenuItem[] = [
  { icon: '🏠', label: 'Dashboard', section: 'home' },
  { icon: '👤', label: 'My Profile', panel: 'profile' },
  { icon: '⚙️', label: 'Settings', panel: 'settings' },
  { icon: '❓', label: 'Help & Support', panel: 'help' },
  { icon: '🔒', label: 'Privacy & Safety', panel: 'privacy' },
  { icon: '🚪', label: 'Logout', logout: true },
]

// App Admin/Super Admin already have their own full tab bar (Passenger/
// Driver/Parent/Admin) right there in the header for navigating between
// roles — this drawer isn't replacing that, just adding the same account-
// level items every other role gets. No My Profile item (nothing to edit —
// see AccountPanels.tsx's OrgProfilePanel) and no Home/Dashboard (the tab
// bar already covers that).
const ADMIN_ITEMS: MenuItem[] = [
  { icon: '⚙️', label: 'Settings', panel: 'settings' },
  { icon: '❓', label: 'Help & Support', panel: 'help' },
  { icon: '🔒', label: 'Privacy & Safety', panel: 'privacy' },
  { icon: '🚪', label: 'Logout', logout: true },
]

const ITEMS_BY_ROLE: Record<DrawerRole, MenuItem[]> = {
  passenger: PASSENGER_ITEMS,
  parent: PARENT_ITEMS,
  driver: DRIVER_ITEMS,
  pharmacy: PHARMACY_ITEMS,
  toda_admin: TODA_ADMIN_ITEMS,
  admin: ADMIN_ITEMS,
  operator_admin: OPERATOR_ADMIN_ITEMS,
  franchise_admin: FRANCHISE_ADMIN_ITEMS,
}

export function NavDrawer({
  open,
  onClose,
  role,
  name,
  roleLabel,
  verifiedLabel,
  driverOnline,
  onToggleOnline,
  activeSection,
  hasActiveRide,
  onNavigate,
  onOpenPanel,
  onLogout,
  onSwitchToTodaAdmin,
}: {
  open: boolean
  onClose: () => void
  role: DrawerRole
  name: string
  roleLabel: string
  verifiedLabel: string | null
  driverOnline: boolean
  onToggleOnline: () => void
  activeSection: DrawerSection
  hasActiveRide: boolean
  onNavigate: (section: DrawerSection) => void
  onOpenPanel: (panel: AccountPanelKind) => void
  onLogout: () => void
  onSwitchToTodaAdmin: () => void
}) {
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  const items = ITEMS_BY_ROLE[role]

  function handleItemClick(item: MenuItem) {
    if (item.logout) {
      onLogout()
      return
    }
    if (item.toggleOnline) {
      onToggleOnline()
      return
    }
    if (item.switchToTodaAdmin) {
      onSwitchToTodaAdmin()
      return
    }
    // Emergency/SOS is special-cased: with a ride in progress it deep-links
    // to the existing TripMonitor SOS button (reusing that implementation,
    // not duplicating it); with no ride, it opens the read-only safety
    // panel instead — never a live trigger from the menu itself, so opening
    // the drawer can never accidentally fire an SOS.
    if (item.label === 'Emergency / SOS' && !hasActiveRide) {
      onOpenPanel('safety')
      onClose()
      return
    }
    if (item.panel) {
      onOpenPanel(item.panel)
      onClose()
      return
    }
    if (item.section) {
      onNavigate(item.section)
      onClose()
    }
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        aria-hidden={!open}
        className={`fixed inset-0 z-[9998] bg-black/50 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      {/* Drawer — z-[9999] deliberately way above normal page content:
          Leaflet (RealLiveMap) sets its own internal panes up to z-index
          700, which otherwise renders on top of a merely z-40 drawer. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`fixed inset-y-0 left-0 z-[9999] flex w-[82vw] max-w-xs flex-col overflow-y-auto bg-white shadow-xl transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          type="button"
          onClick={() => {
            onOpenPanel('profile')
            onClose()
          }}
          className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 p-4 text-left hover:bg-slate-100"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-base font-semibold text-brand-700">
            {name.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-slate-800">{name}</span>
            <span className="block text-xs text-slate-500">{roleLabel}</span>
            {verifiedLabel && <span className="block text-xs font-medium text-emerald-600">{verifiedLabel}</span>}
          </span>
        </button>

        <nav className="flex-1 space-y-0.5 p-2">
          {items.map((item) => {
            const isActive = item.section === activeSection && !item.toggleOnline && !item.logout
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => handleItemClick(item)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className="text-base leading-none">{item.icon}</span>
                  {item.label}
                </span>
                {item.toggleOnline && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      driverOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {driverOnline ? 'Online' : 'Offline'}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>
    </>
  )
}
