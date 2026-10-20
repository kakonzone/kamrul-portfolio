import Card from '../ui/Card';
import CountUp from '../ui/CountUp';
import SectionHeading from '../ui/SectionHeading';
import { profile } from '../../data/profile';
import { deriveStats } from '../../data/stats';

export default function About() {
  // Counted from the real data files (education, training, projects, skills) so
  // the cards stay correct when the data is edited. Called inside the component
  // rather than at module scope so it can't run before the data modules it
  // depends on have finished evaluating.
  const stats = deriveStats();

  return (
    <section id="about" className="bg-bg-alt px-6 py-24">
      <div className="mx-auto max-w-content">
        <SectionHeading label="About" title={profile.aboutHeading} />

        <div className="mt-12 grid gap-12 md:grid-cols-2 md:gap-16">
          {/* Left: paragraphs and meta */}
          <div>
            <div className="space-y-5 text-base leading-relaxed text-muted">
              {profile.about.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>

            <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-line pt-8">
              {profile.meta.map((item) => (
                <div key={item.id}>
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">
                    {item.label}
                  </dt>
                  <dd className="mt-2 text-sm font-semibold text-fg">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Right: 2x2 stat cards */}
          <div className="grid grid-cols-2 gap-5">
            {stats.map((stat) => (
              <Card key={stat.id} className="p-6">
                <p className="text-3xl font-extrabold tracking-tight text-accent md:text-4xl">
                  <CountUp value={stat.value} />
                </p>
                <p className="mt-2 text-xs font-medium uppercase tracking-wider text-muted">
                  {stat.label}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}