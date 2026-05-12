// 2026-05-11 — TASK-011 (T1.10.9): MANDATORY one-shot migration shim.
//
// Background:
//   T1.08 storage abstraction (src/services/storage.js) JSON-stringifies on
//   set and JSON-parses on get. Legacy stored a known set of keys as BARE
//   strings via `localStorage.setItem(key, 'literal')` and read them back
//   with strict equality (`localStorage.getItem(key) === 'literal'`). When
//   T1.12 wires `src/services/storage.js` into the new shell, those legacy
//   keys would no longer survive a round-trip — JSON.parse('1') yields the
//   number 1 (not the string '1'), JSON.parse('true') yields boolean true
//   (not the string 'true'), and `localStorage.getItem` on a key still
//   holding a bare string returns null inside the new abstraction (parse
//   throws on `pyredrake_fight`). Without this shim, existing player saves
//   silently reset to defaults on the first boot after the switchover.
//
// Algorithm (spec from docs/plan/TASKS.md TASK-011 T1.10.9):
//   1. Idempotency sentinel — `blocksworn_storage_v2_migrated`. Stored as
//      JSON-wrapped '"true"' so a future migrate scan won't re-target it.
//   2. For each key in LEGACY_BARE_STRING_KEYS:
//      - If absent → bump `missing` counter, skip.
//      - If already JSON-shaped (raw starts with `"`, `{`, or `[`) →
//        bump `alreadyJSON` counter, skip.
//      - Else → wrap the raw value via `JSON.stringify(raw)`, bump
//        `migrated` counter. Quota / SecurityError swallowed (caller may
//        be in a private-mode browser; nothing to do).
//   3. Stamp the sentinel. Subsequent calls return `{ migrated: 0,
//      skipped: 'sentinel' }`.
//
// This shim operates on RAW localStorage intentionally — it must read the
// pre-JSON wire format before the JSON-routing abstraction can mask it,
// and it must write the post-JSON wire format that storage.getItem will
// then round-trip cleanly.
//
// Allow-list audit trail (from T1.10.1 through T1.10.8 closeouts):
//   - `blocksworn_ftue_beat` — FTUE_STORAGE_KEY (T1.10.1)
//                              stored as bare beat name (e.g. 'pyredrake_fight').
//   - `seenIntroVideo`       — T1.10.1 (3 sites in legacy: 23055, 24355, 56932).
//                              stored as bare '1'.
//   - `onboardingSeen`       — T1.10.1 (2 sites in legacy: 24441, 24454).
//                              stored as bare '1'.
//   - `blocksworn_chapter_{1..5}_complete` (T1.10.2 — 5 keys).
//                              stored as bare 'true'. Setter sites in
//                              progression.js `saveChapterComplete`; reader
//                              sites compare === 'true'.
//   - `blocksworn_voidfang_defeated` (T1.10.8 — 1 key).
//                              stored as bare '1' (legacy line 57911 setter;
//                              38648 debug-reset clearer). Reader compares
//                              === '1'.
//
// Public API:
//   - migrateBareStringKeys()  — one-shot migration, idempotent.
//   - LEGACY_BARE_STRING_KEYS  — frozen allow-list (exposed for test
//                                 coverage assertions).
//   - MIGRATION_SENTINEL_KEY   — sentinel key name (exposed for tests).

export const MIGRATION_SENTINEL_KEY = 'blocksworn_storage_v2_migrated';

// Frozen allow-list of legacy bare-string keys. Order preserved for stable
// iteration order; tests assert length === 9 + presence of each name.
export const LEGACY_BARE_STRING_KEYS = Object.freeze([
  'blocksworn_ftue_beat',           // T1.10.1 — FTUE_STORAGE_KEY value
  'seenIntroVideo',                 // T1.10.1 — 3 sites
  'onboardingSeen',                 // T1.10.1 — 2 sites
  'blocksworn_chapter_1_complete',  // T1.10.2 — chapter-complete flags
  'blocksworn_chapter_2_complete',
  'blocksworn_chapter_3_complete',
  'blocksworn_chapter_4_complete',
  'blocksworn_chapter_5_complete',
  'blocksworn_voidfang_defeated',   // T1.10.8 — Voidfang victory flag
]);

