// Inject the canonical URL, JSON-LD Person details, and base OG image URL into
// index.html before vite build. This makes the static HTML valid for crawlers
// that don't execute JS (Google's main crawler can, but Bing/DuckDuckGo/etc.
// often can't), and avoids a flash of empty meta on the first paint.
//
// Reads profile fields from src/data/profile.js via a tiny regex-based parser
// (same approach as generate-sitemap.mjs).

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SITE = (process.env.VITE_SITE_URL || 'https://example.com').replace(/\/$/, '');
const SITE_NAME = process.env.VITE_SITE_NAME || 'Kamrul · Portfolio';

function getBetween(src, key, fallback = '') {
  const re = new RegExp(`${key}\\s*:\\s*(['"\`])((?:(?!\\1).)*?)\\1`);
  const m = re.exec(src);
  return m ? m[2] : fallback;
}

async function main() {
  const [profileSrc, html] = await Promise.all([
    readFile(path.join(ROOT, 'src/data/profile.js'), 'utf8'),
    readFile(path.join(ROOT, 'index.html'), 'utf8'),
  ]);

  const name = getBetween(profileSrc, 'name', SITE_NAME);
  const eyebrow = getBetween(profileSrc, 'eyebrow', '');
  const tagline = getBetween(profileSrc, 'tagline', '');
  const desc =
    (tagline ? tagline.replace(/^PLACEHOLDER:\s*/, '') : '') ||
    `${eyebrow}`.replace(/^PLACEHOLDER:\s*/, '') ||
    'A developer portfolio.';
  const cleanDesc = desc.startsWith('PLACEHOLDER')
    ? `${name} — ${eyebrow || 'portfolio'}`
    : desc;

  let out = html;

  // %VITE_SITE_URL% substitutions
  out = out.split('%VITE_SITE_URL%').join(SITE);

  // Site name in JSON-LD
  out = out.replace(
    /<script id="ld-person" type="application\/ld\+json">([\s\S]*?)<\/script>/,
    (_, body) => {
      const json = JSON.parse(body);
      json.name = name;
      if (eyebrow && !eyebrow.startsWith('PLACEHOLDER')) json.jobTitle = eyebrow;
      json.url = `${SITE}/`;
      json.description = cleanDesc;
      return `<script id="ld-person" type="application/ld+json">\n${JSON.stringify(json, null, 2)}\n</script>`;
    },
  );

  // Descriptions always come from the hero tagline in profile.js, so editing the
  // tagline once updates the meta description, og:description and
  // twitter:description together. Previously they were only rewritten while
  // they still said PLACEHOLDER, which left a stale tagline baked in.
  const setDescription = (re) =>
    out.replace(re, (m) => m.replace(/content="[^"]*"/, `content="${escapeAttr(cleanDesc)}"`));

  out = setDescription(/<meta name="description" content="[^"]*"/);
  out = setDescription(/<meta property="og:description" content="[^"]*"/);
  out = setDescription(/<meta name="twitter:description" content="[^"]*"/);

  // Title — "Name | Eyebrow" when still the stock value, otherwise untouched.
  out = out.replace(
    /<title>([^<]*)<\/title>/,
    (m, current) => {
      if (current.includes('|')) return m; // already the real title
      return `<title>${escapeText(name)} | ${escapeText(eyebrow || 'Portfolio')}</title>`;
    },
  );

  await writeFile(path.join(ROOT, 'index.html'), out);
  console.log(`[inject-meta] wrote index.html with site=${SITE} name=${name}`);
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
function escapeText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

main().catch((e) => {
  console.error('[inject-meta] failed:', e);
  process.exit(1);
});
