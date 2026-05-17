# Blocksworm UI/UX Designer — Day 1 Onboarding

**For:** the incoming Mobile Game UI/UX Designer hired by Roman 2026-05-16+
**Workstream:** Phase 5 parallel polish (Weeks 0-8), integration with migration sprint
**Reports to:** CTO (gatekeeper for design-to-engineering handoffs); ultimate sign-off Roman
**Compensation + scope:** per `/Users/rm/Downloads/game file/Instructions Game AAA+/Blocksworn_UI_UX_Polish_Strategy.md` §7 (the authoritative brief — read in full Day 1)

> Welcome. This doc orients you in <60 minutes. Read top-to-bottom before doing anything else.

---

## 1. What this project is

**Blocksworm** is a block-puzzle RPG (PvE) for mobile web, currently live at `https://play.blocksworm.com` in v2.1 form. Internal codename history: v2.1 was a successful design reboot; Phase 1-4 (the four executed development phases through 2026-05) shipped Identity Layer + Endgame Social + Chia integration code into the repository, though most Phase 2-4 features are dormant in the live runtime pending Phase 5 Vite migration.

Tone reference: **Darkest Dungeon** narrative voice + **Hades** ceremony + bright crystalline element FX. Poetic, terse, never coach-speak. The Chronicler is our narrator character (cyan-glow portrait, sacred voice).

Competitive set on mobile web: Marvel Snap (card clarity), Brawl Stars (combat feel), Clash Royale (thumb-zone discipline), Hades + Slay the Spire (identity per system), Genshin (mobile menu polish). We're not copying; we're matching their planka in our visual identity.

## 2. Your role boundary (non-negotiable)

| You do | You don't |
|---|---|
| Figma specs + asset creation | Touch code files |
| Audit existing art library + decide reuse | Decide game mechanics |
| Animation timing specs (Lottie / video) | Modify combat math, V_HAPTICS, NARRATOR_LINES |
| Design system tokens (colors, typography, spacing) | Modify any sacred-cow constant (see §3) |
| Device matrix QA from visual perspective | Run code QA (Bug Tester role) |
| Review implementation screenshots | Communicate directly with Game Dev (always through CTO) |

**Why these boundaries:** the Phase 4.1 sidecar incident (2026-05-13) was caused partly by parallel workstreams creating merge conflicts. Clean separation prevents recurrence.

## 3. Sacred Cows — DO NOT MODIFY (CLAUDE.md §2 verbatim)

These values are project-wide invariants. **Visual representation OK; underlying mechanic OFF-LIMITS.**

**Combat math (cannot change):**
- Combo crit formula `total_dmg × (1 + dominantCount × combo × 10%)`
- TIER_COSTS_V18 `{1:1, 2:2, 3:3, 4:5}`
- HERO_ULT_COST_BY_NEWROLE `{warrior:80, mage:100, hunter:120, tank:80, captain:100}`
- TTK formula `boss_hp = expected_squad_dps × target_ttk_seconds`
- MAX_HP = 100 (the *number*, not the visual representation — you may redesign the bar entirely; you may not change "100" to "120")

**Feel layer (cannot change):**
- V_HAPTICS table `{tap:10, place:15, clear:25, hit:30, crit:[30,20,30], levelup:[20,30,40], rareDrop:[40,40,40], victory:[100,50,100,50,200], defeat:[200]}`
- vPlayCritFlash timing: 180ms flash + 440ms shake
- 5-beat boss death cinematic (vPlayBossDieFx) sequence
- Particle line clear pattern direction toward bossImg coordinates

**Narrative voice (cannot change):**
- NARRATOR_LINES strings (Darkest Dungeon-style poetry, literal verbatim)
- The Chronicler character + portrait + cyan glow
- chronicle_intro / chronicle_outro / intro dialog copy
- Boss names + element subtitles
- Tone: poetic, terse, NEVER coach-speak

**Economy (cannot change):**
- GEM_PACKS price ladder $0.99 / $4.99 / $9.99 / $19.99 / $49.99 / $99.99 + bonus percentages
- First Purchase Bonus copy (+50% gems + 1 Hero Card + Founder Badge)
- Battle Pass formula `xp = 500 + (tier-1) × 150`
- Tower retry gem ladder `[100, 200, 400]`

