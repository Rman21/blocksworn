const CHAPTERS = [
  {
    id: 1,
    name: 'ASHEN DOMINION',
    desc: 'The pyres woke before dawn. Pyredrake has risen, and the warband must answer.',
    color: '#E85D4A',
    stihiya: 'EMBER',
    bosses: ['Pyredrake', 'Abyssal Tyrant', 'Grovewarden', 'Solar Phoenix', 'Crypt Lich'],
  },
  {
    id: 2,
    name: 'BLOOM OF MADNESS',
    desc: 'Elder gods stir beneath the verdant rot. Five new beasts await.',
    color: '#9B59D6',
    stihiya: 'UMBRA',
    bosses: ['Verothira', 'Gearheart', 'Voidfang', '...', '...'],
  },
  {
    id: 3,
    name: 'VEIL OF FORGOTTEN GODS',
    desc: 'Cosmic gates open. Archival Eternal preserves silence.',
    color: '#3B8BD4',
    stihiya: 'TIDE',
    bosses: ['(Coming)', '(Coming)', '(Coming)', '(Coming)', 'Archival Eternal'],
  },
];

export function ChapterPreview() {
  return (
    <div className="space-y-6">
      {CHAPTERS.map((ch) => (
        <div
          key={ch.id}
          className="relative p-6 sm:p-8 rounded-2xl border-2 bg-bg-mid overflow-hidden"
          style={{ borderColor: ch.color + '55' }}
        >
          <div
            className="absolute inset-0 pointer-events-none opacity-10"
            style={{ background: `radial-gradient(ellipse at left, ${ch.color}, transparent 60%)` }}
          />
          <div className="relative flex flex-col md:flex-row md:items-center gap-4">
            <div className="md:w-1/3">
              <p
                className="font-display text-xs tracking-[0.3em] mb-2 font-bold"
                style={{ color: ch.color }}
              >
                CHAPTER {ch.id} · {ch.stihiya}
              </p>
              <h3 className="heading-display text-2xl sm:text-3xl mb-3">{ch.name}</h3>
              <p className="text-sm text-text-muted leading-relaxed">{ch.desc}</p>
            </div>
            <div className="md:w-2/3 grid grid-cols-2 sm:grid-cols-5 gap-2">
              {ch.bosses.map((b, i) => (
                <div
                  key={i}
                  className="px-3 py-2 rounded-lg bg-bg-dark/50 border border-white/5 text-xs text-text-secondary text-center"
                >
                  {b}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
      <p className="text-center text-xs text-text-dim mt-6">
        Chapters 4 (CRADLE OF FIRST FLAME) and 5 in development.
      </p>
    </div>
  );
}
