import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    // Injectées **au build** (le process principal n'a pas accès à ces
    // variables sur la machine de l'utilisateur). Absentes → envoi inerte.
    define: {
      'process.env.HEXTECH_SUPABASE_URL': JSON.stringify(
        process.env.HEXTECH_SUPABASE_URL ?? '',
      ),
      'process.env.HEXTECH_SUPABASE_ANON_KEY': JSON.stringify(
        process.env.HEXTECH_SUPABASE_ANON_KEY ?? '',
      ),
    },
    build: {
      rollupOptions: { input: { index: resolve('src/main/index.ts') } },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: { input: { index: resolve('src/preload/index.ts') } },
    },
  },
  renderer: {
    root: 'src/renderer',
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer'),
        '@shared': resolve('src/shared'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          // Fenêtre overlay in-game (transparente, toujours au-dessus).
          overlay: resolve('src/renderer/overlay.html'),
        },
      },
    },
    plugins: [react()],
  },
})
