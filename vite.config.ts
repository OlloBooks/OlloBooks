import type { IncomingMessage, ServerResponse } from 'node:http'
import react from '@vitejs/plugin-react'
import { fireweave, type FireweaveVitePlugin } from '@fireweaveai/web-sdk/vite'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

// The Vite plugin fails the build when no browser key and no environment name
// are set. A static production bundle must still compile: do not inject a key
// and do not force local mode. start() then fails closed in the browser until
// FIREWEAVE_BROWSER_KEY is present at build time, which injects remote mode.
const UNCONFIGURED_BUILD =
  'FIREWEAVE_BROWSER_KEY is not set and no environment name is set'

function fireweaveUnlessUnconfigured(): FireweaveVitePlugin {
  const plugin = fireweave()
  return {
    ...plugin,
    async config(userConfig, env) {
      try {
        return await plugin.config(userConfig, env)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (!message.includes(UNCONFIGURED_BUILD)) throw error
        console.warn(
          '[fireweave] FIREWEAVE_BROWSER_KEY is unset, so this build injects no config. The page still loads. Set FIREWEAVE_BROWSER_KEY (fw_public_…) in the build environment and rebuild to start FireWeave in the browser.',
        )
        return undefined
      }
    },
  }
}

function dailySubscriptionDevApi(): Plugin {
  return {
    name: 'daily-subscription-dev-api',
    apply: 'serve',
    async configureServer(server) {
      if (process.env.VITEST || server.config.mode === 'test') return
      const loadHandler = () =>
        server.ssrLoadModule('/src/subscription/devApi.ts') as Promise<{
          handleDevApi: (request: IncomingMessage, response: ServerResponse) => Promise<boolean>
        }>
      void loadHandler()
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0]?.replace(/\/$/, '') || '/'
        if (path !== '/api/subscribe' && path !== '/api/unsubscribe' && path !== '/api/daily') {
          next()
          return
        }
        void loadHandler().then((loaded) => loaded.handleDevApi(req, res)).then(
          (handled) => {
            if (!handled) next()
          },
          (error: unknown) => {
            console.error('[ollobooks] subscription API failed', error)
            if (!res.headersSent) {
              res.statusCode = 500
              res.setHeader('content-type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({ ok: false, error: "We couldn't save that subscription. Please try again." }))
            }
          },
        )
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), fireweaveUnlessUnconfigured(), dailySubscriptionDevApi()],
  test: {
    environment: 'node',
  },
})
