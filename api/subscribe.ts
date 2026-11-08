import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleSubscribe } from '../src/subscription/handlers.ts'
import { fromNodeRequest, sendWebResponse } from '../src/subscription/nodeAdapter.ts'

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const response = await handleSubscribe(await fromNodeRequest(req))
  await sendWebResponse(res, response)
}
