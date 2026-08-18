import { PAYMENT_METHOD_LABELS } from '../mock/data'
import type { Payment } from '../types'

export function ReceiptCard({ payment }: { payment: Payment }) {
  return (
    <div className="mt-2 space-y-1 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-700">Digital receipt</span>
        <span className="rounded-full bg-brand-100 px-2 py-0.5 font-medium text-brand-700">Paid</span>
      </div>
      {payment.tip > 0 ? (
        <>
          <div className="flex items-center justify-between">
            <span>Fare</span>
            <span>₱{payment.amount - payment.tip}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Tip</span>
            <span>₱{payment.tip}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Total</span>
            <span className="font-medium text-slate-800">₱{payment.amount}</span>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between">
          <span>Amount</span>
          <span className="font-medium text-slate-800">₱{payment.amount}</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span>Method</span>
        <span>{PAYMENT_METHOD_LABELS[payment.method]}</span>
      </div>
      {payment.referenceNo && (
        <div className="flex items-center justify-between">
          <span>Reference no.</span>
          <span className="font-mono">{payment.referenceNo}</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span>Paid at</span>
        <span>{new Date(payment.paidAt).toLocaleString()}</span>
      </div>
    </div>
  )
}
