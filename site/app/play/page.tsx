import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Play Blocksworm — Free Browser Block Puzzle RPG',
  description:
    'Play Blocksworm directly in your browser. No download, no signup. Anonymous play available with optional cross-device sync.',
};

// Game URL: hosted on legacy GitHub Pages so the marketing site doesn't have to
// re-host the 16 MB single-file PWA. iframe is same-origin-friendly because the
// game uses postMessage only when explicitly invoked.
const GAME_SRC = 'https://rman21.github.io/blocksworn/blocksworn_index_fixed.html';

export default function PlayPage() {
  return (
    <div className="bg-bg-dark min-h-[calc(100vh-4rem)]">
      {/* Game iframe — full viewport on desktop, fixed aspect on mobile */}
      <iframe
        src={GAME_SRC}
        title="Blocksworm — Block Puzzle RPG"
        className="w-full h-[calc(100vh-4rem)] border-0 block"
        allow="autoplay; fullscreen; clipboard-write; vibrate"
        referrerPolicy="origin"
      />
    </div>
  );
}
