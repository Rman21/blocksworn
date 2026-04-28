import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About Blocksworm',
  description:
    'A solo-built block puzzle RPG. Marvel Snap depth, Tetris simplicity, AAA anti-FOMO design.',
};

export default function AboutPage() {
  return (
    <div className="container-page py-16 max-w-3xl">
      <h1 className="heading-display text-4xl sm:text-6xl mb-8">About Blocksworm</h1>

      <div className="prose prose-invert max-w-none space-y-6">
        <section>
          <p className="text-lg text-text-secondary leading-relaxed">
            Blocksworm is a single-player block-puzzle RPG. Clear lines, charge hero
            ultimates, defeat elemental bosses across 5 chapters, then climb the endless
            Tower.
          </p>
        </section>

        <section>
          <h2 className="heading-display text-2xl text-gold-300 mb-4 mt-12">
            Three Pillars
          </h2>
          <ul className="space-y-3 text-text-secondary list-disc list-inside ml-2">
            <li>
              <strong className="text-white">No P2W:</strong> Every hero earnable through
              play. Premium currency only buys cosmetics + time skips.
            </li>
            <li>
              <strong className="text-white">No FOMO:</strong> Limited offers always have
              3+ day windows. No 6-hour pressure timers, no auto-renewing micro-traps.
            </li>
            <li>
              <strong className="text-white">Skill-first:</strong> A skilled F2P player
              outperforms a careless whale. Cascade depth, hero combos, and squad
              composition decide fights.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="heading-display text-2xl text-gold-300 mb-4 mt-12">
            Built Solo
          </h2>
          <p className="text-text-secondary leading-relaxed">
            Blocksworm is a solo-built indie. One developer, AI-assisted. The whole game
            is a single ~16 MB HTML file, deployed on GitHub Pages, backend on Firebase.
            No engine, no framework — just vanilla JS, hand-tuned CSS, and a stubborn
            commitment to AAA polish.
          </p>
        </section>

        <section>
          <h2 className="heading-display text-2xl text-gold-300 mb-4 mt-12">
            Tech Stack
          </h2>
          <ul className="space-y-2 text-text-muted text-sm font-mono">
            <li>· Game: Single-file PWA (HTML + CSS + JS)</li>
            <li>· Audio: Web Audio API (generative SFX) + HTML5 Audio (12 MP3 tracks)</li>
            <li>· Backend: Firebase (Auth + Firestore + Hosting)</li>
            <li>· Site: Next.js 15 + Tailwind + Vercel</li>
            <li>· Domain: blocksworm.com (Namecheap)</li>
          </ul>
        </section>

        <section className="pt-8">
          <Link href="/play" className="btn-primary">
            ▶ START PLAYING
          </Link>
        </section>
      </div>
    </div>
  );
}