// Detect whether a raw localStorage string is already in the JSON wire
// format that T1.08 storage.setItem produces.
//
// Tricky bit: legacy stored `'true'` and `'1'` as bare strings (the literal
// characters `t-r-u-e` / `1`). After migration these become `'"true"'` and
// `'"1"'` — wrapped in literal quotes. We MUST treat the unwrapped legacy
// forms as needing migration, NOT mistake them for "already JSON" just
// because `true`/`1` happen to be valid JSON tokens. The 9 known bare-
// string values legacy writes are: 'pyredrake_fight' (and all FTUE beat
// names), '1' (intro-video / onboarding / voidfang), and 'true' (5 chapter-
// complete flags). NONE of those forms start with a `"` — so the leading-
// `"` check is the safe discriminator.
//
// Future-proof: also accept `{`, `[`, `null`-string as already-JSON in case
// a future caller writes a non-string value through storage.setItem before
// a re-migration pass. Numeric / boolean JSON literals (`1`, `true`,
// `false`) cannot be distinguished from the legacy bare-string forms by
// shape alone, so we conservatively migrate them — which is correct for
// the 9 known keys (legacy values become `'"1"'` / `'"true"'`) and at
// worst harmless for any future key (a caller can re-stringify the wrap
// once if it ever matters; storage.getItem currently JSON.parses both
// forms equivalently for value types).
function _looksLikeJSON(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return false;
  const c = raw[0];
  return c === '"' || c === '{' || c === '[';
}

// Sentinel check — has migration already run? Storage abstraction would
// JSON.parse the wrapped sentinel and return boolean true; here we touch
// raw localStorage so we see the wire format directly.
function _sentinelStamped() {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(MIGRATION_SENTINEL_KEY) === '"true"';
  } catch (_e) {
    // SecurityError (storage disabled in private mode, etc.) — treat as
    // "not stamped" so the migration loop can no-op safely below.
    return false;
  }
}

function _stampSentinel() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(MIGRATION_SENTINEL_KEY, '"true"');
  } catch (_e) {
    // QuotaExceeded / SecurityError — best-effort. If the sentinel cannot
    // be stamped, the next boot will re-run the migration; each iteration
    // is itself idempotent (already-JSON values are skipped).
  }
}

/**
 * Run the one-shot bare-string migration. Safe to call on every boot —
 * after the first successful pass the sentinel short-circuits.
 *
 * @returns {{ migrated: number, alreadyJSON: number, missing: number,
 *             total: number, skipped?: 'sentinel' }}
 */
export function migrateBareStringKeys() {
  const total = LEGACY_BARE_STRING_KEYS.length;

  // Fast path — sentinel already stamped. T1.12 will call this on every
  // boot; the second + boot must be O(1).
  if (_sentinelStamped()) {
    return { migrated: 0, alreadyJSON: 0, missing: 0, total, skipped: 'sentinel' };
  }

  // No localStorage available (SSR / private-mode hard fail) — return
  // zeroes without stamping so a future boot in a working environment can
  // still run the migration. Matches storage.js defensive pattern.
  if (typeof localStorage === 'undefined') {
    return { migrated: 0, alreadyJSON: 0, missing: 0, total };
  }

  let migrated = 0;
  let alreadyJSON = 0;
  let missing = 0;

  for (const key of LEGACY_BARE_STRING_KEYS) {
    let raw;
    try {
      raw = localStorage.getItem(key);
    } catch (_e) {
      // Per-key SecurityError — skip + count as missing so the loop can
      // continue. The sentinel still gets stamped below so we don't retry
      // forever in a partially-broken environment.
      missing++;
      continue;
    }

    if (raw === null) { missing++; continue; }

    if (_looksLikeJSON(raw)) { alreadyJSON++; continue; }

    // Bare string — wrap via JSON.stringify so subsequent storage.getItem
    // round-trips cleanly. Wrap-write itself is best-effort.
    try {
      localStorage.setItem(key, JSON.stringify(raw));
      migrated++;
    } catch (_e) {
      // Quota / write-blocked — count as missing-from-the-migrated-set so
      // callers can decide whether to surface a UX warning. We do NOT
      // increment `migrated` since the write didn't take.
      missing++;
    }
  }

  _stampSentinel();
  return { migrated, alreadyJSON, missing, total };
}

