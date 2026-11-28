import { defineConfig } from '@playwright/test'

declare const process: { env: Record<string, string | undefined> }

// Several checkouts may run e2e at once: each picks its own port with E2E_PORT (default 4173).
// The accounts tests run against a second build with the fake backend (VITE_E2E_FAKE=1) on E2E_PORT_FAKE
// (default E2E_PORT + 1); every other test runs against the normal build, which has no account UI.
const port = Number(process.env.E2E_PORT ?? 4173)
const fakePort = Number(process.env.E2E_PORT_FAKE ?? port + 1)

export default defineConfig({
  testDir: 'tests/e2e',
  webServer: [
    {
      command: `VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= VITE_E2E_FAKE= npm run build && npx vite preview --port ${port} --strictPort`,
      url: `http://localhost:${port}`,
      reuseExistingServer: false,
    },
    {
      command: `VITE_E2E_FAKE=1 npx vite build --outDir dist-e2e-fake && npx vite preview --outDir dist-e2e-fake --port ${fakePort} --strictPort`,
      url: `http://localhost:${fakePort}`,
      reuseExistingServer: false,
    },
  ],
  projects: [
    { name: 'guest', testIgnore: /(^|\/)accounts\.spec\.ts$/, use: { baseURL: `http://localhost:${port}` } },
    { name: 'accounts', testMatch: /(^|\/)accounts\.spec\.ts$/, use: { baseURL: `http://localhost:${fakePort}` } },
  ],
})
