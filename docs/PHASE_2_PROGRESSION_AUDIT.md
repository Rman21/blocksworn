# PHASE 2 — PROGRESSION AUDIT (Block B3)

**Branch:** `phase-2-grammar`
**Spec:** [HERO_GRAMMAR.md](HERO_GRAMMAR.md) §6 (squad mechanics) · MASTER_PLAN_V3 §3.5 (boss roster) · §4.1 (SQUAD progression)
**Predecessors:** B0 / B1 / B2 audits (Pirates / Rock / Sharks).
**Scope:** Hero unlock progression (Model B), SQUAD_MAX 3→4→5, boss voice lines (15), archetype visual identity, archetype-specific attack telegraph, save migration. Single Block B3 commit per workflow.

---

## Section A — Existing progression state findings (Step 0 read-only audit)

| System | Status before B3 | Decision |
|---|---|---|
| `revealHero(heroId)` + `HEROES_UNLOCKED_STORAGE_KEY` + `hero.unlocked` flag | Full unlock state machine already in place from Phase 1 | **EXTEND** — `applyBossDefeatProgression` flips `hero.unlocked = true` and saves. |
| `STARTER_HEROES` Set | 4 heroes (`pirate_warrior`, `pirate_mage`, `rock_warrior`, `rock_mage`) | **REPLACED** with B3 spec: 3 heroes (`pirate_warrior` THORGAR, `pirate_hunter` BLACKTOOTH, `pirate_captain` CRIMSON) — smallest legal squad showcasing all 3 main combo verbs. |
| `SQUAD_MAX` | `const SQUAD_MAX = 3` (immutable) | **CONVERTED** to `let` + storage helpers. Progression: 3 → 4 (Boss 2) → 5 (Boss 4). |
| `bossesDefeated` + `chapterProgress` | In place; updated in `onBossDefeated`. | **REUSED** — migration backfill reads `chapterProgress` directly; B3 hook fires AFTER `bossesDefeated` is bumped. |
| `BOSS_ARCHETYPES` registry (5 archetypes: bruiser/assassin/berserker/armored/phoenix) | Defined; `bossArchetype = currentBoss.archetype \|\| 'bruiser'` defaulted ALL bosses to bruiser because the boss roster lacked the `archetype:` field. | **ACTIVATED** — added `archetype:` to each of the 5 bosses in `CHAPTERS[1].bosses`. |
| `maybePhoenixRevive` + `bossPhoenixImmuneTurns` | Phoenix rebirth fully implemented; flashes `PHOENIX REBORN!`. | **REUSED** — Solar Phoenix now actually triggers it (was dead code without `archetype: 'phoenix'`). |
| `vShowAttackTelegraph` + `vClearAttackTelegraph` + `.p-attack-telegraph` CSS | AoE telegraph for all bosses; identical label "⚠ AOE INCOMING". | **EXTENDED** with `ARCHETYPE_TELEGRAPH_LABEL` map — pill prefix differs per archetype (BERSERKER STRIKE / ROW STRIKE / BLOOM STRIKE / SOLAR LINE / DARK GEOMETRY). Mechanics unchanged. |
| `playDialogScript` + single-slot pending queue | Queue serialization fixed in TASK #2.2b. | **REUSED** — boss voice lines route through it (Mode B with explicit `speaker` + `speakerColor`). No new dialog plumbing. |
| `flashText` | In use across the codebase for floating banners. | **REUSED** for the unlock celebration MVP. Full modal-with-card-flips deferred (DEBT-019). |
| `chapterCompleteModal` | In DOM at line ~8022 with `enterTowerFromChapterComplete()` / `replayChapterFromChapterComplete()` actions. | **NOT CHANGED** — Boss 5 unlocks fire the existing modal via the existing `onBossDefeated` chain; B3 just adds the additional "Chapter 1 Complete!" celebration banner via `showHeroUnlockCelebration`. |
| Music system on Crypt Lich < 30% | None present in codebase. | **DEBT-020** — visual archetype aura compensates for v1; music shift skipped. |

---

## Section B — Hero Unlock implementation

**State:** existing `hero.unlocked` boolean per `HERO_ROSTER` entry; persisted via `saveUnlockedHeroesToStorage()` (only non-starter unlocks written, starters always implicit).

**Progression table** (`BOSS_UNLOCKS` const at ~line 8576):