**Anything else is yours to redesign.** Health bars, damage numbers, button shapes, layouts, icons, animations on new surfaces — yes. Sacred FX timings (the 180/440ms above) — no.

## 4. What's live now (your starting point)

Open `https://play.blocksworm.com` on your phone. The current state:
- Pure v2.1 legacy game: 21 MB single HTML, ~4 MB gzipped, TTI ~2.1s
- Bottom nav: HOME / HEROES / TOWER / SHOP
- Functional but emoji-driven; AAA+ feel gaps in every screen
- Phase 2-4 features (Identity Layer FX, Adventures, Party Tower, Replay, Friend Leaderboard, Tower Seasonal, Codex, Wallet, NFT, DAO) are in code but invisible to users until Phase 5 Gate 3 cutover (~Week 5)

**Your Tier S work targets the most-time-spent screens (battle HUD: ~60-70% of player time).** Your Tier A targets first-5-minutes flows. Polish Strategy §4 has full priority tier listing.

## 5. Existing art library (`/Users/rm/Downloads/game/` — 356 MB)

Roman disclosed 2026-05-16. Your TASK-UX-002 (in TASKS.md) is the formal audit. Pre-audit CTO observations:

| Folder | Pre-audit verdict | Notes |
|---|---|---|
| `ingame_icons_cropped/set2_*.png` | ✅ Likely REUSE-DIRECT | Blocksworm-aligned (ember/tide/grove/solar/umbra emblems + 8-12 UI icons including book_help, castle_chapter, coin_gold, heroes_squad, house_home, lightning_energy, shop_building, star_favorite, cards_stack, gem_diamond). Closes ~14 of 22 emoji-to-replace items in Polish Strategy §2.3. |
| `ingame_icons_cropped/set1_*.png` | ✅ Likely REUSE-DIRECT or RESTYLE | Generic game UI (sword, shield_mitigation, trophy, crown, hourglass_timer, magnifier, chest_reward, chat_bubbles, arrow_back, barchart_stats, gem_laurel, lvl_up, bow_hunter, rooster_race). Useful baseline. |
| `race emblems/` + `races/` | ⚠️ Likely DISCARD or INSPIRATION-ONLY | Wrong roster (dark elf, elf, golem, human, lion, orc, pirate, rock, skeleton, troll). Code roster is pirate/shark/rock/croc/spark/grove. Only 2 overlap (pirate, rock). Either stale from earlier design iteration OR flavor inspiration. |
| `elements emblems/` | ⚠️ Likely DISCARD | Wrong element set (dark/earth/fire/light/water). Code element set: ember/tide/grove/solar/umbra (set2 icons already cover these). |
| `boss emblems/`, `boss/`, `new boss/`, `Game bosses/` | ❓ Designer audits | Boss roster in code: phoenix, lich, berserker, engineer, grovewarden. Check whether art matches. |
| `chapter emblems/` | ❓ Designer audits | Chapter narrative anchors. Code has 3 chapters shipped (VEIL OF FORGOTTEN GODS / etc — verify against `src/data/`). |
| `class emblem/` | ❓ Designer audits | Role iconography. Code roles: warrior/mage/hunter/tank/captain. Audit per-role match. |
| `Modifications emblems/`, `Armor/` | ❓ Designer audits | Possibly Tier/Mythic visual differentiation source. |
| `energy.png`, `cristal.png`, `coin.png` | ✅ Likely REUSE | Currency icons. |

**Deliverable for asset audit:** `docs/design/ui-ux/asset-library-audit.md` per TASK-UX-002.

## 6. Your task queue

Open `docs/plan/TASKS.md`. Scroll to `## UI/UX DESIGNER` section. You have 10 tasks (TASK-UX-001..TASK-UX-010). Sequence is gated:

```
TASK-UX-001 (onboarding, this doc + sacred cows + Polish Strategy)
  ↓
TASK-UX-002 (art library audit)
  ↓
TASK-UX-003 (design system tokens + components) ← gates ADR-006
  ↓
TASK-UX-004 (Tier S screen specs) ─┬─ parallel possible
TASK-UX-005 (Tier A screen specs) ─┘
  ↓
TASK-UX-006 (asset production — Lottie, exports)
  ↓
TASK-UX-007 (implementation support during Eng Lead Weeks 6-7)
  ↓
TASK-UX-008 (Week 8 device matrix QA + sign-off)
  ↓
TASK-UX-009 (Tier B post-launch — DEFERRED)
TASK-UX-010 (Tier C Chia visual — DEFERRED)
```

