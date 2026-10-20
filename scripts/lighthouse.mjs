// Run Lighthouse against the preview server for the main routes, mobile and
// desktop. Writes JSON + a summary table to verification/.

import { mkdir, writeFile } from 'node:fs/promises';
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import path from 'node:path';

const OUT = path.resolve('verification');
await mkdir(OUT, { recursive: true });
const SITE = process.env.SITE_URL || 'http://localhost:4173';

const ROUTES = [
  ['/', 'home'],
  ['/blog', 'blog'],
  ['/projects/lumio', 'project'],
];

// Point Lighthouse at the Chromium that Playwright installed (there is no
// system Chrome on this host). CHROME_PATH can override.
const CHROME_PATH =
  process.env.CHROME_PATH ||
  '/home/kakonzone/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';

const chrome = await launch({
  chromePath: CHROME_PATH,
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage'],
});

const lines = ['# Lighthouse report'];
lines.push(`Target: ${SITE}`);
lines.push('');

const rows = [];

async function run(url, label, formFactor) {
  const opts = {
    port: chrome.port,
    output: 'json',
    logLevel: 'error',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
  };
  if (formFactor === 'mobile') {
    opts.formFactor = 'mobile';
    opts.screenEmulation = { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false };
    opts.throttling = {
      rttMs: 150,
      throughputKbps: 1638.4,
      cpuSlowdownMultiplier: 4,
      requestLatencyMs: 562.5,
      downloadThroughputKbps: 1474.56,
      uploadThroughputKbps: 675,
    };
  } else {
    opts.formFactor = 'desktop';
    opts.screenEmulation = { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false };
    opts.throttling = { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1, requestLatencyMs: 0, downloadThroughputKbps: 0, uploadThroughputKbps: 0 };
  }

  const runnerResult = await lighthouse(url, opts);
  const lhr = runnerResult.lhr;
  const cats = lhr.categories;
  const a = lhr.audits;

  const row = {
    label,
    formFactor,
    url,
    performance: Math.round(cats.performance.score * 100),
    accessibility: Math.round(cats.accessibility.score * 100),
    bestPractices: Math.round(cats['best-practices'].score * 100),
    seo: Math.round(cats.seo.score * 100),
    lcpMs: a['largest-contentful-paint']?.numericValue ?? null,
    fcpMs: a['first-contentful-paint']?.numericValue ?? null,
    cls: a['cumulative-layout-shift']?.numericValue ?? null,
    tbt: a['total-blocking-time']?.numericValue ?? null,
    speedIndex: a['speed-index']?.numericValue ?? null,
  };
  rows.push(row);

  await writeFile(
    path.join(OUT, `lighthouse-${label}-${formFactor}.json`),
    JSON.stringify(lhr, null, 2),
  );
  return row;
}

for (const [route, label] of ROUTES) {
  for (const formFactor of ['mobile', 'desktop']) {
    try {
      const r = await run(SITE + route, label, formFactor);
      lines.push(
        `## ${label} (${formFactor}) — ${r.url}\n` +
          `- Performance: ${r.performance}\n` +
          `- Accessibility: ${r.accessibility}\n` +
          `- Best Practices: ${r.bestPractices}\n` +
          `- SEO: ${r.seo}\n` +
          `- LCP: ${r.lcpMs?.toFixed(0)} ms\n` +
          `- FCP: ${r.fcpMs?.toFixed(0)} ms\n` +
          `- CLS: ${r.cls}\n` +
          `- TBT: ${r.tbt?.toFixed(0)} ms\n` +
          `- Speed Index: ${r.speedIndex?.toFixed(0)} ms\n`,
      );
    } catch (e) {
      lines.push(`## ${label} (${formFactor})\nFAILED: ${String(e).split('\n')[0]}\n`);
    }
  }
}

await chrome.kill();

lines.push('## Targets');
lines.push('| route | form | Perf | A11y | Best | SEO | LCP | CLS |');
lines.push('|---|---|---|---|---|---|---|---|');
for (const r of rows) {
  lines.push(
    `| ${r.label} | ${r.formFactor} | ${r.performance} | ${r.accessibility} | ${r.bestPractices} | ${r.seo} | ${r.lcpMs?.toFixed(0)}ms | ${r.cls} |`,
  );
}
lines.push('');
lines.push(
  '## Overall');
const worst = {
  performance: Math.min(...rows.map((r) => r.performance)),
  accessibility: Math.min(...rows.map((r) => r.accessibility)),
  bestPractices: Math.min(...rows.map((r) => r.bestPractices)),
  seo: Math.min(...rows.map((r) => r.seo)),
};
lines.push(`- worst Performance: ${worst.performance} (target >= 90)`);
lines.push(`- worst Accessibility: ${worst.accessibility} (target >= 95)`);
lines.push(`- worst Best Practices: ${worst.bestPractices} (target >= 95)`);
lines.push(`- worst SEO: ${worst.seo} (target >= 95)`);
lines.push('');
lines.push(
  worst.performance >= 90 && worst.accessibility >= 95 && worst.bestPractices >= 95 && worst.seo >= 95
    ? '**Result: ALL TARGETS MET**'
    : '**Result: SOME TARGETS MISSED**',
);

const report = lines.join('\n');
console.log(report);
await writeFile(path.join(OUT, 'lighthouse.log'), report);