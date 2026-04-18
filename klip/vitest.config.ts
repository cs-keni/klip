import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import type { Plugin } from 'vite'

/** Stub all binary/image assets so jsdom never tries to parse them. */
const assetStub: Plugin = {
  name: 'test-asset-stub',
  enforce: 'pre',
  transform(_code, id) {
    if (/\.(ico|png|jpg|jpeg|gif|webp|svg|bmp)(\?.*)?$/.test(id)) {
      return { code: 'export default "test-asset-stub"' }
    }
  }
}

export default defineConfig({
  plugins: [react(), assetStub],

  resolve: {
    alias: {
      '@': resolve('src/renderer/src'),
      '@renderer': resolve('src/renderer/src'),
      // Replace framer-motion with a zero-animation passthrough so tests are
      // synchronous and AnimatePresence never hides elements during assertions.
      'framer-motion': resolve('src/tests/__mocks__/framer-motion.tsx')
    }
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/tests/setup.ts'],
    include: ['src/tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/renderer/src/**/*.{ts,tsx}'],
      exclude: ['src/renderer/src/main.tsx', 'src/renderer/src/env.d.ts']
    }
  }
})
