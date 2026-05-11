// 2026-05-11 — TASK-009 (T1.08): Vitest config for unit tests.
//
// Without scoping, Vitest's default test discovery (`**/*.{test,spec}.{js,...}`)
// picks up the Playwright .spec.js files in tests/smoke/ and tests/visual/,
// which then try to register tests via the Playwright `test()` runner and
// fail with "Playwright Test did not expect test() to be called here". So we
// constrain Vitest to tests/unit/ only — Playwright owns smoke/visual.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js'],
    environment: 'node',
  },
});
