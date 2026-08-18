import { useState } from 'react'

export interface MedsItemRow {
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

function lineCost(row: MedsItemRow): number {
  const unit = parseFloat(row.unitCost)
  if (!unit || Number.isNaN(unit)) return 0
  return unit * qtyMultiplier(row.qty)
}

// Same editable-table pattern as PabiliItemsInput (Item + Qty, Edit/Delete,
// "+ Add item"), plus a Brand column since medicine often needs to specify
// a brand (e.g. "Paracetamol" vs "Biogesic"), a Unit column for how it's
// sold (pcs, box, bottle...), and a Unit Cost column so the running list
// reads like a receipt (# / Description / Unit Cost / Cost) while items are
// still being added — the customer's own price estimate, which flows into
// MedsOrderItem.unitPrice as a starting point the pharmacy can adjust when
// it sends its real quote. Hands the parent both a single serialized string
// (for the "driver buys it" Ride.pabiliItems shape) and the raw structured
// rows via onRowsChange (so MedsBooking can build real MedsOrderItem[] lines
// for the "order direct to pharmacy" quote request).
export function MedsItemsBrandInput({
  value,
  onChange,
  onRowsChange,
}: {
  value: string
  onChange: (v: string) => void
  onRowsChange?: (rows: MedsItemRow[]) => void
}) {
  const [rows, setRows] = useState<MedsItemRow[]>(() =>
    value.trim() ? [{ id: 'seed', item: value.trim(), brand: '', qty: '', unit: '', unitCost: '' }] : [],
  )
  const [draftItem, setDraftItem] = useState('')
  const [draftBrand, setDraftBrand] = useState('')
  const [draftQty, setDraftQty] = useState('')
  const [draftUnit, setDraftUnit] = useState('')
  const [draftUnitCost, setDraftUnitCost] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  function commitRows(next: MedsItemRow[]) {
    setRows(next)
    onRowsChange?.(next)
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

  function handleEdit(row: MedsItemRow) {
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
      <p className="mb-2 text-sm font-semibold text-amber-800">🧾 Items to buy — your order is built here</p>
      {rows.length > 0 && (
        <div className="mb-2 overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">#</th>
                <th className="px-2 py-1.5 text-left font-medium">Description</th>
                <th className="px-2 py-1.5 text-right font-medium">Unit Cost</th>
                <th className="px-2 py-1.5 text-right font-medium">Cost</th>
                <th className="px-1 py-1.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, i) => (
                <tr key={row.id} className={editingId === row.id ? 'bg-brand-50' : 'bg-white'}>
                  <td className="px-2 py-1.5 align-top text-slate-400">{i + 1}</td>
                  <td className="max-w-[130px] px-2 py-1.5 align-top">
                    <div className="truncate font-medium text-slate-700">{row.item}</div>
                    <div className="truncate text-[10px] text-slate-400">
                      {[row.brand, [row.qty, row.unit].filter(Boolean).join(' ')].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right align-top text-slate-500">
                    {row.unitCost ? `₱${row.unitCost}` : '—'}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right align-top font-medium text-slate-700">
                    {lineCost(row) > 0 ? `₱${lineCost(row).toFixed(2)}` : '—'}
                  </td>
                  <td className="whitespace-nowrap px-1 py-1.5 text-right align-top">
                    <button type="button" onClick={() => handleEdit(row)} className="mr-1.5 text-brand-600 hover:text-brand-700" aria-label="Edit">
                      ✎
                    </button>
                    <button type="button" onClick={() => handleDelete(row.id)} className="text-rose-600 hover:text-rose-700" aria-label="Delete">
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {total > 0 && (
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td colSpan={3} className="px-2 py-1.5 text-right text-[11px] font-semibold text-slate-600">
                    Total (estimate)
                  </td>
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
            placeholder="e.g. pcs, box, bottle"
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
            placeholder="e.g. Biogesic"
            className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] font-medium text-amber-700">Unit Cost (Estimate Only)</label>
          <input
            value={draftUnitCost}
            onChange={(e) => setDraftUnitCost(e.target.value)}
            placeholder="e.g. 5"
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
        Only Description is required — Qty, Unit, Brand, and Unit Cost are optional. Unit Cost is just your estimate,
        the pharmacy sends the real price with their quote.
      </p>
    </div>
  )
}
