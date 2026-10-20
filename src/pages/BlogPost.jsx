import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import BlogBody from '../components/ui/BlogBody';
import NotFound from './NotFound';
import { postBySlug, nextPostAfter, formatDate } from '../data/blog';
import useDocumentMeta from '../hooks/useDocumentMeta';

export default function BlogPost() {
  const { slug } = useParams();
  const post = postBySlug(slug);

  useDocumentMeta({
    title: post?.title?.replace(/^PLACEHOLDER:\s*/, '') || 'Post not found',
    description: post?.excerpt?.replace(/^PLACEHOLDER:\s*/, '') || 'Blog post',
    canonical: post ? `/blog/${post.slug}` : undefined,
    ogImage: post?.image || '/og-image.png',
    noindex: !post,
  });

  if (!post) {
    return <NotFound />;
  }

  const next = nextPostAfter(post);

  return (
    <main id="main-content" className="bg-bg px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to all posts
        </Link>

        <header className="mt-8">
          {post.tags?.length ? (
            <div className="flex flex-wrap gap-2">
              {post.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-md px-2 py-1 text-xs font-medium text-accent"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--color-accent) 12%, transparent)' }}
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-fg md:text-4xl">
            {post.title}
          </h1>
          <p className="mt-3 text-sm text-muted">
            {formatDate(post.date)}{post.readTime ? ` · ${post.readTime}` : ''}
          </p>
        </header>

        {post.image ? (
          <div className="mt-10 overflow-hidden rounded-2xl border border-line">
            <img src={post.image} alt={post.title} className="aspect-video w-full object-cover" />
          </div>
        ) : null}

        <article className="mt-10">
          <BlogBody blocks={post.body} />
        </article>

        {next && next.id !== post.id ? (
          <div className="mt-16 border-t border-line pt-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Next post</p>
            <Link
              to={`/blog/${next.slug}`}
              className="mt-3 inline-flex items-center gap-2 text-lg font-semibold text-fg transition-colors hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
            >
              {next.title}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}