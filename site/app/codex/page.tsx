import type { Metadata } from 'next';
import Link from 'next/link';
import { ELEMENTS, RACES, ROLES } from '@/lib/codex';
import { HEROES } from '@/lib/heroes';
import { BOSSES } from '@/lib/bosses';

export const metadata: Metadata = {
  title: 'Codex — Mechanics, Elements, Races & Roles',
  description:
    'The Blocksworm encyclopedia. Five elements (Ember / Tide / Grove / Umbra / Solar). Five races (Pirates / Rock Band / Sharks / Crocodiles / Sparks). Five roles (Warrior / Mage / Hunter / Tank / Captain). The full combo grammar.',
};

function Card({ href, accent, label, title, sub }: { href: string; accent: string; label: string; title: string; sub: string }) {
  return (
    <Link
      href={href}
      className="group relative block p-5 rounded-2xl border-2 bg-bg-mid transition-all hover:-translate-y-1"
      style={{ borderColor: accent + '55', boxShadow: `0 0 20px ${accent}1A` }}
    >
      <p className="font-display text-[10px] tracking-[0.2em] font-bold mb-2" style={{ color: accent }}>
        {label}
      </p>
      <h3 className="font-display text-lg sm:text-xl font-bold text-white mb-1 tracking-wide group-hover:text-gold-300 transition-colors">
        {title}
      </h3>
      <p className="text-xs text-text-muted">{sub}</p>
    </Link>
  );
}

export default function CodexPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-gold-300/10">
        <div className="absolute inset-0 bg-radial-gold pointer-events-none" />
        <div className="container-page relative py-12 sm:py-20 text-center">
          <p className="font-display text-xs sm:text-sm tracking-[0.4em] text-gold-300 mb-4">
            COMBO GRAMMAR · 5 × 5 × 5
          </p>
          <h1 className="heading-display text-4xl sm:text-6xl mb-4">
            <span className="bg-gradient-to-b from-gold-100 via-gold-300 to-gold-700 bg-clip-text text-transparent">
              Codex
            </span>
          </h1>
          <p className="text-text-muted max-w-2xl mx-auto text-sm sm:text-base mb-3">
            Every fight is a sentence. Warrior creates · Mage amplifies · Hunter detonates ·
            Tank absorbs · Captain enables. Every hero answers exactly one of those five verbs.
          </p>
          <p className="text-text-dim italic text-xs sm:text-sm">
            5 elements × 5 roles = 25 mechanically distinct heroes. Race adds flavor, never function.
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="container-page max-w-5xl">
          <div className="text-center mb-8">
            <p className="font-display text-xs tracking-[0.4em] text-gold-300 mb-3">5 ELEMENTS</p>
            <h2 className="heading-display text-3xl sm:text-4xl mb-3">The Stihiyas</h2>
            <p className="text-sm text-text-muted max-w-xl mx-auto">
              Each element has one core mechanic and one combo role. Predictable to read, deep to chain.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {ELEMENTS.map(e => {
              const heroes = HEROES.filter(h => h.stihiya === e.id).length;
              const bosses = BOSSES.filter(b => b.element === e.id || b.secondaryElement === e.id).length;
              return (
                <Card
                  key={e.id}
                  href={`/codex/elements/${e.id}`}
                  accent={e.color}
                  label={`${e.uiName.toUpperCase()} · ${e.inWorldName.toUpperCase()}`}
                  title={e.inWorldName}
                  sub={`${heroes} heroes · ${bosses} bosses`}
                />
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-12 bg-bg-mid border-y border-gold-300/10">
        <div className="container-page max-w-5xl">
          <div className="text-center mb-8">
            <p className="font-display text-xs tracking-[0.4em] text-gold-300 mb-3">5 RACES</p>
            <h2 className="heading-display text-3xl sm:text-4xl mb-3">The Factions</h2>
            <p className="text-sm text-text-muted max-w-xl mx-auto">
              Race is flavor and collection — never mechanical identity. Race-passive caps at +30%.
              Element × Role always out-scales race.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {RACES.map(r => (
              <Card
                key={r.id}
                href={`/codex/races/${r.id}`}
                accent={ELEMENTS.find(e => e.id === r.element)!.color}
                label={r.element.toUpperCase()}
                title={r.name}
                sub={r.status.split('·')[0].trim()}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="container-page max-w-5xl">
          <div className="text-center mb-8">
            <p className="font-display text-xs tracking-[0.4em] text-gold-300 mb-3">5 ROLES</p>
            <h2 className="heading-display text-3xl sm:text-4xl mb-3">The Verbs</h2>
            <p className="text-sm text-text-muted max-w-xl mx-auto">
              Each role is one verb in the combo grammar. A hero has exactly one role. Predictability is non-negotiable.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {ROLES.map(r => (
              <Card
                key={r.id}
                href={`/codex/roles/${r.id}`}
                accent="#FFD53D"
                label={r.function}
                title={r.name}
                sub={r.verb.toUpperCase()}
              />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
