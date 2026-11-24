import { defineConfig, devices } from '@playwright/test'
import { carregarEnvLocal } from './tests/e2e/env'

carregarEnvLocal()

// Porta própria do e2e: evita esbarrar num `next dev` já aberto noutra porta
// (e no 500 "Jest worker" de um servidor com cache velho).
// Host "localhost" (não 127.0.0.1): o `next dev` bloqueia recursos dev vindos de outra
// origem, e com 127.0.0.1 ele considera cross-origin e os chunks não carregam (sem hidratar).
const PORTA = Number(process.env.E2E_PORT ?? 3100)
const BASE_URL = `http://localhost:${PORTA}`

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // O primeiro compile de cada rota do `next dev` pode demorar; folga para não dar flaky.
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
    trace: 'retain-on-failure',
    // Desktop: a barra lateral (lg) fica visível; é onde o teste confere o menu.
    viewport: { width: 1280, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --port ${PORTA}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
