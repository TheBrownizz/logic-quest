import { defineConfig } from '@playwright/test'

declare const process: { env: Record<string, string | undefined> }

// Several checkouts may run e2e at once: each picks its own port with E2E_PORT (default 4173).
const port = Number(process.env.E2E_PORT ?? 4173)

export default defineConfig({
  testDir: 'tests/e2e',
  webServer: {
    command: `npm run build && npx vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
  },
  use: { baseURL: `http://localhost:${port}` },
})
