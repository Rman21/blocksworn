# PHASE 5b BLOCK 1 — Chapter 2 Archetype Infrastructure

**Branch:** `phase-2-grammar`
**Spec:** [BLOCKSWORN_BOSS_COMPENDIUM.md](../BLOCKSWORN_BOSS_COMPENDIUM.md) §12 Archetype Expansions + per-boss §6-10 phase breakdowns
**Predecessor:** Phase 5 sign-off `v0.5.0-phase-5-done` (`7c2b99d`)
**Date:** 2026-04-26

---

## A. Spec recap

Per Boss Compendium §12 — Chapter 2 introduces 5 NEW boss archetypes:

| Archetype | Mechanic | Boss (5b.3-5b.7) |
|---|---|---|
| **Hypnotist** | Suggests hero choices; rewards/punishes obedience | VEROTHIRA |
| **Engineer** | Manipulates board structure (lockdown cells, electrify rows) | GEARHEART |
| **Frenzy** | Escalating damage based on time-since-hit | URSARO |
| **Tempo Disruptor** | Manipulates turn flow / time / player tempo | TIDESPIRE |
| **Battery** | Charge meter that escalates threat then unleashes | HELIOTRON |

This block ships **infrastructure**: archetype data, CSS auras, state vars, init/tick/reset functions, console diagnostic. **Specific boss data ships in Phase 5b.2**, per-boss mechanic refinement in **5b.3-5b.7**.

---

## B. Implementation

### B.1 BOSS_ARCHETYPES extension

10 archetypes total now (5 Chapter 1 + 5 Chapter 2):

```js
hypnotist:       { icon: '🌸', label: 'HYPNOTIST',       hpMult: 1.6, attackCD: 6, dmgMult: 1.0, special: 'suggest' },
engineer:        { icon: '⚙',  label: 'ENGINEER',        hpMult: 1.8, attackCD: 6, dmgMult: 1.1, special: 'lockdown' },
frenzy:          { icon: '🐻', label: 'FRENZY',          hpMult: 1.4, attackCD: 5, dmgMult: 1.0, special: 'frenzyStacks' },
tempo_disruptor: { icon: '❄',  label: 'TEMPO DISRUPTOR', hpMult: 1.5, attackCD: 5, dmgMult: 1.0, special: 'tempo' },
battery:         { icon: '☀',  label: 'BATTERY',         hpMult: 1.6, attackCD: 5, dmgMult: 1.0, special: 'chargeMeter' },
```

`special` field signals which archetype-specific mechanic dispatcher applies; balance pass on Phase 5b.9 sign-off.

### B.2 ARCHETYPE_MATCHUP extension

Per Compendium strategy notes, each archetype has best/worst-counter element:

| Archetype | Strong vs | Weak vs |
|---|---|---|
| Hypnotist | solar | umbra |
| Engineer | grove | ember |
| Frenzy | ember (Hunter-fast) | tide (Mage-slow) |
| Tempo Disruptor | tide | solar |
| Battery | solar | grove |

Drives matchup hint pill on menu screen.

### B.3 5 archetype CSS auras

Mirror existing Phase 2 B3 pattern (`box-shadow` + `@keyframes` pulse + reduced-motion fallback):

| Archetype | Color | Animation feel | Period |
|---|---|---|---|
| Hypnotist | purple shimmer | 3-stage hypnotic eye-pulse | 2.6s |
| Engineer | bronze/copper + green core | steam-vent pulse | 2.2s |
| Frenzy | hot orange | fastest pulse mirrors hunger | 1.4s |
| Tempo Disruptor | ice-blue mist | wide slow wave | 3.6s |
| Battery | electric gold | high-energy spark with 3-stage flicker | 1.0s |

Reduced-motion fallback adds all 5 to the existing media query (kills animation, keeps static glow).

CSS class naming: underscore in archetype key → dash in class name (`tempo_disruptor` → `boss-archetype-tempo-disruptor`). Dispatcher in `startBossBattle` does `archetype.replace(/_/g, '-')`.

### B.4 State model (per archetype)

