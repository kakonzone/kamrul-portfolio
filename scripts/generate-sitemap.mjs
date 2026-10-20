// Generate robots.txt and sitemap.xml from the data files. Run automatically
// from `npm run build` before vite build, and can be re-run any time via
// `npm run sitemap`.
//
// URLs come from VITE_SITE_URL. Section flags from profile.sections hide the
// matching routes from the sitemap.
//
// We don't import the data files via dynamic import because src/data/profile.js
// also imports a PNG asset that Node can't loader-parse. Instead we read the
// source files with a small parser that grabs the slug arrays + the
// `sections: { ... }` block.

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const SITE = (process.env.VITE_SITE_URL || 'https://example.com').replace(/\/$/, '');
const ROOT = process.cwd();

async function readText(rel) {
  return readFile(path.join(ROOT, rel), 'utf8');
}

// Extract the value of `sections: { ... }` from a profile data file. Returns
// { testimonials: boolean, blog: boolean }. Defaults: testimonials=false, blog=true.
function parseSectionFlags(src) {
  const m = src.match(/sections\s*:\s*\{([^}]*)\}/);
  if (!m) return { testimonials: false, blog: true, services: true };
  const inner = m[1];
  const read = (key, fallback) => {
    const r = new RegExp(`${key}\\s*:\\s*(true|false)`).exec(inner);
    return r ? r[1] === 'true' : fallback;
  };
  return {
    testimonials: read('testimonials', false),
    blog: read('blog', true),
    services: read('services', true),
  };
}

// Extract quoted-string values from inside an array literal. Naive but
// fine for our deterministic data files.
function extractSlugs(src, arrayName) {
  const idx = src.indexOf(arrayName);
  if (idx === -1) return [];
  const slice = src.slice(idx);
  const slugs = [];
  const re = /slug:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(slice))) slugs.push(m[1]);
  return slugs;
}

// Extract an array of {slug, date} from a data file with `posts = [...]`.
function extractPosts(src) {
  const idx = src.indexOf('posts');
  if (idx === -1) return [];
  const slice = src.slice(idx, src.indexOf('];', idx) + 1);
  const items = [];
  const blockRe = /\{[\s\S]*?\}/g;
  let m;
  while ((m = blockRe.exec(slice))) {
    const block = m[0];
    const slug = /slug:\s*['"]([^'"]+)['"]/.exec(block);
    const date = /date:\s*['"]([^'"]+)['"]/.exec(block);
    if (slug) items.push({ slug: slug[1], date: date ? date[1] : null });
  }
  return items;
}

function homeSections(flags) {
  // Kept for documentation of which sections are live. The sitemap itself no
  // longer emits `#anchor` entries — search engines de-index fragment URLs and
  // they add noise. Only real routes are listed.
  const enabled = ['about', 'projects', 'skills', 'resume', 'contact'];
  if (flags.blog !== false) enabled.push('blog');
  if (flags.services !== false) enabled.push('services');
  if (flags.testimonials) enabled.push('testimonials');
  return enabled;
}

async function main() {
  const out = path.resolve('public');
  await mkdir(out, { recursive: true });

  const [profileSrc, projectsSrc, blogSrc] = await Promise.all([
    readText('src/data/profile.js'),
    readText('src/data/projects.js'),
    readText('src/data/blog.js'),
  ]);

  const flags = parseSectionFlags(profileSrc);
  const projectSlugs = extractSlugs(projectsSrc, 'projects');
  const posts = extractPosts(blogSrc);
  const sections = homeSections(flags);
  const today = new Date().toISOString().split('T')[0];

  await writeFile(
    path.join(out, 'robots.txt'),
    `User-agent: *\nAllow: /\nDisallow:\nSitemap: ${SITE}/sitemap.xml\n`,
  );

  // Real routes only — no `#anchor` fragments. Anchors are de-indexed by
  // Google and add noise, so we list the home page, the blog index + posts
  // (when blog is enabled), and every project detail page.
  const urls = [];
  urls.push({ loc: `${SITE}/`, lastmod: today, priority: '1.0' });
  if (flags.blog !== false) {
    urls.push({ loc: `${SITE}/blog`, lastmod: today, priority: '0.8' });
    for (const post of posts) {
      urls.push({
        loc: `${SITE}/blog/${post.slug}`,
        lastmod: (post.date || today).split('T')[0],
        priority: '0.7',
      });
    }
  }
  for (const slug of projectSlugs) {
    urls.push({
      loc: `${SITE}/projects/${slug}`,
      lastmod: today,
      priority: '0.7',
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(
      (u) =>
        `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <priority>${u.priority}</priority>\n  </url>`,
    )
    .join('\n')}\n</urlset>\n`;
  await writeFile(path.join(out, 'sitemap.xml'), xml);

  console.log(`[sitemap] wrote public/sitemap.xml (${urls.length} urls) and public/robots.txt`);
  console.log(
    `[sitemap] flags: blog=${flags.blog !== false}, services=${flags.services !== false}, testimonials=${!!flags.testimonials}`,
  );
  console.log('[sitemap] no #anchor entries — real routes only');
}

main().catch((e) => {
  console.error('[sitemap] failed:', e);
  process.exit(1);
});
