import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { BOSSES, BOSSES_BY_CHAPTER, CHAPTERS, type BossMeta } from '@/lib/bosses';

export const metadata: Metadata = {
  title: 'All Bosses — 15 Lords Across 3 Chapters',
  description:
    'Every Blocksworm boss with phase mechanics, lore, and strategy. 5 Ashen Dominion lords (Ch1), 5 Bloom of Madness corruptions (Ch2), 5 Forgotten Gods (Ch3). 10 unique archetypes.',
};

function BossCard({ boss }: { boss: BossMeta }) {
  return (
    <Link
      href={`/bosses/${boss.id}`}
      className="group relative block aspect-[3/4] rounded-2xl overflow-hidden border-2 transition-all hover:-translate-y-1"
      style={{
        borderColor: boss.elementColor + '55',
        background: `linear-gradient(180deg, ${boss.elementColor}26 0%, #12121E 70%)`,
        boxShadow: `0 0 20px ${boss.elementColor}22`,
      }}
    >
      <Image
        src={boss.portraitUrl}
        alt={boss.name}
        fill
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        className="object-cover object-top"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-bg-dark via-bg-dark/40 to-transparent" />
      <div className="absolute top-2 left-2 px-2 py-1 rounded-md text-[10px] font-display tracking-widest font-bold bg-bg-dark/80 backdrop-blur-sm" style={{ color: boss.elementColor }}>
        #{boss.bossNumber}
      </div>
      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className="font-display text-[10px] tracking-[0.2em] mb-1 font-bold" style={{ color: boss.elementColor }}>
          {boss.archetype.toUpperCase()}
        </p>
        <h3 className="font-display text-base sm:text-lg tracking-wide font-bold text-white mb-0.5 leading-tight">
          {boss.name}
        </h3>
        <p className="text-[11px] text-text-muted italic line-clamp-1">
          {boss.tagline}
        </p>
      </div>
    </Link>
  );
}

function ChapterSection({ chapter }: { chapter: 1 | 2 | 3 }) {
  const meta = CHAPTERS[chapter];
  const bosses = BOSSES_BY_CHAPTER[chapter];
  return (
    <section id={`chapter-${chapter}`} className="py-12 sm:py-16">
      <div className="container-page">
        <div className="text-center mb-10">
          <p className="font-display text-xs sm:text-sm tracking-[0.4em] text-gold-300 mb-3">
            CHAPTER {chapter} · {bosses.length} BOSSES
          </p>
          <h2 className="heading-display text-3xl sm:text-5xl mb-3">
            <span className="bg-gradient-to-b from-gold-100 via-gold-300 to-gold-700 bg-clip-text text-transparent">
              {meta.name}
            </span>
          </h2>
          <p className="text-text-secondary max-w-2xl mx-auto italic mb-3 text-sm sm:text-base">
            “{meta.subtitle}”
          </p>
          <p className="text-text-muted max-w-2xl mx-auto text-xs sm:text-sm">
            {meta.flavor}
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {bosses.map(b => <BossCard key={b.id} boss={b} />)}
        </div>
      </div>
    </section>
  );
}

export default function BossesPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-gold-300/10">
        <div className="absolute inset-0 bg-radial-gold pointer-events-none" />
        <div className="container-page relative py-12 sm:py-20 text-center">
          <p className="font-display text-xs sm:text-sm tracking-[0.4em] text-gold-300 mb-4">
            {BOSSES.length} BOSSES · 3 CHAPTERS · 10 ARCHETYPES
          </p>
          <h1 className="heading-display text-4xl sm:text-6xl mb-4">
            <span className="bg-gradient-to-b from-gold-100 via-gold-300 to-gold-700 bg-clip-text text-transparent">
              The Lords
            </span>
          </h1>
          <p className="text-text-muted max-w-2xl mx-auto text-sm sm:text-base">
            Each boss is more than a fight — it is a soul state to overcome.
            Three phases, escalating mechanics, escalating intensity.
            The Moment must be earned at every transition.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="#chapter-1" className="px-4 py-2 rounded-lg border border-gold-300/30 bg-bg-mid text-xs font-display tracking-[0.2em] font-bold text-text-muted hover:text-gold-300 hover:border-gold-300/60 transition-colors">
              ASHEN DOMINION
            </a>
            <a href="#chapter-2" className="px-4 py-2 rounded-lg border border-gold-300/30 bg-bg-mid text-xs font-display tracking-[0.2em] font-bold text-text-muted hover:text-gold-300 hover:border-gold-300/60 transition-colors">
              BLOOM OF MADNESS
            </a>
            <a href="#chapter-3" className="px-4 py-2 rounded-lg border border-gold-300/30 bg-bg-mid text-xs font-display tracking-[0.2em] font-bold text-text-muted hover:text-gold-300 hover:border-gold-300/60 transition-colors">
              VEIL OF FORGOTTEN GODS
            </a>
          </div>
        </div>
      </section>

      <ChapterSection chapter={1} />
      <div className="border-t border-gold-300/10" />
      <ChapterSection chapter={2} />
      <div className="border-t border-gold-300/10" />
      <ChapterSection chapter={3} />
    </>
  );
}
