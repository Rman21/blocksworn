import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BOSSES, CHAPTERS, type BossMeta } from '@/lib/bosses';

interface Props {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return BOSSES.map(b => ({ id: b.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const b = BOSSES.find(x => x.id === id);
  if (!b) return { title: 'Boss Not Found' };
  return {
    title: `${b.name} — ${b.tagline} (Chapter ${b.chapter} Boss)`,
    description: `${b.name} is a ${b.archetype} boss in Chapter ${b.chapter} of Blocksworm. ${b.lore.slice(0, 140)}`,
    openGraph: {
      title: `${b.name} · Blocksworm`,
      description: b.tagline,
      images: [b.portraitUrl],
    },
  };
}

function PhaseCard({ phase, index, color }: { phase: BossMeta['phases'][number]; index: number; color: string }) {
  return (
    <div className="rounded-2xl border-2 bg-bg-mid p-5 sm:p-6" style={{ borderColor: color + '33' }}>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <p className="font-display text-xs tracking-[0.2em] font-bold" style={{ color }}>
          PHASE {index + 1} · {phase.hpRange}
        </p>
      </div>
      <h3 className="font-display text-xl sm:text-2xl font-bold text-white mb-3 tracking-wide">
        {phase.name}
      </h3>
      <p className="text-sm sm:text-base text-text-secondary leading-relaxed mb-4">
        {phase.mechanic}
      </p>
      <blockquote className="border-l-2 pl-4 italic text-sm text-text-muted" style={{ borderColor: color + '88' }}>
        “{phase.voiceLine}”
      </blockquote>
    </div>
  );
}

export default async function BossDetailPage({ params }: Props) {
  const { id } = await params;
  const boss = BOSSES.find(x => x.id === id);
  if (!boss) notFound();

  const chapterMeta = CHAPTERS[boss.chapter];
  const chapterMates = BOSSES.filter(x => x.chapter === boss.chapter && x.id !== boss.id);
  const sameArchetype = BOSSES.filter(x => x.archetype === boss.archetype && x.id !== boss.id);

  return (
    <>
      {/* Banner */}
      <section
        className="relative overflow-hidden border-b border-gold-300/10"
        style={{ background: `linear-gradient(180deg, ${boss.elementColor}33 0%, transparent 70%), #0A0A1A` }}
      >
        <div className="container-page relative py-10 sm:py-16">
          <Link
            href="/bosses"
            className="inline-block mb-6 text-xs font-display tracking-[0.2em] text-text-muted hover:text-gold-300 transition-colors"
          >
            ← BACK TO ALL BOSSES
          </Link>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-center">
            <div className="md:col-span-2">
              <div
                className="relative aspect-[3/4] rounded-3xl overflow-hidden border-4 mx-auto max-w-sm"
                style={{
                  borderColor: boss.elementColor,
                  boxShadow: `0 0 60px ${boss.elementColor}55`,
                }}
              >
                <Image
                  src={boss.portraitUrl}
                  alt={boss.name}
                  fill
                  sizes="(max-width: 768px) 384px, 480px"
                  className="object-cover object-top"
                  priority
                />
              </div>
            </div>
            <div className="md:col-span-3 text-center md:text-left">
              <p className="font-display text-xs sm:text-sm tracking-[0.4em] mb-2 font-bold" style={{ color: boss.elementColor }}>
                CHAPTER {boss.chapter} · BOSS {boss.bossNumber} · {boss.archetype.toUpperCase()}
              </p>
              <h1 className="heading-display text-4xl sm:text-6xl mb-3 leading-[0.95]">
                {boss.name}
              </h1>
              <p className="text-base sm:text-xl text-text-secondary italic mb-6">
                “{boss.tagline}”
              </p>
              <p className="text-sm sm:text-base text-text-muted leading-relaxed mb-8 max-w-2xl">
                {boss.lore}
              </p>
              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto md:mx-0">
                <div className="p-3 rounded-xl border border-gold-300/15 bg-bg-mid text-center">
                  <p className="font-display text-[9px] tracking-[0.2em] text-text-dim mb-1">ELEMENT</p>
                  <p className="font-display text-sm font-bold" style={{ color: boss.elementColor }}>
                    {boss.element.toUpperCase()}
                    {boss.secondaryElement && <span className="text-[10px] block opacity-70 mt-0.5">+ {boss.secondaryElement.toUpperCase()}</span>}
                  </p>
                </div>
                <div className="p-3 rounded-xl border border-gold-300/15 bg-bg-mid text-center">
                  <p className="font-display text-[9px] tracking-[0.2em] text-text-dim mb-1">HP</p>
                  <p className="font-display text-sm font-bold text-white font-mono">{boss.hp.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-xl border border-gold-300/15 bg-bg-mid text-center">
                  <p className="font-display text-[9px] tracking-[0.2em] text-text-dim mb-1">CHAPTER</p>
                  <p className="font-display text-sm font-bold text-white">{boss.chapter} of 3</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Visual identity */}
      <section className="py-10 sm:py-14 border-b border-gold-300/10">
        <div className="container-page max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-6 items-start">
            <div className="relative aspect-square mx-auto md:mx-0 w-24 md:w-[120px]">
              <Image
                src={boss.emblemUrl}
                alt={`${boss.name} emblem`}
                fill
                sizes="120px"
                className="object-contain drop-shadow-[0_0_16px_rgba(255,213,61,0.3)]"
              />
            </div>
            <div>
              <h2 className="font-display text-sm tracking-[0.2em] text-gold-300 font-bold mb-3">
                VISUAL IDENTITY
              </h2>
              <p className="text-text-secondary leading-relaxed">{boss.visualIdentity}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Three phases */}
      <section className="py-12 sm:py-16">
        <div className="container-page max-w-4xl">
          <div className="text-center mb-10">
            <p className="font-display text-xs tracking-[0.4em] text-gold-300 mb-3">
              THREE PHASES · ESCALATING SOUL
            </p>
            <h2 className="heading-display text-3xl sm:text-4xl mb-3">Phase Breakdown</h2>
          </div>
          <div className="space-y-5">
            {boss.phases.map((phase, i) => (
              <PhaseCard key={i} phase={phase} index={i} color={boss.elementColor} />
            ))}
          </div>
        </div>
      </section>

      {/* Death */}
      <section className="py-10 border-t border-gold-300/10 bg-bg-mid/30">
        <div className="container-page max-w-3xl text-center">
          <p className="font-display text-xs tracking-[0.4em] text-gold-300 mb-4 font-bold">
            DEATH
          </p>
          <p className="font-display text-xl sm:text-3xl italic leading-relaxed" style={{ color: boss.elementColor }}>
            “{boss.deathLine}”
          </p>
        </div>
      </section>

      {/* Strategy */}
      <section className="py-12 sm:py-16">
        <div className="container-page max-w-4xl">
          <div className="text-center mb-10">
            <p className="font-display text-xs tracking-[0.4em] text-gold-300 mb-3">
              STRATEGY
            </p>
            <h2 className="heading-display text-3xl sm:text-4xl mb-3">How to Defeat</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div className="p-5 rounded-2xl border border-grove/30 bg-bg-mid">
              <p className="font-display text-xs tracking-[0.2em] text-grove font-bold mb-2">✓ BEST SQUAD</p>
              <p className="text-sm text-text-secondary leading-relaxed">{boss.strategy.bestSquad}</p>
            </div>
            <div className="p-5 rounded-2xl border border-ember/30 bg-bg-mid">
              <p className="font-display text-xs tracking-[0.2em] text-ember font-bold mb-2">✗ WORST SQUAD</p>
              <p className="text-sm text-text-secondary leading-relaxed">{boss.strategy.worstSquad}</p>
            </div>
            <div className="p-5 rounded-2xl border border-gold-300/30 bg-bg-mid">
              <p className="font-display text-xs tracking-[0.2em] text-gold-300 font-bold mb-2">★ KEY LESSON</p>
              <p className="text-sm text-text-secondary leading-relaxed">{boss.strategy.keyLesson}</p>
            </div>
            <div
              className="p-5 rounded-2xl border-2 bg-bg-mid"
              style={{ borderColor: boss.elementColor + '88', boxShadow: `0 0 24px ${boss.elementColor}33` }}
            >
              <p className="font-display text-xs tracking-[0.2em] font-bold mb-2" style={{ color: boss.elementColor }}>
                ⚡ THE MOMENT
              </p>
              <p className="text-sm text-text-secondary leading-relaxed">{boss.strategy.theMoment}</p>
            </div>
          </div>
          <div className="text-center">
            <Link href="/play" className="btn-primary">▶ FIGHT {boss.name}</Link>
          </div>
        </div>
      </section>

      {/* Cross-links */}
      {chapterMates.length > 0 && (
        <section className="py-12 bg-bg-mid border-t border-gold-300/10">
          <div className="container-page max-w-5xl">
            <h2 className="heading-display text-2xl sm:text-3xl mb-6 text-center">
              More from {chapterMeta.name}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {chapterMates.map(m => (
                <Link
                  key={m.id}
                  href={`/bosses/${m.id}`}
                  className="relative block aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all hover:-translate-y-1"
                  style={{
                    borderColor: m.elementColor + '55',
                    background: `linear-gradient(180deg, ${m.elementColor}26 0%, #12121E 70%)`,
                  }}
                >
                  <Image
                    src={m.portraitUrl}
                    alt={m.name}
                    fill
                    sizes="(max-width: 640px) 50vw, 25vw"
                    className="object-cover object-top"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-bg-dark via-bg-dark/40 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-2.5">
                    <p className="font-display text-[9px] tracking-wider font-bold mb-0.5" style={{ color: m.elementColor }}>
                      #{m.bossNumber} · {m.archetype.toUpperCase()}
                    </p>
                    <h3 className="font-display text-xs sm:text-sm tracking-wide font-bold text-white truncate">
                      {m.name}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {sameArchetype.length > 0 && (
        <section className="py-12 border-t border-gold-300/10">
          <div className="container-page max-w-5xl">
            <h2 className="heading-display text-xl sm:text-2xl mb-6 text-center">
              Other {boss.archetype} bosses
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {sameArchetype.map(m => (
                <Link
                  key={m.id}
                  href={`/bosses/${m.id}`}
                  className="relative block aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all hover:-translate-y-1"
                  style={{
                    borderColor: m.elementColor + '55',
                    background: `linear-gradient(180deg, ${m.elementColor}26 0%, #12121E 70%)`,
                  }}
                >
                  <Image
                    src={m.portraitUrl}
                    alt={m.name}
                    fill
                    sizes="(max-width: 640px) 50vw, 25vw"
                    className="object-cover object-top"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-bg-dark via-bg-dark/40 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-2.5">
                    <p className="font-display text-[9px] tracking-wider font-bold mb-0.5" style={{ color: m.elementColor }}>
                      CH{m.chapter} · #{m.bossNumber}
                    </p>
                    <h3 className="font-display text-xs sm:text-sm tracking-wide font-bold text-white truncate">
                      {m.name}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
