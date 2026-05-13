# Narrator Copy Review Sheet — Phase 2 Identity Layer

**Status:** AWAITING ROMAN APPROVAL (Phase 2 PR merge copy-pass)
**Origin:** ESC-02 O2 ruling ("placeholder-first; CTO + Roman do a copy-pass before T2.11 closes")
**Compiler:** Bug Tester (TASK-041 / T2.B.QA Area 3)
**Date:** 2026-05-12

---

## Purpose

Per ESC-02 O2 (resolved 2026-05-12 — Roman authorized "PLACEHOLDER-FIRST"):

> Game Dev wires with Designer's draft strings; CTO + Roman do a copy-pass
> before T2.11 closes (parallel review track). Implementation unblocked;
> final-line editorial review batched at end of Phase 2.

This sheet inventories every Phase 2 Identity Layer string that is
**narrator-adjacent** (banner / HUD / Darkest-Dungeon-voice line) so
Roman can read, redline, or approve them in a single editorial pass.

The sacred `NARRATOR_LINES` table (`src/feel/narrator-lines.js`) is
**byte-perfect, untouched** — verified via `git diff src/feel/narrator-lines.js`
returning empty. All Identity Layer copy lives in isolated constants in
`src/data/identity-layer.js` (or inline in `src/feel/identity-fx.js` for
non-narrator HUD labels), so the sacred infrastructure cannot be
accidentally edited.

---

## Sacred NARRATOR_LINES verification

```bash
$ git diff main..HEAD -- src/feel/narrator-lines.js | grep -cE "^[+-][^+-]" 
# 0 — no content lines modified (only the file-creation diff from Phase 1)
```

**Result:** `NARRATOR_LINES` table is byte-perfect. All 9 sacred lines
(`runStart`, `firstClear`, `bigCombo`, `hpLost`, `guardFire`,
`strikerFire`, `weaverFire`, `lowHP`, `bossAppears`) are unchanged. ✅

---

## Phase 2 narrator-adjacent strings (5 items)

### 1. Grovewarden — Root Surge **(narrator line, WIRED)**

