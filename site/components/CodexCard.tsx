import Link from 'next/link';

export function CodexCard({
  href,
  accent,
  label,
  title,
  sub,
}: {
  href: string;
  accent: string;
  label: string;
  title: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="group relative block p-5 rounded-2xl border-2 bg-bg-mid transition-all hover:-translate-y-1"
      style={{ borderColor: accent + '55', boxShadow: `0 0 20px ${accent}1A` }}
    >
      <p
        className="font-display text-[10px] tracking-[0.2em] font-bold mb-2"
        style={{ color: accent }}
      >
        {label}
      </p>
      <h3 className="font-display text-lg sm:text-xl font-bold text-white mb-1 tracking-wide group-hover:text-gold-300 transition-colors">
        {title}
      </h3>
      <p className="text-xs text-text-muted">{sub}</p>
    </Link>
  );
}
