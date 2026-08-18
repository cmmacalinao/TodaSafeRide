const STARS = [1, 2, 3, 4, 5]

interface StarRatingProps {
  value: number
  onChange?: (value: number) => void
  size?: 'sm' | 'md'
}

// Clickable 1-5 star input when `onChange` is given, otherwise a read-only
// display (e.g. showing a driver's already-submitted average).
export function StarRating({ value, onChange, size = 'md' }: StarRatingProps) {
  const textSize = size === 'sm' ? 'text-base' : 'text-2xl'
  return (
    <div className="flex gap-0.5" role={onChange ? 'radiogroup' : undefined}>
      {STARS.map((star) => (
        <button
          key={star}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(star)}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          className={`leading-none ${textSize} ${onChange ? 'cursor-pointer' : 'cursor-default'} ${
            star <= value ? 'text-amber-400' : 'text-slate-300'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  )
}