```js
// HYPNOTIST
let hypnotistSuggestedHeroIds = [];     // current suggestion targets (P1=1, P2/P3=2)
let hypnotistTendrilHeroId    = null;   // currently coiled hero (locked from firing)
let hypnotistTendrilTurnsLeft = 0;
let hypnotistBloomCorrupted   = false;  // P3: umbra clears now hurt player
// + 6 turn counters for sub-mechanic intervals

// ENGINEER
let engineerLockedCells       = new Map();  // 'r_c' → turns until unlock
let engineerElectrifiedRow    = -1;
let engineerElectrifiedTurns  = 0;
// + 3 turn counters

// FRENZY
let frenzyStacks              = 0;
let frenzyHitThisTurn         = false;
let frenzyP3Active            = false;
let frenzyMaulQueued          = false;
let frenzyDevourQueued        = false;

// TEMPO DISRUPTOR
let tempoSlowQueued           = false;
let tempoChargeNullifyQueued  = false;
let tempoTurnLockQueued       = false;
// + 3 turn counters

// BATTERY
let batteryCharge             = 0;       // 0-100
let batteryHitThisPlacement   = false;
let batteryUnleashCount       = 0;
let batteryPhase              = 1;
```

Plus per-archetype interval/threshold constants per Compendium spec (HYPNOTIST_SUGGEST_INT_P1=8, ENGINEER_WELD_INT=5, FRENZY_DMG_PER_STACK=0.05, etc.).

### B.5 Per-archetype tick functions

```js
function tickChapter2Archetype() {
  if (!currentBoss || !currentBoss.archetype) return;
  const phase = _bossArchetypePhase();
  switch (currentBoss.archetype) {
    case 'hypnotist':       _tickHypnotist(phase); break;
    case 'engineer':        _tickEngineer(phase);  break;
    case 'frenzy':          _tickFrenzy(phase);    break;
    case 'tempo_disruptor': _tickTempo(phase);     break;
    case 'battery':         _tickBattery(phase);   break;
    default: return; // Chapter 1 archetypes — existing handlers unchanged
  }
}
```

Wired into per-placement post-hook alongside MOSSWEAVER/LUMENWIND amp window decrements + IRON HIDE / Static Field / Death Roll race-passives. No-op for Chapter 1 bosses (existing archetypes have separate `maybeEnrageBerserker` / `maybePhoenixRevive` paths preserved).

`_bossArchetypePhase()` helper detects current phase based on HP gates 100% → 66% → 33% → 0% per Boss Compendium.

### B.6 Per-archetype mechanics (Block 1 scaffolding)

Each archetype has a tick function that drives counters + queues phase-gated effects + emits flashText announcements:

**Hypnotist** (3 sub-mechanics escalating per phase):
- Suggestion (P1: every 8 turns, 1 hero / P2: 6 turns, 2 heroes / P3: 4 turns, 2 heroes)
- Petal Fall (every 5 turns, 4 random cells → umbra) — visual queued in Block 1, cell conversion wires in 5b.3
- Tendril Coil (P2+: every 6 turns, lock 1 hero from firing for 2 turns)
- Bloom Bloom (P3: every 8 turns, umbra clears now hurt player) — flag set in Block 1, damage logic wires in 5b.3

**Engineer** (3 sub-mechanics):
- Weld (every 5 turns, 2/3/4 cells locked per phase, 4 turns each) — counter + flash in Block 1, cell-render guards in 5b.4
- Extract (P2+: every 7 turns, absorbs earth-cells → 5% HP heal per absorbed) — wired in 5b.4
- Critical Mass (P3: every 6 turns, electrify 1 row for 2 turns) — row marker in Block 1, damage logic in 5b.4

**Frenzy** (stack-based escalation):
- Stack accumulation per turn (P1: +1 / P3: +2)
- Decay on hit (P1: reset / P2: ×0.5)
- Maul threshold (P2+: ≥5 stacks → 3-attack combo)
- Devour threshold (P3: ≥8 stacks → eat lowest-HP hero)
- Block 1: stacks tick, queued flags set, flash announcements; damage scaling in 5b.5

