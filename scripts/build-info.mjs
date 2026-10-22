// Single source of truth for the build identity and the site URL.
//
// SITE URL: every consumer (canonical link, og:url, og:image, twitter:image,
// JSON-LD url, sitemap.xml, robots.txt) reads VITE_SITE_URL through this
// module. If it is missing we do NOT silently fall back to example.com — we
// print a loud warning and set `siteUrlIsMissing`, which `npm run check:content`
// turns into a hard failure so a production build can never ship with the
// placeholder domain.
//
// BUILD ID: the build timestamp plus the commit hash, resolved in this order:
//   1. git rev-parse HEAD            (local builds)
//   2. CF_PAGES_COMMIT_SHA / WORKERS_CI_COMMIT_SHA / GITHUB_SHA / CI_COMMIT_SHA
//   3. "unknown"
// Cloudflare Workers builds may have no git binary, hence the env fallback.

import { execFileSync } from 'node:child_process';

export const siteUrlRaw = process.env.VITE_SITE_URL || '';
export const siteUrl = siteUrlRaw.replace(/\/+$/, '');
export const siteUrlIsMissing = siteUrl === '';

// Refuse to invent a domain. Anything that looks like a placeholder is treated
// as "missing" so it cannot be published. `example.dev` matters as much as the
// rest: index.html's canonical/og block was pinned to kamrul.example.dev, which
// this list did not recognise, so check:content stayed green on a placeholder.
const PLACEHOLDER_HOSTS = ['example.com', 'example.org', 'example.net', 'example.dev'];
export function siteUrlLooksLikePlaceholder(u = siteUrl) {
  try {
    const host = new URL(u).hostname.toLowerCase();
    return PLACEHOLDER_HOSTS.some((h) => host === h || host.endsWith('.' + h));
  } catch {
    return true; // unparseable == not a usable site URL
  }
}

export function resolveBuildInfo() {
  let commit = 'unknown';
  try {
    commit = execFileSync('git', ['rev-parse', 'HEAD'], {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
    if (!commit) commit = 'unknown';
  } catch {
    // No git in this environment (Cloudflare Workers build). Try CI variables.
    commit =
      process.env.CF_PAGES_COMMIT_SHA ||
      process.env.WORKERS_CI_COMMIT_SHA ||
      process.env.GITHUB_SHA ||
      process.env.CI_COMMIT_SHA ||
      'unknown';
  }
  const short = commit === 'unknown' ? 'unknown' : commit.slice(0, 7);
  const builtAt = new Date().toISOString();
  return { commit, short, builtAt, id: `${builtAt} · ${short}` };
}

export const build = resolveBuildInfo();

if (siteUrlIsMissing || siteUrlLooksLikePlaceholder()) {
  console.warn(
    '\n  ┌──────────────────────────────────────────────────────────────┐\n' +
      '  │ WARNING: VITE_SITE_URL is not set to a real domain           │\n' +
      `  │   value: ${siteUrlRaw || '(empty)'}`.padEnd(64) + '│\n' +
      '  │ Every canonical / og: / twitter: / JSON-LD / sitemap URL will  │\n' +
      '  │ be wrong. `npm run check:content` will FAIL until you set it. │\n' +
      '  │   example: VITE_SITE_URL=https://your-domain.dev npm run build│\n' +
      '  └──────────────────────────────────────────────────────────────┘\n',
  );
}