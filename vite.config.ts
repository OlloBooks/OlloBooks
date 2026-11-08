import react from '@vitejs/plugin-react'
import { fireweave, type FireweaveVitePlugin } from '@fireweaveai/web-sdk/vite'
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

export default defineConfig({
  plugins: [react(), fireweaveUnlessUnconfigured()],
  test: {
    environment: 'node',
  },
})
