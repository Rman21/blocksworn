import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { NEWS, NEWS_CATEGORY_LABELS } from '@/lib/news';

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return NEWS.map(p => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = NEWS.find(p => p.slug === slug);
  if (!post) return { title: 'Article Not Found' };
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.date,
    },
  };
}

const CATEGORY_COLOR: Record<string, string> = {
  announcement: 'text-gold-300',
  update: 'text-grove',
  lore: 'text-umbra',
  design: 'text-tide',
};

export default async function NewsArticle({ params }: Props) {
  const { slug } = await params;
  const post = NEWS.find(p => p.slug === slug);
  if (!post) notFound();

  const paragraphs = post.body.split('\n\n').map(p => p.trim()).filter(Boolean);
  const otherPosts = NEWS.filter(p => p.slug !== slug).slice(0, 2);

  return (
    <>
      <article className="py-12 sm:py-16">
        <div className="container-page max-w-3xl">
          <Link
            href="/news"
            className="inline-block mb-6 text-xs font-display tracking-[0.2em] text-text-muted hover:text-gold-300 transition-colors"
          >
            ← BACK TO NEWS
          </Link>
          <div className="flex items-center gap-3 mb-4 text-xs font-display tracking-[0.2em] font-bold">
            <span className={CATEGORY_COLOR[post.category] ?? 'text-gold-300'}>
              {NEWS_CATEGORY_LABELS[post.category]}
            </span>
            <span className="text-text-dim">·</span>
            <time className="text-text-dim font-mono">{post.date}</time>
          </div>
          <h1 className="heading-display text-4xl sm:text-5xl mb-6 leading-tight">
            <span className="bg-gradient-to-b from-gold-100 via-gold-300 to-gold-700 bg-clip-text text-transparent">
              {post.title}
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-text-secondary leading-relaxed mb-8 italic border-l-2 border-gold-300/40 pl-4">
            {post.excerpt}
          </p>
          <div className="prose-content space-y-5 text-base text-text-secondary leading-relaxed">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      </article>

      {otherPosts.length > 0 && (
        <section className="py-12 bg-bg-mid border-t border-gold-300/10">
          <div className="container-page max-w-3xl">
            <h2 className="heading-display text-2xl mb-6 text-center">More Dispatches</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {otherPosts.map(p => (
                <Link
                  key={p.slug}
                  href={`/news/${p.slug}`}
                  className="group block p-5 rounded-2xl border-2 border-gold-300/15 bg-bg-dark transition-all hover:-translate-y-1 hover:border-gold-300/40"
                >
                  <p className={`text-[10px] font-display tracking-[0.2em] font-bold mb-2 ${CATEGORY_COLOR[p.category] ?? 'text-gold-300'}`}>
                    {NEWS_CATEGORY_LABELS[p.category]}
                  </p>
                  <h3 className="font-display text-lg font-bold text-white mb-2 group-hover:text-gold-300 transition-colors leading-tight">
                    {p.title}
                  </h3>
                  <p className="text-xs text-text-muted line-clamp-2">{p.excerpt}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