**Tempo Disruptor** (queued visual/mechanical effects):
- Slow Time (every 6 turns, visual-only slow-mo) — Block 1 sets queue flag, animation wires in 5b.6
- Reverse Tempo (P2+: every 7 turns, next placement = 0 charge) — flag set in Block 1, charge guard in 5b.6
- Tidal Lock (P3: every 8 turns, next turn fully skipped) — flag set in Block 1, turn-skip in 5b.6

**Battery** (charge meter → unleash):
- Charge accumulator (+1 hit / +2 no-hit / +2 always P3)
- Milestones at 75% / 90% with announcements
- 100% triggers Solar Convergence (P2: 4-row attack) or Sunfire Cascade (P3: 3 sequential AoE)
- Block 1: charge ticks, threshold flash announcements; AoE damage logic wires in 5b.7

### B.7 startBossBattle wiring

```js
// PHASE 5b BLOCK 1: per-archetype init dispatcher
if (currentBoss && currentBoss.archetype && typeof initChapter2Archetype === 'function') {
  initChapter2Archetype(currentBoss.archetype);
}
```

`initChapter2Archetype` calls `resetChapter2ArchetypeState()` (resets ALL Chapter 2 vars defensively) + per-archetype init scaffold (extension point for 5b.3-5b.7).

Plus unconditional reset earlier in `startBossBattle`:
```js
if (typeof resetChapter2ArchetypeState === 'function') resetChapter2ArchetypeState();
```

This prevents Chapter 2 archetype state from leaking across battles even if init dispatcher fails.

### B.8 Console diagnostic

`window.__debugChapter2Archetype()` — single-call snapshot:

```js
{
  currentBoss: 'PYREDRAKE',
  currentArchetype: 'berserker',
  currentPhase: 1,
  hypnotist: { suggestedHeroIds: [], tendrilHeroId: null, ... },
  engineer:  { lockedCells: [], electrifiedRow: -1, ... },
  frenzy:    { stacks: 0, p3Active: false, ... },
  tempo:     { slowQueued: false, ... },
  battery:   { charge: 0, threshold: 100, chargeProgress: '0%', ... }
}
```

For Chapter 1 bosses (current implementation): all Chapter 2 fields show empty/zero state — confirms no leakage.

---

## C. What this block does NOT touch

- Phase 1/2/3/4/5 work intact.
- All Chapter 1 archetype mechanics (`maybeEnrageBerserker`, `maybePhoenixRevive`, armored shields, assassin profile, bruiser default) preserved verbatim.
- No Chapter 2 boss data (Phase 5b.2 ships boss roster + assets).
- No Crocs/Sparks unlock changes (Phase 5b.3-5b.7 remove `locked: true` per boss).
- No World Map cinematic (Phase 5b.8).
- All existing v1 game flow runs unchanged — Chapter 1 5-boss progression unaffected.

---

## D. Edge cases handled

| Scenario | Behavior |
|---|---|
| Chapter 1 boss with existing archetype (berserker etc.) | `tickChapter2Archetype` switch falls through default → no-op; existing handlers run unchanged |
| Battle starts mid-game with current boss having archetype 'hypnotist' | `initChapter2Archetype` runs, state reset, mechanics tick from clean state |
| Sequential battles: Chapter 2 boss → Chapter 1 boss | `resetChapter2ArchetypeState` runs in startBossBattle, Chapter 2 state cleared, Chapter 1 boss runs fresh |
| Boss with unknown archetype (typo / future expansion) | CSS class added (no matching style → no aura), tick switch → default no-op, no error |
| Archetype tick throws exception | Wrapped try/catch in per-placement hook; `console.warn` logs, combat continues |
| Reduced-motion preference | All 5 new archetype animations disabled via existing media query (kept inline with 5 Chapter 1 archetypes) |

---

## E. Roman regression checklist

JS syntax verified post-edits via JavaScriptCore — file parses through 16,856+ lines clean.

