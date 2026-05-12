// 2026-05-11 — TASK-003 (T1.03): first smoke test against legacy single HTML.
// Spec: docs/plan/00_EXECUTION_PLAN.md §13 T1.03.
// Selector choice: `#screenMenu` confirmed present in legacy HTML (single match
// via `grep -c 'id="screenMenu"' docs/_legacy/_archive_v1/blocksworn_index_fixed.html`).

import { test, expect } from '@playwright/test';

test('legacy single HTML loads without pageerrors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  await page.goto('/docs/_legacy/_archive_v1/blocksworn_index_fixed.html');

  // Legacy HTML is 21MB and inlines heavy JS — give it generous time
  await page.waitForSelector('#screenMenu', { timeout: 30000 });

  expect(errors).toEqual([]);
});
