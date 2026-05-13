# T4.12 — Production Launch Sequence

**Phase:** 4 (Chia Integration) — FINAL TASK before Phase 4 close
**Task:** T4.12
**Status:** READY (gated on T4.11 closed beta success criteria all GREEN)
**Author:** CTO
**Created:** 2026-05-13
**Owner approval:** ESC-04 (Q1 Sage primary, Q2 fee schedule + 2.5% royalty, Q3 Founder Badge gift at Wave 1, Q5 launch wave plan)

---

## 1. Purpose

Transition Blocksworn from `testnet11` closed beta to Chia mainnet production launch in a three-wave sequence that respects: (a) ADR-003 anti-P2W invariant, (b) sacred-cow byte-perfect invariants, (c) the Chia-community-first recruitment posture per ESC-04 Q5, (d) AAA+ launch polish per CLAUDE.md §3.

Phase 4 is the **final phase** of the project. Successful T4.12 = Phase 4 CLOSED = Blocksworn is shipped.

## 2. Pre-launch gate checklist (T-7 days)

All items must be GREEN before Wave 1 fires:

### 2.1 Code completeness

- [x] T4.01 design spec (1785 LoC) — ✅
- [x] T4.02 Sage Wallet integration — ✅
- [x] T4.03 NFT-hero data model — ✅
- [x] T4.04 NFT mint flow — ✅
- [ ] T4.05 NFT transfer (depends on T4.03 nft-backend) — IN PROGRESS
- [ ] T4.06 NFT trading + 2.5% royalty enforcement — IN PROGRESS
- [ ] T4.07 Adventure DAO (depends on Phase 3 clan-backend merge to main)
- [x] T4.08 PURE PATH CHAIN leaderboard — ✅
- [x] T4.09 Mobile feature flag `isChiaEnabled()` — ✅
- [x] T4.10 Anti-P2W parity audit — ✅
- [ ] T4.11 Closed beta SUCCESS gate met (all 4 criteria GREEN per runbook §5)
- [ ] T4.13 Legacy Bridge — final integration

### 2.2 Production infrastructure

- [ ] `blocksworn.com` production deploy with `VITE_CHIA_ENABLED=true` + Sentry env tag `phase4-prod`
- [ ] Chia mainnet RPC endpoint configured (replace testnet11 `chia-config.js` constant)
- [ ] `BLOCKSWORN_TREASURY_PUZZLEHASH` replaced with production mainnet address (stub `xch1blocksworntreasury...` → real)
- [ ] Founder Badge NFT collection minted on mainnet (treasury wallet batch-mint per ESC-04 Q3)
- [ ] IPFS gateway pinned for NFT art + lore (hybrid storage per ESC-04 Q4)
- [ ] Sage Wallet "Add Blocksworn" preset available (coordinate with Sage team)
- [ ] DNS + SSL: production cert, www → apex redirect verified
- [ ] CDN cache invalidation playbook ready

### 2.3 Operations readiness

- [ ] On-call rotation: Roman + CTO for Wave 1 first 48h (no rotation gaps)
- [ ] Anti-P2W audit (T4.10) cron scheduled for weekly mainnet snapshot
- [ ] Founder Badge auto-gift script tested on testnet11 with 100 sample recipients
- [ ] Mint-flow analytics dashboard live (mint attempts, success rate, settlement latency)
- [ ] Sentry alert routing: P0 → Discord webhook; P1 → email; rate-limit set to prevent alert-storm
- [ ] CDN traffic ramp plan: 10% → 50% → 100% over Wave 1 first 6h
- [ ] Rollback procedure documented: `VITE_CHIA_ENABLED=false` rebuild + redeploy ≤15 min

### 2.4 Sacred cow re-audit (final)

- [ ] All 50 rows of design spec §8 sacred-cow table re-verified byte-perfect
- [ ] HERO_ROSTER stat blocks unchanged across all 25 heroes (no NFT skin overlay writes back)
- [ ] V_HAPTICS, NARRATOR_LINES, GEM_PACKS, Battle Pass formula, Tower retry ladder, TOWER_PACTS_BASE/MYTHIC, TOWER_LEADERBOARDS sacred 3 keys — all byte-perfect
- [ ] Phase 2 Identity Layer (10 fx mechanical contracts) — all unchanged
- [ ] Phase 3 backends (clan, party-tower, tower-season, friend-graph) — all unchanged
- [ ] Phase 4 additive surfaces (wallet, NFT, PURE PATH CHAIN, audit) — `Object.isFrozen` verified

### 2.5 Anti-P2W final sanity (T4.10 archived audit)

