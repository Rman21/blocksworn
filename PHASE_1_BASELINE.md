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

---

# PHASE 1 — FINAL STATS (2026-04-25)

Closing snapshot after 8 surgical tasks (1.1–1.8) + 6 hotfixes. Game in
shippable-MVP-baseline state.

## File metrics — pre/post comparison

| Metric | Pre-Phase-1 (baseline) | Post-Phase-1 (Task #1.9) | Delta |
|---|---|---|---|
| Bytes | 12,456,953 | 4,041,539 | **−8,415,414 (−67.6%)** |
| Lines | 31,443 | 21,746 | **−9,697 (−30.8%)** |
| MB | 11.88 | 3.85 | **−8.03** |

## Content reductions

| Asset | Pre-Phase-1 | Post-Phase-1 |
|---|---|---|
| Hero roster | 50 heroes (10 factions) | 15 heroes (Pirates / Rock Band / Clockwork-locked) |
| Chapters | 3 (15 bosses) | 1 (5 bosses, ASHEN DOMINION) |
| Squad max | 5 heroes | 3 heroes |
| Game modes | Boss + Tower + Arena + Event Dungeons + Awakening | Boss + Tower |
| Visual systems | Vivid + Arena Premium | Arena Premium only |
| Bottom nav | 3 tabs + 6-item drawer (DAILY/ACH/CODEX/TOWER/SEASON/MODS) | 4 tabs (HOME/HEROES/TOWER/SHOP) + 1-item drawer (DAILY) |
| Monetization | Energy + Paid Packs (4 SKUs) + Pity Bypass + Season Pass | None (Phase 7+ revival) |
| Boss portrait assets | Boss_1..Boss_15 (15) | Boss_1..Boss_5 (5) |

## Removed systems (with task references)

- **Task #1.2** — Arena, Event Dungeons, Awakening modes
- **Task #1.3** — Achievements, Codex, Modifiers, Artifacts (V18 system)
- **Task #1.4** — 8 factions (orc/elf/troll/human/dark_elf/skeleton/golem/lion), 40 heroes, 30 hero portrait base64 assets
- **Task #1.5** — Chapters 2 (FORSAKEN DEPTHS) + 3 (PRIMAL CONCLAVE), Boss_6..15 portraits, BOSS_HERO_REWARDS[2/3]; **+** Chapter Complete modal added
- **Task #1.6** — Vivid visual system (10 STYLIZED CSS blocks, 40 `--v-*` tokens, ~2461 CSS lines, #infoModal Vivid)
- **Task #1.7** — Energy system (vars + UI + gates), Paid Packs (Block 3.2), Convenience Purchases (Block 3.3), Season drawer entry
- **Task #1.8** — Bottom nav rebuild (4-tab: HOME/HEROES/TOWER/SHOP), drawer reduced to DAILY only

## Tech debt log (resolved + deferred)

| ID | Status | Resolution |
|---|---|---|
| DEBT-001 | Active (stubs) | Phase 1.5 / 1.7 partially cleared; Task #1.9 verified residue |
| DEBT-002 | Active | Phase 6 — dead CSS selector cleanup |
| DEBT-003 | **Resolved** · Task #1.4 | fire/fireDelta symmetry restored (10/10 post-roster-reduction) |
| DEBT-004 | Deferred | Phase 5 / Task #1.9 — hero-state let-decls cleanup |
| DEBT-005 | **Resolved** · Task #1.5 | BOSS_HERO_REWARDS[2/3] removed |
| DEBT-006 | Deferred | Phase 5 — FTUE narrative rewrite by Creative Director |
| DEBT-007 | Deferred | Phase 5 — leader choice + narrator design |
| DEBT-008 | **Resolved** · Task #1.5 (Part B) | revealHero() now unlocks |
| DEBT-009 | Deferred | Phase 6 — `v-*` class alias rename (DOM + CSS + JS) |
| DEBT-010 | Deferred | Phase 7+ — Season system reactivation |
| DEBT-011 | Deferred | Phase 6 — splash card sizing polish |
| DEBT-012 | Deferred | Phase 5 — orphan Ch2/3 DIALOG_LINES (44 entries) cleanup |

## Playtest findings (Phase 4/5 priorities)

- **PF-001** — Grovewarden difficulty wall (4× defeat from Roman) → Phase 4 balance
- **PF-002** — HP mechanic not taught in onboarding → Phase 5 progressive disclosure
- **PF-003** — Hero abilities feel weak and unexplained → Phase 4 + Phase 5
- **PF-004** — Chapter Complete auto-trigger E2E unverified → Task #1.9 / Phase 4 retest

See `/docs/PLAYTEST_FINDINGS.md` for detail.

## Functional verification (Task #1.9 audit)

✓ All removed-feature greps return 0 (modulo intentional DEBT-001 stubs + 1 cleanup comment)
✓ `HERO_ROSTER.length === 15` (10 active + 5 Clockwork-locked)
✓ `CHAPTERS.length === 1` (ASHEN DOMINION, 5 bosses)
✓ Squad max === 3 (verified via SQUAD_MAX const + `__debugHeroes()`)
✓ Structural balance: braces 2954/2954, parens 7097/7097, brackets 1461/1461
✓ All 20 core gameplay functions present (showScreen, goToMenu, goToTower, fireHero, etc.)
✓ Bottom nav: 4 tabs (HOME/HEROES/TOWER/SHOP), drawer 1 item (DAILY)
✓ Visual unified Arena Premium (no `--v-*` defs, no `var(--v-*)` refs)
✓ 0 dangling onclick handlers
✓ migrateSave() regex covers all removed-system localStorage keys

## Remaining residue (intentional, documented)

- **2 stub functions** (`MODIFIERS = {}`, `openModifiersSheet() {}`) — DEBT-001
- **44 orphan DIALOG_LINES entries** for Ch2/3 bosses — DEBT-012, naturally cleaned in Phase 5
- **309 `.v-*` CSS compound selectors** + **67 `v-*` DOM class names** — DEBT-009 architectural aliases, Phase 6
- **Vivid keyword** in 20 textual comments (cosmetic only)

## Out of scope (deferred to future phases)

- **Phase 2** — Clockwork faction implementation (5 placeholder heroes → real)
- **Phase 3** — Boss voice & encounter polish (5 Ch1 bosses)
- **Phase 4** — The Moment Mechanics (PF-001..003 addressed via balance + tactile polish)
- **Phase 5** — Onboarding Rebuild (PF-002, FTUE narrative rewrite, DEBT-006/007/012)
- **Phase 6** — Launch Prep (DEBT-002/009/011 cleanup, splash polish)
- **Phase 7+** — Web3 / monetization revival (Season, Paid Packs, energy if needed; DEBT-010)

