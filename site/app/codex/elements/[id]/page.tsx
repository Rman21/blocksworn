import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ELEMENTS, ELEMENT_BY_ID, RACE_BY_ID } from '@/lib/codex';
import { HEROES } from '@/lib/heroes';
import { BOSSES } from '@/lib/bosses';
import type { Element } from '@/lib/bosses';

interface Props {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return ELEMENTS.map(e => ({ id: e.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const e = ELEMENT_BY_ID[id as Element];
  if (!e) return { title: 'Element Not Found' };
  return {
    title: `${e.inWorldName} (${e.uiName}) — Element Guide`,
    description: `${e.inWorldName} element in Blocksworm: ${e.coreMechanic} ${e.comboRole}`,
  };
}

export default async function ElementPage({ params }: Props) {
  const { id } = await params;
  const element = ELEMENT_BY_ID[id as Element];
  if (!element) notFound();

  const race = RACE_BY_ID[element.raceId];
  const heroes = HEROES.filter(h => h.stihiya === element.id);
  const bosses = BOSSES.filter(b => b.element === element.id || b.secondaryElement === element.id);

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
            ELEMENT · {element.uiName.toUpperCase()}
          </p>
          <h1 className="heading-display text-5xl sm:text-7xl mb-4 leading-[0.9]" style={{ color: element.color }}>
            {element.inWorldName}
          </h1>
          <p className="text-base sm:text-xl text-text-secondary max-w-2xl">{element.coreMechanic}</p>
        </div>
      </section>

      <section className="py-10 sm:py-12">
        <div className="container-page max-w-3xl space-y-6">
          <div className="rounded-2xl border-2 bg-bg-mid p-6" style={{ borderColor: element.color + '40' }}>
            <p className="font-display text-xs tracking-[0.2em] font-bold mb-2" style={{ color: element.color }}>BOARD INTERACTION</p>
            <p className="text-text-secondary leading-relaxed">{element.boardInteraction}</p>
          </div>
          <div className="rounded-2xl border-2 bg-bg-mid p-6" style={{ borderColor: element.color + '40' }}>
            <p className="font-display text-xs tracking-[0.2em] font-bold mb-2" style={{ color: element.color }}>COMBO ROLE</p>
            <p className="text-text-secondary leading-relaxed">{element.comboRole}</p>
          </div>
          <div className="rounded-2xl border-2 bg-bg-mid p-6" style={{ borderColor: element.color + '40' }}>
            <p className="font-display text-xs tracking-[0.2em] font-bold mb-2" style={{ color: element.color }}>SIGNATURE</p>
            <p className="text-text-secondary leading-relaxed">{element.signature}</p>
          </div>
          <Link
            href={`/codex/races/${race.id}`}
            className="block rounded-2xl border-2 border-gold-300/15 bg-bg-mid p-6 transition-all hover:border-gold-300/40 hover:-translate-y-0.5"
          >
            <p className="font-display text-xs tracking-[0.2em] text-gold-300 font-bold mb-2">PRIMARY RACE</p>
            <h2 className="font-display text-2xl font-bold text-white mb-2">{race.name}</h2>
            <p className="text-sm text-text-muted">{race.raceFlavor}</p>
            <p className="mt-3 text-xs font-display tracking-[0.2em] text-gold-300">SEE RACE PROFILE →</p>
          </Link>
        </div>
      </section>

      {heroes.length > 0 && (
        <section className="py-12 bg-bg-mid border-y border-gold-300/10">
          <div className="container-page max-w-5xl">
            <h2 className="heading-display text-2xl sm:text-3xl mb-6 text-center">{element.inWorldName} Heroes</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {heroes.map(h => (
                <Link
                  key={h.id}
                  href={`/heroes/${h.id}`}
                  className="group relative aspect-square rounded-2xl overflow-hidden border-2 transition-all hover:-translate-y-1"
                  style={{ borderColor: h.stihiyaColor + '55', background: `linear-gradient(180deg, ${h.stihiyaColor}26 0%, #12121E 70%)` }}
                >
                  <Image src={h.portraitUrl} alt={h.name} fill sizes="(max-width: 640px) 50vw, 20vw" className="object-cover object-top" />
                  <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-bg-dark via-bg-dark/85 to-transparent">
                    <p className="font-display text-[9px] tracking-[0.18em]" style={{ color: h.stihiyaColor }}>
                      {h.race.toUpperCase()} · {h.role.toUpperCase()}
                    </p>
                    <h3 className="font-display text-xs font-bold text-white truncate">{h.name}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {bosses.length > 0 && (
        <section className="py-12">
          <div className="container-page max-w-5xl">
            <h2 className="heading-display text-2xl sm:text-3xl mb-6 text-center">{element.inWorldName} Bosses</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {bosses.map(b => (
                <Link
                  key={b.id}
                  href={`/bosses/${b.id}`}
                  className="relative block aspect-[3/4] rounded-2xl overflow-hidden border-2 transition-all hover:-translate-y-1"
                  style={{ borderColor: b.elementColor + '55', background: `linear-gradient(180deg, ${b.elementColor}26 0%, #12121E 70%)` }}
                >
                  <Image src={b.portraitUrl} alt={b.name} fill sizes="(max-width: 640px) 50vw, 20vw" className="object-cover object-top" />
                  <div className="absolute inset-0 bg-gradient-to-t from-bg-dark via-bg-dark/40 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-2.5">
                    <p className="font-display text-[9px] tracking-wider font-bold mb-0.5" style={{ color: b.elementColor }}>
                      CH{b.chapter} · {b.archetype.toUpperCase()}
                    </p>
                    <h3 className="font-display text-xs sm:text-sm font-bold text-white truncate">{b.name}</h3>
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
