/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Day-2 shipped hero ids as `croc_*`; Day-4 corrected to canonical
  // `crocodile_*` (matches game's HERO_ROSTER). Permanent redirect for any
  // shared/indexed Day-2 URLs.
  async redirects() {
    return [
      { source: '/heroes/croc_warrior', destination: '/heroes/crocodile_warrior', permanent: true },
      { source: '/heroes/croc_hunter',  destination: '/heroes/crocodile_hunter',  permanent: true },
      { source: '/heroes/croc_mage',    destination: '/heroes/crocodile_mage',    permanent: true },
      { source: '/heroes/croc_tank',    destination: '/heroes/crocodile_tank',    permanent: true },
      { source: '/heroes/croc_captain', destination: '/heroes/crocodile_captain', permanent: true },
      // 2026-05-13 — Game deploy split. Anyone deep-linking to the legacy
      // standalone HTML lands on the canonical game origin instead.
      { source: '/blocksworn_index_fixed.html', destination: 'https://play.blocksworm.com/', permanent: true },
    ];
  },
  // Enable server-side rendering for SEO; static-export not used.
  experimental: {
    optimizePackageImports: ['framer-motion'],
  },
};

export default nextConfig;
