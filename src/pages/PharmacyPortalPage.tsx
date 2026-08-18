import { useEffect, useRef, useState, type RefObject } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useRides } from '../context/RideContext'
import { useSession } from '../context/SessionContext'
import { DocumentUploadField } from '../components/DocumentUploadField'
import { OrderChat } from '../components/OrderChat'
import type { MedicineCategory, MedsOrder, MedsOrderItem, MedsOrderStatus, PaymentAccountDetails } from '../types'

const CATEGORY_LABELS: Record<MedicineCategory, string> = {
  otc: 'OTC',
  rx: 'Rx required',
  restricted: 'Restricted',
}

const CATEGORY_STYLES: Record<MedicineCategory, string> = {
  otc: 'bg-emerald-100 text-emerald-700',
  rx: 'bg-amber-100 text-amber-800',
  restricted: 'bg-rose-100 text-rose-700',
}

const ORDER_STATUS_LABELS: Record<MedsOrderStatus, string> = {
  pending_confirmation: 'Awaiting your quote',
  quoted: 'Quote sent — waiting on customer',
  confirmed: 'Checked out — ready to process',
  rejected: 'Declined',
  cancelled: 'Cancelled',
  ready_for_pickup: 'Ready — customer booking their own ride',
  dispatched: 'Dispatched',
}

