import Link from 'next/link';
import { HeroShowcase } from '@/components/HeroShowcase';
import { FeatureGrid } from '@/components/FeatureGrid';
import { ChapterPreview } from '@/components/ChapterPreview';

export default function HomePage() {
  return (
    <>
      {/* Hero section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-radial-gold pointer-events-none" />
        <div className="container-page relative pt-12 sm:pt-20 pb-16 sm:pb-24">
          <div className="max-w-4xl mx-auto text-center animate-fade-in">
            <p className="font-display text-xs sm:text-sm tracking-[0.4em] text-gold-300 mb-4">
              BLOCK PUZZLE · RPG · F2P
            </p>
            <h1 className="heading-display text-5xl sm:text-7xl lg:text-8xl mb-6 leading-[0.95]">
              <span className="bg-gradient-to-b from-gold-100 via-gold-300 to-gold-700 bg-clip-text text-transparent">
                BLOCKSWORM
              </span>
            </h1>
            <p className="text-lg sm:text-2xl text-text-secondary mb-3 font-light tracking-wide">
              Clear lines · Summon legends
            </p>
            <p className="text-sm sm:text-base text-text-muted max-w-2xl mx-auto mb-10 leading-relaxed">
              25 elemental heroes. 5 chapters. Endless Tower. Marvel Snap-style depth in
              a block puzzle you can finish on a coffee break.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/play" className="btn-primary w-full sm:w-auto">
                ▶ PLAY FREE — NO SIGN-UP
              </Link>
              <Link href="/heroes" className="btn-secondary w-full sm:w-auto">
                MEET THE HEROES
              </Link>
            </div>
            <p className="mt-6 text-xs text-text-dim tracking-wider">
              No P2W · No FOMO · All 25 heroes earnable through play
            </p>
          </div>
        </div>
      </section>

      {/* Hero showcase grid */}
      <section className="py-16 sm:py-24 border-t border-gold-300/10">
        <div className="container-page">
          <div className="text-center mb-12">
            <p className="font-display text-xs tracking-[0.4em] text-gold-300 mb-3">
              25 LEGENDS · 5 RACES
            </p>
            <h2 className="heading-display text-3xl sm:text-5xl mb-4">
              Build Your Squad
            </h2>
            <p className="text-text-muted max-w-2xl mx-auto">
              Each hero brings unique abilities. Pirates set ember chains, Sharks freeze
              tides, Sparks blast solar lines. Mix races for synergy bonuses.
            </p>
          </div>
          <HeroShowcase />
          <div className="text-center mt-10">
            <Link href="/heroes" className="btn-secondary">
              VIEW ALL HEROES →
            </Link>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="py-16 sm:py-24 bg-bg-mid border-y border-gold-300/10">
        <div className="container-page">
          <div className="text-center mb-12">
            <p className="font-display text-xs tracking-[0.4em] text-gold-300 mb-3">
              WHAT MAKES IT DIFFERENT
            </p>
            <h2 className="heading-display text-3xl sm:text-5xl mb-4">
              Block Puzzle, Reinvented
            </h2>
          </div>
          <FeatureGrid />
        </div>
      </section>

      {/* Chapter preview */}
      <section className="py-16 sm:py-24">
        <div className="container-page">
          <div className="text-center mb-12">
            <p className="font-display text-xs tracking-[0.4em] text-gold-300 mb-3">
              5 CHAPTERS · 25 BOSSES · ENDLESS TOWER
            </p>
            <h2 className="heading-display text-3xl sm:text-5xl mb-4">
              The Journey
            </h2>
          </div>
          <ChapterPreview />
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-20 sm:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-radial-ember pointer-events-none" />
        <div className="container-page relative text-center">
          <h2 className="heading-display text-4xl sm:text-6xl mb-6">
            <span className="bg-gradient-to-b from-gold-100 to-gold-700 bg-clip-text text-transparent">
              Ready, Summoner?
            </span>
          </h2>
          <p className="text-text-muted mb-10 max-w-xl mx-auto">
            One tap to start. Anonymous play available. Cross-device sync via free
            Firebase account when you&apos;re ready.
          </p>
          <Link href="/play" className="btn-primary text-base">
            ▶ ENTER THE BATTLE
          </Link>
        </div>
      </section>
    </>
  );
}
