import type { MetadataRoute } from 'next';
import { HEROES } from '@/lib/heroes';
import { BOSSES } from '@/lib/bosses';

const BASE = 'https://blocksworm.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes = ['', '/play', '/heroes', '/bosses', '/leaderboard', '/about'];

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
    ...BOSSES.map(b => ({
      url: `${BASE}/bosses/${b.id}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.7, // bosses get slightly higher SEO priority — strategy guides drive search traffic
    })),
  ];
}
