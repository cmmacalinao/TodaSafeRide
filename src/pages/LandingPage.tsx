import { Link } from 'react-router-dom'
import { GoogleAdSlot } from '../components/GoogleAdSlot'

const FEATURES = [
  { icon: '🛡️', title: 'Safety First', body: 'Every ride puts passenger safety above all else.' },
  { icon: '👮', title: 'Verified Drivers', body: 'Ride with registered and verified TODA drivers.' },
  { icon: '📍', title: 'Track Your Ride', body: 'Know your driver and ride location through the app.' },
  { icon: '🚨', title: 'Emergency Assistance', body: 'Quick access to help when you need it.' },
  { icon: '📱', title: 'Easy Booking', body: 'Book your tricycle anytime with just a few taps.' },
  { icon: '💰', title: 'Transparent Fare', body: 'Know your fare before you ride.' },
  { icon: '⭐', title: 'Driver Ratings', body: 'Help maintain quality and safe service through passenger feedback.' },
  { icon: '🏠', title: 'Door-to-Door Service', body: 'Convenient pickup and drop-off at your preferred location.' },
  { icon: '📋', title: 'Digital Ride Records', body: 'Keep a record of your bookings and trips.' },
  { icon: '🤝', title: 'Trusted Local Transportation', body: 'Connecting passengers with their local TODA in a safer, smarter way.' },
]

export function LandingPage() {
  return (
    <div className="mx-auto max-w-lg">
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-700 via-brand-600 to-brand-500 px-6 pb-12 pt-10 text-center text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-400/20 blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-16 -left-10 h-48 w-48 rounded-full bg-white/10 blur-2xl"
        />

        <div className="relative flex flex-col items-center">
          <img
            src="/logo.png"
            alt="TodaRide — Safe Ride, Safe Arrival"
            className="w-56 rounded-2xl shadow-xl ring-1 ring-white/10 sm:w-64"
          />
          <p className="mt-5 max-w-sm text-sm text-blue-100">
            Book a tricycle from your phone, track it live, and travel with confidence — for you,
            and for your kids.
          </p>

          <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
            <Link
              to="/book"
              className="rounded-lg bg-gold-500 py-3 text-sm font-semibold text-brand-900 shadow-md transition hover:bg-gold-400"
            >
              Book a Ride →
            </Link>
            <Link
              to="/book?service=buy_medicine"
              className="rounded-lg border border-white/30 py-3 text-sm font-medium text-white transition hover:bg-white/10"
            >
              💊 Buy a Medicine
            </Link>
            <Link
              to="/drive"
              className="rounded-lg border border-white/30 py-3 text-sm font-medium text-white transition hover:bg-white/10"
            >
              I'm a Driver
            </Link>
            <Link
              to="/pharmacy"
              className="rounded-lg border border-white/30 py-3 text-sm font-medium text-white transition hover:bg-white/10"
            >
              🏪 Pharmacy/Store — Partner with us
            </Link>
          </div>
        </div>
      </section>

      <section className="px-5 py-8">
        <div className="mb-5 flex items-center gap-2">
          <span className="text-2xl">🛡️</span>
          <h2 className="text-lg font-extrabold tracking-tight text-slate-800">WHY CHOOSE TODARIDE?</h2>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="text-xl leading-none">{f.icon}</span>
              <div>
                <p className="text-sm font-semibold text-slate-800">{f.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 pb-4">
        <GoogleAdSlot placement="landing" />
      </section>

      <section className="px-5 pb-10">
        <div className="rounded-xl bg-gradient-to-r from-brand-700 to-brand-600 p-5 text-center text-white shadow-sm">
          <p className="text-sm font-semibold">Ready to ride?</p>
          <p className="mt-1 text-xs text-blue-100">No terminal visit, no waiting in the rain.</p>
          <Link
            to="/book"
            className="mt-3 inline-block rounded-lg bg-gold-500 px-6 py-2.5 text-sm font-semibold text-brand-900 transition hover:bg-gold-400"
          >
            Book a Ride →
          </Link>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          <Link to="/admin" className="underline hover:text-slate-600">
            Admin Operation
          </Link>
        </p>
      </section>
    </div>
  )
}
