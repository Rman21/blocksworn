import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About Blocksworm',
  description:
    'A solo-built block puzzle RPG. Marvel Snap depth, Tetris simplicity, AAA anti-FOMO design. Built around one feeling: The Last Line.',
};

const COMPARE = [
  { genre: 'Block puzzle', usual: 'Endless, no stakes', us: 'Short bouts with HP, death, and 2-minute tactical endgames' },
  { genre: 'Puzzle RPG', usual: 'Match-3, slow grind', us: '8×8 placement, 2-minute fights, cascade ultimates' },
  { genre: 'Hero collectors', usual: 'Auto-battle gacha', us: 'Your placement IS your heroes\' damage' },
];

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-gold-300/10">
        <div className="absolute inset-0 bg-radial-gold pointer-events-none" />
        <div className="container-page relative py-12 sm:py-20">
          <div className="max-w-3xl mx-auto text-center">
            <p className="font-display text-xs sm:text-sm tracking-[0.4em] text-gold-300 mb-4">
              ABOUT BLOCKSWORM
            </p>
            <h1 className="heading-display text-4xl sm:text-6xl mb-6 leading-[0.95]">
              <span className="bg-gradient-to-b from-gold-100 via-gold-300 to-gold-700 bg-clip-text text-transparent">
                The Last Line
              </span>
            </h1>
            <p className="text-base sm:text-lg text-text-secondary leading-relaxed italic">
              You&apos;re on 1 HP. The boss is on 8% HP. His next strike kills you.
              A Z-piece falls into the tray. Two seconds of silence — and you see
              the full cascade three moves ahead. You set the piece. Time slows.
              The boss dies one tick before its attack lands.
            </p>
            <p className="mt-4 text-sm text-text-muted">
              That feeling — the read-and-execute on the brink — is what this whole game is built around.
            </p>
          </div>
        </div>
      </section>

      {/* Emotional contract */}
      <section className="py-12 sm:py-16">
        <div className="container-page max-w-3xl">
          <div className="rounded-2xl border-2 border-gold-300/20 bg-bg-mid p-6 sm:p-10 text-center">
            <p className="font-display text-xs tracking-[0.4em] text-gold-300 mb-4">
              EMOTIONAL CONTRACT
            </p>
            <p className="text-lg sm:text-xl text-text-secondary leading-relaxed italic">
              &ldquo;A game where you feel like a tactician on the brink — when your
              brain sees the answer half a second before death, and it works
              because of the squad you built yourself.&rdquo;
            </p>
            <p className="mt-6 text-sm text-text-muted">
              Not Diablo (omnipotence). Not Genshin (collection). Not Royal Match (zen).
              You are the one who slips out of the trap. Again and again.
            </p>
          </div>
        </div>
      </section>

      {/* What makes it different */}
      <section className="py-12 sm:py-16 bg-bg-mid border-y border-gold-300/10">
        <div className="container-page max-w-4xl">
          <div className="text-center mb-10">
            <p className="font-display text-xs tracking-[0.4em] text-gold-300 mb-3">
              WHY IT&apos;S DIFFERENT
            </p>
            <h2 className="heading-display text-3xl sm:text-4xl mb-3">A category of one</h2>
          </div>
          <div className="rounded-2xl border border-gold-300/20 overflow-hidden">
            <div className="grid grid-cols-3 gap-px bg-gold-300/15 text-xs sm:text-sm">
              <div className="bg-bg-dark p-4 font-display tracking-[0.2em] text-gold-300 font-bold">GENRE</div>
              <div className="bg-bg-dark p-4 font-display tracking-[0.2em] text-text-muted font-bold">TYPICAL</div>
              <div className="bg-bg-dark p-4 font-display tracking-[0.2em] text-gold-300 font-bold">BLOCKSWORM</div>
              {COMPARE.map((row) => (
                <FragmentRow key={row.genre} row={row} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Three pillars */}
      <section className="py-12 sm:py-16">
        <div className="container-page max-w-4xl">
          <div className="text-center mb-10">
            <p className="font-display text-xs tracking-[0.4em] text-gold-300 mb-3">
              THREE PILLARS
            </p>
            <h2 className="heading-display text-3xl sm:text-4xl mb-3">What we won&apos;t do</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Pillar title="No P2W" body="Every hero is earnable through play. Premium currency buys cosmetics and time skips — never power, never gating." />
            <Pillar title="No FOMO" body="Limited offers carry 3+ day windows. No 6-hour pressure timers. No auto-renewing micro-traps." />
            <Pillar title="Skill-first" body="A skilled F2P player outperforms a careless whale. Cascade depth, hero combos, and squad composition decide fights." />
          </div>
        </div>
      </section>

      {/* By the numbers */}
      <section className="py-12 sm:py-16 bg-bg-mid border-y border-gold-300/10">
        <div className="container-page max-w-4xl">
          <div className="text-center mb-10">
            <p className="font-display text-xs tracking-[0.4em] text-gold-300 mb-3">
              BY THE NUMBERS
            </p>
            <h2 className="heading-display text-3xl sm:text-4xl mb-3">v1 scope</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat n="25" label="Heroes" sub="5 races · 5 roles" />
            <Stat n="15" label="Bosses" sub="3 chapters · 10 archetypes" />
            <Stat n="29" label="Tower Pacts" sub="4 tiers + 5 dual-element" />
            <Stat n="∞" label="Tower Floors" sub="Daily / Weekly / Seasonal" />
          </div>
        </div>
      </section>

      {/* Built solo */}
      <section className="py-12 sm:py-16">
        <div className="container-page max-w-3xl">
          <h2 className="heading-display text-3xl sm:text-4xl text-gold-300 mb-6">Built solo</h2>
          <p className="text-text-secondary leading-relaxed mb-6">
            Blocksworm is a one-person indie, AI-assisted. The whole game is a single ~16 MB
            HTML file deployed on GitHub Pages, backend on Firebase. No engine, no framework —
            just vanilla JS, hand-tuned CSS, and a stubborn commitment to AAA polish.
          </p>
          <h3 className="font-display text-sm tracking-[0.2em] text-gold-300 font-bold mb-3 mt-8">
            STACK
          </h3>
          <ul className="space-y-2 text-text-muted text-sm font-mono">
            <li>· Game: single-file PWA (HTML + CSS + vanilla JS)</li>
            <li>· Audio: Web Audio API (generative SFX) + HTML5 Audio (12 boss tracks)</li>
            <li>· Backend: Firebase (anonymous auth + Firestore + Hosting)</li>
            <li>· Site: Next.js 15 + Tailwind + Vercel</li>
            <li>· Domain: blocksworm.com (Namecheap)</li>
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-16 sm:py-24 overflow-hidden border-t border-gold-300/10">
        <div className="absolute inset-0 bg-radial-ember pointer-events-none" />
        <div className="container-page relative text-center">
          <h2 className="heading-display text-3xl sm:text-5xl mb-6">
            <span className="bg-gradient-to-b from-gold-100 to-gold-700 bg-clip-text text-transparent">
              Ready to read the board?
            </span>
          </h2>
          <Link href="/play" className="btn-primary">▶ START PLAYING</Link>
        </div>
      </section>
    </>
  );
}

