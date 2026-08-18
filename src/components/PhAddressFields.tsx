import { PH_PROVINCES, getBarangaysForCity, getCitiesForProvince } from '../mock/data'

export interface PhAddressValue {
  province: string
  city: string
  barangay: string
  addressDetail: string
}

interface PhAddressFieldsProps {
  value: PhAddressValue
  onChange: (value: PhAddressValue) => void
  addressDetailLabel?: string
  addressDetailPlaceholder?: string
}

// Shared cascading Province → City/Municipality → Barangay picker used by
// every registration form in the app (TODA, driver, passenger, parent) so
// they all speak the same address shape.
export function PhAddressFields({
  value,
  onChange,
  addressDetailLabel = 'Detailed address (zone, street, house no., notes)',
  addressDetailPlaceholder = 'e.g. Zone 2, near the public market entrance',
}: PhAddressFieldsProps) {
  const cities = value.province ? getCitiesForProvince(value.province) : []
  const barangays = value.province && value.city ? getBarangaysForCity(value.province, value.city) : []

  return (
    <>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Province</label>
        <select
          value={value.province}
          onChange={(e) => onChange({ province: e.target.value, city: '', barangay: '', addressDetail: value.addressDetail })}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Select province</option>
          {PH_PROVINCES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">City / Municipality</label>
          <select
            value={value.city}
            onChange={(e) => onChange({ ...value, city: e.target.value, barangay: '' })}
            disabled={!value.province}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
          >
            <option value="">Select city</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Barangay</label>
          <select
            value={value.barangay}
            onChange={(e) => onChange({ ...value, barangay: e.target.value })}
            disabled={!value.city}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
          >
            <option value="">Select barangay</option>
            {barangays.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">{addressDetailLabel}</label>
        <textarea
          value={value.addressDetail}
          onChange={(e) => onChange({ ...value, addressDetail: e.target.value })}
          rows={2}
          placeholder={addressDetailPlaceholder}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
    </>
  )
}

// CLSU (Science City of Muñoz, Nueva Ecija) is this app's home base — every
// registration form starts pre-filled here instead of on empty "Select
// province/city" prompts, since it's the default address in this demo.
export const EMPTY_PH_ADDRESS: PhAddressValue = {
  province: 'Nueva Ecija',
  city: 'Science City of Muñoz',
  barangay: 'CLSU',
  addressDetail: '',
}
