import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Check, Github } from 'lucide-react';
import Card from '../components/ui/Card';
import Tag from '../components/ui/Tag';
import NotFound from './NotFound';
import { projectBySlug, nextProjectAfter } from '../data/projects';
import useDocumentMeta from '../hooks/useDocumentMeta';

export default function ProjectDetail() {
  const { slug } = useParams();
  const project = projectBySlug(slug);

  useDocumentMeta({
    title: project?.title?.replace(/^PLACEHOLDER:\s*/, '') || 'Project not found',
    description: project?.shortDescription?.replace(/^PLACEHOLDER:\s*/, '') || 'Project',
    canonical: project ? `/projects/${project.slug}` : undefined,
    ogImage: project?.image || '/og-image.png',
    noindex: !project,
  });

  if (!project) {
    return <NotFound />;
  }

  const liveUrl = project.liveUrl?.trim();
  const repoUrl = project.repoUrl?.trim();
  const next = nextProjectAfter(project);

  return (
    <main id="main-content" className="bg-bg px-6 py-20">
      <div className="mx-auto max-w-[1100px]">
        <Link
          to="/#projects"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to projects
        </Link>

        {/* Hero image */}
        <div className="mt-8 overflow-hidden rounded-2xl border border-line">
          {project.image ? (
            <img src={project.image} alt={project.title} className="aspect-video w-full object-cover" />
          ) : null}
        </div>

        {/* Title row */}
        <header className="mt-10 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-fg md:text-4xl">
              {project.title}
            </h1>
            <span className="mt-3 inline-block rounded-md border border-line bg-card px-2 py-1 text-xs font-medium text-muted">
              {project.category}
            </span>
          </div>

          <div className="flex flex-wrap gap-3">
            {liveUrl ? (
              <a
                href={liveUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Live Demo
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            ) : null}
            {repoUrl ? (
              <a
                href={repoUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-2 rounded-lg border border-line bg-transparent px-5 py-2.5 text-sm font-semibold text-fg transition-colors hover:border-accent hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Source Code
                <Github size={16} aria-hidden="true" />
              </a>
            ) : null}
          </div>
        </header>

        {/* Technologies used */}
        {project.tech?.length ? (
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-muted">
              Technologies used
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {project.tech.map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </div>
          </section>
        ) : null}

        {/* Overview */}
        <section className="mt-10 max-w-3xl">
          <h2 className="sr-only">About this project</h2>
          <p className="text-base leading-relaxed text-muted">{project.longDescription}</p>
        </section>

        {/* Features */}
        {project.features?.length ? (
          <section className="mt-12">
            <h2 className="text-xl font-bold text-fg">Key features</h2>
            <ul className="mt-5 space-y-3">
              {project.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-muted">
                  <Check
                    size={18}
                    className="mt-0.5 shrink-0 text-accent"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Gallery */}
        {project.gallery?.length ? (
          <section className="mt-12">
            <h2 className="text-xl font-bold text-fg">Gallery</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {project.gallery.map((src, i) => (
                <div key={i} className="overflow-hidden rounded-2xl border border-line">
                  <img src={src} alt={`${project.title} screenshot ${i + 1}`} className="w-full object-cover" />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Next project */}
        {next && next.id !== project.id ? (
          <Card className="mt-16 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
              Next project
            </p>
            <Link
              to={`/projects/${next.slug}`}
              className="mt-3 inline-flex items-center gap-2 text-lg font-semibold text-fg transition-colors hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
            >
              {next.title}
              <span aria-hidden="true">→</span>
            </Link>
          </Card>
        ) : null}
      </div>
    </main>
  );
}