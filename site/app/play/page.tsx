import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Play Blocksworm — Free Browser Block Puzzle RPG',
  description:
    'Play Blocksworm directly in your browser. No download, no signup. Anonymous play available with optional cross-device sync.',
};

// Game served from the same origin (vendored into /public) so the iframe doesn't
// hop across domains and we keep one localStorage namespace for player progress.
const GAME_SRC = '/blocksworn_index_fixed.html';

// 2026-04-28 — Mobile fix: previously the iframe was sized as
// h-[calc(100vh-4rem)] inside a normal flow div, which on iOS Safari left
// the chronograph tip-card cropped at the bottom (URL bar + toolbar +
// marketing header all eating into the visible viewport). Now the iframe
// is rendered fullscreen via `fixed inset-0` over everything (including the
// marketing Header) with a high z-index. Sized in 100dvh / 100% so it
// adapts to the dynamic mobile viewport correctly.
export default function PlayPage() {
  return (
    <div
      className="fixed inset-0 z-[9999] bg-bg-dark"
      style={{ height: '100dvh', width: '100dvw' }}
    >
      <iframe
        src={GAME_SRC}
        title="Blocksworm — Block Puzzle RPG"
        className="w-full h-full border-0 block"
        allow="autoplay; fullscreen; clipboard-write; vibrate"
        referrerPolicy="origin"
      />
    </div>
  );
}
