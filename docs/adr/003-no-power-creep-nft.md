# ADR-003: Strict No-P2W Policy — NFT Heroes Confer Identity, Not Power

**Status:** Accepted (back-filled by T3.01 design — original decision per CLAUDE.md §1.3 + Execution Plan §9.3)
**Date:** 2026-05-13 (back-filled; decision pre-dates Phase 3, governs Phase 3 + Phase 4 Chia integration)
**Author:** CTO (Roman approved via Execution Plan §9 sign-off)

## Context

Blocksworn's Phase 4 integration with Chia (NFT-bound heroes via Sage Wallet) raises the most-charged design question in modern mobile gaming: **does paying give players a mechanical advantage?**

The free-to-play monetization industry has converged on two patterns:
- **P2W (pay-to-win):** paid currency buys stats / progression / win-rate (Clash of Clans, Raid Shadow Legends, etc.). Drives ARPDAU but burns retention long-term.
- **Cosmetic / Convenience (no-P2W):** paid currency buys cosmetics, identity, time-saves only (Marvel Snap, Brawl Stars, Path of Exile). Sustained retention, slower revenue ramp.

NFT-bound heroes in Phase 4 introduce a third dimension: **on-chain ownership of game characters**. The temptation to make NFT heroes stronger than non-NFT heroes is industry-standard for play-to-earn (StepN, Axie Infinity model). That model has consistently collapsed when token economies fail.

This ADR locks in the alternative pattern.

## Decision

**Blocksworn is strict no-P2W across all monetization surfaces, including Phase 4 NFT integration.**

Specifically:

1. **Paid currency (gems, USD IAP) buys only:**
   - Cosmetics (skins, emblems, frames, badges, profile borders)
   - Convenience (Tower retry tokens — sacred ladder `[100, 200, 400]` honored; cosmetic season progress accelerants)
   - Identity (founder badges, prestige tier markers, achievement frames)

2. **Paid currency NEVER buys:**
   - Hero stats / damage / HP
   - Progression past gates (chapter unlocks via play only)
   - Win-rate modifiers (no "boosters" that reduce boss HP or buff player)
   - Permanent gameplay advantage

3. **NFT-bound heroes (Phase 4) confer:**
   - **Identity** — name, origin story, visual variant, voice line variant, collectible status
   - **Cosmetic** — unique skin, emblem, particle effects
   - **Trade-ability** — on-chain ownership transfer (the actual NFT utility)
   - **Recognition** — visible in profile / Codex / leaderboards as "owned"

4. **NFT-bound heroes do NOT confer:**
   - Higher stats than non-NFT counterparts
   - Mechanical exclusivity (every NFT hero archetype has a F2P-equivalent)
   - Win-rate advantage in PvP-adjacent surfaces (Adventures, Party Tower, leaderboards)

5. **PURE PATH leaderboard (sacred CLAUDE.md §2.5)** — F2P-only Tower leaderboard. Players who have ever paid are EXCLUDED. This is the no-P2W contract made visible: F2P players have their own competitive surface, free of paid-player optimization pressure.

## Practical implications for Phase 3

1. **Adventures weekly boss** (T3.02–T3.05) — clan rewards are cosmetic-only. Bigger clans don't pay-gate larger contributor pools (Q1 in T3.01 explicitly rejected the 5-30 whale-tier expansion).
2. **Party Tower** (T3.10–T3.13) — shared Tower-Hearts pool draws from sacred ladder; no party-size-tier perks; democratic OR captain-pick TOWER_PACTS but no whale-only pacts.
3. **Replay storage** (T3.07–T3.09) — paid tiers get more storage SIZE, not different storage RIGHTS. Permanent storage across all tiers (Designer recommendation per T3.01 Q2). No expiration penalty for F2P.
4. **Friend leaderboard** (T3.06) — no paid prominence; sort by recent activity or score, never by spend.
5. **Tower seasonal** (T3.14–T3.15) — Battle Pass tier rewards are cosmetic-only; sacred Battle Pass formula `500 + (tier-1) × 150` honored; no Tower-Hearts shortcuts via paid tiers.

## Practical implications for Phase 4 (Chia)

