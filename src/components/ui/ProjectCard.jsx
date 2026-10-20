import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import Card from './Card';
import Tag from './Tag';

export default function ProjectCard({ project }) {
  const { slug, category, title, shortDescription, tech = [], image } = project;
  const liveUrl = project.liveUrl?.trim();

  return (
    <Card
      data-cursor="hover"
      className="group flex h-full flex-col overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:border-accent"
    >
      {/* Image */}
      <div className="aspect-video w-full overflow-hidden rounded-t-2xl bg-bg-alt">
        {image ? (
          <img
            src={image}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : null}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-fg">{title}</h3>
          <span className="shrink-0 rounded-md border border-line bg-bg-alt px-2 py-1 text-xs font-medium text-muted">
            {category}
          </span>
        </div>

        <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-muted">
          {shortDescription}
        </p>

        {tech.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {tech.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
        ) : null}

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
          {liveUrl ? (
            <a
              href={liveUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
            >
              Live Demo
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          ) : (
            <span aria-hidden="true" />
          )}

          <Link
            to={`/projects/${slug}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-fg transition-colors hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
          >
            View Details
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </Card>
  );
}