- [ ] T4.11 final-week audit history archived to `docs/adr/006-phase4-launch-audit-history.md`
- [ ] All 5 metrics within 5% parity tolerance for last 2 audit cycles
- [ ] `evaluateEscalation(history)` returns `{shouldEscalate: false}` at gate-decision moment

## 3. Launch waves (per ESC-04 Q5)

### Wave 1 — Chia community (Day 0)

**Audience:** Same Chia-community channels as T4.11 (Discord, Twitter, Chia forum, Sage Wallet community)

**Activities:**
- T-0h: Production deploy goes live; mainnet RPC active; Sentry alerts enabled
- T+0h: Roman thread on Twitter: "Blocksworn mainnet is live — same game, now with optional Chia NFT layer (cosmetic only, no P2W)"
- T+0h: Discord announcement in `#blocksworn-beta` (now renamed `#blocksworn-launch`) + Chia Discord
- T+1h: Founder Badge auto-gift fires for all T4.11 testers (via treasury wallet batch-transfer)
- T+2h: First 100 closed-beta testers receive Sentry-tagged "VIP onboarding" email with mainnet wallet faucet (0.5 XCH each, paid from Blocksworn treasury for first 100 testers as gratitude — ESC if Roman objects to this cost)
- T+6h: First CDN ramp to 50% (was 10% for first 6h)
- T+24h: Full CDN; daily anti-P2W audit begins
- T+48h: First "Day 2" pulse — Roman tweets stats; Discord pulse

**Pass criteria for Wave 2 (after T+72h):**
- ✅ Zero P0 bugs
- ✅ Wallet-connect funnel >70% (matches T4.11 baseline)
- ✅ Mint settlement p99 <60s on mainnet
- ✅ Sentry rate <0.1% P0; <1% P1
- ✅ Anti-P2W audit Day 1+2+3 indeterminate-pass (insufficient sample expected)

### Wave 2 — Crypto media + non-Chia crypto crossover (Day 7)

**Audience:** Crypto-gaming media (CoinTelegraph, Decrypt, CoinDesk, Cointelegraph Magazine, The Defiant)

**Activities:**
- T+7d: Press release: "Blocksworn — block-puzzle RPG launches on Chia with anti-P2W NFT model"
- T+7d: Roman + CTO available for 30-min interviews with up to 5 crypto outlets
- T+7d: AMA in Chia Discord (1 hour Q&A)
- T+10d: Twitter spaces co-hosted with Chia Foundation
- T+14d: First-week-of-mainnet retrospective post on Chia forum

**Pass criteria for Wave 3 (after T+14d):**
- ✅ Anti-P2W audit Week 2 PASSES (within 5% on all 5 metrics; first audit with statistically meaningful sample)
- ✅ Mint volume >50 unique wallets minting >1 NFT each
- ✅ Active DAU >300 (sum of beta cohort + Wave 1+2 organic)
- ✅ NPS Week 2 survey ≥40 (matches T4.11 closed-beta target)
- ✅ Tower / Adventure / Party Tower run-completion rates matching Phase 3 baseline ±10%

### Wave 3 — Mainstream (Day 21)

**Audience:** Mainstream gaming media (Rock Paper Shotgun, PC Gamer, Polygon, Kotaku, IGN) + casual gamers via App Store / Web crawlers

**Activities:**
- T+21d: Press release to mainstream gaming outlets: "AAA-style block puzzle RPG with optional NFT layer ships"
- T+21d: Mobile build (`VITE_CHIA_ENABLED=false`) submission to App Store + Google Play
  - Reminder: Mobile build has ZERO Chia DOM per T4.09 smoke verification
  - Mobile is F2P-parity-pure: no wallet, no NFT, no PURE PATH CHAIN, no DAO
- T+28d: Long-form post-launch retrospective on Blocksworn blog: "Why we built an anti-P2W NFT layer and what we learned"
- T+30d: Phase 4 official close — ADR-006 audit-history committed; Phase 4 closeout report

**Pass criteria for Phase 4 CLOSE (after T+30d):**
- ✅ Anti-P2W audit Week 4 PASSES (parity holding)
- ✅ Mobile build has zero Chia surfaces verified in store-review screenshots
- ✅ Production stability: Sentry P0 rate <0.05% over 14-day rolling window
- ✅ Roman approval: "Phase 4 done. Blocksworn shipped."

## 4. Founder Badge gift (per ESC-04 Q3)

### 4.1 Mechanism (T+1h Wave 1)

1. Pre-launch (T-1 day): Treasury wallet runs `nft-backend.js mintNftVariant({variantId: 'founder_badge_genesis', recipientPuzzleHash: wallet})` for each enrolled T4.11 tester (100-300 minted)
2. T+1h Wave 1: Sage transactions auto-fire — testers see Founder Badge in their wallet on next sync
3. T+1h+1min: Auto-email to each tester confirms gift + links to "View on Sage Wallet" + IPFS art

