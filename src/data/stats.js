import { education } from './education';
import { training } from './training';
import { projects } from './projects';
import { skillGroups } from './skills';

/**
 * Derive the About stat cards from the real data files so they stay correct
 * when you edit education.js, training.js, projects.js or skills.js.
 * No invented numbers — every value below is counted or dated.
 */

// "Jun 2022 to Jun 2026" -> 4 whole years (2026 - 2022).
function yearsFromIsoRange(entries) {
  let total = 0;
  for (const e of entries) {
    if (!e?.startDate || !e?.endDate) continue;
    const sy = Number(String(e.startDate).slice(0, 4));
    const ey = Number(String(e.endDate).slice(0, 4));
    if (Number.isFinite(sy) && Number.isFinite(ey) && ey >= sy) total += ey - sy;
  }
  return total;
}

// Count the chips inside the "Programming Languages" skill group.
function countSkillGroup(title) {
  const group = skillGroups.find((g) => g.title === title);
  return group?.skills?.length ?? 0;
}

export function deriveStats() {
  return [
    {
      id: 'cse-study',
      value: String(yearsFromIsoRange(education)),
      label: 'Years of CSE study',
    },
    {
      id: 'training',
      value: String(training.length),
      label: 'Training programs',
    },
    {
      id: 'projects',
      value: String(projects.length),
      label: 'Projects built',
    },
    {
      id: 'languages',
      value: String(countSkillGroup('Programming Languages')),
      label: 'Languages',
    },
  ];
}

export default deriveStats;