| Boss N | Heroes unlocked | Squad headcount after |
|---|---|---|
| Game start | THORGAR / BLACKTOOTH / CRIMSON | 3 (squadMax = 3) |
| 1 (Pyredrake) | + EMBERHAND, IRONBELLY (full Pirates) | 5 |
| 2 (Abyssal Tyrant) | + RIFFBLADE, SHRIEK, KEYCRYPT, THUNDERBEAT, NIGHTLORD (full Rock Band) | 10 + squadMax → 4 |
| 3 (Grovewarden) | + RIMEFANG, BRINESHOT (first Sharks) | 12 |
| 4 (Solar Phoenix) | + CRYOMIND, BULWARK, ABYSSKING (full Sharks) | 15 + squadMax → 5 |
| 5 (Crypt Lich) | none new — Chapter 1 complete celebration | 15 |

**Hook:** `applyBossDefeatProgression(bossNumber)` in `onBossDefeated` after `bossesDefeated` bump. Idempotent — re-defeating a previously-cleared boss won't re-fire celebration because `hero.unlocked` is already true and squadMax bumps use `Math.max`.

---

## Section C — SQUAD_MAX progression

`SQUAD_MAX` converted from `const` to `let` (line ~8576). Persisted via `SQUAD_MAX_STORAGE_KEY = 'blocksworn_squad_max'`.

`BOSS_SQUAD_BUMPS = { 2: 4, 4: 5 }` — Boss 2 bumps to 4 slots, Boss 4 bumps to 5. Other boss kills don't change SQUAD_MAX.

`saveSquadMaxToStorage()` / `loadSquadMaxFromStorage()` — clamped to [3, 5] on load for safety.

All existing code that referenced `SQUAD_MAX` (squad-select capping, reconciliation, FTUE backfill) continues to work — they read the live value.

---

## Section D — Unlock celebration UI

**MVP implementation (this commit):**
- `showSquadSlotUnlockToast(newMax)` — `flashText` + vibrate; shown FIRST when both unlock + slot bump fire on the same boss.
- `showHeroUnlockCelebration(bossNumber, heroIds)` — main banner via `flashText` with the tier label (`UNLOCK_TIER_LABELS`), then a 700ms-delayed second banner listing the unlocked names.
- Order: squad-slot toast (immediate) → 1500ms delay → hero unlock banner. Stagger gives the player time to read each.

**Deferred polish (DEBT-019):**
- Full modal overlay with portrait grid + card-flip stagger animation.
- "View Squad" / "Continue" CTAs.
- Boss-themed color washes per tier.

The MVP is functionally complete — every spec'd celebration fires; the visuals are conservative.

---

## Section E — Boss voice lines (15 lines mapping)

`BOSS_VOICES` const keyed by boss `name`:

| Boss | intro | midfight (HP < 50% first time) | death (final kill, after Phoenix revive) |
|---|---|---|---|
| PYREDRAKE | "The cinder that refuses to die... STILL BURNS." | "Your flames are kindling to mine." | "I... will return... in ash..." |
| ABYSSAL TYRANT | "You disturb the depths. The depths answer." | "Tide does not retreat. Tide consumes." | "...the deep... remembers..." |
| GROVEWARDEN | "The forest watches. The forest judges." | "You are temporary. We are root and bough." | "...new growth... from old wounds..." |
| SOLAR PHOENIX | "I have died. I have risen. WATCH ME RISE AGAIN." | "Each death is rehearsal. I AM ETERNAL." | "Not... yet... not... yet..." |
| CRYPT LICH | "Mortals. Such... persistent... noise." | "Your defiance amuses me. Briefly." | "Death... is... a... door..." |

