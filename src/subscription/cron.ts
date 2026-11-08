import { bearerMatches, isProduction } from './token.ts'

export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  const header = request.headers.get('authorization') ?? ''
  if (secret && bearerMatches(header, secret)) return true
  if (process.env.VERCEL_ENV || isProduction()) return false
  return !secret
}

export function allowLocalJobModes(): boolean {
  return !process.env.VERCEL_ENV && !isProduction()
}
