import { isPdf, buildDailyPdf } from './pdf.ts'
import { createStore, subscriberSchedule, type Subscriber, type SubscriberStore } from './store.ts'
import { signUnsubscribeToken, unsubscribeSecret } from './token.ts'
import type { Schedule } from './validate.ts'

export type DailyMode = 'send' | 'preview' | 'test'

export type DailyResult = {
  ok: true
  mode: DailyMode
  active: number
  eligible: number
  built: number
  emailed: number
  recorded: number
  skipped: number
  failed: number
  pages: number[]
  bytes: number[]
  pdf: boolean
  recipients: string[]
  reason?: string
}

type SendResult = { ok: true } | { ok: false; error: string }

export type DailyDeps = {
  now?: Date
  store?: SubscriberStore
  fetchImpl?: typeof fetch
  resendApiKey?: string | null
  emailFrom?: string | null
  origin?: string
  secret?: string
  mode?: DailyMode
}

export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10)
}

const DAY_MS = 86_400_000

function calendarDay(value: string): string | null {
  const day = value.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const parsed = Date.parse(`${day}T00:00:00.000Z`)
  if (Number.isNaN(parsed)) return null
  if (new Date(parsed).toISOString().slice(0, 10) !== day) return null
  return day
}

function daysBetween(earlier: string, later: string): number {
  const start = Date.parse(`${earlier}T00:00:00.000Z`)
  const end = Date.parse(`${later}T00:00:00.000Z`)
  return Math.round((end - start) / DAY_MS)
}

/** Whether this cron run should mail the subscriber. A missing schedule counts as daily. */
export function isDue(subscriber: Pick<Subscriber, 'schedule' | 'lastSentOn'>, now: Date): boolean {
  const last = subscriber.lastSentOn ? calendarDay(subscriber.lastSentOn) : null
  if (!last) return true
  const today = utcDay(now)
  const schedule = subscriberSchedule(subscriber)
  if (schedule === 'weekly') return daysBetween(last, today) >= 7
  if (schedule === 'monthly') return last.slice(0, 7) !== today.slice(0, 7)
  return last !== today
}

export function siteOrigin(fallback?: string): string {
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (productionHost) return `https://${productionHost}`
  const host = process.env.VERCEL_URL
  if (host) return `https://${host}`
  return fallback ?? 'http://127.0.0.1:5173'
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

const EMAIL_COPY: Record<Schedule, { subject: string; lead: string }> = {
  daily: {
    subject: "Today's OlloBooks puzzles",
    lead: "Today's Sudoku puzzles for your kids are attached. Print them on US Letter.",
  },
  weekly: {
    subject: "This week's OlloBooks puzzles",
    lead: "This week's Sudoku puzzles for your kids are attached. Print them on US Letter.",
  },
  monthly: {
    subject: "This month's OlloBooks puzzles",
    lead: "This month's Sudoku puzzles for your kids are attached. Print them on US Letter.",
  },
}

export function puzzleEmail(unsubscribeUrl: string, schedule: Schedule = 'daily'): { subject: string; text: string; html: string } {
  const copy = EMAIL_COPY[schedule]
  const text = [copy.lead, '', 'You can unsubscribe from any email.', unsubscribeUrl].join('\n')
  const safeUrl = escapeHtml(unsubscribeUrl)
  const html = `<!doctype html><html><body style="margin:0;background:#f3e7d4;color:#241c16;font-family:Georgia,serif;padding:24px">
<p style="font-size:18px;line-height:1.45">${escapeHtml(copy.lead)}</p>
<p style="font-size:14px;color:#6b5c4e">You can unsubscribe from any email.</p>
<p><a href="${safeUrl}" style="color:#c44724">Unsubscribe</a></p>
</body></html>`
  return { subject: copy.subject, text, html }
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const step = 0x8000
  for (let index = 0; index < bytes.length; index += step) {
    binary += String.fromCharCode(...bytes.subarray(index, index + step))
  }
  return btoa(binary)
}

export function unsubscribeLink(origin: string, token: string): string {
  const url = new URL('/api/unsubscribe', origin)
  url.searchParams.set('token', token)
  return url.toString()
}

export async function sendPuzzleEmail(options: {
  fetchImpl: typeof fetch
  apiKey: string
  from: string
  to: string
  unsubscribeUrl: string
  pdf: Uint8Array
  schedule?: Schedule
}): Promise<SendResult> {
  const message = puzzleEmail(options.unsubscribeUrl, options.schedule ?? 'daily')
  const response = await options.fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: options.from,
      to: [options.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
      attachments: [
        {
          filename: 'ollobooks-sudoku.pdf',
          content: toBase64(options.pdf),
          content_type: 'application/pdf',
        },
      ],
    }),
  })
  if (!response.ok) {
    const detail = await response.text()
    return { ok: false, error: detail.slice(0, 300) }
  }
  return { ok: true }
}

