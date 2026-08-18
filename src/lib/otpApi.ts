// Talks to the local Express server (see server/index.js) which holds the
// Semaphore API key and actually sends the SMS — a browser-only app can't
// call a paid SMS gateway directly without exposing the key to anyone who
// opens devtools.
const OTP_API_BASE = import.meta.env.VITE_OTP_API_BASE ?? 'http://localhost:4000'

interface OtpApiResult {
  ok: boolean
  error?: string
  // The server (npm run server) isn't running at all — as opposed to the
  // server being up but rejecting the request. Callers use this to silently
  // fall back to an on-screen simulated code instead of surfacing an error,
  // so the app is still fully testable without the OTP server running. Once
  // the server (and a Semaphore key) is set up, this stops firing and real
  // texts go out automatically — no code changes needed then.
  unreachable?: boolean
}

async function postJson(path: string, body: unknown): Promise<OtpApiResult> {
  try {
    const res = await fetch(`${OTP_API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: data.error ?? 'Something went wrong.' }
    return { ok: true }
  } catch {
    return { ok: false, unreachable: true }
  }
}

export function sendRealOtp(phone: string): Promise<OtpApiResult> {
  return postJson('/api/send-otp', { phone })
}

export function verifyRealOtp(phone: string, code: string): Promise<OtpApiResult> {
  return postJson('/api/verify-otp', { phone, code })
}
