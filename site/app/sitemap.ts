import type { MetadataRoute } from 'next';
import { HEROES } from '@/lib/heroes';
import { BOSSES } from '@/lib/bosses';
import { NEWS } from '@/lib/news';
import { ELEMENTS, RACES, ROLES } from '@/lib/codex';

const BASE = 'https://blocksworm.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticRoutes = ['', '/play', '/heroes', '/bosses', '/codex', '/leaderboard', '/news', '/about'];

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
    // Codex taxonomy pages — element/race/role guides drive long-tail SEO
    ...ELEMENTS.map(e => ({
      url: `${BASE}/codex/elements/${e.id}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    ...RACES.map(r => ({
      url: `${BASE}/codex/races/${r.id}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    ...ROLES.map(r => ({
      url: `${BASE}/codex/roles/${r.id}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    ...NEWS.map(p => ({
      url: `${BASE}/news/${p.slug}`,
      lastModified: new Date(p.date),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ];
}
