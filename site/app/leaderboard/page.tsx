import type { Metadata } from 'next';
import { LeaderboardTable } from '@/components/LeaderboardTable';

export const metadata: Metadata = {
  title: 'Tower Leaderboard',
  description:
    'Top 100 Tower of Endless climbers. Live leaderboard, updated every season. Free to view.',
};

export default function LeaderboardPage() {
  return (
    <>
      <section className="border-b border-gold-300/10">
        <div className="container-page py-12 sm:py-16 text-center">
          <p className="font-display text-xs sm:text-sm tracking-[0.4em] text-gold-300 mb-3">
            TOP 100 · UPDATED LIVE
          </p>
          <h1 className="heading-display text-4xl sm:text-6xl mb-4">
            <span className="bg-gradient-to-b from-gold-100 via-gold-300 to-gold-700 bg-clip-text text-transparent">
              Tower Leaderboard
            </span>
          </h1>
          <p className="text-text-muted max-w-2xl mx-auto text-sm sm:text-base">
            Climb the endless Tower. Highest floor wins. Resets every season — your best
            run is still etched into history.
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="container-page max-w-3xl">
          <LeaderboardTable />
        </div>
      </section>
    </>
  );
}
