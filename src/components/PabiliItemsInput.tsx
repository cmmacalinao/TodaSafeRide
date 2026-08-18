import { useState } from 'react'

interface PabiliItemRow {
  id: string
  item: string
  brand: string
  qty: string
  unit: string
  unitCost: string
}

// Pulls a leading number out of a freeform Qty string (e.g. "2 boxes" -> 2)
// so a receipt line total can still be computed — Qty is deliberately
// freeform elsewhere (it can be a peso budget like "₱50 worth" instead of a
// count), so this is a best-effort read, not a strict parse.
function qtyMultiplier(qty: string): number {
  const match = qty.match(/\d+(\.\d+)?/)
  return match ? parseFloat(match[0]) : 1
}

function lineCost(row: PabiliItemRow): number {
  const unit = parseFloat(row.unitCost)
  if (!unit || Number.isNaN(unit)) return 0
  return unit * qtyMultiplier(row.qty)
}

// Turns the freeform "what to buy" textarea into an editable table — each
// row is its own item with Qty, Unit, Brand, and an optional Unit Cost
// estimate (same field set/order as MedsItemsBrandInput, for a consistent
// "build your order" experience across Pabili and Medicine), with
// Edit/Delete per row and an "Add item" form below. Still hands the parent
// a single string (Ride.pabiliItems' actual shape, shown on the driver's
// ride card and trip history unchanged) — this component owns the
// structured rows itself and just re-serializes them into that string on
// every change, so no other file needs to know rows exist.
export function PabiliItemsInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // Only used to seed the initial rows on mount (e.g. if a caller ever
  // remounts this with pre-existing text) — can't losslessly split back into
  // separate columns, so it lands as one row with the raw text as the item
  // name. Callers that reset to '' between orders (see the `key`-remount
  // pattern in PassengerPage.tsx) never hit this with stale text.
  const [rows, setRows] = useState<PabiliItemRow[]>(() =>
    value.trim() ? [{ id: 'seed', item: value.trim(), brand: '', qty: '', unit: '', unitCost: '' }] : [],
  )
  const [draftItem, setDraftItem] = useState('')
  const [draftBrand, setDraftBrand] = useState('')
  const [draftQty, setDraftQty] = useState('')
  const [draftUnit, setDraftUnit] = useState('')
  const [draftUnitCost, setDraftUnitCost] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  function commitRows(next: PabiliItemRow[]) {
    setRows(next)
    onChange(
      next
        .map((r) => {
          const brandPart = r.brand.trim() ? ` (${r.brand.trim()})` : ''
          const unitPart = r.unit.trim() ? ` ${r.unit.trim()}` : ''
          const qtyPart = r.qty.trim() ? `${r.qty.trim()}${unitPart} ` : ''
          const costPart = r.unitCost.trim() ? ` @₱${r.unitCost.trim()}` : ''
          return `${qtyPart}${r.item.trim()}${brandPart}${costPart}`
        })
        .join(', '),
    )
  }

  function handleAddOrSave() {
    if (!draftItem.trim()) return
    if (editingId) {
      commitRows(
        rows.map((r) =>
          r.id === editingId
            ? {
                ...r,
                item: draftItem.trim(),
                brand: draftBrand.trim(),
                qty: draftQty.trim(),
                unit: draftUnit.trim(),
                unitCost: draftUnitCost.trim(),
              }
            : r,
        ),
      )
    } else {
      commitRows([
        ...rows,
        {
          id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          item: draftItem.trim(),
          brand: draftBrand.trim(),
          qty: draftQty.trim(),
          unit: draftUnit.trim(),
          unitCost: draftUnitCost.trim(),
        },
      ])
    }
    setEditingId(null)
    setDraftItem('')
    setDraftBrand('')
    setDraftQty('')
    setDraftUnit('')
    setDraftUnitCost('')
  }

  function handleEdit(row: PabiliItemRow) {
    setEditingId(row.id)
    setDraftItem(row.item)
    setDraftBrand(row.brand)
    setDraftQty(row.qty)
    setDraftUnit(row.unit)
    setDraftUnitCost(row.unitCost)
  }

  function handleCancelEdit() {
    setEditingId(null)
    setDraftItem('')
    setDraftBrand('')
    setDraftQty('')
    setDraftUnit('')
    setDraftUnitCost('')
  }

  function handleDelete(id: string) {
    commitRows(rows.filter((r) => r.id !== id))
    if (editingId === id) handleCancelEdit()
  }

  const total = rows.reduce((sum, r) => sum + lineCost(r), 0)

  return (
    <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
      <p className="mb-2 text-sm font-semibold text-amber-800">🧾 What do you want your driver to buy?</p>
      {rows.length > 0 && (
        <div className="mb-2 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[320px] text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Description</th>
                <th className="px-2 py-1.5 text-right font-medium">Unit Cost</th>
                <th className="px-2 py-1.5 text-right font-medium">Cost</th>
                <th className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className={editingId === row.id ? 'bg-brand-50' : 'bg-white'}>
                  <td className="max-w-[120px] px-2 py-1.5">
                    <div className="truncate text-slate-700">{row.item}</div>
                    <div className="truncate text-[10px] text-slate-400">
                      {[row.brand, [row.qty, row.unit].filter(Boolean).join(' ')].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right text-slate-500">
                    {row.unitCost ? `₱${row.unitCost}` : '—'}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right font-medium text-slate-700">
                    {lineCost(row) > 0 ? `₱${lineCost(row).toFixed(2)}` : '—'}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right">
                    <button type="button" onClick={() => handleEdit(row)} className="mr-2 font-medium text-brand-600 hover:text-brand-700">
                      Edit
                    </button>
                    <button type="button" onClick={() => handleDelete(row.id)} className="font-medium text-rose-600 hover:text-rose-700">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {total > 0 && (
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td className="px-2 py-1.5 text-right text-[11px] font-semibold text-slate-600">Total (estimate)</td>
                  <td />
                  <td className="whitespace-nowrap px-2 py-1.5 text-right text-[11px] font-semibold text-slate-800">
                    ₱{total.toFixed(2)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <div>
          <label className="mb-0.5 block text-[10px] font-medium text-amber-700">Qty</label>
          <input
            value={draftQty}
            onChange={(e) => setDraftQty(e.target.value)}
            placeholder="e.g. 2 or ₱50"
            className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] font-medium text-amber-700">Unit</label>
          <input
            value={draftUnit}
            onChange={(e) => setDraftUnit(e.target.value)}
            placeholder="e.g. kg, pcs, box"
            className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="mb-0.5 block text-[10px] font-medium text-amber-700">Description</label>
          <input
            value={draftItem}
            onChange={(e) => setDraftItem(e.target.value)}
            placeholder="e.g. Paracetamol 500mg"
            className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] font-medium text-amber-700">Brand</label>
          <input
            value={draftBrand}
            onChange={(e) => setDraftBrand(e.target.value)}
            placeholder="e.g. Lucky Me"
            className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] font-medium text-amber-700">Unit Cost (Estimate Only)</label>
          <input
            value={draftUnitCost}
            onChange={(e) => setDraftUnitCost(e.target.value)}
            placeholder="e.g. 50"
            inputMode="decimal"
            className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
          />
        </div>
      </div>
      <div className="mt-1.5 flex gap-2">
        <button
          type="button"
          onClick={handleAddOrSave}
          disabled={!draftItem.trim()}
          className="flex-1 rounded-lg border border-brand-300 bg-white py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {editingId ? 'Save changes' : '+ Add item'}
        </button>
        {editingId && (
          <button
            type="button"
            onClick={handleCancelEdit}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
          >
            Cancel
          </button>
        )}
      </div>
      <p className="mt-1 text-[11px] text-amber-700">
        Only Description is required — Qty, Unit, Brand, and Unit Cost are optional. Qty can be an amount (2kg, 3
        pcs) or a peso budget (₱50 worth). Unit Cost is just your estimate — bring enough cash to cover the items
        themselves separately from the fare below.
      </p>
    </div>
  )
}