// ─── T1.14 — DELETE artifact subsystem ────────────────────────────────────
//
// Background:
//   v2.1 P1 §4 retired the artifact subsystem in legacy (PR #1.E gutted state,
//   functions, and T4 ARCANE RESONANCE). P5 §7 layered a CONSERVATIVE
//   localStorage cleanup pass (_phase5FinalArtifactCleanup, 4 keys). T1.14
//   completes the deletion per ADR-004 (Hybrid Runtime Coexistence) — legacy
//   may now be modified for cleanup tasks. This shim folds the legacy P5
//   cleanup into the modular boot chain so the cleanup runs even after legacy
//   is demoted, and adds defensive removal of the historical localStorage keys
//   the artifact subsystem ever wrote (legacy 38804-38812
//   _migrateArtifactStorageCleanup also handled `blocksworn_equipped_artifacts`
//   and `blocksworn_artifact_inventory`; legacy 29959-29964 P5 cleanup added
//   `blocksworn_artifact_history` and `blocksworn_artifact_pity`).
//
// Algorithm:
//   1. Idempotency sentinel — `blocksworn_artifacts_removed_v1`. Stored as
//      JSON-wrapped '"true"' so a future migrate scan won't re-target it.
//   2. Remove each well-known artifact-related localStorage key (idempotent —
//      missing keys are skipped silently).
//   3. If the aggregated `blocksworn_progress` save has `artifactsOwned` /
//      `equippedArtifacts` / `artDropPityCounter` fields, strip them and
//      write the save back (older builds wrote these; PR #1.E §4.3 stopped
//      writing them but old saves still carry the keys).
//   4. Stamp the sentinel.
//
// Failure modes: all storage I/O wrapped in try/catch. Quota / private-mode
// errors are swallowed (next boot will retry; idempotency makes that safe).
// Corrupt JSON in the progress save is treated as "no artifact fields" and
// silently ignored — the legacy load path already handles malformed data.

export const ARTIFACTS_REMOVED_SENTINEL_KEY = 'blocksworn_artifacts_removed_v1';

// Frozen allow-list of artifact-related localStorage keys ever written by
// legacy (cross-referenced against legacy 29959-29964 + 38808-38809).
export const LEGACY_ARTIFACT_STORAGE_KEYS = Object.freeze([
  'blocksworn_artifacts',           // hypothetical aggregate key
  'blocksworn_equipped_artifacts',  // legacy P5 cleanup + _migrateArtifactStorageCleanup
  'blocksworn_artifact_inventory',  // legacy _migrateArtifactStorageCleanup
  'blocksworn_artifact_history',    // legacy P5 cleanup
  'blocksworn_artifact_pity',       // legacy P5 cleanup
  'blocksworn_artifacts_owned',     // hypothetical alt naming
  'blocksworn_artifacts_equipped',  // hypothetical alt naming
]);

function _artifactsSentinelStamped() {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(ARTIFACTS_REMOVED_SENTINEL_KEY) === '"true"';
  } catch (_e) {
    return false;
  }
}

function _stampArtifactsSentinel() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(ARTIFACTS_REMOVED_SENTINEL_KEY, '"true"');
  } catch (_e) {
    // Best-effort; next boot retries.
  }
}

/**
 * Remove the artifact subsystem from persistent storage. Safe to call on
 * every boot — sentinel short-circuits after the first successful pass.
 *
 * @returns {{ removed: number, savePatched: boolean, skipped?: 'sentinel' }}
 */
export function migrateRemoveArtifacts() {
  if (_artifactsSentinelStamped()) {
    return { removed: 0, savePatched: false, skipped: 'sentinel' };
  }
  if (typeof localStorage === 'undefined') {
    return { removed: 0, savePatched: false };
  }

  let removed = 0;
  let savePatched = false;

  // 1. Remove well-known artifact localStorage keys.
  for (const key of LEGACY_ARTIFACT_STORAGE_KEYS) {
    try {
      if (localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
        removed++;
      }
    } catch (_e) {
      // Per-key SecurityError — skip + continue.
    }
  }

  // 2. Strip artifact fields from the aggregated progress save. Old builds
  //    persisted `artifactsOwned` / `equippedArtifacts` / `artDropPityCounter`
  //    on `blocksworn_progress` until v2.1 P1 PR #1.E §4.3 stopped writing
  //    them. The legacy load path silently defaults these to empty, so the
  //    fields are harmless residue — but stripping them on migration prevents
  //    storage bloat and makes the save shape match the live writer.
  try {
    const raw = localStorage.getItem('blocksworn_progress');
    if (raw) {
      const data = JSON.parse(raw);
      if (data && typeof data === 'object'
          && ('artifactsOwned' in data
              || 'equippedArtifacts' in data
              || 'artDropPityCounter' in data)) {
        delete data.artifactsOwned;
        delete data.equippedArtifacts;
        delete data.artDropPityCounter;
        localStorage.setItem('blocksworn_progress', JSON.stringify(data));
        savePatched = true;
      }
    }
  } catch (_e) {
    // Corrupt JSON / SecurityError — silently ignored. Legacy load path
    // handles malformed data with defensive defaults.
  }

  _stampArtifactsSentinel();
  return { removed, savePatched };
}
