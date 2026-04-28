import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RACES, RACE_BY_ID, ELEMENT_BY_ID, type RaceId } from '@/lib/codex';
import { HEROES } from '@/lib/heroes';

interface Props {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return RACES.map(r => ({ id: r.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const r = RACE_BY_ID[id as RaceId];
  if (!r) return { title: 'Race Not Found' };
  return {
    title: `${r.name} — Race Guide (${r.element.toUpperCase()})`,
    description: `${r.name} race in Blocksworm. ${r.raceFlavor} ${r.lore.slice(0, 120)}`,
  };
}

export default async function RacePage({ params }: Props) {
  const { id } = await params;
  const race = RACE_BY_ID[id as RaceId];
  if (!race) notFound();

  const element = ELEMENT_BY_ID[race.element];
  // HEROES use 'pirate' / 'rock' / 'shark' / 'crocodile' / 'spark' as race ids — same as RaceId
  const roster = HEROES.filter(h => h.race === race.id);

  return (
    <>
      <section
        className="relative overflow-hidden border-b border-gold-300/10"
        style={{ background: `linear-gradient(180deg, ${element.color}33 0%, transparent 70%), #0A0A1A` }}
      >
        <div className="container-page relative py-10 sm:py-16">
          <Link href="/codex" className="inline-block mb-6 text-xs font-display tracking-[0.2em] text-text-muted hover:text-gold-300 transition-colors">
            ← BACK TO CODEX
          </Link>
          <p className="font-display text-xs sm:text-sm tracking-[0.4em] mb-3 font-bold" style={{ color: element.color }}>
            RACE · {element.uiName.toUpperCase()} ELEMENT
          </p>
          <h1 className="heading-display text-5xl sm:text-7xl mb-4 leading-[0.9]">
            <span className="bg-gradient-to-b from-gold-100 via-gold-300 to-gold-700 bg-clip-text text-transparent">
              {race.name}
            </span>
          </h1>
          <p className="text-base sm:text-lg text-text-secondary italic max-w-2xl mb-3">
            {race.raceFlavor}
          </p>
          <p className="text-xs text-text-dim">{race.status}</p>
        </div>
      </section>

      <section className="py-10 sm:py-12">
        <div className="container-page max-w-3xl">
          <div className="rounded-2xl border-2 border-gold-300/15 bg-bg-mid p-6 sm:p-8 mb-6">
            <p className="font-display text-xs tracking-[0.2em] text-gold-300 font-bold mb-3">LORE</p>
            <p className="text-text-secondary leading-relaxed text-base sm:text-lg">
              {race.lore}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="rounded-2xl border-2 bg-bg-mid p-5" style={{ borderColor: element.color + '40' }}>
              <p className="font-display text-xs tracking-[0.2em] font-bold mb-2" style={{ color: element.color }}>2-OF-RACE PASSIVE</p>
              <p className="text-sm text-text-secondary leading-relaxed">{race.passive2}</p>
            </div>
            <div className="rounded-2xl border-2 bg-bg-mid p-5" style={{ borderColor: element.color }}>
              <p className="font-display text-xs tracking-[0.2em] font-bold mb-2" style={{ color: element.color }}>3+-OF-RACE PASSIVE</p>
              <p className="text-sm text-text-secondary leading-relaxed">{race.passive3}</p>
            </div>
          </div>
          <Link
            href={`/codex/elements/${element.id}`}
            className="block rounded-2xl border-2 border-gold-300/15 bg-bg-mid p-6 transition-all hover:border-gold-300/40 hover:-translate-y-0.5"
          >
            <p className="font-display text-xs tracking-[0.2em] text-gold-300 font-bold mb-2">PRIMARY ELEMENT</p>
            <h2 className="font-display text-2xl font-bold mb-2" style={{ color: element.color }}>{element.inWorldName}</h2>
            <p className="text-sm text-text-muted">{element.coreMechanic}</p>
            <p className="mt-3 text-xs font-display tracking-[0.2em] text-gold-300">SEE ELEMENT PROFILE →</p>
          </Link>
        </div>
      </section>

      <section className="py-12 bg-bg-mid border-y border-gold-300/10">
        <div className="container-page max-w-5xl">
          <h2 className="heading-display text-2xl sm:text-3xl mb-6 text-center">The {race.name} Roster</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {roster.map(h => (
              <Link
                key={h.id}
                href={`/heroes/${h.id}`}
                className="group relative aspect-square rounded-2xl overflow-hidden border-2 transition-all hover:-translate-y-1"
                style={{ borderColor: h.stihiyaColor + '55', background: `linear-gradient(180deg, ${h.stihiyaColor}26 0%, #12121E 70%)` }}
              >
                <Image src={h.portraitUrl} alt={h.name} fill sizes="(max-width: 640px) 50vw, 20vw" className="object-cover object-top" />
                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-bg-dark via-bg-dark/85 to-transparent">
                  <p className="font-display text-[9px] tracking-[0.18em]" style={{ color: h.stihiyaColor }}>
                    {h.role.toUpperCase()}
                  </p>
                  <h3 className="font-display text-xs font-bold text-white truncate">{h.name}</h3>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
