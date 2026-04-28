import type { Metadata } from 'next';
import { ELEMENTS, RACES } from '@/lib/codex';
import { CodexCard } from '@/components/CodexCard';

export const metadata: Metadata = {
  title: 'Races — Codex',
  description:
    'The five factions of Blocksworm: Pirates, Rock Band, Sharks, Crocodiles, Sparks. Race is flavor and collection — never mechanical identity.',
};

export default function RacesIndexPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-gold-300/10">
        <div className="absolute inset-0 bg-radial-gold pointer-events-none" />
        <div className="container-page relative py-12 sm:py-16 text-center">
          <p className="font-display text-xs sm:text-sm tracking-[0.4em] text-gold-300 mb-3">
            CODEX · 5 RACES
          </p>
          <h1 className="heading-display text-4xl sm:text-6xl mb-4">
            <span className="bg-gradient-to-b from-gold-100 via-gold-300 to-gold-700 bg-clip-text text-transparent">
              The Factions
            </span>
          </h1>
          <p className="text-text-muted max-w-2xl mx-auto text-sm sm:text-base">
            Race is flavor and collection — never mechanical identity. Race-passive caps at +30%.
            Element × Role always out-scales race.
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="container-page max-w-5xl">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {RACES.map(r => (
              <CodexCard
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
    </>
  );
}
