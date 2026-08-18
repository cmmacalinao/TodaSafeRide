import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useRides } from '../context/RideContext'
import { useSession } from '../context/SessionContext'
import { StatusBadge } from '../components/StatusBadge'
import { AlertBanner } from '../components/AlertBanner'
import { ReceiptCard } from '../components/ReceiptCard'
import { TripMonitor } from '../components/TripMonitor'
import { ParentRegisterForm } from '../components/ParentRegisterForm'
import { QuickBookingForm, type KnownRider } from '../components/QuickBookingForm'
import { GoogleAdSlot } from '../components/GoogleAdSlot'
import { isWithinRetentionDays } from '../lib/tracking'
import type { Parent, Passenger, Ride, ServiceType } from '../types'

const SELF_TAB = 'self'
const GUEST_TAB = 'guest'

export function ParentPage() {
  const { parents, parentLinks, passengers, rides } = useRides()
  const { currentParentId, setCurrentParentId, authedAccount } = useSession()
  const [showRegister, setShowRegister] = useState(false)
  const [selectedTab, setSelectedTab] = useState<string>(SELF_TAB)
  // Only the Admin ops view (/parent) needs to switch between accounts to
  // test as anyone — a real logged-in parent's identity is fixed to whoever
  // authenticated, same as the Driver app.
  const isAdminOpsView = authedAccount?.role === 'admin'
  const location = useLocation()
  const navigate = useNavigate()
  // Forces the self-booking QuickBookingForm to remount with a fresh
  // initialServiceType when the hamburger drawer deep-links to Ride/Pabili/
  // Medicine — it only reads that prop once on mount (see QuickBookingForm's
  // own doc comment), same remount-to-reseed pattern used throughout this
  // app (e.g. MedsItemsBrandInput's itemsResetKey).
  const [bookingRemountKey, setBookingRemountKey] = useState(0)
  const [desiredServiceType, setDesiredServiceType] = useState<ServiceType>('ride')

  useEffect(() => {
    const section = (location.state as { section?: string } | null)?.section
    if (!section) return
    navigate(location.pathname, { replace: true, state: {} })
    const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })
    switch (section) {
      case 'home':
        setSelectedTab(SELF_TAB)
        scrollTop()
        break
      case 'ride':
      case 'pabili':
      case 'medicine':
        setSelectedTab(SELF_TAB)
        setDesiredServiceType(section === 'medicine' ? 'buy_medicine' : (section as ServiceType))
        setBookingRemountKey((k) => k + 1)
        scrollTop()
        break
      case 'current':
      case 'history':
        setSelectedTab(SELF_TAB)
        scrollTop()
        break
      default:
        break
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key])

  const parent = parents.find((p) => p.id === currentParentId) ?? parents[0]
  const links = parentLinks.filter((l) => l.parentId === parent?.id)
  const students = links
    .map((link) => ({ link, student: passengers.find((p) => p.id === link.studentPassengerId) }))
    .filter((x): x is { link: (typeof links)[number]; student: Passenger } => !!x.student)

  const inProgress = (id: string) =>
    rides.some((r) => r.passengerId === id && !['completed', 'declined', 'cancelled'].includes(r.status))
  const parentHasActiveRide = parent ? inProgress(parent.id) : false

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {isAdminOpsView ? (
          <>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-medium text-slate-500">Viewing as</p>
              <button
                type="button"
                onClick={() => setShowRegister((v) => !v)}
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                {showRegister ? 'Cancel' : '+ Register (parent + child)'}
              </button>
            </div>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              value={parent?.id ?? ''}
              onChange={(e) => setCurrentParentId(e.target.value)}
            >
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {showRegister && (
              <div className="mt-2">
                <ParentRegisterForm
                  onRegistered={(id) => {
                    setCurrentParentId(id)
                    setShowRegister(false)
                  }}
                />
              </div>
            )}
          </>
        ) : (
          <div>
            <p className="text-xs font-medium text-slate-500">Viewing as</p>
            <p className="text-sm font-semibold text-slate-800">{parent?.name}</p>
          </div>
        )}
      </section>

      {parent && (
        <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setSelectedTab(SELF_TAB)}
            className={`flex-1 whitespace-nowrap rounded-md px-2 py-2 text-xs font-medium transition ${
              selectedTab === SELF_TAB ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'
            }`}
          >
            Myself{parentHasActiveRide && ' 🔴'}
          </button>
          {students.map(({ student }) => (
            <button
              key={student.id}
              type="button"
              onClick={() => setSelectedTab(student.id)}
              className={`flex-1 whitespace-nowrap rounded-md px-2 py-2 text-xs font-medium transition ${
                selectedTab === student.id ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'
              }`}
            >
              {student.name}
              {inProgress(student.id) && ' 🔴'}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSelectedTab(GUEST_TAB)}
            className={`flex-1 whitespace-nowrap rounded-md px-2 py-2 text-xs font-medium transition ${
              selectedTab === GUEST_TAB ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500'
            }`}
          >
            Someone else
          </button>
        </div>
      )}

      {parent && selectedTab === SELF_TAB && (
        <ParentSelfBooking
          parent={parent}
          rides={rides}
          bookingRemountKey={bookingRemountKey}
          desiredServiceType={desiredServiceType}
        />
      )}

      {parent && selectedTab === GUEST_TAB && (
        <QuickBookingForm
          title="Book for someone else"
          guestDefaultProvince={parent.province}
          guestDefaultCity={parent.city}
          bookedByParentId={parent.id}
        />
      )}

      {links.length === 0 && !showRegister && selectedTab !== SELF_TAB && selectedTab !== GUEST_TAB && (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-400">
          {isAdminOpsView ? 'No linked children yet. Use "+ Register (parent + child)" above.' : 'No linked children yet.'}
        </section>
      )}

      {students.map(({ link, student }) =>
        selectedTab === student.id ? (
          <StudentMonitor
            key={student.id}
            student={student}
            relationship={link.relationship}
            parentName={parent?.name ?? ''}
            parentId={parent?.id ?? ''}
            rides={rides}
          />
        ) : null,
      )}

      <GoogleAdSlot placement="parentBottom" />
    </div>
  )
}