function seedFor(subscriber: Subscriber, day: string): number {
  let hash = 0
  const text = `${day}:${subscriber.email}:${subscriber.size}:${subscriber.difficulty}:${subscriber.count}`
  for (let index = 0; index < text.length; index += 1) {
    hash = (Math.imul(hash, 31) + text.charCodeAt(index)) >>> 0
  }
  return hash || 1
}

export async function runDaily(deps: DailyDeps = {}): Promise<DailyResult> {
  const now = deps.now ?? new Date()
  const day = utcDay(now)
  const store = deps.store ?? createStore()
  const mode = deps.mode ?? 'send'
  const fetchImpl = deps.fetchImpl ?? fetch
  const apiKey = deps.resendApiKey === undefined ? (process.env.RESEND_API_KEY ?? null) : deps.resendApiKey
  const from = deps.emailFrom === undefined ? (process.env.EMAIL_FROM ?? null) : deps.emailFrom
  const origin = deps.origin ?? siteOrigin()

  const subscribers = await store.list()
  const active = subscribers.filter((subscriber) => !subscriber.unsubscribedAt)
  const eligible = active.filter((subscriber) => isDue(subscriber, now))
  const result: DailyResult = {
    ok: true,
    mode,
    active: active.length,
    eligible: eligible.length,
    built: 0,
    emailed: 0,
    recorded: 0,
    skipped: active.length - eligible.length,
    failed: 0,
    pages: [],
    bytes: [],
    pdf: false,
    recipients: [],
  }

  if (mode === 'send' && (!apiKey || !from)) {
    const reason = !apiKey ? 'RESEND_API_KEY is unset; no email sent' : 'EMAIL_FROM is unset; no email sent'
    console.warn(`[ollobooks] daily puzzles skipped: ${reason}`)
    result.reason = reason
    return result
  }

  const secret = mode === 'send' ? (deps.secret ?? unsubscribeSecret()) : (deps.secret ?? '')

  for (const subscriber of eligible) {
    try {
      const pdf = await buildDailyPdf(subscriber, seedFor(subscriber, day))
      result.built += 1
      result.pages.push(pdf.pages)
      result.bytes.push(pdf.bytes.byteLength)
      result.recipients.push(subscriber.email)
      if (!result.pdf) result.pdf = isPdf(pdf.bytes)

      if (mode === 'preview') continue

      if (mode === 'test') {
        await store.markSent(subscriber.email, day)
        result.recorded += 1
        continue
      }

      const token = await signUnsubscribeToken(subscriber.email, secret)
      const sent = await sendPuzzleEmail({
        fetchImpl,
        apiKey: apiKey ?? '',
        from: from ?? '',
        to: subscriber.email,
        unsubscribeUrl: unsubscribeLink(origin, token),
        pdf: pdf.bytes,
        schedule: subscriberSchedule(subscriber),
      })
      if (!sent.ok) {
        result.failed += 1
        console.error(`[ollobooks] daily email failed for ${subscriber.email}: ${sent.error}`)
        continue
      }
      await store.markSent(subscriber.email, day)
      result.emailed += 1
    } catch (error) {
      result.failed += 1
      console.error('[ollobooks] daily puzzle failed', error)
    }
  }

  if (mode === 'preview') result.reason = 'Preview only. No email sent.'
  if (mode === 'test') {
    if (result.recorded > 0) result.reason = 'Recorded this UTC day without sending email.'
    else if (result.skipped > 0) result.reason = 'Already recorded for this UTC day. No email sent.'
    else result.reason = 'No email sent.'
  }
  return result
}