function FragmentRow({ row }: { row: typeof COMPARE[number] }) {
  return (
    <>
      <div className="bg-bg-mid p-4 font-display tracking-wider text-white">{row.genre}</div>
      <div className="bg-bg-mid p-4 text-text-muted">{row.usual}</div>
      <div className="bg-bg-mid p-4 text-gold-300 font-medium">{row.us}</div>
    </>
  );
}

function Pillar({ title, body }: { title: string; body: string }) {
  return (
    <div className="p-6 rounded-2xl border-2 border-gold-300/20 bg-bg-mid">
      <h3 className="font-display text-xl font-bold text-gold-300 mb-3 tracking-wider">{title}</h3>
      <p className="text-sm text-text-secondary leading-relaxed">{body}</p>
    </div>
  );
}

function Stat({ n, label, sub }: { n: string; label: string; sub: string }) {
  return (
    <div className="p-5 rounded-2xl border border-gold-300/15 bg-bg-dark text-center">
      <p className="font-display text-4xl sm:text-5xl font-black bg-gradient-to-b from-gold-100 to-gold-700 bg-clip-text text-transparent leading-none mb-2">
        {n}
      </p>
      <p className="font-display text-xs tracking-[0.2em] text-white font-bold mb-1">
        {label.toUpperCase()}
      </p>
      <p className="text-[10px] text-text-dim">{sub}</p>
    </div>
  );
}