Each task in TASKS.md has explicit deliverables + CTO sign-off gate.

## 7. Communication channels

**With CTO:**
- Async: Figma comments, doc PRs (`docs/design/ui-ux/*.md`), TASKS.md status updates
- Sync: 1× per week 30-min call (you propose time)
- Escalations: CLAUDE.md §8 escalation paths. If you find a sacred-cow conflict (e.g., a screen spec genuinely requires changing a sacred timing) → STOP and escalate to CTO via `docs/plan/REPORT.md` ESC-NN. CTO escalates to Roman. **Never silently work around a sacred cow.**

**With Engineering Lead (after their Week 0-1 onboarding):**
- All design-to-engineering handoff routes through CTO
- Engineering Lead screenshots staging builds; CTO routes to you for review
- Your iterations live in Figma; you do NOT comment on PRs or merge code

**With Bug Tester:**
- You + Bug Tester partner on Week 8 device matrix QA
- Visual perspective (you) + code-quality perspective (Bug Tester) = both sign-offs required for beta release

**With Roman:**
- Ultimate aesthetic + brand decision authority
- Direct line via Slack/Discord for design direction questions
- CTO can mediate if unsure whether Roman approval needed

## 8. Documents to read on Day 1 (in order)

1. **This doc** (you're here)
2. `/Users/rm/Downloads/game file/Instructions Game AAA+/Blocksworn_UI_UX_Polish_Strategy.md` — Roman's authoritative brief (~800 lines, ~30 min read)
3. `CLAUDE.md` — sections 1, 2, 3, 6, 9 (sacred cows + AAA+ standards + references + glossary; ~20 min)
4. `docs/adr/005-full-vite-migration-with-gates.md` — what the parallel migration sprint is doing (~10 min)
5. `docs/reports/00_EXECUTIVE_BRIEFING.md` and `06_INDEX.md` — project state context (~10 min)
6. `docs/plan/TASKS.md` `## UI/UX DESIGNER` section — your task queue
7. Live game on your phone for 30 min — feel current state

**Total Day 1 reading:** ~2 hours. Then sign onboarding doc in `docs/design/ui-ux/onboarding-sign-off.md` (template you'll create at end of Day 1).

## 9. Working principles you'll be evaluated on

These mirror CLAUDE.md §7 working principles for the whole team:

1. **Sacred cows immutable** — see §3 above. Visual freedom around them is broad; mechanical change is escalation.
2. **Atomic deliverables** — one screen spec per Figma file or per page, with implementation-ready notes. No giant "redesign everything" Figma dumps.
3. **Mobile-first viewport range** — your specs must work from iPhone SE 375pt to iPhone Pro Max 440pt + Samsung 320pt-412pt. Polish Strategy §3 has full device matrix.
4. **Performance budget respect** — Lottie ≤16ms/frame, SVG icons ≤2 KB gz, no bundle bloat past +200 KB total gz. CTO will measure and reject overruns.
5. **Sign-off discipline** — every Tier S/A spec gets CTO review against sacred cows BEFORE handoff to Engineering Lead. No "we'll fix it during implementation."
6. **No silent scope creep** — if a screen needs work beyond its task's Tier, file new task; don't bundle.

## 10. What success looks like (Week 8 sign-off)

By Week 8 end, you've delivered:

- ADR-006 (Design System Foundational Decisions) — co-authored with CTO, signed by Roman
- 17 Figma screen specs (10 Tier S + 7 Tier A)
- Custom icon library (22+ icons, consistent style)
- Lottie animations for healthbar / damage numbers / pressure meter / CTAs
- All assets exported in implementation-ready formats (SVG + PNG @1x/@2x/@3x; Lottie JSON)
- `docs/design/ui-ux/sign-off-week-8.md` with device matrix verdict + ready-for-T4.11-beta confirmation
- Designer's GO verdict alongside Bug Tester's = release green light

T4.11 closed beta opens Week 9 with polished UI in front of 100+ Chia community testers. T4.12 production launch Week 13.

Welcome to Blocksworm.

---

**Document version:** 1.0
**Maintained by:** CTO (until Designer onboarded, then jointly)
**Last updated:** 2026-05-16
