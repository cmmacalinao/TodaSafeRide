import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { NavBar } from './components/NavBar'
import { AuthGate } from './components/AuthGate'
import { LandingPage } from './pages/LandingPage'
import { PassengerPage } from './pages/PassengerPage'
import { DriverPage } from './pages/DriverPage'
import { ParentPage } from './pages/ParentPage'
import { AdminPage } from './pages/AdminPage'
import { SuperAdminPage } from './pages/SuperAdminPage'
import { AccountingPage } from './pages/AccountingPage'
import { IncomePromotionPage } from './pages/IncomePromotionPage'
import { BookPage } from './pages/BookPage'
import { PharmacyPortalPage } from './pages/PharmacyPortalPage'
import { OperatorPortalPage } from './pages/OperatorPortalPage'
import { FranchisePage } from './pages/FranchisePage'
import { RideProvider } from './context/RideContext'
import { SessionProvider, useSession } from './context/SessionContext'

function AppShell() {
  const { authedAccount } = useSession()
  const location = useLocation()

  // The landing page itself is public — it's just "Book a Ride" / "I'm a
  // Driver" entry points, nothing account-specific — so a logged-out visitor
  // sees it instead of the login gate. Every other route (/book, /drive, the
  // admin/ops view, ...) still requires logging in first: authedAccount
  // resets on every fresh page load (see SessionContext), so trying to reach
  // any of those always means hitting AuthGate first.
  if (!authedAccount) {
    if (location.pathname === '/') return <LandingPage />
    return <AuthGate />
  }

  // Once authed, which URLs are even reachable depends on the account's
  // role — this is the actual role separation, not just the login wall
  // above. Passenger/Parent accounts are confined to the rider app, Driver
  // and TODA Admin accounts to the driver app; neither can wander into the
  // full multi-tab system. Only App Admin gets that ("everything visible").
  const isRiderRole = authedAccount.role === 'passenger' || authedAccount.role === 'parent'
  const isDriverRole = authedAccount.role === 'driver' || authedAccount.role === 'toda_admin'
  const isPharmacyRole = authedAccount.role === 'pharmacy'
  const isOperatorAdminRole = authedAccount.role === 'operator_admin'
  const isFranchiseAdminRole = authedAccount.role === 'franchise_admin'

  // Path-based (not role-based) — mirrors NavBar's own isRiderApp/isDriverApp/
  // isPharmacyApp checks, needed here too so <main>'s top padding can match
  // whichever header variant NavBar is currently rendering (see below).
  const isRiderApp = location.pathname.startsWith('/book')
  const isDriverApp = location.pathname.startsWith('/drive')
  const isPharmacyApp = location.pathname.startsWith('/pharmacy')
  const isOperatorApp = location.pathname.startsWith('/operator')
  const isFranchiseApp = location.pathname.startsWith('/franchise')

  if (isRiderRole && location.pathname !== '/book') {
    return <Navigate to="/book" replace />
  }
  if (isDriverRole && location.pathname !== '/drive') {
    return <Navigate to="/drive" replace />
  }
  if (isPharmacyRole && location.pathname !== '/pharmacy') {
    return <Navigate to="/pharmacy" replace />
  }
  if (isOperatorAdminRole && location.pathname !== '/operator') {
    return <Navigate to="/operator" replace />
  }
  if (isFranchiseAdminRole && location.pathname !== '/franchise') {
    return <Navigate to="/franchise" replace />
  }

  // NavBar's header is `fixed` (not `sticky`) so it's guaranteed to stay
  // visible at the very top of the viewport no matter how far the page
  // scrolls — sticky can fail to stay pinned depending on the surrounding
  // scroll container. A fixed header is removed from document flow though,
  // so <main> needs matching top padding or its content would start out
  // hidden underneath it; the two header variants render at different
  // heights (the rider/driver/pharmacy header is a single row, the
  // full-nav one adds a second row of tabs below it), so the padding has to
  // match whichever is currently showing.
  const isMinimalHeader = isRiderApp || isDriverApp || isPharmacyApp || isOperatorApp || isFranchiseApp

  return (
    <>
      <NavBar />
      <main className={isMinimalHeader ? 'pt-24' : 'pt-36'}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          {/* Public rider and driver apps — separate, minimal-nav entry
              points for end users. */}
          <Route path="/book" element={<BookPage />} />
          <Route path="/drive" element={<DriverPage />} />
          <Route path="/pharmacy" element={<PharmacyPortalPage />} />
          <Route path="/operator" element={<OperatorPortalPage />} />
          <Route path="/franchise" element={<FranchisePage />} />
          {/* Original full-nav system — the internal/operations view where
              every role's tab is reachable. Only Admin accounts ever reach
              this far (see the redirects above). */}
          <Route path="/passenger" element={<PassengerPage />} />
          <Route path="/driver" element={<DriverPage />} />
          <Route path="/parent" element={<ParentPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/super" element={<SuperAdminPage />} />
          <Route path="/admin/accounting" element={<AccountingPage />} />
          <Route path="/admin/income-promotion" element={<IncomePromotionPage />} />
        </Routes>
      </main>
    </>
  )
}

export default function App() {
  return (
    <SessionProvider>
      <RideProvider>
        <AppShell />
      </RideProvider>
    </SessionProvider>
  )
}
