import 'dotenv/config'
import express from 'express'
import cors from 'cors'

const PORT = process.env.PORT ?? 4000
const SEMAPHORE_API_KEY = process.env.SEMAPHORE_API_KEY
const SEMAPHORE_SENDER_NAME = process.env.SEMAPHORE_SENDER_NAME ?? 'SEMAPHORE'

const app = express()
app.use(cors({ origin: /^http:\/\/localhost:\d+$/ }))
app.use(express.json())

// phone -> { code, expiresAt }. In-memory only: fine for a local prototype,
// resets whenever this server restarts.
const otpStore = new Map()
const CODE_TTL_MS = 5 * 60 * 1000

function normalizePhone(phone) {
  return String(phone ?? '').replace(/[^\d+]/g, '')
}

async function sendViaSemaphore(phone, code) {
  const message = `Your TodaRide verification code is ${code}. It expires in 5 minutes.`
  const res = await fetch('https://api.semaphore.co/api/v4/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apikey: SEMAPHORE_API_KEY,
      number: phone,
      message,
      sendername: SEMAPHORE_SENDER_NAME,
    }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const detail = (data && (data.message || JSON.stringify(data))) || res.statusText
    throw new Error(`Semaphore rejected the request: ${detail}`)
  }
  return data
}

app.post('/api/send-otp', async (req, res) => {
  const phone = normalizePhone(req.body?.phone)
  if (!phone) return res.status(400).json({ error: 'Phone number is required.' })

  const code = String(Math.floor(1000 + Math.random() * 9000))
  otpStore.set(phone, { code, expiresAt: Date.now() + CODE_TTL_MS })

  if (!SEMAPHORE_API_KEY) {
    // No gateway configured yet — fall back to logging the code to this
    // terminal so the flow is still testable before you've signed up for
    // Semaphore. Once SEMAPHORE_API_KEY is set in server/.env, real texts go
    // out instead.
    console.log(`[otp] No SEMAPHORE_API_KEY set — code for ${phone} is ${code}`)
    return res.json({ ok: true, dev: true })
  }

  try {
    await sendViaSemaphore(phone, code)
    return res.json({ ok: true })
  } catch (err) {
    console.error('[otp] Semaphore send failed:', err.message)
    return res.status(502).json({ error: 'Failed to send SMS. Check server logs and your Semaphore account/credits.' })
  }
})

app.post('/api/verify-otp', (req, res) => {
  const phone = normalizePhone(req.body?.phone)
  const code = String(req.body?.code ?? '').trim()
  const entry = otpStore.get(phone)

  if (!entry) return res.status(400).json({ error: 'No code was sent to this number — send one first.' })
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(phone)
    return res.status(400).json({ error: 'Code expired — request a new one.' })
  }
  if (code !== entry.code) return res.status(400).json({ error: 'Incorrect code.' })

  otpStore.delete(phone)
  return res.json({ ok: true })
})

app.listen(PORT, () => {
  console.log(`OTP server listening on http://localhost:${PORT}`)
  if (!SEMAPHORE_API_KEY) {
    console.log('SEMAPHORE_API_KEY not set — sending will be simulated via console log until you add it to server/.env')
  }
})
