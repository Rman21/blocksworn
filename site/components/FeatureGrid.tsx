const FEATURES = [
  {
    icon: '⚔',
    title: 'CASCADE COMBOS',
    desc: 'Stack 3+ line clears for chained damage. Element matching multiplies output. The deeper the cascade, the bigger the boom.',
  },
  {
    icon: '🔥',
    title: 'HERO ULTIMATES',
    desc: '25 unique abilities — THORGAR forges ember chains, EMBERHAND ignites cascades, BLACKTOOTH detonates the chain. Every squad plays differently.',
  },
  {
    icon: '🏛',
    title: 'ENDLESS TOWER',
    desc: 'Beyond the 25-boss campaign — climb the Tower. Procedural pacts, weekly resets, leaderboards. Top 100 earn Mythic stones.',
  },
  {
    icon: '🎁',
    title: 'NO P2W · NO FOMO',
    desc: 'Every hero earnable through play. Battle Pass cosmetics only. Limited offers always have 3+ day windows. F2P-respectful by design.',
  },
  {
    icon: '🌐',
    title: 'CROSS-DEVICE SYNC',
    desc: 'Anonymous account creates instantly. Friends + leaderboards via Firebase. Your run on web, finish on mobile.',
  },
  {
    icon: '⚡',
    title: 'INSTANT PLAY',
    desc: 'Browser-native. No download, no install. 16 MB single-file PWA. Add to home screen for full-screen mode.',
  },
];

export function FeatureGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {FEATURES.map((f) => (
        <div
          key={f.title}
          className="p-6 rounded-2xl border border-gold-300/15 bg-bg-dark hover:border-gold-300/40 transition-colors"
        >
          <div className="text-4xl mb-4">{f.icon}</div>
          <h3 className="font-display text-base tracking-[0.18em] text-gold-300 font-bold mb-3">
            {f.title}
          </h3>
          <p className="text-sm text-text-muted leading-relaxed">{f.desc}</p>
        </div>
      ))}
    </div>
  );
}
