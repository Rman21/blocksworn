'use client';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import { HEROES, type HeroMeta } from '@/lib/heroes';

const RACE_FILTERS = ['ALL', 'pirate', 'rock', 'shark', 'crocodile', 'spark'] as const;
const ROLE_FILTERS = ['ALL', 'warrior', 'hunter', 'mage', 'tank', 'captain'] as const;

export function HeroFilterGrid() {
  const [race, setRace] = useState<(typeof RACE_FILTERS)[number]>('ALL');
  const [role, setRole] = useState<(typeof ROLE_FILTERS)[number]>('ALL');

  const filtered = useMemo<HeroMeta[]>(() => {
    return HEROES.filter(h => {
      if (race !== 'ALL' && h.race !== race) return false;
      if (role !== 'ALL' && h.role !== role) return false;
      return true;
    });
  }, [race, role]);

  return (
    <>
      <div className="mb-8 space-y-3">
        {/* Race filter */}
        <div>
          <p className="font-display text-xs tracking-[0.25em] text-text-dim mb-2">RACE</p>
          <div className="flex flex-wrap gap-2">
            {RACE_FILTERS.map(r => (
              <button
                key={r}
                onClick={() => setRace(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-display tracking-[0.15em] font-bold transition-colors ${
                  race === r
                    ? 'bg-gold-300 text-bg-dark'
                    : 'bg-bg-mid text-text-muted hover:text-gold-300 hover:bg-gold-300/10 border border-gold-300/20'
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Role filter */}
        <div>
          <p className="font-display text-xs tracking-[0.25em] text-text-dim mb-2">ROLE</p>
          <div className="flex flex-wrap gap-2">
            {ROLE_FILTERS.map(r => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-display tracking-[0.15em] font-bold transition-colors ${
                  role === r
                    ? 'bg-gold-300 text-bg-dark'
                    : 'bg-bg-mid text-text-muted hover:text-gold-300 hover:bg-gold-300/10 border border-gold-300/20'
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-text-dim mt-2">
          Showing {filtered.length} of {HEROES.length} heroes
        </p>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-text-dim">
          No heroes match these filters.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map(h => (
            <Link
              key={h.id}
              href={`/heroes/${h.id}`}
              className="group relative aspect-square rounded-2xl overflow-hidden border-2 bg-bg-mid transition-all hover:-translate-y-1"
              style={{
                borderColor: h.stihiyaColor + '55',
                background: `linear-gradient(180deg, ${h.stihiyaColor}26 0%, #12121E 70%)`,
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className="w-20 h-20 rounded-full border-2"
                  style={{ borderColor: h.stihiyaColor + '88', background: '#0A0A1A' }}
                />
              </div>
              <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-bg-dark via-bg-dark/85 to-transparent">
                <p
                  className="font-display text-[9px] tracking-[0.18em] mb-0.5"
                  style={{ color: h.stihiyaColor }}
                >
                  {h.race.toUpperCase()} · {h.role.toUpperCase()}
                </p>
                <h3 className="font-display text-xs sm:text-sm tracking-wider font-bold text-white truncate">
                  {h.name}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
