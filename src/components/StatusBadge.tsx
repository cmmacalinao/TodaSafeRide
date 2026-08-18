import type { RideStatus } from '../types'

const STYLES: Record<RideStatus, string> = {
  requested: 'bg-amber-100 text-amber-800',
  accepted: 'bg-sky-100 text-sky-800',
  driver_arriving: 'bg-sky-100 text-sky-800',
  ongoing: 'bg-brand-100 text-brand-700',
  completed: 'bg-slate-200 text-slate-700',
  declined: 'bg-rose-100 text-rose-700',
  cancelled: 'bg-rose-100 text-rose-700',
}

const LABELS: Record<RideStatus, string> = {
  requested: 'Waiting for driver',
  accepted: 'Accepted',
  driver_arriving: 'Driver arriving',
  ongoing: 'Ride ongoing',
  completed: 'Completed',
  declined: 'Declined',
  cancelled: 'Cancelled',
}

export function StatusBadge({ status }: { status: RideStatus }) {
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  )
}