// TODARIDE MEDS — a pharmacy's own portal, mirroring TodaAdminPage.tsx's
// shape (own-org scoping via a plain in-component filter, same as the rest
// of this app already does for TODA orgs). Reached at the dedicated
// /pharmacy route (see App.tsx) rather than nested inside another page,
// since a pharmacy account isn't a kind of driver or passenger account.
export function PharmacyPortalPage() {
  const { loggedInPharmacyId } = useSession()
  const {
    pharmacies,
    medicineProducts,
    medsOrders,
    sendMedsQuote,
    rejectMedsOrder,
    reviewMedsPrescription,
    processMedsOrder,
    toggleMedicineProductStock,
    addMedicineProduct,
    updatePharmacyPaymentAccount,
    sendMedsOrderMessage,
  } = useRides()
  const location = useLocation()
  const navigate = useNavigate()
  // Scroll targets for the hamburger drawer's menu items (see
  // NavBar.tsx/NavDrawer.tsx) — hooks must run before the early returns
  // below (Rules of Hooks), so this is safe even on the "not logged in"/
  // "pharmacy not found" fallback renders that follow.
  const ordersSectionRef = useRef<HTMLElement>(null)
  const productsSectionRef = useRef<HTMLElement>(null)
  const paymentsSectionRef = useRef<HTMLElement>(null)
  const historySectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const section = (location.state as { section?: string } | null)?.section
    if (!section) return
    navigate(location.pathname, { replace: true, state: {} })
    const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })
    const refs: Record<string, RefObject<HTMLElement | null>> = {
      orders: ordersSectionRef,
      products: productsSectionRef,
      payments: paymentsSectionRef,
      history: historySectionRef,
    }
    if (section === 'home') {
      scrollTop()
    } else if (refs[section]) {
      setTimeout(() => refs[section].current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key])

  if (!loggedInPharmacyId) {
    // App.tsx only ever routes here once authedAccount.role === 'pharmacy'
    // (which always sets loggedInPharmacyId together — see AuthGate.tsx's
    // PharmacyAuth) — this is just a defensive fallback, not a real login
    // form, since there's no path that reaches /pharmacy without one.
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
        <p className="text-sm text-slate-400">Not logged in.</p>
      </div>
    )
  }

  const pharmacy = pharmacies.find((p) => p.id === loggedInPharmacyId)
  if (!pharmacy) {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
        <p className="text-sm text-slate-400">Pharmacy not found.</p>
      </div>
    )
  }

  const ownOrders = medsOrders.filter((o) => o.pharmacyId === pharmacy.id)
  const needsQuoteOrders = ownOrders.filter((o) => o.status === 'pending_confirmation')
  const awaitingCustomerOrders = ownOrders.filter((o) => o.status === 'quoted')
  const readyToProcessOrders = ownOrders.filter((o) => o.status === 'confirmed')
  const pastOrders = ownOrders.filter(
    (o) => o.status !== 'pending_confirmation' && o.status !== 'quoted' && o.status !== 'confirmed',
  )
  const ownProducts = medicineProducts.filter((p) => p.pharmacyId === pharmacy.id)

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-medium text-slate-500">Logged in as</p>
        <h1 className="text-sm font-semibold text-slate-700">
          {pharmacy.businessType === 'store' ? '🏪' : '💊'} {pharmacy.name}
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Exclusive access to {pharmacy.name} only — you can't view or manage any other pharmacy's orders or
          products from here.
        </p>
        {pharmacy.businessType === 'store' && (
          <p className="mt-2 rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800">
            Registered as a Store — passengers can pick you by name for a Pabili errand (instead of the generic
            nearby-store search). Pabili itself stays freeform (no catalog/quote step here) — an errand for your
            store goes straight to a driver as a normal Pabili request.
          </p>
        )}
      </section>

      <section ref={ordersSectionRef} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Orders awaiting your quote</h2>
        {needsQuoteOrders.length === 0 && <p className="text-sm text-slate-400">No new order requests.</p>}
        <div className="space-y-3">
          {needsQuoteOrders.map((order) => (
            <QuoteOrderCard
              key={order.id}
              order={order}
              onSendQuote={(items, receiptDataUrl) => sendMedsQuote(order.id, items, receiptDataUrl)}
              onReject={(reason) => rejectMedsOrder(order.id, reason)}
              onReviewPrescription={(approved, reason) => reviewMedsPrescription(order.id, approved, reason)}
              onSendMessage={(text) => sendMedsOrderMessage(order.id, 'pharmacy', text)}
            />
          ))}
        </div>
      </section>

      <section ref={paymentsSectionRef} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Payment accounts</h2>
        <p className="mt-1 text-xs text-slate-500">
          Customers who pay by GCash or Maya see this account's QR code and number so they can send payment directly
          to you — cash is still collected by the driver on delivery instead.
        </p>
        <div className="mt-3 space-y-3">
          <PaymentAccountForm
            label="GCash"
            details={pharmacy.gcashAccount}
            onSave={(details) => updatePharmacyPaymentAccount(pharmacy.id, 'gcash', details)}
          />
          <PaymentAccountForm
            label="Maya"
            details={pharmacy.mayaAccount}
            onSave={(details) => updatePharmacyPaymentAccount(pharmacy.id, 'maya', details)}
          />
        </div>
      </section>

      {awaitingCustomerOrders.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Quoted — waiting on customer</h2>
          <div className="space-y-2">
            {awaitingCustomerOrders.map((order) => (
              <div key={order.id} className="rounded-lg border border-slate-200 p-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">{order.customerName}</span>
                  <span className="text-[11px] text-slate-400">₱{order.total}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {order.items.map((item) => `${item.quantity}x ${item.name}`).join(', ')} — waiting for the
                  customer to accept and check out.
                </p>
                <div className="mt-2">
                  <OrderChat
                    messages={order.messages}
                    viewerRole="pharmacy"
                    otherPartyLabel={order.customerName}
                    onSend={(text) => sendMedsOrderMessage(order.id, 'pharmacy', text)}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {readyToProcessOrders.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Ready to process</h2>
          <div className="space-y-3">
            {readyToProcessOrders.map((order) => (
              <div key={order.id} className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">{order.customerName}</span>
                  <span className="text-xs font-semibold text-slate-800">₱{order.total}</span>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {order.items.map((item) => `${item.quantity}x ${item.name}`).join(', ')}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Checked out {order.paidOnline ? `— ✓ paid online via ${order.paymentMethod}` : `— pays cash on delivery`}
                  {order.deliveryMode === 'self_book' ? ' · customer will book their own ride' : ' · you will dispatch a driver'}
                </p>
                {order.paymentProofDataUrl && (
                  <a href={order.paymentProofDataUrl} target="_blank" rel="noreferrer" className="mt-1.5 inline-block">
                    <img
                      src={order.paymentProofDataUrl}
                      alt="Payment confirmation"
                      className="h-14 w-14 rounded-md border border-emerald-300 object-cover"
                    />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => processMedsOrder(order.id)}
                  className="mt-2 w-full rounded-lg bg-brand-600 py-2 text-xs font-semibold text-white hover:bg-brand-700"
                >
                  {order.deliveryMode === 'self_book' ? 'Mark ready for pickup' : 'Process & dispatch driver'}
                </button>
                <div className="mt-2">
                  <OrderChat
                    messages={order.messages}
                    viewerRole="pharmacy"
                    otherPartyLabel={order.customerName}
                    onSend={(text) => sendMedsOrderMessage(order.id, 'pharmacy', text)}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section ref={productsSectionRef} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Products</h2>
        <div className="space-y-1.5">
          {ownProducts.length === 0 && <p className="text-sm text-slate-400">No products yet — add your first one below.</p>}
          {ownProducts.map((product) => (
            <div key={product.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-700">{product.name}</p>
                <p className="text-[11px] text-slate-400">
                  {product.genericName ?? '—'} · ₱{product.price}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CATEGORY_STYLES[product.category]}`}>
                  {CATEGORY_LABELS[product.category]}
                </span>
                <button
                  type="button"
                  onClick={() => toggleMedicineProductStock(product.id)}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    product.inStock ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {product.inStock ? 'In stock' : 'Out of stock'}
                </button>
              </div>
            </div>
          ))}
        </div>
        <AddProductForm onAdd={(args) => addMedicineProduct({ pharmacyId: pharmacy.id, ...args })} />
      </section>

      <section ref={historySectionRef} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Order history</h2>
        {pastOrders.length === 0 && <p className="text-sm text-slate-400">No past orders yet.</p>}
        <div className="space-y-2">
          {pastOrders.map((order) => (
            <div key={order.id} className="rounded-lg border border-slate-200 p-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700">{order.customerName}</span>
                <span className="text-[11px] text-slate-400">{ORDER_STATUS_LABELS[order.status]}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {order.items.map((item) => `${item.quantity}x ${item.name}`).join(', ')} · ₱{order.total}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function AddProductForm({
  onAdd,
}: {
  onAdd: (args: { name: string; genericName: string | null; category: MedicineCategory; price: number }) => void
}) {
  const [name, setName] = useState('')
  const [genericName, setGenericName] = useState('')
  const [category, setCategory] = useState<MedicineCategory>('otc')
  const [price, setPrice] = useState('')
  const [error, setError] = useState('')

  function handleAdd() {
    const priceNum = Number(price)
    if (!name.trim() || !Number.isFinite(priceNum) || priceNum <= 0) {
      setError('Enter a product name and a price greater than 0.')
      return
    }
    onAdd({ name: name.trim(), genericName: genericName.trim() || null, category, price: priceNum })
    setName('')
    setGenericName('')
    setCategory('otc')
    setPrice('')
    setError('')
  }

  return (
    <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
      <p className="text-xs font-medium text-slate-500">Add a product</p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Product name (e.g. Biogesic 500mg)"
        className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
      />
      <input
        value={genericName}
        onChange={(e) => setGenericName(e.target.value)}
        placeholder="Generic name (optional)"
        className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
      />
      <div className="flex gap-1.5">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as MedicineCategory)}
          className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
        >
          <option value="otc">OTC</option>
          <option value="rx">Rx required</option>
          <option value="restricted">Restricted</option>
        </select>
        <input
          type="number"
          min={0}
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Price ₱"
          className="w-28 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
        />
      </div>
      {error && <p className="text-[11px] font-medium text-rose-600">{error}</p>}
      <button
        type="button"
        onClick={handleAdd}
        className="w-full rounded-lg border border-brand-300 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
      >
        + Add product
      </button>
    </div>
  )
}

function PaymentAccountForm({
  label,
  details,
  onSave,
}: {
  label: string
  details: PaymentAccountDetails | null
  onSave: (details: PaymentAccountDetails | null) => void
}) {
  // Starts in edit mode when nothing's saved yet (nudges a new pharmacy to
  // fill it in), read-only summary once something's saved — same
  // show-then-edit shape as everything else in this portal.
  const [editing, setEditing] = useState(!details)
  const [accountName, setAccountName] = useState(details?.accountName ?? '')
  const [accountNumber, setAccountNumber] = useState(details?.accountNumber ?? '')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(details?.qrDataUrl ?? null)

  function handleSave() {
    if (!accountName.trim() || !accountNumber.trim()) return
    onSave({ accountName: accountName.trim(), accountNumber: accountNumber.trim(), qrDataUrl })
    setEditing(false)
  }

  function handleRemove() {
    onSave(null)
    setAccountName('')
    setAccountNumber('')
    setQrDataUrl(null)
    setEditing(true)
  }

  if (!editing && details) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-2.5">
        {details.qrDataUrl ? (
          <img src={details.qrDataUrl} alt={`${label} QR code`} className="h-12 w-12 shrink-0 rounded-md object-cover" />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xl text-slate-300">
            📱
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-700">
            {label} · {details.accountName}
          </p>
          <p className="text-[11px] text-slate-400">{details.accountNumber}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Edit
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-1.5 rounded-lg border border-slate-200 p-2.5">
      <p className="text-xs font-medium text-slate-500">{label} account</p>
      <input
        value={accountName}
        onChange={(e) => setAccountName(e.target.value)}
        placeholder="Account name"
        className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
      />
      <input
        value={accountNumber}
        onChange={(e) => setAccountNumber(e.target.value)}
        placeholder="Mobile number / account number"
        className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
      />
      <DocumentUploadField label={`${label} QR code (optional)`} dataUrl={qrDataUrl} onUpload={setQrDataUrl} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!accountName.trim() || !accountNumber.trim()}
          className="flex-1 rounded-lg border border-brand-300 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save
        </button>
        {details && (
          <button
            type="button"
            onClick={handleRemove}
            className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  )
}

function QuoteOrderCard({
  order,
  onSendQuote,
  onReject,
  onReviewPrescription,
  onSendMessage,
}: {
  order: MedsOrder
  onSendQuote: (items: MedsOrderItem[], receiptDataUrl: string | null) => void
  onReject: (reason: string) => void
  onReviewPrescription: (approved: boolean, reason: string | null) => void
  onSendMessage: (text: string) => void
}) {
  const [rejectReason, setRejectReason] = useState('')
  const [prescriptionRejectReason, setPrescriptionRejectReason] = useState('')
  // Editable per-order pricing — defaults to whatever the customer's cart
  // captured (the catalog price at the time), but the pharmacy is free to
  // override any line item just for this request (e.g. a price change, a
  // brand substitution) before sending the quote back.
  const [items, setItems] = useState<MedsOrderItem[]>(order.items)
  // For a prescription-only order (customer attached a photo instead of
  // typing items) — the pharmacy reads the prescription and either types
  // in what it covers (below) and/or attaches a photo of the receipt they
  // wrote up themselves as backup/alternative proof of the quoted amount.
  const [draftName, setDraftName] = useState('')
  const [draftQty, setDraftQty] = useState('1')
  const [draftPrice, setDraftPrice] = useState('')
  const [receiptDataUrl, setReceiptDataUrl] = useState<string | null>(order.receiptDataUrl)
  const needsPrescriptionReview = order.prescriptionStatus === 'pending'
  // Medicine cost only — delivery + service fee belong to the tricycle ride,
  // which doesn't exist yet at quotation time (it's only dispatched once the
  // customer accepts and checks out), so it has no place on this quote.
  const medicineTotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)

  function updatePrice(productId: string, unitPrice: number) {
    setItems((prev) => prev.map((item) => (item.productId === productId ? { ...item, unitPrice } : item)))
  }

  function updateQuantity(productId: string, quantity: number) {
    setItems((prev) => prev.map((item) => (item.productId === productId ? { ...item, quantity } : item)))
  }

  function updateNote(productId: string, note: string) {
    setItems((prev) => prev.map((item) => (item.productId === productId ? { ...item, note: note || null } : item)))
  }

  function addManualItem() {
    const price = Number(draftPrice)
    const qty = Number(draftQty)
    if (!draftName.trim() || !Number.isFinite(price) || price <= 0 || !Number.isFinite(qty) || qty <= 0) return
    setItems((prev) => [
      ...prev,
      { productId: `manual-${Date.now()}`, name: draftName.trim(), quantity: qty, unitPrice: price, note: null },
    ])
    setDraftName('')
    setDraftQty('1')
    setDraftPrice('')
  }

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">{order.customerName}</span>
        <span className="text-xs font-semibold text-slate-800">₱{medicineTotal}</span>
      </div>
      <div className="mt-2 rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
        <p className="mb-2 text-sm font-semibold text-amber-800">🧾 Quotation — price each item</p>
        {items.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[320px] text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-1.5 py-1.5 text-left font-medium">#</th>
                  <th className="px-1.5 py-1.5 text-left font-medium">Description</th>
                  <th className="px-1.5 py-1.5 text-right font-medium">Unit Cost</th>
                  <th className="px-1.5 py-1.5 text-right font-medium">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, i) => (
                  <tr key={item.productId}>
                    <td className="px-1.5 py-1.5 align-top text-slate-400">{i + 1}</td>
                    <td className="max-w-[100px] px-1.5 py-1.5 align-top">
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.productId, Number(e.target.value) || 0)}
                          className="w-8 shrink-0 rounded-md border border-slate-300 px-1 py-0.5 text-center text-xs"
                        />
                        <span className="truncate font-medium text-slate-700">x {item.name}</span>
                      </div>
                      <input
                        value={item.note ?? ''}
                        onChange={(e) => updateNote(item.productId, e.target.value)}
                        placeholder="Note for customer"
                        className="mt-1 w-full rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600 placeholder:text-slate-400"
                      />
                    </td>
                    <td className="whitespace-nowrap px-1.5 py-1.5 text-right align-top">
                      <span className="inline-flex items-center gap-0.5">
                        ₱
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.unitPrice}
                          onChange={(e) => updatePrice(item.productId, Number(e.target.value) || 0)}
                          className="w-10 rounded-md border border-slate-300 px-1 py-0.5 text-right text-xs"
                        />
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right align-top font-medium text-slate-700">
                      ₱{(item.unitPrice * item.quantity).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td colSpan={3} className="px-2 py-1 text-right text-xs font-semibold text-slate-800">
                    Medicine total
                  </td>
                  <td className="whitespace-nowrap px-2 py-1 text-right text-xs font-semibold text-slate-900">
                    ₱{medicineTotal.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {order.items.length === 0 && (
          <div className={items.length > 0 ? 'mt-2 space-y-1.5' : 'space-y-1.5'}>
            <p className="text-[11px] font-medium text-amber-800">
              No items listed by the customer — check the prescription below, then either type in what you're
              fulfilling (with a price) or attach a photo of the receipt you wrote up.
            </p>
            <div className="flex gap-1.5">
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Item / medicine name"
                className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs"
              />
              <input
                type="number"
                min={1}
                value={draftQty}
                onChange={(e) => setDraftQty(e.target.value)}
                placeholder="Qty"
                className="w-14 rounded-md border border-slate-300 px-1.5 py-1 text-xs"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={draftPrice}
                onChange={(e) => setDraftPrice(e.target.value)}
                placeholder="₱ each"
                className="w-20 rounded-md border border-slate-300 px-1.5 py-1 text-xs"
              />
            </div>
            <button
              type="button"
              onClick={addManualItem}
              disabled={!draftName.trim() || !draftPrice.trim()}
              className="w-full rounded-lg border border-brand-300 bg-white py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Add item
            </button>
            <DocumentUploadField label="Receipt photo (optional)" dataUrl={receiptDataUrl} onUpload={setReceiptDataUrl} />
          </div>
        )}
      </div>

      <p className="mt-1.5 text-[11px] text-slate-400">Deliver to: {order.deliveryAddress.label}</p>

      {order.prescriptionDataUrls.length > 0 && (
        <div className="mt-2 rounded-lg bg-slate-50 p-2">
          <p className="mb-1 text-[11px] font-medium text-slate-500">
            Uploaded prescription{order.prescriptionDataUrls.length > 1 ? ` (${order.prescriptionDataUrls.length} pages)` : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            {order.prescriptionDataUrls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer">
                <img src={url} alt={`Prescription page ${i + 1}`} className="h-24 w-24 rounded-md object-cover" />
              </a>
            ))}
          </div>
          {needsPrescriptionReview ? (
            <div className="mt-2 space-y-1.5">
              <input
                value={prescriptionRejectReason}
                onChange={(e) => setPrescriptionRejectReason(e.target.value)}
                placeholder="Reason if rejecting (optional)"
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onReviewPrescription(true, null)}
                  className="flex-1 rounded-lg bg-brand-600 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                >
                  Approve prescription
                </button>
                <button
                  type="button"
                  onClick={() => onReviewPrescription(false, prescriptionRejectReason.trim() || 'Not clear enough')}
                  className="flex-1 rounded-lg border border-rose-300 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                >
                  Reject
                </button>
              </div>
            </div>
          ) : (
            <p className={`mt-1 text-[11px] font-medium ${order.prescriptionStatus === 'approved' ? 'text-emerald-600' : 'text-rose-600'}`}>
              {order.prescriptionStatus === 'approved' ? '✓ Prescription approved' : '✗ Prescription rejected'}
            </p>
          )}
        </div>
      )}

      <div className="mt-3 space-y-1.5">
        {needsPrescriptionReview && (
          <p className="text-[11px] text-amber-700">Review the prescription above before sending a quote.</p>
        )}
        {!needsPrescriptionReview && items.length === 0 && (
          <p className="text-[11px] text-amber-700">Add at least one item with a price above before sending a quote.</p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSendQuote(items, receiptDataUrl)}
            disabled={needsPrescriptionReview || items.length === 0}
            className="flex-1 rounded-lg bg-brand-600 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Send quote
          </button>
        </div>
        <div className="flex gap-2">
          <input
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for declining (optional)"
            className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={() => onReject(rejectReason.trim() || 'Unable to fulfill this order')}
            className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
          >
            Decline
          </button>
        </div>
        <OrderChat messages={order.messages} viewerRole="pharmacy" otherPartyLabel={order.customerName} onSend={onSendMessage} />
      </div>
    </div>
  )
}
