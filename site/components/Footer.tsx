import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-gold-300/15 bg-bg-mid mt-16">
      <div className="container-page py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div>
            <h3 className="font-display text-xs tracking-[0.2em] text-gold-300 font-bold mb-4">
              GAME
            </h3>
            <ul className="space-y-2 text-sm text-text-muted">
              <li><Link href="/play" className="hover:text-gold-300 transition-colors">Play</Link></li>
              <li><Link href="/heroes" className="hover:text-gold-300 transition-colors">Heroes</Link></li>
              <li><Link href="/bosses" className="hover:text-gold-300 transition-colors">Bosses</Link></li>
              <li><Link href="/codex" className="hover:text-gold-300 transition-colors">Codex</Link></li>
              <li><Link href="/leaderboard" className="hover:text-gold-300 transition-colors">Leaderboard</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-display text-xs tracking-[0.2em] text-gold-300 font-bold mb-4">
              ABOUT
            </h3>
            <ul className="space-y-2 text-sm text-text-muted">
              <li><Link href="/about" className="hover:text-gold-300 transition-colors">About</Link></li>
              <li><Link href="/news" className="hover:text-gold-300 transition-colors">News</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-display text-xs tracking-[0.2em] text-gold-300 font-bold mb-4">
              LEGAL
            </h3>
            <ul className="space-y-2 text-sm text-text-muted">
              <li><Link href="/legal/privacy" className="hover:text-gold-300 transition-colors">Privacy</Link></li>
              <li><Link href="/legal/terms" className="hover:text-gold-300 transition-colors">Terms</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-display text-xs tracking-[0.2em] text-gold-300 font-bold mb-4">
              CONTACT
            </h3>
            <ul className="space-y-2 text-sm text-text-muted">
              <li><a href="mailto:hello@blocksworm.com" className="hover:text-gold-300 transition-colors">hello@blocksworm.com</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-gold-300/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="font-display text-xs tracking-[0.25em] text-gold-300 font-black">
            BLOCKSWORM
          </span>
          <p className="text-xs text-text-dim">
            © 2026 Blocksworm. All heroes earnable through play. No P2W.
          </p>
        </div>
      </div>
    </footer>
  );
}
