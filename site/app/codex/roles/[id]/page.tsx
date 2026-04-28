import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ROLES, ROLE_BY_ID, ELEMENTS, type RoleId } from '@/lib/codex';
import { HEROES } from '@/lib/heroes';

interface Props {
  params: Promise<{ id: string }>;
}

export function generateStaticParams() {
  return ROLES.map(r => ({ id: r.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const r = ROLE_BY_ID[id as RoleId];
  if (!r) return { title: 'Role Not Found' };
  return {
    title: `${r.name} — Role Guide (${r.function})`,
    description: `${r.name} role in Blocksworm. ${r.verb}. ${r.boardInteraction}`,
  };
}

export default async function RolePage({ params }: Props) {
  const { id } = await params;
  const role = ROLE_BY_ID[id as RoleId];
  if (!role) notFound();

  // One hero per element with this role — visualizes "5 heroes share the role, vary by element"
  const variants = ELEMENTS.map(el => HEROES.find(h => h.role === role.id && h.stihiya === el.id))
    .filter((h): h is NonNullable<typeof h> => h !== undefined);

  return (
    <>
      <section className="relative overflow-hidden border-b border-gold-300/10">
        <div className="absolute inset-0 bg-radial-gold pointer-events-none" />
        <div className="container-page relative py-10 sm:py-16">
          <Link href="/codex" className="inline-block mb-6 text-xs font-display tracking-[0.2em] text-text-muted hover:text-gold-300 transition-colors">
            ← BACK TO CODEX
          </Link>
          <p className="font-display text-xs sm:text-sm tracking-[0.4em] text-gold-300 mb-3 font-bold">
            ROLE · {role.function}
          </p>
          <h1 className="heading-display text-5xl sm:text-7xl mb-4 leading-[0.9]">
            <span className="bg-gradient-to-b from-gold-100 via-gold-300 to-gold-700 bg-clip-text text-transparent">
              {role.name}
            </span>
          </h1>
          <p className="text-base sm:text-2xl text-text-secondary italic">
            <span className="text-gold-300 font-bold">{role.verb}</span> · the {role.function.toLowerCase()} verb of the cascade.
          </p>
        </div>
      </section>

      <section className="py-10 sm:py-12">
        <div className="container-page max-w-3xl space-y-6">
          <div className="rounded-2xl border-2 border-gold-300/20 bg-bg-mid p-6">
            <p className="font-display text-xs tracking-[0.2em] text-gold-300 font-bold mb-2">BOARD INTERACTION</p>
            <p className="text-text-secondary leading-relaxed">{role.boardInteraction}</p>
          </div>
          <div className="rounded-2xl border-2 border-gold-300/20 bg-bg-mid p-6">
            <p className="font-display text-xs tracking-[0.2em] text-gold-300 font-bold mb-2">ULT SIGNATURE</p>
            <p className="text-text-secondary leading-relaxed">{role.ultPattern}</p>
          </div>
          <div className="rounded-2xl border-2 border-gold-300/20 bg-bg-mid p-6">
            <p className="font-display text-xs tracking-[0.2em] text-gold-300 font-bold mb-2">CHARGE COST</p>
            <p className="text-text-secondary leading-relaxed">{role.chargeCost}</p>
          </div>
          <div className="rounded-2xl border-2 border-gold-300/30 bg-bg-mid p-6">
            <p className="font-display text-xs tracking-[0.2em] text-gold-300 font-bold mb-3">THE CASCADE GRAMMAR</p>
            <p className="text-text-secondary leading-relaxed">
              <strong className="text-white">Warrior creates → Mage amplifies → Hunter detonates</strong> = damage cascade.{' '}
              <strong className="text-white">Tank absorbs</strong> = team gets turns.{' '}
              <strong className="text-white">Captain enables</strong> = multiplier + drops.
            </p>
            <p className="mt-3 text-sm text-text-muted">
              Every hero answers exactly one verb. Predictability is non-negotiable — variance lives in drop order, never in hero behavior.
            </p>
          </div>
        </div>
      </section>

      <section className="py-12 bg-bg-mid border-y border-gold-300/10">
        <div className="container-page max-w-5xl">
          <h2 className="heading-display text-2xl sm:text-3xl mb-3 text-center">5 elements × 1 role</h2>
          <p className="text-center text-sm text-text-muted mb-6 max-w-xl mx-auto">
            One {role.name} per element — same verb, different element-state.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {variants.map(h => (
              <Link
                key={h.id}
                href={`/heroes/${h.id}`}
                className="group relative aspect-square rounded-2xl overflow-hidden border-2 transition-all hover:-translate-y-1"
                style={{ borderColor: h.stihiyaColor + '55', background: `linear-gradient(180deg, ${h.stihiyaColor}26 0%, #12121E 70%)` }}
              >
                <Image src={h.portraitUrl} alt={h.name} fill sizes="(max-width: 640px) 50vw, 20vw" className="object-cover object-top" />
                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-bg-dark via-bg-dark/85 to-transparent">
                  <p className="font-display text-[9px] tracking-[0.18em]" style={{ color: h.stihiyaColor }}>
                    {h.race.toUpperCase()} · {h.stihiya.toUpperCase()}
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
