import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { handleSubscribe, handleUnsubscribe } from './handlers.ts'
import { createFileStore } from './store.ts'
import { signUnsubscribeToken } from './token.ts'
import { validateSubscription } from './validate.ts'

describe('subscribe validation', () => {
  it('rejects an invalid email and accepts a daily subscription with defaults', () => {
    expect(validateSubscription({ email: 'not-an-email' }).ok).toBe(false)
    expect(validateSubscription({ email: 'a@b' }).ok).toBe(false)
    expect(validateSubscription({ email: 'parent@example.com', count: 7 }).ok).toBe(false)
    expect(validateSubscription({ email: 'parent@example.com', size: 5 }).ok).toBe(false)

    const parsed = validateSubscription({ email: ' Parent@Example.com ' })
    expect(parsed).toEqual({
      ok: true,
      value: {
        email: 'parent@example.com',
        size: 4,
        difficulty: 'easy',
        count: 3,
        includeAnswers: true,
      },
    })
  })

  it('returns an error response for an invalid address and stores a valid one', async () => {
    const invalid = await handleSubscribe(
      new Request('http://127.0.0.1:5173/api/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email', size: 4, difficulty: 'easy', count: 3, includeAnswers: true }),
      }),
    )
    expect(invalid.status).toBe(400)
    const invalidBody = (await invalid.json()) as { ok: boolean; error: string }
    expect(invalidBody.ok).toBe(false)
    expect(invalidBody.error).toMatch(/valid email/i)

    const directory = await mkdtemp(path.join(tmpdir(), 'ollobooks-subscribers-'))
    const previous = process.env.SUBSCRIBER_STORE_DIR
    process.env.SUBSCRIBER_STORE_DIR = directory
    delete process.env.RESEND_API_KEY
    delete process.env.EMAIL_FROM
    try {
      const store = createFileStore()
      const response = await handleSubscribe(
        new Request('http://127.0.0.1:5173/api/subscribe', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: 'parent@example.com', size: 4, difficulty: 'easy', count: 3, includeAnswers: true }),
        }),
        store,
      )
      expect(response.status).toBe(200)
      const body = (await response.json()) as { ok: boolean; message: string; delivery: string; unsubscribeUrl?: string }
      expect(body.ok).toBe(true)
      expect(body.delivery).toBe('pending')
      expect(body.message).toMatch(/next morning/)
      expect(body.message).toMatch(/configured/)
      const saved = JSON.parse(await readFile(path.join(directory, 'subscribers.json'), 'utf8')) as Record<string, { count: number }>
      expect(saved['parent@example.com']?.count).toBe(3)

      const token = await signUnsubscribeToken('parent@example.com')
      const page = await handleUnsubscribe(new Request(`http://127.0.0.1:5173/api/unsubscribe?token=${encodeURIComponent(token)}`), store)
      expect(page.status).toBe(200)
      expect(await page.text()).toMatch(/unsubscribed/i)
      expect((await store.get('parent@example.com'))?.unsubscribedAt).toBeTruthy()
    } finally {
      if (previous === undefined) delete process.env.SUBSCRIBER_STORE_DIR
      else process.env.SUBSCRIBER_STORE_DIR = previous
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('reports a save failure without dropping the error', async () => {
    const response = await handleSubscribe(
      new Request('http://127.0.0.1:5173/api/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'parent@example.com' }),
      }),
      {
        async get() {
          return null
        },
        async list() {
          return []
        },
        async save() {
          throw new Error('disk full')
        },
        async markSent() {},
        async unsubscribe() {},
      },
    )
    expect(response.status).toBe(500)
    const body = (await response.json()) as { error: string }
    expect(body.error).toMatch(/save/i)
  })
})

afterEach(() => {
  delete process.env.RESEND_API_KEY
  delete process.env.EMAIL_FROM
})
