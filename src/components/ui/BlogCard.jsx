import { Link } from 'react-router-dom';
import { formatDate } from '../../data/blog';

export default function BlogCard({ post, headingLevel: Heading = 'h3' }) {
  return (
    <Link
      to={`/blog/${post.slug}`}
      data-cursor="hover"
      className="group block h-full overflow-hidden rounded-2xl border border-line bg-card transition-all duration-200 hover:-translate-y-1 hover:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {post.image ? (
        <div className="aspect-video w-full overflow-hidden bg-bg-alt">
          <img
            src={post.image}
            alt={post.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </div>
      ) : null}

      <div className="p-6">
        {post.tags?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {post.tags.map((t) => (
              <span
                key={t}
                className="rounded-md px-2 py-0.5 text-[11px] font-medium text-accent"
                style={{ backgroundColor: 'color-mix(in srgb, var(--color-accent) 12%, transparent)' }}
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}

        <Heading className="mt-4 line-clamp-3 text-base font-semibold leading-snug text-fg">
          {post.title}
        </Heading>

        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted">
          {post.excerpt}
        </p>

        <p className="mt-5 text-xs text-muted">
          {formatDate(post.date)}{post.readTime ? ` · ${post.readTime}` : ''}
        </p>
      </div>
    </Link>
  );
}