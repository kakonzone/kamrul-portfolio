import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import BlogCard from '../components/ui/BlogCard';
import { posts, allTags } from '../data/blog';
import useDocumentMeta from '../hooks/useDocumentMeta';

const FILTER_ALL = 'All';

export default function BlogList() {
  useDocumentMeta({
    title: 'Blog',
    description: 'Notes on shipping Flutter apps, testing, and mobile engineering.',
    canonical: '/blog',
    ogImage: '/og-image.png',
  });
  const tags = useMemo(() => allTags(), []);
  const filters = useMemo(() => [FILTER_ALL, ...tags], [tags]);
  const [active, setActive] = useState(FILTER_ALL);

  const visible = active === FILTER_ALL
    ? posts
    : posts.filter((p) => p.tags?.includes(active));

  return (
    <main id="main-content" className="bg-bg px-6 py-20">
      <div className="mx-auto max-w-[1100px]">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back home
        </Link>

        <header className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Blog</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-fg md:text-4xl">
            All posts
          </h1>
        </header>

        {filters.length > 1 ? (
          <div className="mt-10 flex flex-wrap gap-3" role="group" aria-label="Filter posts by tag">
            {filters.map((f) => {
              const isActive = f === active;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setActive(f)}
                  aria-pressed={isActive}
                  className={`rounded-full border px-5 py-2 text-sm font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    isActive
                      ? 'border-accent bg-accent text-accent-ink'
                      : 'border-line bg-card text-muted hover:border-accent hover:text-accent'
                  }`}
                >
                  {f}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((post) => (
            <BlogCard key={post.id} post={post} headingLevel="h2" />
          ))}
        </div>

        {visible.length === 0 ? (
          <p className="mt-12 text-sm text-muted">No posts match this tag yet.</p>
        ) : null}
      </div>
    </main>
  );
}