import SectionHeading from '../ui/SectionHeading';
import { skillCategories, iconFor, brandColor, isThemeAware } from '../../data/skills';
// The animated tree is loaded straight from an external archive.org URL, so it is
// referenced by absolute URL and is never imported into the bundle — that also
// keeps it out of Vite's hashed asset pipeline and out of check:assets.
// Served at 960x540, 160 frames, 10s loop. No local copy is kept.

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

        {/* Two columns on wide screens: the skill groups on the left, the
            animated tree on the right, aligned to the top and sticky so it stays
            beside the chips while the taller chip column scrolls. Below 768px
            `.skills-layout` flips to a column so the tree sits under the chips —
            see the Skills layout block at the end of src/styles/index.css.

            The `mt-12` that used to sit on the wrapper around the groups now
            sits here instead, so the gap under the heading is unchanged. */}
        <div className="skills-layout mt-12">
          <div className="skills-left">
            <div className="flex flex-col gap-10">
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

          <div className="skills-right">
            {/* width/height give the browser an intrinsic aspect ratio so the box
                is reserved before the remote file arrives. `.skills-gif` already
                supplies the responsiveness (`width: 100%; height: auto` in both
                the desktop rule and the ≤768px override), so no inline sizing is
                needed. It is far below the fold, so it stays lazy.
                `referrerPolicy` keeps the visitor's URL out of the archive.org
                request logs. */}
            <img
              src="https://ia601902.us.archive.org/12/items/animating-tree-ezgif.com-enlarge-image/Animating_tree-ezgif.com-enlarge-image.webp"
              alt="Animated tree"
              width={960}
              height={540}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="skills-gif"
            />
          </div>
        </div>
      </div>
    </section>
  );
}