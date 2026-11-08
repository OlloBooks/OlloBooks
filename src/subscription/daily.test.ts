import { describe, expect, it } from 'vitest'
import { sheetPlan } from '../sudoku/model.ts'
import { isCronAuthorized } from './cron.ts'
import { puzzleEmail, runDaily, utcDay } from './daily.ts'
import { buildDailyPdf, isPdf } from './pdf.ts'
import { memoryStore, type Subscriber } from './store.ts'

function subscriber(overrides: Partial<Subscriber> = {}): Subscriber {
  return {
    email: 'parent@example.com',
    size: 4,
    difficulty: 'easy',
    count: 3,
    includeAnswers: true,
    createdAt: '2026-11-08T12:00:00.000Z',
    unsubscribedAt: null,
    lastSentOn: null,
    ...overrides,
  }
}

describe('daily puzzles', () => {
  it('builds a PDF whose bytes start with %PDF and whose page count matches puzzles plus the answer key', async () => {
    const choice = subscriber()
    const pdf = await buildDailyPdf(choice, 21)
    expect(isPdf(pdf.bytes)).toBe(true)
    expect(String.fromCharCode(...pdf.bytes.subarray(0, 4))).toBe('%PDF')
    expect(pdf.pages).toBe(sheetPlan(choice.count, 1, choice.includeAnswers).total)
    expect(pdf.pages).toBe(choice.count + choice.count)
  }, 20000)

  it('mails each active subscriber once per UTC day and skips anyone unsubscribed', async () => {
    const store = memoryStore([
      subscriber(),
      subscriber({ email: 'done@example.com', unsubscribedAt: '2026-11-08T12:30:00.000Z' }),
    ])
    const calls: Array<{ url: string; body: { subject: string; text: string; to: string[]; attachments: Array<{ content: string }> } }> = []
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({
        url: String(input),
        body: JSON.parse(String(init?.body)) as (typeof calls)[number]['body'],
      })
      return new Response(JSON.stringify({ id: 'email_1' }), { status: 200 })
    }
    const now = new Date('2026-11-08T13:00:00.000Z')
    const first = await runDaily({
      now,
      store,
      fetchImpl,
      resendApiKey: 'test-key',
      emailFrom: 'OlloBooks <puzzles@ollobooks.com>',
      origin: 'http://127.0.0.1:5173',
      secret: 'test-unsubscribe-secret',
      mode: 'send',
    })
    expect(first.built).toBe(1)
    expect(first.emailed).toBe(1)
    expect(first.recipients).toEqual(['parent@example.com'])
    expect(first.pages).toEqual([6])
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe('https://api.resend.com/emails')
    expect(calls[0]?.body.subject).toBe("Today's OlloBooks puzzles")
    expect(calls[0]?.body.text).toMatch(/US Letter/)
    expect(calls[0]?.body.text).toContain('/api/unsubscribe?token=')
    expect(calls[0]?.body.text).not.toContain('email=')
    const attachment = Uint8Array.from(atob(calls[0]?.body.attachments[0]?.content ?? ''), (char) => char.charCodeAt(0))
    expect(String.fromCharCode(...attachment.subarray(0, 4))).toBe('%PDF')
    expect((await store.get('parent@example.com'))?.lastSentOn).toBe(utcDay(now))

    const second = await runDaily({
      now,
      store,
      fetchImpl,
      resendApiKey: 'test-key',
      emailFrom: 'OlloBooks <puzzles@ollobooks.com>',
      origin: 'http://127.0.0.1:5173',
      secret: 'test-unsubscribe-secret',
      mode: 'send',
    })
    expect(second.emailed).toBe(0)
    expect(second.built).toBe(0)
    expect(second.skipped).toBe(1)
    expect(calls).toHaveLength(1)
  }, 20000)

  it('does not send when the email provider is not configured', async () => {
    let called = false
    const fetchImpl: typeof fetch = async () => {
      called = true
      return new Response('nope', { status: 500 })
    }
    const result = await runDaily({
      store: memoryStore([subscriber()]),
      fetchImpl,
      resendApiKey: null,
      emailFrom: null,
      now: new Date('2026-11-08T13:00:00.000Z'),
    })
    expect(result.emailed).toBe(0)
    expect(result.built).toBe(0)
    expect(result.reason).toMatch(/RESEND_API_KEY is unset/)
    expect(called).toBe(false)
    expect(puzzleEmail('http://127.0.0.1:5173/api/unsubscribe?token=abc').subject).toBe("Today's OlloBooks puzzles")
  })

  it('rejects cron callers that do not present the secret on Vercel', () => {
    const previousNode = process.env.NODE_ENV
    const previousVercel = process.env.VERCEL_ENV
    const previousSecret = process.env.CRON_SECRET
    try {
      process.env.NODE_ENV = 'production'
      process.env.VERCEL_ENV = 'production'
      process.env.CRON_SECRET = 'cron-secret'
      const allowed = new Request('https://ollobooks.com/api/daily', {
        headers: { authorization: 'Bearer cron-secret' },
      })
      const denied = new Request('https://ollobooks.com/api/daily')
      expect(isCronAuthorized(allowed)).toBe(true)
      expect(isCronAuthorized(denied)).toBe(false)
    } finally {
      process.env.NODE_ENV = previousNode
      if (previousVercel === undefined) delete process.env.VERCEL_ENV
      else process.env.VERCEL_ENV = previousVercel
      if (previousSecret === undefined) delete process.env.CRON_SECRET
      else process.env.CRON_SECRET = previousSecret
    }
  })
})
