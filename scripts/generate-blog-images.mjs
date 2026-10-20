// Generates 4 blog cover images (1600x900) with a soft accent gradient and
// the post title centered. Replace with real screenshots later.

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve('src/assets/blog');
await mkdir(OUT, { recursive: true });

const posts = [
  { slug: 'flutter-state-management-in-2026', title: 'Flutter state in 2026', tone: '#0f3347', accent: '#00b8f0' },
  { slug: 'supabase-auth-the-honest-version', title: 'Supabase auth, honestly', tone: '#0a2942', accent: '#22d3ee' },
  { slug: 'a-release-checklist-i-actually-use', title: 'Release checklist', tone: '#112e3a', accent: '#34d399' },
  { slug: 'the-mobile-testing-pyramid', title: 'The mobile testing pyramid', tone: '#1d2540', accent: '#a78bfa' },
];

function svg({ title, tone, accent }) {
  const safeTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${tone}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" fill="${tone}"/>
  <rect width="1600" height="900" fill="url(#g)"/>
  <g font-family="Inter, system-ui, sans-serif" fill="#ffffff">
    <text x="80" y="460" font-size="64" font-weight="800" fill-opacity="0.95">${safeTitle}</text>
    <text x="80" y="520" font-size="22" font-weight="500" fill="${accent}" fill-opacity="0.85">PLACEHOLDER: blog post cover</text>
  </g>
</svg>`;
}

for (const p of posts) {
  await writeFile(path.join(OUT, `${p.slug}.svg`), svg(p));
}
console.log('Wrote', posts.length, 'blog covers to', OUT);