### 4.2 Founder Badge metadata (NFT1 spec)

```json
{
  "name": "Blocksworn Founder Badge",
  "edition_number": "<N>",
  "edition_total": "<final_tester_count>",
  "minted_at": "<ISO timestamp>",
  "minted_by": "treasury",
  "season": "season_1_launch",
  "artwork_ipfs": "ipfs://<hash>",
  "lore_ipfs": "ipfs://<hash>",
  "royalty_bps": 250,
  "royalty_recipient": "<BLOCKSWORN_TREASURY_PUZZLEHASH>"
}
```

### 4.3 What Founder Badge confers (per ADR-003 — cosmetic only)

- ✅ Visual badge in Profile screen
- ✅ Provenance: "I tested Blocksworn before mainnet"
- ✅ Tradeable / transferable on Sage / secondary markets
- ✅ Codex entry visible to all players (read-only on PURE PATH CHAIN leaderboard tab)
- ❌ NO HP / damage / crit / ULT / synergy advantage
- ❌ NO Tower / Adventures / Party Tower mechanical benefit
- ❌ NO faster progression / discount on future mints / battle-pass shortcut

## 5. Rollback procedures

### 5.1 Soft rollback (Phase 4 surfaces disabled, game stays up)

Trigger conditions:
- Anti-P2W audit fails 2 consecutive weekly cycles
- P0 mint bug affecting >5% of mint attempts
- Sage Wallet compatibility break (Sage team confirms unavailable)
- DDoS / mint queue overflow

Procedure (≤15 min):
1. Set `VITE_CHIA_ENABLED=false` in production env
2. Trigger Vercel rebuild + redeploy
3. Verify mobile-equivalent surface: zero Chia DOM
4. Post Discord + Twitter status: "Chia layer temporarily disabled while we investigate; game is fully playable F2P"
5. Open ESC + incident ticket

### 5.2 Hard rollback (Phase 4 reverted to pre-launch)

Trigger conditions:
- Critical sacred-cow violation discovered post-launch (e.g., HERO_ROSTER stat divergence)
- Legal / regulatory blocker

Procedure (≤4 hours):
1. Revert `claude/phase4-chia-design` merge to main
2. Force-deploy main without Phase 4 (only with explicit Roman approval — destructive op per CLAUDE.md §0)
3. NFTs minted during Wave 1 remain on Chia chain forever (per spec §2.5 Field 7 — provenance preservation)
4. Public statement: full incident report within 48h

## 6. Success metrics for "Phase 4 CLOSED"

At T+30d post-Wave 1:

| Metric | Target | Source |
|--------|--------|--------|
| Anti-P2W audit (4 weekly cycles) | All PASS | T4.10 `runSeasonAudit` |
| Cumulative unique wallet connections | >500 | Sentry wallet-connect events |
| Cumulative NFT mints (variants + Founder Badges + achievements) | >1000 | nft-backend events |
| 2.5% royalty captured to treasury | matches `getRoyaltyBreakdown()` ledger | Treasury wallet audit |
| Mobile build store reviews | ≥4.0 stars on App Store + Google Play | Store dashboards |
| Sentry P0 rate (rolling 14d) | <0.05% | Sentry analytics |
| Sentry P1 rate (rolling 14d) | <0.5% | Sentry analytics |
| Tester NPS (Wave 1 testers only, T+30d) | ≥50 | In-game survey |
| Discord active members | growing (any net positive) | Discord analytics |
| Sacred-cow byte-perfect status | 100% | Visual regression + unit tests |

## 7. Phase 4 CLOSED — what comes after

Once Phase 4 is closed:

1. ADR-006 committed: full Phase 4 audit history, sacred-cow byte-perfect verification, anti-P2W parity proof
2. CLAUDE.md updated: Phase 4 sacred cows added to §2.7 list (BLOCKSWORN_TREASURY_ROYALTY_BPS=250, NFT_NAMESPACE_PREFIX, etc.)
3. Project status PLAN.md: Phase 4 → DONE; "Project status: SHIPPED"
4. Founder Badge edition_total locked permanently
5. Roman makes go/no-go on V1.1 features deferred from Phase 4 (Chia Wallet support, on-chain DAO governance proposals, etc.)
6. Long-term: Phase 5 (if any) gated on V1 retention / revenue data — separate scoping exercise

---

**Document version:** 1.0
**Approval:** ESC-04 + ESC-04 Q3 + Q5 RESOLVED
**Next update:** at T4.11 success-gate review (final pre-launch checklist update)
