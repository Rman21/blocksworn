// News posts for /news. Tiny hand-curated list — gets replaced by a CMS or
// MDX collection once volume justifies it. Per WEBSITE_SPEC §10.7 the cadence
// is 1 article/week eventually; for v1 a few launch posts are enough.

export interface NewsPost {
  slug: string;
  title: string;
  excerpt: string;
  date: string; // ISO yyyy-mm-dd
  category: 'update' | 'lore' | 'design' | 'announcement';
  body: string; // simple paragraphs, double-newline separated
}

export const NEWS: NewsPost[] = [
  {
    slug: 'site-launch',
    title: 'blocksworm.com is live',
    date: '2026-04-28',
    category: 'announcement',
    excerpt: 'A new home for the block puzzle RPG — playable in your browser, no signup, no FOMO.',
    body: `After months of iterating on the game itself, blocksworm.com goes live today.

The site is hybrid: marketing landing → playable game iframe → public Tower leaderboard, with an account hub coming next. You can play the full PWA right in your browser via /play — no download, no signup. Anonymous progress saves locally; cross-device sync via Firebase will land alongside the account hub.

We launched with the full 25-hero roster across five races (Pirates, Rock Band, Sharks, Crocodiles, Sparks), 15 bosses across three chapters (Ashen Dominion, Bloom of Madness, Veil of Forgotten Gods), and the endless Tower mode. Each hero and boss has a dedicated page with lore, mechanics, and strategy notes.

Next on the road map: account hub, multilingual (RU/EN), more chapters of the Cosmic Ascension Arc, and Tier 3 hero ascension.`,
  },
  {
    slug: 'meet-the-bosses',
    title: 'Meet the 15 Lords',
    date: '2026-04-28',
    category: 'lore',
    excerpt: 'Each boss represents a soul state to overcome — RAGE, PATIENCE, JUDGMENT, ARROGANCE, BOREDOM and ten more.',
    body: `Every boss in Blocksworm is more than a damage sponge. Each one represents a kind of soul state — a mode of failure that the Old World fell into.

Pyredrake is RAGE that refuses to die. Abyssal Tyrant is PATIENCE perverted into apathy. Grovewarden is JUDGMENT without mercy. Solar Phoenix is ARROGANCE wrapped in glory. Crypt Lich is BOREDOM with the very concept of life.

Chapter 2 escalates the metaphor: Verothira is SEDUCTION that consumes the seeker; Gearheart is DUTY without context; Ursaro is HUNGER without reason; Tidespire is INEVITABILITY that drowns the spark; Heliotron is NOSTALGIA that calcifies into law.

Chapter 3 leaves earthly weakness behind entirely. Twilight Vessel, Stormshepherd, Voidpriestess, Root-of-Nothing, and Archival Eternal are forgotten gods — beings so old they no longer remember why anything mattered.

The player's victory is not just defeating bosses. It is rejecting these patterns in themselves.

Browse the full roster on /bosses — each entry has phase mechanics, voice lines, and strategy notes.`,
  },
  {
    slug: 'design-no-p2w',
    title: 'Why Blocksworm has no pay-to-win',
    date: '2026-04-28',
    category: 'design',
    excerpt: 'All 25 heroes are earnable through play. Battle Pass is cosmetic acceleration, not gating. Here\'s the philosophy.',
    body: `The block puzzle RPG genre is full of games that gate progression behind hero packs. We made a different call.

Every hero in Blocksworm is earnable through legitimate play. Defeat Pyredrake — the first boss — and you complete the Pirates roster. Defeat Crypt Lich at the end of Chapter 1 and you have all 15 first-wave heroes plus a 5-slot squad. The game's progression IS the unlock progression. There is no separate gacha pull.

The Battle Pass exists, and the Premium track is optional. It accelerates Tier 2 ascension and grants cosmetic frames + auras. It does not unlock heroes, mechanics, or bosses. It does not gate the Tower.

This is a deliberate trade-off. We make less revenue per whale and bet on a wider, longer-tenured player base instead. The North Star is The Moment — that 2-second window where you read the board three moves ahead and execute a kill cascade. That moment is free.`,
  },
];

export const NEWS_CATEGORY_LABELS: Record<NewsPost['category'], string> = {
  update: 'UPDATE',
  lore: 'LORE',
  design: 'DESIGN',
  announcement: 'ANNOUNCEMENT',
};
