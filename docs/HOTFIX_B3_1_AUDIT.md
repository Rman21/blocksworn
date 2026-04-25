# HOTFIX B3.1 — Audit

**Branch:** `phase-2-grammar`
**Mode:** Hotfix — narrow patch, single commit. **NOT auto-merged to main per task instruction** (Roman verifies first).
**Diagnostic doc:** [HOTFIX_B3_1_DIAG.md](HOTFIX_B3_1_DIAG.md)
**Source:** Roman playtest after B3 (`a6b5cea` on main).

---

## Section A — Bug #1 root cause + fix applied

**Root cause** ([HOTFIX_B3_1_DIAG.md §BUG #1](HOTFIX_B3_1_DIAG.md#bug-1--voice-dialog-portrait-shows-broken-image-icon)): the B3 helper `_bossVoiceTrigger(slot)` built the dialog script with `speaker` + `speakerColor` + `text` only — NO `portraitKey`. The dialog renderer falls back to `src = ''` when `line.portraitKey` is undefined, producing `<img src="">` which the browser renders as a broken-image icon.

**Fix** ([blocksworn_index_fixed.html:8893](blocksworn_index_fixed.html:8893)): added `portraitKey: currentBoss.img` to the script line. `currentBoss.img` is already `'Boss_1'`..`'Boss_5'` per the boss roster, and `ASSETS.Boss_1`..`ASSETS.Boss_5` are inline base64 JPEG data URIs at [blocksworn_index_fixed.html:8165](blocksworn_index_fixed.html:8165) onward — they always resolve. No new assets, no new code paths, no new failure modes.

**Diff scope:** one line added (`portraitKey: currentBoss.img,`) plus 3-line comment block updated to explain the requirement and reference the renderer line.

---

## Section B — Bug #2 root cause + fix applied

**Root cause** ([HOTFIX_B3_1_DIAG.md §BUG #2](HOTFIX_B3_1_DIAG.md#bug-2--hero-a-fires--heroes-bcd-charge-meters-drain)): legacy stihiya-shared ULT charge architecture (`ultCharges = { ember, tide, grove, solar, umbra }`, mutated to 0 in `onHeroCardClick` at [blocksworn_index_fixed.html:20744](blocksworn_index_fixed.html:20744)). Predates phase-2-grammar entirely.

**Why B3 exposed it:** the `STARTER_HEROES` change from a 2-element 4-hero set (pirate W+M, rock W+M) to a mono-element 3-hero set (pirate W+H+C) made the legacy shared-stihiya bar visible — all 3 starter cards now share `ultCharges['ember']`, so firing CRIMSON visually drains THORGAR + BLACKTOOTH + CRIMSON simultaneously.

**Fix in this commit:** **NONE.** Per the task's explicit ESCALATE criteria:

> ESCALATE if:
> - Either bug has root cause OUTSIDE B3 changes (means it's a pre-existing bug exposed by B3, requires MGD decision on scope)
> - Fix would require touching unrelated systems

Both criteria hit. The minimal scope-bounded patch (Option A in DIAG doc — revert STARTER_HEROES to mixed-element) is one option; the architecturally correct patch (Option C — per-hero charge meters) is a Phase-4-scale rewrite that was deliberately archived. MGD picks the path. This hotfix touches **zero** lines related to charges, ultCharges, onHeroCardClick, STARTER_HEROES, or any shared-stihiya logic.

**Decision queue for MGD** (from DIAG doc Section MGD decision options):
- **A** — Revert STARTER_HEROES to mixed-element (cheapest, fully reversible).
- **B** — Keep new STARTER_HEROES, add UI hint explaining shared-element charge.
- **C** — Restore archived/phase-4 per-hero charge architecture (largest scope).
- **D** — Hybrid: per-hero meter UI rendering, per-stihiya pool internally.

DIAG doc recommends Option A.

---

## Section C — Why this was missed in B3

1. **Author runs JS syntax check via JavaScriptCore but cannot render DOM.** Voice dialog portraits only fail at render time — JS parses fine. Step 8 of B3's regression checklist (`Boss intro voices fire correctly`) requires browser playtest to catch.
2. **B3 used `playDialogScript` Mode B (boss dialog) without studying the existing `pyredrake_intro` example.** That legacy line at [blocksworn_index_fixed.html:11425](blocksworn_index_fixed.html:11425) DOES include `portraitKey: 'Boss_1'`. Mirroring it would have prevented BUG #1.
3. **B3 changed STARTER_HEROES without thinking through interaction with the legacy stihiya-shared charge bar.** The new starter trio looks great as combo grammar (CREATOR + DETONATOR + ENABLER) but is mono-element, which collapses three card meters into one charge bar visually.

**Lessons for future blocks:**
- Mirror existing patterns when introducing parallel features (Mode B boss voices vs. legacy boss dialogs — they should have identical script-line shapes).
- Audit downstream visual impact when changing fundamental sets like `STARTER_HEROES` — not just "does the squad work" but "what does the player SEE on the deck after the first ULT fires."
- Consider adding a unit-test-style check at parse time that boss voice scripts include `portraitKey` (filed as **DEBT-023**).

---

## Section D — Diagnostic console logs added

**None in this hotfix.** BUG #1's fix is mechanical (one-line addition); no new logging needed. BUG #2 is escalated, not fixed — adding the `[ChargeFire]` diagnostic the task suggested would imply we've identified a code path to instrument, but the legacy code path is intentional behavior.

If MGD picks Option A or D for BUG #2, the implementing commit (separate from this hotfix) can add `[ChargeFire]` instrumentation as part of that work and target removal at Block B5.

---

## Section E — Roman regression verify checklist

JS syntax verified post-fix via JavaScriptCore (4.38MB parses clean). Roman to verify in browser:

1. **Voice dialog portraits — Pyredrake fight:**
   - Battle starts. After ~1.5s, dialog overlay shows PYREDRAKE intro.
   - Speaker portrait = boss render (Boss_1 image), NOT broken-image icon.
   - Speaker name = "PYREDRAKE", color = boss red.
   - Voice text appears with typewriter effect.

2. **Voice dialog portraits — all 5 bosses:**
   - Same as #1 for Abyssal Tyrant (Boss_2), Grovewarden (Boss_3), Solar Phoenix (Boss_4), Crypt Lich (Boss_5).
   - Each portrait visible. No broken icons.

3. **Mid-fight voice (HP < 50% first crossing):**
   - Damage boss to ~50% HP.
   - Mid-fight line fires. Portrait visible.
   - Subsequent damage does NOT re-fire (per-battle flag holds).

4. **Death voice (final kill):**
   - Defeat boss. Death line fires before victory cinematic. Portrait visible.
   - For Solar Phoenix: only the FINAL kill (post-revive) fires the death line, NOT the rebirth "death".

5. **No console errors** during full Chapter 1 run.

6. **BUG #2 status check** — confirm by playtest that this hotfix did NOT touch the charge mechanic:
   - Squad with 3 starter Pirates (THORGAR, BLACKTOOTH, CRIMSON).
   - Fire any ULT. All 3 hero cards' charge bars visually drain to 0 — **expected** (legacy stihiya-shared design, escalated).
   - This is the bug Roman reported in #2 — it remains until MGD picks an option from DIAG Section MGD decision options.

If voice portraits work in browser, BUG #1 is closed. BUG #2 remains open pending MGD.

---

## Section F — Git status

Single hotfix commit on `phase-2-grammar`. **NOT merged to main per task instruction** — Roman verifies first.

After Roman verifies BUG #1 fix:
- If green: merge `phase-2-grammar` to `main` (auto-merge pattern resumes).
- If red: investigate further before merge.

BUG #2 escalation: separate decision-and-implementation cycle. MGD picks A/B/C/D from DIAG doc; implementing commit is a follow-up, not part of this hotfix.

---

## Section G — DEBT register update

| ID | Item | Status |
|---|---|---|
| **DEBT-023 (new)** | Parse-time check that boss voice scripts include `portraitKey` (lint-style guard) | Filed. Block B5 polish candidate. |

Open from earlier blocks:
- DEBT-014 FTUE FSM rework (Phase 4)
- DEBT-016 KEYCRYPT/THUNDERBEAT free-encore-token architecture (B5)
- DEBT-017 BULWARK refundPlacement (Phase 6)
- DEBT-018 shark-emoji onerror fallback (cosmetic)
- DEBT-019 full hero-unlock modal w/ card-flip animation (B4)
- DEBT-020 Crypt Lich music shift (no music system in v1)
- DEBT-021 per-archetype telegraph cell highlighting (Phase 3)
- DEBT-022 squad-select tooltips/badges/locked-slot indicator (B4)
