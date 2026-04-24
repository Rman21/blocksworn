# PHASE 1 — BASELINE METRICS

**Date captured:** 2026-04-24
**Git commit (HEAD at capture):** 2c7eb77695a18dc800119284c4a3c9b7ba446b58
**Branch:** phase-1-reduction
**Snapshot path:** backups/blocksworn_v_pre_reduction.html

## File

- **Size:** 12,456,953 bytes (~11.88 MB)
- **Lines:** 31,443
- **SHA-256:** `7264e7c9852bf6c620454dce9851f8eab2ba1eb657f8d63968a9002fcfee54be`

## JS declarations

- `async function fire*` count (pattern `^async function fire`): **100**
  - Breakdown: `fireDelta*` matches = 49. Remaining hero-named `fire*` = 51.
  - Note: expected symmetry would be 50 + 50 = 100 for 50 heroes. The 51/49 split suggests one hero has two `fire*` entries OR one hero is missing a `fireDelta*`. Not blocking — flagged for Phase 2 audit.
- `async function ultTwist*` count: **50**
- `async function ultDelta*` count: 50 (captured for reference, not required by spec)
- `CHAPTERS` array length: **3**
- `HERO_ROSTER` array length: **50**

## Screens (DOM)

- Total `<div class="screen"` elements: **12**
- Screen IDs (alphabetical):
  - screenAchievements
  - screenArena
  - screenAwaken
  - screenBattle
  - screenCodex
  - screenDailies
  - screenEvent
  - screenMenu
  - screenSeason
  - screenSelect
  - screenShop
  - screenTower

## Rollback instructions

If Phase 1 needs to be aborted:

```bash
git checkout main
git branch -D phase-1-reduction
cp backups/blocksworn_v_pre_reduction.html blocksworn_index_fixed.html
```

Verify restoration with:

```bash
shasum -a 256 blocksworn_index_fixed.html
# expected: 7264e7c9852bf6c620454dce9851f8eab2ba1eb657f8d63968a9002fcfee54be
```
