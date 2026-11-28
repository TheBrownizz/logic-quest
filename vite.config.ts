import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

declare const process: { env: Record<string, string | undefined> }

export default defineConfig({
  // Build-time switch for the end-to-end fake backend: false in every normal build, so the fake is tree-shaken out.
  define: { __E2E_FAKE__: JSON.stringify(process.env.VITE_E2E_FAKE === '1') },
  base: './',
  plugins: [react()],
  // The sign-in redirect URLs name this port, so it must not drift.
  server: { port: 5173, strictPort: true },
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
