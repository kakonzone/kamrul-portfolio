import SectionHeading from '../ui/SectionHeading';
import { skillCategories, iconFor, brandColor, isThemeAware } from '../../data/skills';

function SkillChip({ name, iconKey }) {
  const Icon = iconFor(iconKey);
  const color = brandColor(iconKey);
  const themeAware = isThemeAware(iconKey);
  // For brand colors that look bad on one theme (dark on dark or light on light),
  // let CSS pick --color-fg in the current theme via inline `color`.
  const colorStyle = themeAware ? { color: 'var(--color-fg)' } : { color };
  return (
    <span
      className="inline-flex items-center gap-2.5 rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-fg transition-colors duration-200 hover:border-accent"
    >
      <Icon size={16} className="shrink-0" aria-hidden="true" style={colorStyle} />
      <span>{name}</span>
    </span>
  );
}

export default function Skills() {
  return (
    <section id="skills" className="bg-bg-alt px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading label="Skills" title="What I work with" />

        <div className="mt-12 flex flex-col gap-10">
          {skillCategories.map((category) => (
            <div key={category.id}>
              <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-muted">
                {category.title}
              </p>
              <div className="flex flex-wrap gap-3">
                {category.skills.map((skill) => (
                  <SkillChip key={skill.id} name={skill.name} iconKey={skill.id} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}