import type { MetadataRoute } from 'next';
import { HEROES } from '@/lib/heroes';

const BASE = 'https://blocksworm.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes = ['', '/play', '/heroes', '/leaderboard', '/about'];

  return [
    ...staticRoutes.map(p => ({
      url: BASE + p,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: p === '' ? 1.0 : 0.8,
    })),
    ...HEROES.map(h => ({
      url: `${BASE}/heroes/${h.id}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
