import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer'),
      '@shared': resolve('src/shared'),
    },
  },
  test: {
    environment: 'jsdom',
    // Le code du process principal (LCU, sockets) tourne sous Node, pas jsdom.
    environmentMatchGlobs: [['src/main/**', 'node']],
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
  },
})
