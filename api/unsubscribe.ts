import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleUnsubscribe } from '../src/subscription/handlers.ts'
import { fromNodeRequest, sendWebResponse } from '../src/subscription/nodeAdapter.ts'

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const response = await handleUnsubscribe(await fromNodeRequest(req))
  await sendWebResponse(res, response)
}