**Triggers:**
- `maybeFireBossVoiceIntro()` — called from `startBossBattle` on a 1.5s timeout (after squad-pop). FTUE-only Pyredrake and Tower battles skip.
- `maybeFireBossVoiceMidfight()` — called from `dealDamage` after boss HP update. Fires once when `bossHP / bossMaxHP < 0.5`.
- `maybeFireBossVoiceDeath()` — called from `dealDamage` when `bossHP <= 0` AND `revivesRemaining === 0` (so Phoenix mid-life "deaths" don't fire the death line — only the final kill does).

**Per-battle flags reset** in `startBossBattle` via `resetBossVoiceFlags()`.

**Routing:** all three trigger sites call `playDialogScript([{speaker, speakerColor, text}], null)`. The single-slot pending queue from TASK #2.2b serializes back-to-back fires (e.g. midfight + death on the same dealDamage tick) — the queue drains via microtask after the active dialog completes.

---

## Section F — Archetype visual identities

Boss roster updated with `archetype:` field (line ~8340):

| Boss | Archetype | Existing mechanic activated | Visual aura |
|---|---|---|---|
| PYREDRAKE | berserker | `maybeEnrageBerserker` (×2 attack damage at HP ≤ 50%) was dead code; now fires. | Red `#E85D4A` pulsing aura, 1.6s cycle. |
| ABYSSAL TYRANT | armored | `armored.special: 'shields'` (70% absorb) hooked into existing damage pipe. | Cool blue `#3B8BD4` steel-sheen, 3.0s slow pan. |
| GROVEWARDEN | bruiser | bruiser is the default profile (1.5× HP, 8 attack CD). | Warm green `#5DCA79` organic breath, 2.4s cycle. |
| SOLAR PHOENIX | phoenix | `maybePhoenixRevive` (60% HP rebirth + 2-turn motif immunity) — was active via `revives:1` legacy path; now ALSO routed through `phoenix.special: 'revive'` for parity. | Gold `#E8B84A` rebirth aura, 1.8s cycle, more pronounced glow. |
| CRYPT LICH | assassin | assassin profile (0.7× HP, 4 attack CD, 1.4× damage) — fits the "fast deadly final boss" intent. | Purple `#9B59D6` shadow tendrils, 2.0s cycle. |

**CSS classes:** `.boss-archetype-{berserker|armored|bruiser|phoenix|assassin}` applied to `#bossImgWrap` in `startBossBattle`. All previous archetype classes removed first so re-entering a fight is clean.

**Reduced-motion compliance:** `@media (prefers-reduced-motion: reduce)` rule kills the pulse animations and falls back to the static box-shadow. Each archetype is still visually identifiable but doesn't strobe.

---

## Section G — Attack telegraph patterns

`ARCHETYPE_TELEGRAPH_LABEL` map provides per-archetype pill labels in `vShowAttackTelegraph`:

| Archetype | Telegraph label |
|---|---|
| berserker | ⚡ BERSERKER STRIKE |
| armored | 🛡 ROW STRIKE |
| bruiser | 🌿 BLOOM STRIKE |
| phoenix | ☀ SOLAR LINE |
| assassin | ▦ DARK GEOMETRY |

**v1 mechanics** unchanged — all bosses still use AoE void-scatter; only the warning pill prefix differs. Per-archetype cell highlighting (specific row/column/pattern selection) is **DEBT-021** for Phase 3 polish.

---

## Section H — Migration logic for existing saves

`runMigration_B3()` runs once per install:

1. **Gate:** if `localStorage[SQUAD_MAX_STORAGE_KEY]` is non-null → skip (already migrated OR fresh install which writes its own value below).
2. **Read** `chapterProgress[1]` from `localStorage['blocksworn_chapter_progress']` (peek directly because `bossesDefeated` global isn't loaded yet at parse time).
3. **Backfill heroes:** for each `n` ≤ `bossesDefeated`, mark all `BOSS_UNLOCKS[n]` heroes as `unlocked = true`.
4. **Backfill SQUAD_MAX:** apply max of `BOSS_SQUAD_BUMPS` for each defeated boss.
5. **Persist** both via the standard save helpers.
6. **Console log** the result for verification (`[B3 Migration] bossesDefeated=N → unlocked heroes=K SQUAD_MAX=M`).

**Idempotent** — re-running is no-op (gate at step 1).

**Roman's case** (Boss 4 reached): expected output post-migration —
`bossesDefeated=4 → unlocked heroes=15 SQUAD_MAX=5`
(all 15 heroes unlocked, full 5-slot squad available).

**Failure mode safe:** if migration throws, game still playable with 3 starters + SQUAD_MAX=3. User just plays Chapter 1 again. No crash, no soft-lock.

---

## Section I — Squad-select UI changes

**This commit (minimal):**
- `STARTER_HEROES` set updated → squad-select default population reflects new starter trio (THORGAR/BLACKTOOTH/CRIMSON).
- `SQUAD_MAX` becomes mutable → existing squad-select cap automatically respects the live value (slots shown = `SQUAD_MAX`; selecting beyond it is already prevented by `if (activeSquad.length >= SQUAD_MAX)` at line ~8670).
- Locked heroes already render greyscale via existing `.locked-hero-box` / `.v-hero-card.locked` CSS (lines ~5064, ~1507) driven by `hero.unlocked === false`.

**Deferred polish (DEBT-022):**
- "Defeat Boss N to unlock" tooltip on locked hero cards.
- "NEW" badge on recently-unlocked heroes (last 1-2 sessions).
- Locked-slot indicator on slots > current SQUAD_MAX (e.g. greyed-out 4th and 5th slot during pre-Boss-2 stage).

The MVP works because (a) the existing locked-hero greyscale already communicates "can't use yet" and (b) the squad slot count grows at the right boss tiers — players see the slot count visually expand on the squad-select grid.

---

## Section J — Regression checklist (Roman to verify)

JS syntax verified post-edits via JavaScriptCore (4.38MB parses clean).

1. **Fresh start** (clear localStorage):
   - Squad-select shows only THORGAR / BLACKTOOTH / CRIMSON unlocked.
   - 12 other heroes greyscale + locked.
   - Squad slots = 3.
2. **Existing save** (Roman's state — Boss 4 reached):
   - Console: `[B3 Migration] bossesDefeated=4 → unlocked heroes=15 SQUAD_MAX=5`.
   - All 15 heroes unlocked. Squad slot count = 5.
3. **Win Boss 1 (Pyredrake)** as fresh player:
   - PYREDRAKE death voice line fires before victory cinematic ("I... will return... in ash...").
   - "Full Pirates Roster!" banner + EMBERHAND · IRONBELLY name banner 700ms later.
   - Squad-select now shows 5 unlocked Pirates.
4. **Win Boss 2 (Abyssal Tyrant)**:
   - ABYSSAL TYRANT death line first.
   - "+1 SQUAD SLOT — 4 HEROES" toast immediately.
   - 1.5s later: "Rock Band Joins the Fight!" banner + 5 Rock Band names.
   - Squad slot count = 4 in subsequent squad-select.
5. **Win Boss 3 (Grovewarden)**:
   - GROVEWARDEN death line.
   - "First Sharks!" banner + RIMEFANG · BRINESHOT names.
   - 12 unlocked total.
6. **Win Boss 4 (Solar Phoenix)**:
   - Phoenix rebirth animation triggers on first death (`PHOENIX REBORN!` flash + 60% HP restore + 2-turn motif immunity).
   - SOLAR PHOENIX death line on FINAL death only (after revive).
   - "+1 SQUAD SLOT — 5 HEROES" toast.
   - "Full Sharks Roster!" banner + 3 Sharks names.
   - Squad slot count = 5.
7. **Win Boss 5 (Crypt Lich)**:
   - CRYPT LICH death line.
   - "Chapter 1 Complete!" banner.
   - Existing chapterCompleteModal shows.
8. **Boss intro voices**: 1.5s after each battle starts, the boss speaks (queue-serialized — never overlaps with FTUE dialog).
9. **Midfight voices**: each boss speaks once at HP < 50% (only first crossing).
10. **Archetype visuals**: 5 boss portraits visually distinct — red pulse (Pyredrake), blue sheen (Abyssal Tyrant), green breath (Grovewarden), gold glow (Solar Phoenix), purple shadow (Crypt Lich). Reduced-motion mode: animations off, static glow remains.
11. **Attack telegraph labels**: each boss shows its own label pill (BERSERKER STRIKE / ROW STRIKE / BLOOM STRIKE / SOLAR LINE / DARK GEOMETRY).
12. **No console errors** through full Chapter 1 (5 bosses) playthrough. Captain dual buff still works for all 3 captains (CRIMSON / NIGHTLORD / ABYSSKING).

---

## Section K — Deferred items (DEBT register)

| ID | Item | Reason for deferral |
|---|---|---|
| **DEBT-019** | Full hero-unlock modal with portrait grid + card-flip stagger animation | MVP via flashText is functionally complete; modal is polish. Block B4 candidate. |
| **DEBT-020** | Crypt Lich music shift at < 30% HP | No music system in v1 codebase. Skip per task spec ("if not — DEBT, document and skip"). Phase 6+ candidate. |
| **DEBT-021** | Per-archetype attack telegraph cell highlighting (specific row/column/pattern) | Mechanics-equivalent — all bosses use AoE void-scatter in v1. Visual differentiation via labels suffices for now. Phase 3 polish. |
| **DEBT-022** | Squad-select polish: "Defeat Boss N" tooltip on locked cards, "NEW" badge on recently-unlocked, locked-slot indicator | Existing greyscale + lock-icon CSS already communicates locked state; slot count expands automatically on SQUAD_MAX bumps. Block B4 polish. |

Open from earlier blocks (still active):
- **DEBT-014** FTUE FSM rework (Phase 4).
- **DEBT-016** KEYCRYPT/THUNDERBEAT free-encore-token architecture (Block B5).
- **DEBT-017** BULWARK refundPlacement plumbing (Phase 6).
- **DEBT-018** shark-emoji onerror fallback for portraits (cosmetic).

---

## Section L — Git status

Single Block B3 commit on `phase-2-grammar`. Per Roman's standing instruction ("добавляй все в основую игру!!!"), the commit will be auto-merged into `main` immediately so playtest sees both lineages.
