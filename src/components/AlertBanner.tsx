export function AlertBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700">
      <span className="text-base leading-none">⚠</span>
      <span>{message}</span>
    </div>
  )
}
