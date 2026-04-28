import { FEATURED_HEROES } from '@/lib/heroes';

export function HeroShowcase() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5">
      {FEATURED_HEROES.map((h) => (
        <div
          key={h.id}
          className="group relative aspect-square rounded-2xl overflow-hidden border-2 border-gold-300/30 bg-bg-mid transition-all hover:border-gold-300 hover:shadow-[0_0_24px_rgba(255,213,61,0.30)] hover:-translate-y-1"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={h.portraitUrl}
            alt={h.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-bg-dark via-bg-dark/85 to-transparent">
            <p className="font-display text-[10px] tracking-[0.18em] text-gold-300/85 mb-0.5">
              {h.race.toUpperCase()} · {h.role.toUpperCase()}
            </p>
            <h3 className="font-display text-sm tracking-wider font-bold text-white">
              {h.name}
            </h3>
          </div>
          {/* Stihiya color glow accent on hover */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none mix-blend-overlay"
            style={{
              background: `radial-gradient(circle at 50% 30%, ${h.stihiyaColor}33, transparent 60%)`,
            }}
          />
        </div>
      ))}
    </div>
  );
}
