import type { Metadata } from 'next';
import { ROLES } from '@/lib/codex';
import { CodexCard } from '@/components/CodexCard';

export const metadata: Metadata = {
  title: 'Roles — Codex',
  description:
    'The five verbs of the combo grammar: Warrior creates, Mage amplifies, Hunter detonates, Tank absorbs, Captain enables.',
};

export default function RolesIndexPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-gold-300/10">
        <div className="absolute inset-0 bg-radial-gold pointer-events-none" />
        <div className="container-page relative py-12 sm:py-16 text-center">
          <p className="font-display text-xs sm:text-sm tracking-[0.4em] text-gold-300 mb-3">
            CODEX · 5 ROLES
          </p>
          <h1 className="heading-display text-4xl sm:text-6xl mb-4">
            <span className="bg-gradient-to-b from-gold-100 via-gold-300 to-gold-700 bg-clip-text text-transparent">
              The Verbs
            </span>
          </h1>
          <p className="text-text-muted max-w-2xl mx-auto text-sm sm:text-base">
            Each role is one verb in the combo grammar. A hero has exactly one role. Predictability
            is non-negotiable.
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="container-page max-w-5xl">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {ROLES.map(r => (
              <CodexCard
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
