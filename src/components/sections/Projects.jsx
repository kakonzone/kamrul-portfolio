import { useMemo, useState } from 'react';
import SectionHeading from '../ui/SectionHeading';
import ProjectCard from '../ui/ProjectCard';
import { projects } from '../../data/projects';

const FILTER_ALL = 'All';

// Build the pills from the data so it stays in sync automatically.
function deriveCategories(items) {
  return Array.from(new Set(items.map((p) => p.category))).sort();
}

export default function Projects() {
  const categories = useMemo(() => deriveCategories(projects), []);
  const filters = useMemo(() => [FILTER_ALL, ...categories], [categories]);
  const [active, setActive] = useState(FILTER_ALL);

  const visible = active === FILTER_ALL
    ? projects
    : projects.filter((p) => p.category === active);

  return (
    <section id="projects" className="bg-bg px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading label="Projects" title="Things I've built" />

        {/* Filter pills */}
        <div className="mt-10 flex flex-wrap gap-3" role="group" aria-label="Filter projects by category">
          {filters.map((filter) => {
            const isActive = filter === active;
            return (
              <button
                key={filter}
                type="button"
                onClick={() => setActive(filter)}
                aria-pressed={isActive}
                className={`rounded-full border px-5 py-2 text-sm font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  isActive
                    ? 'border-accent bg-accent text-accent-ink'
                    : 'border-line bg-card text-muted hover:border-accent hover:text-accent'
                }`}
              >
                {filter}
              </button>
            );
          })}
        </div>

        {/* Grid */}
        <div
          className="projects-grid mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          data-filter={active}
        >
          {visible.map((project) => (
            <div key={project.id} className="project-fade">
              <ProjectCard project={project} />
            </div>
          ))}
        </div>

        {visible.length === 0 ? (
          <p className="mt-12 text-center text-sm text-muted">
            No projects match this filter yet.
          </p>
        ) : null}
      </div>
    </section>
  );
}