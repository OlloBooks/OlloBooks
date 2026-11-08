import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleApi } from './handlers.ts'
import { fromNodeRequest, sendWebResponse } from './nodeAdapter.ts'

const PATHS = new Set(['/api/subscribe', '/api/unsubscribe', '/api/daily'])

export async function handleDevApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const path = (req.url ?? '').split('?')[0]?.replace(/\/$/, '') || '/'
  if (!PATHS.has(path)) return false
  const request = await fromNodeRequest(req)
  const response = await handleApi(request)
  await sendWebResponse(res, response)
  return true
}