**File:** `src/data/identity-layer.js:858`
**Constant:** `ROOT_SURGE_NARRATOR_LINE_PLACEHOLDER`
**Value:** `'Where you would not bloom, I will.'`
**Comment marker:** ✅ `// FINAL COPY: pending Roman approval at Phase 2 PR merge.`
**Mechanic context:** Fires when player's last 3 line clears were all
non-grove. The boss "speaks" via the narrator overlay alongside 3 mossy
roots crawling up empty cells (spec §3.5 field 6 — "boss feels
thematically alive").
**Tone target:** Darkest Dungeon (poetic, terse, voice-of-boss).
**Roman action:** APPROVE as-is OR redline with replacement string.

---

### 2. Phoenix — Ashen Reign **(HUD label only; no narrator line wired)**

**File:** `src/data/identity-layer.js:444`
**Constant:** `ASHEN_REIGN_HUD_COUNTDOWN_TEXT`
**Value:** `'EMBER ONLY — 5s'`
**Comment marker:** none (HUD label, not narrator)
**Mechanic context:** Displayed on the HUD for 5 seconds after Phoenix
revive while the board is locked to ember-only piece placement (spec §3.1
field 4).
**Tone target:** functional HUD label (mechanical clarity); not
Darkest-Dungeon-voice.
**Spec narrator line (NOT yet wired):** `"The ash remembers. Strike only with the flame that birthed it."` (spec §3.1 field 6)
**Roman action:**
- APPROVE the HUD label as functional UI copy (no tone constraint), AND
- DECIDE: ship Phase 2 PR with no spec §3.1 narrator line (HUD-only),
  OR add the spec line as a `PHOENIX_ASHEN_REIGN_NARRATOR_LINE_PLACEHOLDER`
  constant + ctx.narratorApi.show() call in a follow-up patch.

---

### 3. Lich — Cursed Tiles **(spec narrator line NOT yet wired)**

**File:** none (no Lich-narrator constant exists in identity-layer.js)
**Mechanic context:** Fires next-turn after player clears with ≥2 sharks.
3 cells gain skull overlays (spec §3.2 field 6 — "boss feels responsive").
**Spec narrator line (NOT yet wired):** `"What you took, the deep remembers."` (spec §3.2 field 6)
**Roman action:** DECIDE: ship Phase 2 PR with no Lich narrator line
(boss-reactive mechanic is purely visual + mechanical), OR add the spec
line in a follow-up patch.

---

### 4. Bloodtide Pulse — Berserker HUD **(HUD label only)**

**File:** `src/feel/identity-fx.js:3019` (inline literal)
**Value:** `'BLOODTIDE PULSE — +5% incoming'`
**Comment marker:** none (HUD label)
**Mechanic context:** Displayed on the HUD when the bloodtide pulse is
pending (every 3rd clear in Active state). Telegraphs the +5% damage on
the boss's next attack.
**Tone target:** functional HUD label; not Darkest-Dungeon-voice.
**Roman action:** APPROVE as functional UI copy OR redline.

---

### 5. Engineer Lockdown — Tetris celebration banner **(banner label only)**

**File:** `src/feel/identity-fx.js:3362, 3702` (inline literal, used twice)
**Value:** `'TETRIS!'`
**Comment marker:** none (celebration banner)
**Mechanic context:** Triumphant celebration banner displayed
immediately when player completes a 4-line crit clear, BEFORE the
boss's lockdown response clanks in (spec §3.4 field 6 — "Triumphant
TETRIS celebration banner IMMEDIATELY followed by clanking metal
lockdown").
**Tone target:** classic Tetris reference; not Darkest-Dungeon-voice.
**Roman action:** APPROVE as iconic genre callout OR redline.

---

## Spec narrator lines NOT in current implementation

Per `docs/design/mechanics/identity-layer.md` §3, the spec lists 4
Darkest-Dungeon-voice narrator lines. Only 1 is wired in code (item 1
above). The remaining 3 are documented here for Roman's explicit
ship-vs-defer decision:

| # | Spec | Suggested line | Wired? | Recommended action |
|---|------|----------------|--------|--------------------|
| 1 | §3.1 Phoenix Ashen Reign | "The ash remembers. Strike only with the flame that birthed it." | NO | ADD as PHOENIX_ASHEN_REIGN_NARRATOR_LINE_PLACEHOLDER in identity-layer.js + wire via ctx.narratorApi in fxPhoenixAshenReign |
| 2 | §3.2 Lich Cursed Tiles | "What you took, the deep remembers." | NO | ADD as LICH_CURSED_TILES_NARRATOR_LINE_PLACEHOLDER in identity-layer.js + wire via ctx.narratorApi in fxLichCursedTiles |
| 3 | §3.5 Grovewarden Root Surge | "Where you would not bloom, I will." | YES | NONE — already wired (item 1 above) |
| 4 | §3.7 Uroboros Eternal Loop | "The eye that sees itself sees you, too." | NO (Uroboros out of Phase 2 scope) | DEFER to Phase 3 (Uroboros is seasonal Tower mythic per spec §3.7) |

**Bug Tester recommendation:** The 2 missing narrator lines (Phoenix +
Lich) are LOW-RISK additions — same pattern as the existing Root Surge
wiring (isolated constant + `try/catch ctx.narratorApi.show(line)`). The
sacred `NARRATOR_LINES` table is unchanged either way. CTO can spawn a
follow-up T2.13 task to add them OR Roman can approve Phase 2 PR with
just the wired Root Surge line + spec-only Phoenix/Lich lines deferred
to a polish pass.

---

## Verification commands (for Roman audit)

```bash
# Sacred NARRATOR_LINES table unchanged
git diff main..HEAD -- src/feel/narrator-lines.js
# Expect: only the Phase 1 file-creation diff; no content edits.

# All narrator-adjacent strings in Identity Layer
grep -nE "= '[A-Z][^']*'" src/data/identity-layer.js
# Expected output:
#   444:export const ASHEN_REIGN_HUD_COUNTDOWN_TEXT  = 'EMBER ONLY — 5s';
#   858:export const ROOT_SURGE_NARRATOR_LINE_PLACEHOLDER = 'Where you would not bloom, I will.';

# Inline HUD/banner strings in identity-fx.js
grep -nE "textContent = '[A-Z]" src/feel/identity-fx.js
# Expected output:
#   2084: ASHEN_REIGN_HUD_COUNTDOWN_TEXT (constant ref)
#   2203: ASHEN_REIGN_HUD_COUNTDOWN_TEXT (constant ref)
#   3019: 'BLOODTIDE PULSE — +5% incoming'
#   3362: 'TETRIS!'
#   3702: 'TETRIS!'
```

---

## Phase 2 PR merge gate

Phase 2 PR MAY merge with:
- ✅ Sacred `NARRATOR_LINES` unchanged (verified)
- ✅ Item 1 (Root Surge "Where you would not bloom, I will.") approved
- ✅ Items 2/4/5 (HUD/banner labels — Ashen Reign HUD, Bloodtide HUD,
  TETRIS!) approved as functional UI copy
- ✅ Items 1/2 narrator lines from §3.1 + §3.2 either added as
  isolated PLACEHOLDER constants OR explicitly deferred to a Phase 2.5
  polish task

OR with explicit Roman edits to any of the above 5 strings; in which
case CTO files the edits as a [BUG-NN] or [T2.B.QA-fix-NN] task for
Game Dev to apply before merge.

---

**Document version:** 1.0
**Owner:** Bug Tester (Phase 2 closeout)
**Maintainer:** CTO until Roman approves; then archive
