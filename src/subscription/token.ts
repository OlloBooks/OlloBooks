const DEV_SECRET = 'dev-only-unsubscribe-secret'

export function isProduction(): boolean {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'
}

export function unsubscribeSecret(): string {
  const configured = process.env.UNSUBSCRIBE_SECRET
  if (configured) return configured
  if (isProduction()) throw new Error('UNSUBSCRIBE_SECRET is required in production')
  return DEV_SECRET
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function base64UrlDecode(value: string): Uint8Array | null {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/')
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
  try {
    const binary = atob(padded + pad)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    return bytes
  } catch {
    return null
  }
}

function safeEqual(left: Uint8Array, right: Uint8Array): boolean {
  const length = Math.max(left.length, right.length)
  let diff = left.length === right.length ? 0 : 1
  for (let index = 0; index < length; index += 1) {
    diff |= (left[index] ?? 0) ^ (right[index] ?? 0)
  }
  return diff === 0
}

async function hmac(secret: string, payload: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)))
}

export async function signUnsubscribeToken(email: string, secret = unsubscribeSecret()): Promise<string> {
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ v: 1, email })))
  const signature = base64UrlEncode(await hmac(secret, payload))
  return `${payload}.${signature}`
}

export async function verifyUnsubscribeToken(token: string, secret = unsubscribeSecret()): Promise<string | null> {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payload, signature] = parts
  if (!payload || !signature) return null

  const expected = base64UrlEncode(await hmac(secret, payload))
  if (!safeEqual(new TextEncoder().encode(signature), new TextEncoder().encode(expected))) return null

  const decoded = base64UrlDecode(payload)
  if (!decoded) return null
  try {
    const parsed = JSON.parse(new TextDecoder().decode(decoded)) as { v?: unknown; email?: unknown }
    if (parsed.v !== 1 || typeof parsed.email !== 'string' || !parsed.email) return null
    return parsed.email
  } catch {
    return null
  }
}

export function bearerMatches(header: string, secret: string): boolean {
  return safeEqual(new TextEncoder().encode(header), new TextEncoder().encode(`Bearer ${secret}`))
}
