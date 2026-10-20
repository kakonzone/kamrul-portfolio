// Generates clean abstract gradient placeholders for the Projects grid.
// One per project slug in src/data/projects.js. No text — the card body
// carries the title and category.
//
// NOTE: these are placeholders. When you add a real screenshot, drop it at
// src/assets/projects/<slug>.webp, run `npm run optimize:images`, and point
// the project's `image` field at the generated public/ path.

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve('src/assets/projects');
await mkdir(OUT, { recursive: true });

const projects = [
  { slug: 'lumio', tone: '#0f3347', accent: '#00b8f0', angle: 135 },
  { slug: 'unitrack', tone: '#0a2942', accent: '#22d3ee', angle: 45 },
  { slug: 'fact-check-bd', tone: '#112e3a', accent: '#34d399', angle: 90 },
  { slug: 'crypto-coin-screener', tone: '#1a2440', accent: '#a78bfa', angle: 200 },
];

function svg({ tone, accent, angle }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
  <defs>
    <radialGradient id="a" cx="30%" cy="30%" r="65%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="b" cx="80%" cy="75%" r="55%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1600" height="900" fill="${tone}"/>
  <g transform="rotate(${angle} 800 450)">
    <ellipse cx="520" cy="330" rx="520" ry="380" fill="url(#a)"/>
    <ellipse cx="1080" cy="620" rx="460" ry="340" fill="url(#b)"/>
  </g>
</svg>
`;
}

for (const p of projects) {
  const file = path.join(OUT, `${p.slug}.svg`);
  await writeFile(file, svg(p), 'utf8');
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
}