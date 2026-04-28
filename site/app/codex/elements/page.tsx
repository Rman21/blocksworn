import type { Metadata } from 'next';
import { ELEMENTS } from '@/lib/codex';
import { HEROES } from '@/lib/heroes';
import { BOSSES } from '@/lib/bosses';
import { CodexCard } from '@/components/CodexCard';

export const metadata: Metadata = {
  title: 'Elements — Codex',
  description:
    'The five Stihiyas of Blocksworm: Ember, Tide, Grove, Umbra, Solar. Each element has one core mechanic and one combo role.',
};

export default function ElementsIndexPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-gold-300/10">
        <div className="absolute inset-0 bg-radial-gold pointer-events-none" />
        <div className="container-page relative py-12 sm:py-16 text-center">
          <p className="font-display text-xs sm:text-sm tracking-[0.4em] text-gold-300 mb-3">
            CODEX · 5 ELEMENTS
          </p>
          <h1 className="heading-display text-4xl sm:text-6xl mb-4">
            <span className="bg-gradient-to-b from-gold-100 via-gold-300 to-gold-700 bg-clip-text text-transparent">
              The Stihiyas
            </span>
          </h1>
          <p className="text-text-muted max-w-2xl mx-auto text-sm sm:text-base">
            Each element has one core mechanic and one combo role. Predictable to read, deep to chain.
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="container-page max-w-5xl">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {ELEMENTS.map(e => {
              const heroes = HEROES.filter(h => h.stihiya === e.id).length;
              const bosses = BOSSES.filter(
                b => b.element === e.id || b.secondaryElement === e.id,
              ).length;
              return (
                <CodexCard
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
    </>
  );
}
