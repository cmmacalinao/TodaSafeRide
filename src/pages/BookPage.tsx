import { useSession } from '../context/SessionContext'
import { PassengerPage } from './PassengerPage'
import { ParentPage } from './ParentPage'

// The public rider-facing entry point at /book. App.tsx only ever routes a
// 'passenger' or 'parent' authedAccount here (see its role-based redirects),
// so which page renders is decided by that account's actual role — not a
// manual switch a logged-in user could flip to see an unrelated account's
// "Viewing as" (that's what caused a passenger session to be able to land on
// some other, unrelated parent's view). Reuses PassengerPage/ParentPage
// wholesale rather than re-implementing booking/rating/reporting/Pabili
// logic a second time.
export function BookPage() {
  const { authedAccount } = useSession()

  if (authedAccount?.role === 'parent') return <ParentPage />
  return <PassengerPage />
}
