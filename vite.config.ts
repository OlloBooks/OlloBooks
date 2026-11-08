import react from '@vitejs/plugin-react'
import { fireweave } from '@fireweaveai/web-sdk/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), fireweave()],
  test: {
    environment: 'node',
  },
})
