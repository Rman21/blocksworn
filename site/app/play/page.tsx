import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Play Blocksworm — Free Browser Block Puzzle RPG',
  description:
    'Play Blocksworm directly in your browser. No download, no signup. Anonymous play available with optional cross-device sync.',
};

// Game served from the same origin (vendored into /public) so the iframe doesn't
// hop across domains and we keep one localStorage namespace for player progress.
const GAME_SRC = '/blocksworn_index_fixed.html';

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
