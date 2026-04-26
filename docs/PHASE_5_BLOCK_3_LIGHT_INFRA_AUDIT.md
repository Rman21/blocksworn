# PHASE 5 BLOCK 3 — Light/Solar Infrastructure

**Branch:** `phase-2-grammar`
**Spec:** [BLOCKSWORN_COMBAT_REFERENCE.md](../BLOCKSWORN_COMBAT_REFERENCE.md) §3.5 Light/Solar · §11 Universal Infrastructure
**Predecessor:** Phase 5 Block 2 (Crocodiles) — `a3557ce`
**Date:** 2026-04-26

---

## A. Spec recap

Per Combat Reference §3.5 — LIGHT (in-world: SOLAR):

> **Core mechanic:** Light cell clears → +1 shield per cell. Hunter конвертит ВСЕ shields в один burst attack.
> **Combat role:** Sustain → Conversion. Накопил защиту → потратил на damage.
> **Side-system state:** `lightCells` array + existing shieldPool.
> **Cap:** SHIELDS-TO-DAMAGE banner при shields ≥ 8.
> **Universal hooks:** `onSolarCellsCleared(n)`, `consumeShieldsForBurst()`.
> **Identity:** "Жди и наказывай. Defensive payoff."

This block ships the **infrastructure layer**. Hero-level abilities ship in Phase 5 Block 4 (Sparks).

---

## B. Implementation

### B.1 State model

```js
const SOLAR_SHIELDS_THRESHOLD = 8;             // shieldCount → SHIELDS-TO-DAMAGE banner
const SOLAR_BURST_DMG_PER_SHIELD = 200;        // suggested burst dmg/shield (Block 4 reference)
let solarShieldsCapFired      = false;         // per-battle one-shot banner
let solarShieldsBankedTotal   = 0;             // running counter of shields gained via solar clears (debug + audit)
```

**Key design decision** (vs Block 1 grove): No separate `lightCells` Map. Light's "side-system state" IS the existing `shieldCount` global — Light clears feed directly into shields. The new state vars (`solarShieldsCapFired`, `solarShieldsBankedTotal`) only track:
- per-battle one-shot for the SHIELDS-TO-DAMAGE banner
- audit counter for shields gained specifically via solar clears (separate from total shieldCount which can come from Tank ULTs, IRON HIDE, etc.)

This avoids duplicating the existing shield system. Sparks heroes (Block 4) will read raw `shieldCount` directly, just like MOSSWEAVER (Block 2).

### B.2 `onSolarCellsCleared(n)` universal hook

Mirrors `onTideCellsCleared` / `onUmbraCellsCleared` / `onGroveCellsCleared` pattern. Each cleared solar cell → +1 shield, capped by `MAX_SHIELD + 2 + maxShieldBonus`:

```js
function onSolarCellsCleared(n) {
  if (!MOTIFS_ENABLED.solar) return;
  if (!n) return;
  if (typeof computeActiveElements === 'function' && !computeActiveElements().has('solar')) return;
  const cap = MAX_SHIELD + 2 + (maxShieldBonus || 0);
  let gained = 0;
  for (let i = 0; i < n; i++) {
    if (shieldCount < cap) { shieldCount++; gained++; }
    else break;
  }
  if (gained > 0) {
    solarShieldsBankedTotal += gained;
    flashText('LIGHT WARD +' + gained + '🛡', STIHIYA_COLORS.solar);
  }
  try { maybeFireShieldsCap(); } catch (e) {}
}
```

Wired into `clearLines` dispatch alongside tide/umbra/grove.

### B.3 `consumeShieldsForBurst()` Hunter helper

```js
function consumeShieldsForBurst() {
  const consumed = shieldCount;
  shieldCount = 0;
  return consumed;
}
```

Universal Light Hunter consume pattern. Reserved for **RADIANCE Aurora Burst** (Phase 5 Block 4). Returns shield count for caller to multiply by per-shield burst dmg formula. Drains shieldCount to 0.

> Note: MOSSWEAVER (Earth Mage, Block 2) has its own inline shield-to-damage in its ULT — uses raw `shieldCount * 200`, doesn't go through this helper. Functionally equivalent. Future cleanup pass may unify.

### B.4 `maybeFireShieldsCap()` cap banner

```js
function maybeFireShieldsCap() {
  if (solarShieldsCapFired) return;
  if (shieldCount < SOLAR_SHIELDS_THRESHOLD) return;
  solarShieldsCapFired = true;
  flashText('SHIELDS-TO-DAMAGE!', STIHIYA_COLORS.solar);
  vibrate([60, 40, 60, 40, 120]);
}
```

**Critical design decision**: cap banner fires ONLY from `onSolarCellsCleared`'s call path — not from arbitrary shield sources (Tank ULTs, IRON HIDE, captain DOMINION, ABYSSKING freeze, etc.). This preserves the "Light defensive payoff" thematic identity per spec — banner is meaningful (you cleared lights → you're now ready to convert) rather than decorative (any shield source triggers banner).

Visual consistency with INFERNO! / SHATTER VOLLEY! / ENCORE-OF-ENCORE! / REVENGE BURST! pattern. Vibrate triple-pulse identical to grove's REVENGE BURST for "high-cap-reached" haptic family.

### B.5 Console diagnostic

`window.__debugSolar()` — single-call snapshot for triage:

