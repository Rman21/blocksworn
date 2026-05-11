// 2026-05-11 — TASK-003 (T1.03): Playwright smoke test config.
// Spec: docs/plan/00_EXECUTION_PLAN.md §13 T1.03.
// Four projects (desktop chromium + webkit, mobile chrome Pixel 7, mobile safari iPhone 14).
// webServer auto-starts `npm run dev` on :5173.
// 2026-05-11 — TASK-004 (T1.04): widen testDir to ./tests so the visual
// baseline + (later) regression specs are discovered alongside smoke tests.
// npm scripts target subpaths explicitly (test:smoke, test:visual:baseline).

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
});
