import { defineConfig, devices } from '@playwright/test'

const e2eDatabaseUrl = process.env.E2E_DATABASE_URL
if (!e2eDatabaseUrl) {
  throw new Error('Set E2E_DATABASE_URL to a dedicated local PostgreSQL database before running Playwright.')
}

let databaseUrl: URL
try {
  databaseUrl = new URL(e2eDatabaseUrl)
} catch {
  throw new Error('E2E_DATABASE_URL must be a valid PostgreSQL connection URL.')
}

const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ''))
if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
  throw new Error('E2E_DATABASE_URL must use PostgreSQL.')
}
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(databaseUrl.hostname)) {
  throw new Error('Playwright is restricted to a local E2E database; remote database hosts are refused.')
}
if (!/(^|[_-])(e2e|test)([_-]|$)/i.test(databaseName)) {
  throw new Error('The E2E database name must contain a separate "e2e" or "test" segment.')
}

const port = Number(process.env.PLAYWRIGHT_PORT ?? '3100')
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('PLAYWRIGHT_PORT must be an integer between 1024 and 65535.')
}
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npm run db:migrate && npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    env: {
      DATABASE_URL: e2eDatabaseUrl,
      AUTH_SECRET: process.env.E2E_AUTH_SECRET ?? 'local-e2e-only-change-before-deployment',
      NEXTAUTH_URL: baseURL,
    },
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
