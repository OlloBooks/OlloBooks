import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleDaily } from '../src/subscription/handlers.ts'
import { fromNodeRequest, sendWebResponse } from '../src/subscription/nodeAdapter.ts'

export const config = {
  maxDuration: 60,
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const response = await handleDaily(await fromNodeRequest(req))
  await sendWebResponse(res, response)
}
