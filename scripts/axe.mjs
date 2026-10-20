// Run axe-core accessibility audit across the main routes in dark and light
// theme, in Chromium and Firefox. Reports violations by impact level.
// Exits non-zero if any serious or critical violations remain.

import { chromium, firefox } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve('verification');
await mkdir(OUT, { recursive: true });
const SITE = process.env.SITE_URL || 'http://localhost:4173';

const ROUTES = [
  ['/', 'home'],
  ['/blog', 'blog-list'],
  ['/blog/a-release-checklist-i-actually-use', 'blog-post'],
  ['/projects/lumio', 'project-detail'],
  ['/definitely-not-a-real-page', 'not-found'],
];

async function audit(browserType, engineName, theme) {
  const browser = await browserType.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  const results = [];
  for (const [route, label] of ROUTES) {
    await page.goto(SITE + route, { waitUntil: 'networkidle' });
    // Set the theme explicitly on <html> before axe runs.
    await page.evaluate((t) => {
      document.documentElement.classList.toggle('dark', t === 'dark');
      localStorage.setItem('theme', t);
    }, theme);
    await page.waitForTimeout(350);

    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();

    results.push({
      route,
      label,
      violations: axe.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.length,
        sample: v.nodes.slice(0, 2).map((n) => n.html.slice(0, 160)),
      })),
      passes: axe.passes.length,
      incomplete: axe.incomplete.length,
    });
  }

  await ctx.close();
  await browser.close();
  return { engineName, theme, results, pageErrors };
}

const lines = ['# Accessibility audit — axe-core'];
let serious = 0;
let critical = 0;

for (const [type, name] of [[chromium, 'chromium'], [firefox, 'firefox']]) {
  for (const theme of ['dark', 'light']) {
    let r;
    try {
      r = await audit(type, name, theme);
    } catch (e) {
      lines.push(`\n## ${name}/${theme}\nFATAL: ${String(e).split('\n')[0]}\n`);
      critical++;
      continue;
    }
    lines.push(`\n## ${name} · ${theme}`);
    if (r.pageErrors.length) {
      lines.push(`  page errors: ${r.pageErrors.join(' | ')}`);
      critical += r.pageErrors.length;
    }
    for (const res of r.results) {
      const crit = res.violations.filter((v) => v.impact === 'critical');
      const ser = res.violations.filter((v) => v.impact === 'serious');
      critical += crit.length;
      serious += ser.length;
      const badge = res.violations.length === 0 ? 'CLEAN' : `${res.violations.length} violations`;
      lines.push(`  ${res.route} (${res.label}): ${badge} · passes=${res.passes} incomplete=${res.incomplete}`);
      for (const v of res.violations) {
        lines.push(
          `    - [${v.impact}] ${v.id}: ${v.help} (${v.nodes} node${v.nodes === 1 ? '' : 's'})`,
        );
        for (const s of v.sample) lines.push(`        ${s}`);
      }
    }
  }
}

lines.push('');
lines.push(`## Summary`);
lines.push(`- serious violations: ${serious}`);
lines.push(`- critical violations: ${critical}`);
lines.push('');
lines.push(
  critical === 0 && serious === 0
    ? '**Result: ALL PASS — zero serious/critical**'
    : `**Result: FAIL — ${serious} serious, ${critical} critical**`,
);

const report = lines.join('\n');
console.log(report);
await writeFile(path.join(OUT, 'axe-audit.log'), report);
process.exit(critical === 0 && serious === 0 ? 0 : 1);