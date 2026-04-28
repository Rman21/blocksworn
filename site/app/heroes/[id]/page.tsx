import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HEROES } from '@/lib/heroes';

interface Props {
  params: Promise<{ id: string }>;
}

// SSG — pre-render every hero at build time
export function generateStaticParams() {
  return HEROES.map(h => ({ id: h.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const h = HEROES.find(x => x.id === id);
  if (!h) return { title: 'Hero Not Found' };
  return {
    title: `${h.name} — ${h.race} ${h.role}`,
    description:
      h.tagline ||
      `${h.name} is a ${h.stihiya} ${h.role} from the ${h.race} race. Free hero in Blocksworm.`,
    openGraph: {
      title: `${h.name} · Blocksworm`,
      description: h.tagline,
      images: [h.portraitUrl],
    },
  };
}

export default async function HeroDetailPage({ params }: Props) {
  const { id } = await params;
  const h = HEROES.find(x => x.id === id);
  if (!h) notFound();

  // Find squad-mates (same race)
  const squadMates = HEROES.filter(x => x.race === h.race && x.id !== h.id);
  const sameRole = HEROES.filter(x => x.role === h.role && x.id !== h.id);

  return (
    <>
      {/* Hero banner */}
      <section
        className="relative overflow-hidden border-b border-gold-300/10"
        style={{ background: `linear-gradient(180deg, ${h.stihiyaColor}26 0%, transparent 70%), #0A0A1A` }}
      >
        <div className="container-page relative py-12 sm:py-16">
          <Link
            href="/heroes"
            className="inline-block mb-6 text-xs font-display tracking-[0.2em] text-text-muted hover:text-gold-300 transition-colors"
          >
            ← BACK TO ROSTER
          </Link>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
            <div className="md:col-span-1">
              <div
                className="relative aspect-square rounded-3xl overflow-hidden border-4 mx-auto max-w-xs"
                style={{
                  borderColor: h.stihiyaColor,
                  background: `linear-gradient(180deg, ${h.stihiyaColor}33 0%, #12121E 70%)`,
                  boxShadow: `0 0 40px ${h.stihiyaColor}55`,
                }}
              >
                <Image
                  src={h.portraitUrl}
                  alt={h.name}
                  fill
                  sizes="(max-width: 768px) 320px, 384px"
                  className="object-cover object-top"
                  priority
                />
              </div>
            </div>
            <div className="md:col-span-2 text-center md:text-left">
              <p
                className="font-display text-xs sm:text-sm tracking-[0.4em] mb-2 font-bold"
                style={{ color: h.stihiyaColor }}
              >
                {h.stihiya.toUpperCase()} · {h.race.toUpperCase()} · {h.role.toUpperCase()}
              </p>
              <h1 className="heading-display text-5xl sm:text-7xl mb-6">{h.name}</h1>
              {h.tagline && (
                <p className="text-base sm:text-lg text-text-secondary leading-relaxed mb-6">
                  {h.tagline}
                </p>
              )}
              <Link href="/play" className="btn-primary">
                ▶ PLAY {h.name}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats / details */}
      <section className="py-12 sm:py-16">
        <div className="container-page max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            <div className="p-6 rounded-2xl border border-gold-300/15 bg-bg-mid">
              <p className="font-display text-xs tracking-[0.2em] text-text-dim mb-2">RACE</p>
              <p className="font-display text-2xl font-bold text-white">{h.race.toUpperCase()}</p>
            </div>
            <div className="p-6 rounded-2xl border border-gold-300/15 bg-bg-mid">
              <p className="font-display text-xs tracking-[0.2em] text-text-dim mb-2">ROLE</p>
              <p className="font-display text-2xl font-bold text-white">{h.role.toUpperCase()}</p>
            </div>
            <div
              className="p-6 rounded-2xl border-2 bg-bg-mid"
              style={{ borderColor: h.stihiyaColor + '55' }}
            >
              <p className="font-display text-xs tracking-[0.2em] text-text-dim mb-2">STIHIYA</p>
              <p className="font-display text-2xl font-bold" style={{ color: h.stihiyaColor }}>
                {h.stihiya.toUpperCase()}
              </p>
            </div>
          </div>

          {h.tagline && (
            <div className="mb-12 p-6 rounded-2xl border border-gold-300/15 bg-bg-mid">
              <h2 className="font-display text-sm tracking-[0.2em] text-gold-300 font-bold mb-3">
                ULTIMATE
              </h2>
              <p className="text-text-secondary leading-relaxed">{h.tagline}</p>
            </div>
          )}

          {/* Race squad */}
          {squadMates.length > 0 && (
            <div className="mb-12">
              <h2 className="heading-display text-2xl sm:text-3xl mb-6">
                {h.race.toUpperCase()} Squad
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {squadMates.map(m => (
                  <Link
                    key={m.id}
                    href={`/heroes/${m.id}`}
                    className="relative block aspect-square rounded-xl overflow-hidden border-2 transition-all hover:-translate-y-1"
                    style={{
                      borderColor: m.stihiyaColor + '55',
                      background: `linear-gradient(180deg, ${m.stihiyaColor}26 0%, #12121E 70%)`,
                    }}
                  >
                    <Image
                      src={m.portraitUrl}
                      alt={m.name}
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="object-cover object-top"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-bg-dark to-transparent">
                      <p className="text-[9px] font-display tracking-wider font-bold text-white text-center truncate">
                        {m.name}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Same role across races */}
          {sameRole.length > 0 && (
            <div>
              <h2 className="heading-display text-2xl sm:text-3xl mb-6">
                Other {h.role.toUpperCase()}s
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {sameRole.map(m => (
                  <Link
                    key={m.id}
                    href={`/heroes/${m.id}`}
                    className="relative block aspect-square rounded-xl overflow-hidden border-2 transition-all hover:-translate-y-1"
                    style={{
                      borderColor: m.stihiyaColor + '55',
                      background: `linear-gradient(180deg, ${m.stihiyaColor}26 0%, #12121E 70%)`,
                    }}
                  >
                    <Image
                      src={m.portraitUrl}
                      alt={m.name}
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="object-cover object-top"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-bg-dark to-transparent">
                      <p className="text-[9px] font-display tracking-wider font-bold text-white text-center truncate">
                        {m.name}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
