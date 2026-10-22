// Inject the canonical URL, JSON-LD Person details, and base OG image URL into
// index.html before vite build. This makes the static HTML valid for crawlers
// that don't execute JS (Google's main crawler can, but Bing/DuckDuckGo/etc.
// often can't), and avoids a flash of empty meta on the first paint.
//
// Reads profile fields from src/data/profile.js via a tiny regex-based parser
// (same approach as generate-sitemap.mjs).

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { siteUrl, siteUrlRaw, siteUrlIsMissing, siteUrlLooksLikePlaceholder, build } from './build-info.mjs';

const ROOT = process.cwd();
const SITE = siteUrlIsMissing ? 'https://example.com' : siteUrl;
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

  // Single source of truth: replace every hardcoded absolute URL with the one
  // derived from VITE_SITE_URL. This covers canonical, og:url, og:image,
  // twitter:image and the JSON-LD url in one sweep, so they can never drift.
  out = out
    .split('%VITE_SITE_URL%')
    .join(SITE)
    // Match EVERY reserved example host, with or without a subdomain. The old
    // pattern listed only `kamrul.example.com` and `example.com`, so the
    // `https://kamrul.example.dev/` that index.html actually used was never
    // matched and survived into the build — canonical, og:url, og:image and
    // twitter:image stayed pinned to the placeholder while JSON-LD and the
    // sitemap pointed somewhere else. One pattern now, so they cannot drift.
    // The lookbehind stops a real host that merely ends in those letters
    // (`myexample.com`) from being swallowed.
    .replace(
      /(?<![\w.@-])https?:\/\/(?:[a-z0-9-]+\.)*example\.(?:com|org|net|dev)\b/gi,
      SITE,
    );

  // Build identity: an HTML comment (always) plus a <meta name="build"> that
  // the footer reads when the page is loaded with ?debug=1. This is how you can
  // tell a cached older deploy from the current one on a phone.
  //
  // IMPORTANT: this script rewrites index.html in place and runs on every
  // build, so it must REPLACE any previously injected block rather than append.
  // Otherwise repeated builds stack duplicate meta tags and grow the file.
  out = out
    // drop previously injected blocks (script comment + meta + inline script)
    .replace(/\n\s*<!-- build:[\s\S]*?-->\n/g, '\n')
    .replace(/\n\s*<meta name="build" content="[^"]*"\s*\/>\n/g, '\n')
    .replace(/\n\s*<script>window\.__BUILD__=[^<]*?;<\/script>\n/g, '\n');

  out = out.replace(
    /<\/head>/,
    `\n  <!-- build: ${build.builtAt} · commit ${build.commit} -->\n` +
      `  <meta name="build" content="${escapeAttr(`${build.builtAt}|${build.commit}`)}" />\n` +
      `  <script>window.__BUILD__={builtAt:${JSON.stringify(build.builtAt)},commit:${JSON.stringify(build.commit)},short:${JSON.stringify(build.short)}};</script>\n` +
      `</head>`,
  );

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
  const urlState =
    siteUrlIsMissing || siteUrlLooksLikePlaceholder() ? ' (WARNING: VITE_SITE_URL not set!)' : '';
  console.log(`[inject-meta] site=${SITE}${urlState}`);
  console.log(`[inject-meta] build=${build.builtAt} commit=${build.short}`);
  console.log('[inject-meta] wrote canonical, og:url, og:image, twitter:image and JSON-LD url from VITE_SITE_URL');
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
