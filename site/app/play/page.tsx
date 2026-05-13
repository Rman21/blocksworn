import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Play Blocksworm — Free Browser Block Puzzle RPG',
  description:
    'Play Blocksworm directly in your browser. No download, no signup. Anonymous play available with optional cross-device sync.',
};

// 2026-05-13 — Deploy topology migration: the game now ships from its own
// Vercel project at play.blocksworm.com (Vite static SPA) rather than as a
// vendored static HTML iframed inside this Next.js marketing site. Reasons
// (per AAA+ recommendation): independent rollback, independent CSP, immutable
// hashed-asset cache headers, separate Sentry env tag, and a clean path to
// beta.blocksworm.com (T4.11) + blocksworn.com (T4.12 production launch).
//
// The legacy `site/public/blocksworn_index_fixed.html` snapshot is retained
// for the moment so deep-links to that filename still resolve, but the
// /play route now permanently redirects to the dedicated game origin.
export default function PlayPage(): never {
  permanentRedirect('https://play.blocksworm.com/');
}
