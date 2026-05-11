// 2026-05-11 — TASK-001 (T1.01): minimal Vite config for Blocksworn scaffold.
// Populated further in later Phase 1 tasks (aliases, build options, etc.).

import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});
