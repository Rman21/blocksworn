/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow external image sources (game assets on rman21.github.io)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'rman21.github.io',
      },
    ],
  },
  // Enable server-side rendering for SEO; static-export not used.
  experimental: {
    optimizePackageImports: ['framer-motion'],
  },
};

export default nextConfig;
