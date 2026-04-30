import Link from 'next/link';
import { HeroShowcase } from '@/components/HeroShowcase';
import { FeatureGrid } from '@/components/FeatureGrid';
import { ChapterPreview } from '@/components/ChapterPreview';
import { HowToPlayVideo } from '@/components/HowToPlayVideo';

export default function HomePage() {
  return (
    <>
      {/*
       * Track F.2 — hero section now leads with a 6-second gameplay clip
       * (Abyssal Tyrant cascade w/ crit, umbra/purple) instead of static
       * marketing copy. Mass-market visitors decide in <3 seconds whether
       * to click Play; showing the actual game in motion above the fold
       * converts ~3× better than a logo + tagline (mobile F2P industry
       * benchmark, see polish plan v0.1 §F.1).
       *
       * Layout: two-column on >=md (video left, copy right), stacked on
       * mobile (video on top, copy below). Heading + CTA are gold-gradient
       * to keep the existing brand language.
       */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-radial-gold pointer-events-none" />
        <div className="container-page relative pt-12 sm:pt-20 pb-16 sm:pb-24">
          <div className="grid gap-10 md:gap-14 md:grid-cols-2 md:items-center max-w-6xl mx-auto animate-fade-in">
            {/* Left / top — autoplay hero clip.
             * - autoPlay + loop + muted + playsInline are all required for
             *   iOS Safari to inline-autoplay without a user gesture
             * - <source media="..."> for mobile must come BEFORE desktop;
             *   browsers pick the FIRST matching source
             * - poster paints before the video decodes (no white-flash)
             * - aspect-ratio inline locks layout so there's no shift
             */}
            <div className="order-1 md:order-1 mx-auto w-full max-w-md md:max-w-none">
              <video
                className="block w-full h-auto rounded-2xl border border-gold-300/30 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]"
                autoPlay
                loop
                muted
                playsInline
                poster="/videos/landing/clip_A_cascade_crit_poster.jpg"
                style={{ aspectRatio: '886 / 1520' }}
              >
                <source
                  src="/videos/landing/clip_A_cascade_crit_mobile.mp4"
                  type="video/mp4"
                  media="(max-width: 768px)"
                />
                <source
                  src="/videos/landing/clip_A_cascade_crit_desktop.mp4"
                  type="video/mp4"
                />
              </video>
            </div>
            {/* Right / bottom — copy + CTAs */}
            <div className="order-2 md:order-2 text-center md:text-left">
              <p className="font-display text-xs sm:text-sm tracking-[0.4em] text-gold-300 mb-4">
                BLOCK PUZZLE · RPG · F2P
              </p>
              <h1 className="heading-display text-4xl sm:text-5xl lg:text-6xl mb-5 leading-[1.0]">
                <span className="bg-gradient-to-b from-gold-100 via-gold-300 to-gold-700 bg-clip-text text-transparent">
                  Block puzzle × Hero RPG
                </span>
              </h1>
              <p className="text-base sm:text-xl text-text-secondary mb-3 font-light tracking-wide">
                Play free in your browser. No download.
              </p>
              <p className="text-sm sm:text-base text-text-muted max-w-xl md:max-w-none mx-auto md:mx-0 mb-8 leading-relaxed">
                25 elemental heroes. 5 chapters. Endless Tower. Match lines, trigger
                heroes, cascade for massive damage.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start items-center">
                <Link href="/play" className="btn-primary w-full sm:w-auto">
                  ▶ PLAY NOW — first win in 90 seconds
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
        </div>
      </section>

      {/*
       * Track F.2 — "See it in action". Second gameplay loop (Ember
       * tutorial battle, orange palette, clean readability) anchored
       * below the fold. Lazy-loaded via Intersection Observer in
       * HowToPlayVideo so it doesn't tank Lighthouse Performance — the
       * bytes only hit the wire when the section scrolls into view.
       */}
      <section className="py-16 sm:py-24 border-t border-gold-300/10">
        <div className="container-page">
          <div className="text-center mb-10">
            <p className="font-display text-xs tracking-[0.4em] text-gold-300 mb-3">
              SEE IT IN ACTION
            </p>
            <h2 className="heading-display text-3xl sm:text-5xl mb-4">
              Drop pieces. Trigger heroes.
            </h2>
            <p className="text-text-muted max-w-2xl mx-auto">
              Cascade for massive damage.
            </p>
          </div>
          <div className="mx-auto w-full max-w-md md:max-w-lg">
            <HowToPlayVideo />
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
