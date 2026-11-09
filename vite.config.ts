import type { IncomingMessage, ServerResponse } from 'node:http'
import react from '@vitejs/plugin-react'
import { fireweave, type FireweaveVitePlugin } from '@fireweaveai/web-sdk/vite'
import { loadEnv, type Plugin } from 'vite'
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

// Open Graph, Twitter and canonical URLs must be absolute. SITE_URL wins; on
// Vercel the production domain is used, so preview builds still point crawlers
// at production.
function resolveSiteUrl(env: Record<string, string>): string {
  const explicit = env.SITE_URL || process.env.SITE_URL
  if (explicit) return explicit.replace(/\/+$/, '')
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (productionHost) return `https://${productionHost}`
  return ''
}

function seoFiles(siteUrl: string): Plugin {
  return {
    name: 'ollobooks-seo-files',
    configResolved(config) {
      if (config.command === 'build' && !siteUrl) {
        config.logger.warn(
          '[seo] SITE_URL is not set and this is not a Vercel build, so canonical, Open Graph and sitemap URLs are relative. Set SITE_URL to the public origin and rebuild.',
        )
      }
    },
    transformIndexHtml(html) {
      return html.replaceAll('__SITE_URL__', siteUrl)
    },
    generateBundle() {
      const sitemapUrl = siteUrl ? `${siteUrl}/sitemap.xml` : null
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: ['User-agent: *', 'Allow: /', 'Disallow: /api/', ...(sitemapUrl ? ['', `Sitemap: ${sitemapUrl}`] : []), ''].join('\n'),
      })
      if (!siteUrl) return
      const lastmod = new Date().toISOString().slice(0, 10)
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${siteUrl}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
    <image:image>
      <image:loc>${siteUrl}/og-image.png</image:loc>
    </image:image>
  </url>
</urlset>
`,
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    fireweaveUnlessUnconfigured(),
    dailySubscriptionDevApi(),
    seoFiles(resolveSiteUrl(loadEnv(mode, process.cwd(), ''))),
  ],
  test: {
    environment: 'node',
  },
}))