1. **NFT minting** — every NFT hero has a stat-equivalent F2P version. Player can play the entire game with F2P-only roster.
2. **NFT exclusivity** — visual + lore only. Skin variants, voice-line variants, cosmetic effects.
3. **NFT trade-ability** — on-chain transfer is the real utility; speculation is secondary.
4. **No play-to-earn extraction loops** — NFTs don't generate gameplay-relevant rewards faster than play.

## Rationale

### Why strict no-P2W

- **Retention math:** P2W games show high D1 (paid acquisition) but cratering D30. Marvel Snap retains 30%+ at D30 vs Raid Shadow Legends ~5%.
- **Reputation:** Web3/NFT games have a poisoned reputation post-2022 token crashes. Distinguishing Blocksworn requires the strict no-P2W contract baked into design from day one.
- **PURE PATH visibility:** F2P-only leaderboard is the contract visible. Players see "F2P leaderboard exists" → no paranoia that whales dominate.
- **Roman's philosophy:** the project lead's explicit principle (CLAUDE.md §1.3 endgame fantasy): "Гибрид — обычные web-игроки + crypto". Both audiences must coexist; P2W tilts toward crypto-only and alienates web.

### Why NFT heroes still have value at no-P2W

- **Identity / collectibility:** owning a hero with on-chain provenance is meaningful in itself (the Bored Apes lesson — utility was status, not stats)
- **Tradeable ownership:** unlike traditional gacha pulls, NFT heroes can be transferred / sold / gifted on-chain
- **Cosmetic uniqueness:** NFT heroes get unique visual variants that F2P heroes don't — pure prestige differentiation
- **Lore depth:** NFT heroes can carry per-hero story chapters / voice lines / origin events (cosmetic content, not gameplay-affecting)

### Why NOT play-to-earn

- **Tokenomics collapse risk:** PtE economies depend on new-player inflow to fund existing-player extraction. When growth stops, the economy collapses (Axie Infinity 2022 ~$300M → ~$1B → ~$200M cycle).
- **Regulatory risk:** PtE faces increasing scrutiny as unregistered securities in multiple jurisdictions.
- **Gameplay distortion:** PtE players play to extract, not to enjoy. Burns the design integrity Blocksworn aims for.

## Consequences

**Positive:**
- Long-term retention pattern aligned with Marvel Snap / Brawl Stars / Path of Exile
- F2P parity protects the largest player segment
- PURE PATH leaderboard is a competitive differentiator visible to players
- Phase 4 NFT integration becomes "premium cosmetic edition" framing, not P2W

**Negative:**
- ARPDAU growth is slower than aggressive P2W
- Crypto-native audience may be disappointed if they expect PtE
- Whale-segment economics are weaker (no infinite mechanical depth to monetize)

**Neutral:**
- Battle Pass / season progression remains the core monetization rail (cosmetic tiers + small convenience)
- IAP gem packs continue per sacred §2.4 ladder

## Compliance

How to verify this decision is being followed:

1. **Every new monetization surface** must answer: "does this give paying players a mechanical / win-rate advantage?" If yes, ESCALATE. If no, document why not in the relevant design spec.
2. **No paid-only mechanical content** — every gameplay system must have a F2P access path. (Cosmetic-only paid content is OK.)
3. **PURE PATH leaderboard sacred** — F2P-only by lifetime-spend check at season boundary. Any paying-player presence on PURE PATH is a bug.
4. **NFT hero stat parity** — every Phase 4 NFT hero's stat block must match an existing F2P hero archetype. Visual / cosmetic differentiation only.
5. **Battle Pass formula sacred** — `500 + (tier-1) × 150` byte-perfect; tier rewards cosmetic-only.

## Related

- CLAUDE.md §1.3 endgame fantasy ("Гибрид — обычные web-игроки + crypto")
- CLAUDE.md §2.4 Economy sacred values (GEM_PACKS, First Purchase Bonus, Battle Pass formula, Tower retry)
- CLAUDE.md §2.5 PURE PATH leaderboard (F2P-only sacred)
- Execution Plan §9 Phase 4 Chia integration
- ADR-002 (async party tower) — async pattern reinforces F2P parity (no real-time competitive advantage to monetize)
- T3.01 design spec §8 Player Segments (F2P/Minnow/Dolphin/Whale access matrix verifying no-P2W invariant)
