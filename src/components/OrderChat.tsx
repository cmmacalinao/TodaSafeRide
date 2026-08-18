import { useState } from 'react'
import type { OrderMessage } from '../types'

// Shared by both sides of a medicine order (MedsBooking's ActiveOrderCard on
// the customer side, PharmacyPortalPage's order cards on the pharmacy side)
// — same message list, just viewed from a different `viewerRole` so each
// side's own messages align right and the other party's align left.
export function OrderChat({
  messages,
  viewerRole,
  otherPartyLabel,
  onSend,
}: {
  messages: OrderMessage[]
  viewerRole: 'customer' | 'pharmacy'
  otherPartyLabel: string
  onSend: (text: string) => void
}) {
  const [draft, setDraft] = useState('')

  function handleSend() {
    if (!draft.trim()) return
    onSend(draft.trim())
    setDraft('')
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5">
      <p className="mb-1.5 text-xs font-semibold text-slate-600">💬 Chat with {otherPartyLabel}</p>
      {messages.length === 0 ? (
        <p className="mb-2 text-[11px] text-slate-400">
          No messages yet — ask about brands, stock, substitutions, or delivery details.
        </p>
      ) : (
        <div className="mb-2 max-h-52 space-y-1.5 overflow-y-auto pr-1">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender === viewerRole ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-lg px-2.5 py-1.5 text-xs ${
                  m.sender === viewerRole ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.text}</p>
                <p className={`mt-0.5 text-[10px] ${m.sender === viewerRole ? 'text-brand-100' : 'text-slate-400'}`}>
                  {new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend()
          }}
          placeholder="Type a message..."
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!draft.trim()}
          className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Send
        </button>
      </div>
    </div>
  )
}
