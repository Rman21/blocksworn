import { FEATURED_HEROES } from '@/lib/heroes';

export function HeroShowcase() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5">
      {FEATURED_HEROES.map((h) => (
        <div
          key={h.id}
          className="group relative aspect-square rounded-2xl overflow-hidden border-2 border-gold-300/30 bg-bg-mid transition-all hover:border-gold-300 hover:shadow-[0_0_24px_rgba(255,213,61,0.30)] hover:-translate-y-1"
          style={{ background: `linear-gradient(180deg, ${h.stihiyaColor}26 0%, #12121E 70%)` }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-24 h-24 rounded-full border-2"
              style={{ borderColor: h.stihiyaColor + '88', background: '#0A0A1A' }}
            />
          </div>
          <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-bg-dark via-bg-dark/85 to-transparent">
            <p
              className="font-display text-[10px] tracking-[0.18em] mb-0.5"
              style={{ color: h.stihiyaColor }}
            >
              {h.race.toUpperCase()} · {h.role.toUpperCase()}
            </p>
            <h3 className="font-display text-sm tracking-wider font-bold text-white">
              {h.name}
            </h3>
          </div>
        </div>
      ))}
    </div>
  );
}
