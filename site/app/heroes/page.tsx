import type { Metadata } from 'next';
import Link from 'next/link';
import { HEROES } from '@/lib/heroes';
import { HeroFilterGrid } from '@/components/HeroFilterGrid';

export const metadata: Metadata = {
  title: 'All Heroes — 25 Legends Across 5 Races',
  description:
    'Browse all 25 Blocksworm heroes. Pirates, Rock Band, Sharks, Crocodiles, Sparks. Each race has 5 roles: Warrior, Hunter, Mage, Tank, Captain.',
};

const RACES = ['pirate', 'rock', 'shark', 'crocodile', 'spark'] as const;
const ROLES = ['warrior', 'hunter', 'mage', 'tank', 'captain'] as const;

export default function HeroesPage() {
  // Stats for the header
  const races = Array.from(new Set(HEROES.map(h => h.race)));
  return (
    <>
      <section className="relative overflow-hidden border-b border-gold-300/10">
        <div className="absolute inset-0 bg-radial-gold pointer-events-none" />
        <div className="container-page relative py-12 sm:py-20 text-center">
          <p className="font-display text-xs sm:text-sm tracking-[0.4em] text-gold-300 mb-4">
            {HEROES.length} LEGENDS · {races.length} RACES · {ROLES.length} ROLES
          </p>
          <h1 className="heading-display text-4xl sm:text-6xl mb-4">
            <span className="bg-gradient-to-b from-gold-100 via-gold-300 to-gold-700 bg-clip-text text-transparent">
              The Roster
            </span>
          </h1>
          <p className="text-text-muted max-w-2xl mx-auto text-sm sm:text-base">
            Every hero earnable through play. Mix races for synergy bonuses, mix roles
            for combo grammar (Warrior creates · Mage amplifies · Hunter detonates).
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="container-page">
          <HeroFilterGrid />
        </div>
      </section>

      {/* Race breakdown */}
      <section className="py-16 bg-bg-mid border-y border-gold-300/10">
        <div className="container-page">
          <h2 className="heading-display text-3xl sm:text-4xl text-center mb-12">
            Five Races, Five Stihiyas
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {RACES.map(r => {
              const inRace = HEROES.filter(h => h.race === r);
              if (inRace.length === 0) return null;
              const stih = inRace[0].stihiya;
              const color = inRace[0].stihiyaColor;
              return (
                <Link
                  key={r}
                  href={`/heroes#race-${r}`}
                  className="p-5 rounded-xl border-2 bg-bg-dark text-center transition-all hover:-translate-y-1"
                  style={{
                    borderColor: color + '55',
                  }}
                >
                  <p
                    className="font-display text-xs tracking-[0.25em] mb-1 font-bold"
                    style={{ color }}
                  >
                    {stih.toUpperCase()}
                  </p>
                  <h3 className="font-display text-base tracking-wider text-white mb-2">
                    {r.toUpperCase()}
                  </h3>
                  <p className="text-xs text-text-dim">{inRace.length} heroes</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
