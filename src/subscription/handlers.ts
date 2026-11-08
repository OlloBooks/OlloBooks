import { allowLocalJobModes, isCronAuthorized } from './cron.ts'
import { runDaily, siteOrigin, type DailyMode } from './daily.ts'
import { createStore, type SubscriberStore } from './store.ts'
import { isProduction, signUnsubscribeToken, verifyUnsubscribeToken } from './token.ts'
import { validateSubscription, type Schedule } from './validate.ts'

export const MESSAGE_READY = "You're on the list. The first PDF arrives the next morning."
export const MESSAGE_PENDING =
  "You're on the list. The first PDF arrives the next morning, once email delivery is configured."

export function subscriptionMessage(schedule: Schedule, configured: boolean): string {
  if (schedule === 'daily') return configured ? MESSAGE_READY : MESSAGE_PENDING
  const cadence = schedule === 'weekly' ? 'weekly' : 'monthly'
  const later = schedule === 'weekly' ? 'once a week' : 'once a month'
  if (configured) {
    return `You're on the list for ${cadence} puzzles. The first PDF arrives the next morning. After that, puzzles arrive ${later}.`
  }
  return `You're on the list for ${cadence} puzzles. The first PDF arrives the next morning, once email delivery is configured. After that, puzzles arrive ${later}.`
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

export function deliveryConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
}

function page(title: string, message: string, status: number): Response {
  const safeTitle = escapeHtml(title)
  const safeMessage = escapeHtml(message)
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle} · OlloBooks</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,560&family=Nunito:wght@700;800&display=swap" rel="stylesheet" />
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f3e7d4; color: #241c16; font-family: Nunito, "Avenir Next", sans-serif; }
    main { width: min(440px, calc(100% - 32px)); padding: 28px 24px; border: 1px solid #e5d4bf; border-radius: 28px; background: #fffaf3; box-sizing: border-box; }
    p.eyebrow { margin: 0 0 8px; color: #c44724; font-size: 0.78rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; }
    h1 { font-family: Fraunces, Palatino, serif; font-weight: 560; font-size: 2.1rem; line-height: 1.05; margin: 0 0 10px; }
    p { margin: 0; color: #6b5c4e; line-height: 1.45; }
    a { color: #c44724; font-weight: 800; }
  </style>
</head>
<body>
  <main>
    <p class="eyebrow">OlloBooks</p>
    <h1>${safeTitle}</h1>
    <p>${safeMessage}</p>
    <p style="margin-top:16px"><a href="/">Back to the library</a></p>
  </main>
</body>
</html>`
  return new Response(html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  })
}

export async function handleSubscribe(request: Request, store: SubscriberStore = createStore()): Promise<Response> {
  if (request.method !== 'POST') return json({ ok: false, error: 'Use POST.' }, 405)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, error: 'Enter a valid email address.' }, 400)
  }

  const parsed = validateSubscription(body)
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400)

  const now = new Date().toISOString()
  try {
    const existing = await store.get(parsed.value.email)
    await store.save({
      ...parsed.value,
      createdAt: existing?.createdAt ?? now,
      unsubscribedAt: null,
      lastSentOn: existing && !existing.unsubscribedAt ? existing.lastSentOn : null,
    })
  } catch (error) {
    console.error('[ollobooks] subscribe failed', error)
    return json({ ok: false, error: "We couldn't save that subscription. Please try again." }, 500)
  }

  const configured = deliveryConfigured()
  const payload: { ok: true; message: string; delivery: 'configured' | 'pending'; unsubscribeUrl?: string } = {
    ok: true,
    message: subscriptionMessage(parsed.value.schedule, configured),
    delivery: configured ? 'configured' : 'pending',
  }

  if (!isProduction()) {
    try {
      const token = await signUnsubscribeToken(parsed.value.email)
      payload.unsubscribeUrl = new URL(`/api/unsubscribe?token=${encodeURIComponent(token)}`, request.url).toString()
    } catch (error) {
      console.error('[ollobooks] could not sign unsubscribe link', error)
    }
  }

  return json(payload)
}

export async function handleUnsubscribe(request: Request, store: SubscriberStore = createStore()): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return page('Unsubscribe', 'Open the unsubscribe link from your email.', 405)
  }

  const token = new URL(request.url).searchParams.get('token') ?? ''
  if (!token) return page('Unsubscribe', 'This unsubscribe link is not valid.', 400)

  let email: string | null
  try {
    email = await verifyUnsubscribeToken(token)
  } catch (error) {
    console.error('[ollobooks] unsubscribe secret missing', error)
    return page('Unsubscribe', 'Unsubscribe is not available right now.', 500)
  }
  if (!email) return page('Unsubscribe', 'This unsubscribe link is not valid.', 400)

  try {
    await store.unsubscribe(email, new Date().toISOString())
  } catch (error) {
    console.error('[ollobooks] unsubscribe failed', error)
    return page('Unsubscribe', 'We could not update that subscription. Please try the link again.', 500)
  }

  return page("You're unsubscribed", 'No more morning puzzles will be sent to this address.', 200)
}

export async function handleDaily(request: Request, store?: SubscriberStore): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return json({ ok: false, error: 'Use GET.' }, 405)
  if (!isCronAuthorized(request)) return json({ ok: false, error: 'Unauthorized.' }, 401)

  const url = new URL(request.url)
  const requested = url.searchParams.get('mode')
  let mode: DailyMode = 'send'
  if (allowLocalJobModes() && (requested === 'preview' || requested === 'test')) mode = requested

  try {
    const result = await runDaily({
      store,
      mode,
      origin: siteOrigin(url.origin),
    })
    return json(result)
  } catch (error) {
    console.error('[ollobooks] daily failed', error)
    return json({ ok: false, error: 'The daily job could not run.' }, 500)
  }
}

export async function handleApi(request: Request): Promise<Response> {
  const path = new URL(request.url).pathname
  if (path === '/api/subscribe') return handleSubscribe(request)
  if (path === '/api/unsubscribe') return handleUnsubscribe(request)
  if (path === '/api/daily') return handleDaily(request)
  return json({ ok: false, error: 'Not found.' }, 404)
}
