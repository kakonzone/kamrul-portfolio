import {
  Smartphone,
  Server,
  Code2,
  Globe,
  Cpu,
  Wrench,
  ChevronRight,
} from 'lucide-react';
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
    <span className="skills-chip">
      <Icon size={14} className="shrink-0" aria-hidden="true" style={colorStyle} />
      <span>{name}</span>
    </span>
  );
}

// Maps a category id to its `grid-template-areas` name in `.skills-layout`.
// The desktop grid places cards in columns 1–2 and the tree in column 3:
//   row 1  mobile  lang    tree
//   row 2  backend cs      tree
//   row 3  web     cs      tree
//   row 4  tools   tools   tree
// Placement is explicit rather than by DOM order, so the file order (mobile,
// backend, languages, web, CS, tools) stays the reading and tab order.
// See the Skills layout block in src/styles/index.css.
const GRID_AREA = {
  'mobile-cross-platform': 'mobile',
  'backend-apis': 'backend',
  'programming-languages': 'lang',
  'web-development': 'web',
  'cs-fundamentals': 'cs',
  'software-development': 'tools',
};

// One icon per category card, in the accent color. The categories carry no icon
// of their own in the data, so these are picked to match what each group holds.
// Decorative: the heading text already names the group, so every icon here is
// aria-hidden.
const CATEGORY_ICON = {
  'mobile-cross-platform': Smartphone,
  'backend-apis': Server,
  'programming-languages': Code2,
  'web-development': Globe,
  'cs-fundamentals': Cpu,
  'software-development': Wrench,
};

export default function Skills() {
  return (
    <section id="skills" className="bg-bg-alt px-6 py-24">
      <div className="mx-auto max-w-6xl skills-container">
        {/* The header is built inline instead of with the shared <SectionHeading>,
            because seven other sections use that component and restyling it there
            would restyle the whole page. The accent rule before "SKILLS" is a
            ::before pseudo-element in `.skills-eyebrow` (see the Skills header
            block in src/styles/index.css), and the accent word is a <span> INSIDE
            the single <h2> — so the section still has exactly one level-2 heading. */}
        <div className="skills-heading">
          <p className="skills-eyebrow">Skills</p>
          <h2 className="text-3xl font-bold tracking-tight text-fg md:text-4xl">
            What I <span className="text-accent">work</span> with
          </h2>
          <p className="skills-subtitle">
            The tools and technologies I use to build modern, scalable and real-world applications.
          </p>
        </div>

        {/* `.skills-layout` is a three-column CSS grid: the six category groups
            are direct children placed by their `skills-group--*` modifier (grid
            columns 1–2), and the tree is the last child, spanning every row in
            column 3. Grouping and spacing only — the chips keep their exact
            markup, class names, icons and brand colors, and are not restyled
            here.

            The `mt-12` on this wrapper is unchanged, so the gap under the
            heading is unchanged. */}
        <div className="skills-layout mt-12">
          {skillCategories.map((category) => {
            const Icon = CATEGORY_ICON[category.id] ?? Code2;
            return (
              <div
                key={category.id}
                className={`skills-group skills-group--${GRID_AREA[category.id]}`}
              >
                <div className="skills-card-head">
                  <span className="skills-card-icon">
                    <Icon size={28} aria-hidden="true" />
                  </span>
                  <div className="skills-card-headings">
                    <h3 className="skills-group-title">{category.title}</h3>
                    <p className="skills-group-desc">{category.description}</p>
                  </div>
                  {/* Decorative affordance only — aria-hidden, not a button, no
                      click handler: the card has nothing to expand or navigate to. */}
                  <ChevronRight className="skills-card-chevron" size={18} aria-hidden="true" />
                </div>
                <div className="skills-chips">
                  {category.skills.map((skill) => (
                    <SkillChip key={skill.id} name={skill.name} iconKey={skill.id} />
                  ))}
                </div>
              </div>
            );
          })}

          <div className="skills-tree">
            {/* The <img> IS the 520:350 box: `aspect-ratio` plus a `max-width`
                cap means it is exactly 520x350 wherever 520px of column is
                available and shrinks with the same shape everywhere else. No
                transform, no fixed height, no max-height — nothing that could
                shift or squeeze it. Every attribute below is unchanged. */}
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

            {/* One phrase per <br> so the three lines hold at every width. The
                2px accent bar and the muted-white color are both in CSS. */}
            <blockquote className="skills-tree-quote">
              Better tools.
              <br />
              Better code.
              <br />
              Bigger dreams.
            </blockquote>

            {/* Decorative only: a hairline with an accent dot. Carries no
                information, so it is hidden from assistive tech. */}
            <div className="skills-tree-rule" aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
}