// A parent can book for themselves too, not just their linked children —
// Parent accounts have no isStudent/isPwdSenior discount fields (unlike
// Passenger), so a self-booking always rides at the standard rate.
function ParentSelfBooking({
  parent,
  rides,
  bookingRemountKey,
  desiredServiceType,
}: {
  parent: Parent
  rides: Ride[]
  bookingRemountKey: number
  desiredServiceType: ServiceType
}) {
  const { tripHistoryRetentionDays, cancelRide, setParentFavoriteDriver } = useRides()
  const myRides = rides.filter((r) => r.passengerId === parent.id)
  // Excludes a dispatched MEDS delivery — QuickBookingForm's own MedsBooking
  // (rendered in the `else` branch below) already tracks it via its own
  // activeOrder/linkedRide lookup with MEDS-aware cancel rules; without this
  // exclusion this generic card would claim the ride first and let the
  // parent cancel an already-dispatched delivery outright via plain
  // cancelRide (see the identical fix in PassengerPage.tsx).
  const activeRide = myRides.find(
    (r) => r.serviceType !== 'buy_medicine' && !['completed', 'declined', 'cancelled'].includes(r.status),
  )
  // Admin-configurable — see AdminPage's "Trip history retention" setting.
  const pastRides = myRides.filter(
    (r) => ['completed', 'declined', 'cancelled'].includes(r.status) && isWithinRetentionDays(r.requestedAt, tripHistoryRetentionDays),
  )

  const rider: KnownRider = {
    id: parent.id,
    name: parent.name,
    isStudent: false,
    isPwdSenior: false,
    province: parent.province,
    city: parent.city,
    barangay: parent.barangay,
    addressDetail: parent.addressDetail,
  }

  return (
    <div className="space-y-3">
      {activeRide ? (
        <TripMonitor
          title="Your live trip"
          ride={activeRide}
          sosActorId={parent.id}
          sosLabel="SOS — Emergency"
          showCancel
          onCancel={() => cancelRide(activeRide.id)}
        />
      ) : (
        <QuickBookingForm
          key={bookingRemountKey}
          title="Book for yourself"
          rider={rider}
          bookedByParentId={null}
          favoriteDriverId={parent.favoriteDriverId}
          onSetFavoriteDriver={(driverId) => setParentFavoriteDriver(parent.id, driverId)}
          initialServiceType={desiredServiceType}
        />
      )}

      {pastRides.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Your ride history</h2>
          <div className="space-y-2">
            {pastRides.map((r) => (
              <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">
                    {r.serviceType === 'pabili' && '🛍️ '}
                    {r.serviceType === 'buy_medicine' && '💊 '}
                    {r.pickup.label} → {r.dropoff.label}
                  </span>
                  <StatusBadge status={r.status} />
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  ₱{r.fareEstimate} · {new Date(r.requestedAt).toLocaleString()}
                </div>
                {r.payment && <ReceiptCard payment={r.payment} />}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function StudentMonitor({
  student,
  relationship,
  parentName,
  parentId,
  rides,
}: {
  student: Passenger
  relationship: string
  parentName: string
  parentId: string
  rides: Ride[]
}) {
  const { tripHistoryRetentionDays, cancelRide, setFavoriteDriver } = useRides()
  const studentRides = rides.filter((r) => r.passengerId === student.id)
  // See ParentSelfBooking's identical exclusion above — a dispatched MEDS
  // delivery is tracked by QuickBookingForm's own MedsBooking instead.
  const activeRide = studentRides.find(
    (r) => r.serviceType !== 'buy_medicine' && !['completed', 'declined', 'cancelled'].includes(r.status),
  )
  // Admin-configurable — see AdminPage's "Trip history retention" setting.
  const pastRides = studentRides.filter(
    (r) => ['completed', 'declined', 'cancelled'].includes(r.status) && isWithinRetentionDays(r.requestedAt, tripHistoryRetentionDays),
  )

  const rider: KnownRider = {
    id: student.id,
    name: student.name,
    isStudent: student.isStudent,
    isPwdSenior: student.isPwdSenior,
    province: student.province,
    city: student.city,
    barangay: student.barangay,
    addressDetail: student.addressDetail,
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-slate-500">
        {student.name} · {relationship} of {parentName}
      </p>

      {activeRide ? (
        <TripMonitor
          title="Live trip"
          ride={activeRide}
          sosActorId={parentId}
          sosLabel="SOS — Alert me now"
          extraContacts={student.phone ? [{ label: `Call ${student.name}`, phone: student.phone }] : []}
          showCancel
          onCancel={() => cancelRide(activeRide.id)}
        />
      ) : (
        <QuickBookingForm
          title={`Book for ${student.name}`}
          rider={rider}
          bookedByParentId={parentId}
          favoriteDriverId={student.favoriteDriverId}
          onSetFavoriteDriver={(driverId) => setFavoriteDriver(student.id, driverId)}
        />
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Ride history</h2>
        <div className="space-y-2">
          {pastRides.length === 0 && <p className="text-sm text-slate-400">No past trips yet.</p>}
          {pastRides.map((r) => (
            <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700">
                  {r.serviceType === 'pabili' && '🛍️ '}
                  {r.serviceType === 'buy_medicine' && '💊 '}
                  {r.pickup.label} → {r.dropoff.label}
                </span>
                <StatusBadge status={r.status} />
              </div>
              <div className="mt-1 text-xs text-slate-400">
                ₱{r.fareEstimate} · {new Date(r.requestedAt).toLocaleString()}
              </div>
              {r.routeAlert && (
                <div className="mt-1">
                  <AlertBanner message="This trip had a route deviation alert." />
                </div>
              )}
              {r.payment && <ReceiptCard payment={r.payment} />}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
