import type { Metadata } from 'next';
import Link from 'next/link';
import { NEWS, NEWS_CATEGORY_LABELS } from '@/lib/news';

export const metadata: Metadata = {
  title: 'News — Updates, Lore, Design Notes',
  description:
    'The latest from Blocksworm: launch announcements, lore deep-dives, and design philosophy. New posts on a weekly cadence.',
};

const CATEGORY_COLOR: Record<string, string> = {
  announcement: 'text-gold-300',
  update: 'text-grove',
  lore: 'text-umbra',
  design: 'text-tide',
};

export default function NewsPage() {
  // Newest first
  const sorted = [...NEWS].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <section className="border-b border-gold-300/10">
        <div className="container-page py-12 sm:py-16 text-center">
          <p className="font-display text-xs sm:text-sm tracking-[0.4em] text-gold-300 mb-3">
            DISPATCHES FROM THE ASHES
          </p>
          <h1 className="heading-display text-4xl sm:text-6xl mb-4">
            <span className="bg-gradient-to-b from-gold-100 via-gold-300 to-gold-700 bg-clip-text text-transparent">
              News
            </span>
          </h1>
          <p className="text-text-muted max-w-2xl mx-auto text-sm sm:text-base">
            Game updates, lore deep-dives, and design notes from the team.
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="container-page max-w-3xl space-y-6">
          {sorted.map(post => (
            <Link
              key={post.slug}
              href={`/news/${post.slug}`}
              className="group block p-6 sm:p-8 rounded-2xl border-2 border-gold-300/15 bg-bg-mid transition-all hover:-translate-y-1 hover:border-gold-300/40 hover:shadow-[0_0_20px_rgba(255,213,61,0.15)]"
            >
              <div className="flex items-center gap-3 mb-3 text-xs font-display tracking-[0.2em] font-bold">
                <span className={CATEGORY_COLOR[post.category] ?? 'text-gold-300'}>
                  {NEWS_CATEGORY_LABELS[post.category]}
                </span>
                <span className="text-text-dim">·</span>
                <time className="text-text-dim font-mono">{post.date}</time>
              </div>
              <h2 className="heading-display text-2xl sm:text-3xl mb-3 group-hover:text-gold-300 transition-colors">
                {post.title}
              </h2>
              <p className="text-text-secondary leading-relaxed">{post.excerpt}</p>
              <p className="mt-4 text-xs font-display tracking-[0.2em] text-gold-300">
                READ MORE →
              </p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