1. **Existing Chapter 1 progression unaffected**:
   - Pyredrake (berserker) — `bossArchBerserkerPulse` aura active; `maybeEnrageBerserker` fires at 50% HP unchanged
   - Abyssal Tyrant (armored) — armor shields unchanged
   - Grovewarden (bruiser) — default profile unchanged
   - Solar Phoenix (phoenix) — revive unchanged
   - Crypt Lich (assassin) — assassin profile unchanged

2. **Chapter 2 archetype dry-run** (manual injection):
   ```js
   currentBoss = { name: 'TEST_HYPNOTIST', archetype: 'hypnotist', ... };
   tickChapter2Archetype();
   __debugChapter2Archetype()
   // → { currentArchetype: 'hypnotist', hypnotist: { ... }, ... }
   ```

3. **CSS class application**:
   - Set `currentBoss.archetype = 'tempo_disruptor'` → bossImgWrap gets `boss-archetype-tempo-disruptor` class → ice-blue swell aura visible

4. **State reset on battle start**:
   - After Chapter 2 dry-run with frenzyStacks=5, start new battle
   - `__debugChapter2Archetype().frenzy.stacks` → 0 (reset cleared)

5. **No console errors** through full Chapter 1 with Chapter 2 archetype infrastructure idle.

6. **DevTools verification**:
   - `BOSS_ARCHETYPES.hypnotist` → `{ icon: '🌸', label: 'HYPNOTIST', hpMult: 1.6, ... }`
   - `ARCHETYPE_MATCHUP.battery` → `{ strong: ['solar'], weak: ['grove'] }`
   - `tickChapter2Archetype` is callable
   - `initChapter2Archetype('frenzy')` resets state + console log

---

## F. Spec adherence

| Spec point (Compendium §12 + per-boss specs) | Implementation | Status |
|---|---|---|
| 5 NEW archetypes with HP/CD/dmg per Compendium | BOSS_ARCHETYPES extended (10 entries total) | ✅ |
| Each archetype has CSS aura (visual identity) | 5 new `.boss-archetype-*` classes + animations | ✅ |
| Telegraph labels per archetype | flashText emissions in tick functions (🌸 / ⚙ / 🐻 / ❄ / ☀) | ✅ |
| Phase progression (3 HP gates) | `_bossArchetypePhase()` helper + per-tick phase parameter | ✅ |
| Mechanic infrastructure (counters, thresholds, queue flags) | All 5 archetype tick functions ship complete state machines | ✅ |
| Reset on battle start | `resetChapter2ArchetypeState` + dispatcher in `startBossBattle` | ✅ |
| Reduced-motion compliance | 5 new archetypes added to existing `@media` block | ✅ |
| Specific boss-mechanic logic (cell conversion, cell lock guards, hero coil rendering, etc.) | Reserved for 5b.3-5b.7 (per-boss blocks) | ⏳ |

---

## G. Phase 5b progress

- ✅ **Block 1 — Chapter 2 archetype infrastructure** (this commit)
- ⏳ Block 2 — Chapter 2 boss data + 10 PNG assets (5 Chapter 1 + 5 Chapter 2)
- ⏳ Block 3 — VEROTHIRA (Hypnotist mechanics) + unlock 2 Crocs
- ⏳ Block 4 — GEARHEART (Engineer mechanics) + unlock 3 Crocs
- ⏳ Block 5 — URSARO (Frenzy mechanics) + unlock 2 Sparks
- ⏳ Block 6 — TIDESPIRE (Tempo Disruptor mechanics) + unlock 3 Sparks
- ⏳ Block 7 — HELIOTRON (Battery mechanics) + Chapter 2 finale
- ⏳ Block 8 — World Map cinematic + Chapter 2 transition
- ⏳ Block 9 — Phase 5b sign-off + tag `v0.5.5-chapter-2-done`

After Block 9 → Chapter 2 fully playable; Crocs/Sparks all unlocked through natural progression; soft launch decision.

---

## H. Git status

Single Block 1 commit on `phase-2-grammar`. Auto-merged to `main`.
