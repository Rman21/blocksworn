// 2026-05-13 — TASK-065 (T4.07): Adventure DAO constants (frozen).
//
// Spec: docs/design/chia-integration.md §5 Adventure DAO + §13.6 ESC-04 Q2
//       ruling (uniform fee, 2.5% royalty) + ADR-003 (anti-P2W invariant).
//
// Sacred-cow safety:
//   - This file holds NO sacred-cow values per CLAUDE.md §2.x. DAO governance
//     is a NEW Phase 4 concept; no overlap with combat math, V_HAPTICS,
//     NARRATOR_LINES, GEM_PACKS, Battle Pass, Tower retry ladder, Tower
//     leaderboards, TOWER_PACTS, HERO_ROSTER, HERO_TIER_ABILITIES, or any
//     Phase 1/2/3 backend.
//   - All exports are Object.freeze'd to prevent runtime mutation.
//   - Per ADR-003 (no-P2W) sacred invariant: DAO mode confers ZERO mechanical
//     advantage over non-DAO clan. DAO_PROPOSAL_TYPES below is a CLOSED
//     COSMETIC-ONLY WHITELIST — proposals that would alter mechanical
//     gameplay (damage, win-rate, weekly defeat target, contribution cap,
//     boss HP, leaderboard rules) are NEVER allowed and NEVER added to this
//     enum without an ESC + Roman approval per CLAUDE.md §2.7 sacred-cow
//     change protocol.
//   - Per ADR-004 (hybrid): this file lives in src/data/, never imported by
//     legacy HTML.
//   - Per ADR-005 (mobile feature flag, T4.09): consumers MUST gate on
//     isChiaEnabled() before reading these constants into Chia-bound UI.
//
// V1 scope per spec §5 + ESC-04 Q2:
//   - Two governance modes per spec §5.1: token-weighted (advanced opt-in)
//     and one-member-one-vote (default; reduces token-weighted P2W vector).
//   - DAO descriptor mint fee = 0.05 XCH = 50_000_000_000 mojos (ESC-04 Q2).
//   - Proposal whitelist limited to cosmetic / identity decisions only
//     (banner theme, weekly cosmetic focus, clan name). Mechanical proposals
//     are SACRED-FORBIDDEN per ADR-003.
//   - 50% quorum required for a proposal to pass (CLOSED-FORM tally).
//   - Max 3 concurrent active proposals per clan (prevents proposal-spam
//     denial of governance).

/**
 * DAO governance modes. Sacred whitelist per ADR-003.
 *
 * - TOKEN_WEIGHTED: vote weight scales with wallet-held DAO badge count;
 *   this mode is OPT-IN at clan creation and carries a stronger P2W risk
 *   surface — clans choosing it accept that mode but the DAO STILL grants
 *   ZERO mechanical advantage over non-DAO clans (governance affects
 *   cosmetic decisions ONLY per DAO_PROPOSAL_TYPES below).
 * - ONE_MEMBER_ONE_VOTE: every wallet-connected member gets equal vote
 *   weight regardless of badge count or token holdings. This is the
 *   sacred default per ADR-003 (avoids token-weighted P2W vector).
 */
export const DAO_GOVERNANCE_MODES = Object.freeze({
  TOKEN_WEIGHTED:       'token_weighted',
  ONE_MEMBER_ONE_VOTE:  'one_member_one_vote',
});

/**
 * Default governance mode. Per ADR-003 anti-P2W sacred invariant: this
 * defaults to ONE_MEMBER_ONE_VOTE to avoid the token-weighted P2W vector.
 * Clans must explicitly opt into token-weighted at creation.
 */
export const DAO_DEFAULT_GOVERNANCE_MODE = DAO_GOVERNANCE_MODES.ONE_MEMBER_ONE_VOTE;

/**
 * DAO descriptor mint fee in mojos (1 XCH = 1e12 mojos).
 *
 * Per ESC-04 Q2 sacred ruling: 0.05 XCH = 50_000_000_000 mojos. This is
 * the fee the clan creator pays at clan-creation time to deploy the on-chain
 * DAO descriptor + mint the clan banner NFT. The fee flows to the Chia
 * network as gas + to the Blocksworn treasury as a premium (split is
 * resolved at marketplace level per Chia NFT1 ecosystem norm).
 *
 * Sacred-cow note: 50_000_000_000 mojos is the ESC-04 Q2 sacred value;
 * changing it before T4.12 mainnet cutover requires a new ESC + Roman
 * approval per CLAUDE.md §2.7.
 */
export const DAO_BADGE_MINT_FEE_MOJOS = 50_000_000_000;

/**
 * DAO proposal types — a CLOSED, SACRED, COSMETIC-ONLY WHITELIST.
 *
 * Per ADR-003 anti-P2W sacred invariant + spec §5.4 ("No DAO-only
 * mechanical rewards"): DAO governance covers ONLY cosmetic / identity
 * decisions. Mechanical proposal types (damage, win-rate, weekly target,
 * contribution cap, boss HP, leaderboard rules, retry ladder, gem economy)
 * are STRICTLY FORBIDDEN and are NEVER added to this enum without an ESC
 * + Roman approval per CLAUDE.md §2.7 sacred-cow change protocol.
 *
 * Allowed types:
 *   - COSMETIC_THEME — choose clan banner color / theme.
 *   - WEEKLY_FOCUS   — choose which cosmetic prize art is featured this
 *                      week (no mechanical effect on boss HP / drops).
 *   - NAME_CHANGE    — propose a new clan name (identity decision).
 */
export const DAO_PROPOSAL_TYPES = Object.freeze({
  COSMETIC_THEME: 'cosmetic_theme',
  WEEKLY_FOCUS:   'weekly_focus',
  NAME_CHANGE:    'name_change',
});

/**
 * Fraction of clan members that must vote on a proposal for it to
 * resolve as passed/failed. Below this quorum the proposal resolves as
 * 'failed' regardless of yes-vote count.
 *
 * Sacred-cow note: 0.50 is the exact V1 sacred value; tuning requires an
 * ESC since looser quorum reduces governance legitimacy + tighter quorum
 * could starve cosmetic decisions in low-engagement clans.
 */
export const DAO_PROPOSAL_QUORUM_FRACTION = 0.50;

/**
 * Maximum concurrently active proposals per clan. Prevents proposal-spam
 * denial-of-governance where a malicious member floods the queue with
 * trivial cosmetic proposals to drown out important decisions.
 *
 * V1 sacred value = 3. Tuning is non-sacred but ESC recommended.
 */
export const DAO_PROPOSAL_MAX_ACTIVE = 3;
