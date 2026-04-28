import Link from 'next/link';
import { CHAPTERS, BOSSES_BY_CHAPTER } from '@/lib/bosses';

const CHAPTER_ACCENTS: Record<1 | 2 | 3, { color: string; stihiya: string }> = {
  1: { color: '#E85D4A', stihiya: 'EMBER' },
  2: { color: '#9B59D6', stihiya: 'UMBRA' },
  3: { color: '#9B59D6', stihiya: 'DUAL' },
};

export function ChapterPreview() {
  return (
    <div className="space-y-6">
      {([1, 2, 3] as const).map((id) => {
        const meta = CHAPTERS[id];
        const bosses = BOSSES_BY_CHAPTER[id];
        const accent = CHAPTER_ACCENTS[id];
        return (
          <Link
            key={id}
            href={`/bosses#chapter-${id}`}
            className="group relative block p-6 sm:p-8 rounded-2xl border-2 bg-bg-mid overflow-hidden transition-all hover:-translate-y-1"
            style={{ borderColor: accent.color + '55' }}
          >
            <div
              className="absolute inset-0 pointer-events-none opacity-10"
              style={{ background: `radial-gradient(ellipse at left, ${accent.color}, transparent 60%)` }}
            />
            <div className="relative flex flex-col md:flex-row md:items-center gap-4">
              <div className="md:w-1/3">
                <p
                  className="font-display text-xs tracking-[0.3em] mb-2 font-bold"
                  style={{ color: accent.color }}
                >
                  CHAPTER {id} · {accent.stihiya}
                </p>
                <h3 className="heading-display text-2xl sm:text-3xl mb-3 group-hover:text-gold-300 transition-colors">
                  {meta.name}
                </h3>
                <p className="text-sm text-text-muted leading-relaxed italic">“{meta.subtitle}”</p>
              </div>
              <div className="md:w-2/3 grid grid-cols-2 sm:grid-cols-5 gap-2">
                {bosses.map((b) => (
                  <div
                    key={b.id}
                    className="px-3 py-2 rounded-lg bg-bg-dark/50 border border-white/5 text-xs text-text-secondary text-center font-display tracking-wider truncate"
                    title={b.tagline}
                  >
                    {b.name}
                  </div>
                ))}
              </div>
            </div>
          </Link>
        );
      })}
      <p className="text-center text-xs text-text-dim mt-6">
        Chapters 4 (COURT OF THE FALLEN HEAVENS) and 5 (CRADLE OF THE FIRST FLAME) in development.
      </p>
    </div>
  );
}
