import { useState } from 'react';
import Card from '../ui/Card';
import SectionHeading from '../ui/SectionHeading';
import { experience } from '../../data/experience';
import { education } from '../../data/education';
import { formatDateRange } from '../../utils/dateRange';

const TABS = [
  { id: 'work', label: 'Work' },
  { id: 'education', label: 'Education' },
];

const SOURCES = { work: experience, education: education };

function Timeline({ items }) {
  return (
    <ol className="relative ml-3">
      {/* Vertical line */}
      <span
        aria-hidden="true"
        className="absolute left-1.5 top-2 bottom-2 w-px bg-line"
      />
      {items.map((item) => (
        <li key={item.id} className="relative pl-10 pb-8 last:pb-0">
          {/* Hollow circle marker */}
          <span
            aria-hidden="true"
            className="absolute left-0 top-2 inline-block h-3 w-3 rounded-full border-2 border-accent bg-bg"
          />
          <Card className="p-6 experience-fade">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <h3 className="text-base font-semibold text-fg">{item.title}</h3>
              <span className="shrink-0 text-xs font-medium text-muted">
                {formatDateRange(item.startDate, item.endDate)}
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold text-accent">{item.organization}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted">{item.description}</p>
          </Card>
        </li>
      ))}
    </ol>
  );
}

export default function Experience() {
  const [tab, setTab] = useState('work');
  const items = SOURCES[tab];

  return (
    <section id="experience" className="bg-bg px-6 py-24">
      <div className="mx-auto max-w-[1100px]">
        <SectionHeading label="Experience" title="Where I've been" />

        <div className="mt-12 flex flex-wrap gap-3" role="group" aria-label="Show work or education history">
          {TABS.map((t) => {
            const isActive = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-pressed={isActive}
                className={`rounded-full border px-5 py-2 text-sm font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  isActive
                    ? 'border-accent bg-accent text-accent-ink'
                    : 'border-line bg-card text-muted hover:border-accent hover:text-accent'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="mt-12" data-tab={tab}>
          <Timeline items={items} key={tab} />
        </div>
      </div>
    </section>
  );
}