```js
{
  enabled: true,
  shieldCount: 5,
  shieldCap: 5,                  // MAX_SHIELD + 2 + maxShieldBonus
  solarBankedTotal: 3,           // shields gained via solar clears (vs other sources)
  shieldsThreshold: 8,
  capFired: false,
  capProgress: '62%',            // shieldCount / threshold
  burstDmgPerShieldHint: 200
}
```

### B.6 Per-battle reset

In `startBossBattle` reset block, adjacent to grove infrastructure:

```js
solarShieldsCapFired     = false;
solarShieldsBankedTotal  = 0;
```

`shieldCount` itself is reset elsewhere (existing combat init).

---

## C. What this block does NOT touch

- All Phase 1/2/3/4 work intact.
- Existing solar mechanics (radiantCells, huntPack, roar, valeriusRadiantWard, halo chain) — preserved verbatim. Block 3 only adds NEW universal hook for the Light spec; it doesn't refactor existing solar code.
- Existing `shieldCount` / `MAX_SHIELD` / shield consumption logic — untouched.
- No Spark heroes yet (Phase 5 Block 4).
- Phase 5 Block 1 grove infrastructure preserved verbatim.

---

## D. Edge cases handled

| Scenario | Behavior |
|---|---|
| `MOTIFS_ENABLED.solar === false` | Hook short-circuits; safe to ship before Phase 5 Block 4 |
| Solar clear with 0 cells | `if (!n) return;` |
| Shield already at cap | Hook bumps 0 shields (loop break), no flash, banner check still runs |
| Shield ≥ 8 from non-solar sources only (Tank ULTs etc.) | Banner does NOT fire (preserves thematic identity) |
| Shield reaches 8 via solar clear, drops via boss attack, climbs to 8 again | Banner fires ONCE per battle (one-shot flag) |
| Hunter consume with 0 shields | Returns 0 — Hunter ULT falls back to flat dmg primer-shot pattern |
| Mixed cleared elements (e.g. solar + grove + ember in same line) | Each hook fires independently for its element count |
| Player retries battle | Both new state vars reset in `startBossBattle` |

---

## E. Roman regression checklist

JS syntax verified post-edits via JavaScriptCore — file parses through 16,096+ lines clean.

1. **Smoke test — fresh battle, no Spark heroes**:
   - `__debugSolar()` shows `{ shieldCount: 0, solarBankedTotal: 0, capFired: false, capProgress: '0%' }`
   - Solar clears (in non-FTUE Light fight) bump shieldCount via hook
   - "LIGHT WARD +N🛡" flashes when shields gained from clear
   - At shieldCount ≥ 8 → "SHIELDS-TO-DAMAGE!" banner fires once

2. **Manual injection test (DevTools)**:
   ```js
   shieldCount = 7;
   onSolarCellsCleared(2)  // bumps shield by 2 (capped if at cap), banner fires
   __debugSolar()  // → { capFired: true, ... }
   onSolarCellsCleared(3)  // shield bumps further but no re-banner
   ```

3. **Shield via non-solar source**:
   - Tank ULT or IRON HIDE bumps shieldCount to 8
   - `__debugSolar().capFired === false` — banner did NOT fire (correct)
   - Solar clear at shield=8 then bumps to 9 → banner fires

4. **Manual consume test**:
   ```js
   consumeShieldsForBurst()  // returns shield count, drains to 0
   ```

5. **Battle restart**: all solar state resets to fresh.

6. **No console errors** through full Chapter 1 with non-Spark squad (no regression).

7. **DevTools console**: `__debugSolar()` returns full snapshot.

---

## F. Spec adherence

| Spec point (Combat Ref §3.5 + §11) | Implementation | Status |
|---|---|---|
| Light cell clears → +1 shield per cell | `onSolarCellsCleared` increments shieldCount | ✅ |
| `onSolarCellsCleared(n)` universal hook | Plumbed in clearLines dispatch | ✅ |
| `consumeShieldsForBurst()` Hunter helper | Returns shieldCount, drains to 0 | ✅ |
| SHIELDS-TO-DAMAGE cap banner at shields ≥ 8 | `maybeFireShieldsCap` + once-per-battle flag | ✅ |
| Cap banner thematic gating | Only fires from solar-clear path (not arbitrary shield sources) | ✅ |
| Visual banner consistency | `flashText('SHIELDS-TO-DAMAGE!', STIHIYA_COLORS.solar)` | ✅ |
| `MOTIFS_ENABLED.solar` gating | Hook short-circuits if disabled | ✅ |
| Per-battle reset | `startBossBattle` adjacent to grove resets | ✅ |
| Reduced-motion compliance | No animation added (banner is plain `flashText`, already reduced-motion-safe) | ✅ |

---

## G. Phase 5 progress

- ✅ Block 1 — Earth/Grove infrastructure (`2994f0a`)
- ✅ Block 2 — Crocodile heroes (`a3557ce`)
- ✅ **Block 3 — Light/Solar infrastructure** (this commit)
- ⏳ Block 4 — Spark heroes (5 heroes + race-passives + SOLARLORD captain dual + THE PRISMATIC RIDE signature combo)
- ⏳ Block 5 — Hero unlock progression update (25 heroes total)
- ⏳ Block 6 — Phase 5 sign-off + tag `v0.5.0-phase-5-done`

---

## H. Git status

Single Block 3 commit on `phase-2-grammar`. Auto-merged to `main`.
