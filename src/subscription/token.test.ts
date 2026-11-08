import { afterEach, describe, expect, it } from 'vitest'
import { signUnsubscribeToken, unsubscribeSecret, verifyUnsubscribeToken } from './token.ts'

const SECRET = 'test-unsubscribe-secret'

afterEach(() => {
  delete process.env.UNSUBSCRIBE_SECRET
  delete process.env.VERCEL_ENV
})

describe('unsubscribe tokens', () => {
  it('signs and verifies a token without putting the raw email in the query', async () => {
    const token = await signUnsubscribeToken('parent@example.com', SECRET)
    expect(token.split('.')).toHaveLength(2)
    expect(await verifyUnsubscribeToken(token, SECRET)).toBe('parent@example.com')

    const url = new URL(`http://127.0.0.1:5173/api/unsubscribe?token=${encodeURIComponent(token)}`)
    expect(url.searchParams.get('email')).toBeNull()
    expect(url.searchParams.get('token')).toBe(token)
    expect(await verifyUnsubscribeToken(url.searchParams.get('token') ?? '', SECRET)).toBe('parent@example.com')
  })

  it('rejects a tampered payload or signature', async () => {
    const token = await signUnsubscribeToken('parent@example.com', SECRET)
    const [payload, signature] = token.split('.')
    expect(await verifyUnsubscribeToken(`${payload}.${signature?.slice(0, -1)}x`, SECRET)).toBeNull()
    expect(await verifyUnsubscribeToken(`aaaa.${signature}`, SECRET)).toBeNull()
    expect(await verifyUnsubscribeToken(token, 'other-secret')).toBeNull()
    expect(await verifyUnsubscribeToken('not-a-token', SECRET)).toBeNull()
  })

  it('uses a dev secret outside production and requires the env var in production', () => {
    expect(unsubscribeSecret()).toBe('dev-only-unsubscribe-secret')
    process.env.UNSUBSCRIBE_SECRET = 'from-env'
    expect(unsubscribeSecret()).toBe('from-env')
    delete process.env.UNSUBSCRIBE_SECRET
    process.env.VERCEL_ENV = 'production'
    expect(() => unsubscribeSecret()).toThrow(/UNSUBSCRIBE_SECRET/)
  })
})
