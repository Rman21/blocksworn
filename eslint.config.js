// 2026-05-11 — TASK-005 (T1.05): ESLint v9 flat config for the scaffold phase.
// Spec: docs/plan/00_EXECUTION_PLAN.md §13 T1.05 § B.
//
// Scope (linted): src/, tests/, playwright.config.js, vite.config.js, eslint.config.js.
// Ignored: node_modules, dist, legacy reference HTML, captured baselines + run
// artifacts, the site/ folder (separate project).
//
// no-console is intentionally OFF for now: scaffold-phase code still uses
// console.* freely. T1.10+ introduces src/services/logger.js, at which point
// we re-enable no-console and migrate residual call sites.

import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: [
      'src/**/*.js',
      'tests/**/*.js',
      'playwright.config.js',
      'vite.config.js',
      'eslint.config.js',
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Browser globals (src/ targets browser; tests evaluate in-page snippets).
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        console: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        // Legacy globals exposed by the single HTML — used inside page.evaluate()
        // bodies that run in the browser context, where eslint can't tell.
        showScreen: 'readonly',
        goToMenu: 'readonly',
        goToShop: 'readonly',
        goToTower: 'readonly',
        goToSeason: 'readonly',
        goToProfile: 'readonly',
        goToSelect: 'readonly',
        goToDailies: 'readonly',
        renderShopPacks: 'readonly',
        // Node globals (config files, test helpers using node:fs etc.).
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-console': 'off', // re-enable in T1.10+ once src/services/logger.js lands
    },
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'docs/_legacy/**',
      'tests/visual/baseline/**',
      'tests/visual/current/**',
      'tests/visual/diff/**',
      'playwright-report/**',
      'test-results/**',
      'site/**',
      'firebase/**',
      'public/**',
      'playground/**',
      'backups/**',
      'assets/**',
    ],
  },
];
