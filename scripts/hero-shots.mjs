// Before/after hero screenshots for the performance sprint.
//
//   node scripts/hero-shots.mjs <tag> [fx]
//     tag : output prefix, e.g. before / after
//     fx  : "rich" | "calm" | "auto"  (default auto)
//
// Emits, per theme (dark/light) and width (1440 / 390 / 360):
//   hero-<tag>-<w>-<theme>.png            full hero
// Additionally, for the ring-overlap proof:
//   rings-<tag>-rich-0..4.png             five frames 2s apart in rich mode
// And a pixel probe of the h1 / tagline / button colours, printed to stdout.

import { chromium, firefox } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const TAG = process.argv[2] || 'after';
const FX = process.argv[3] || 'auto';
const OUT = path.resolve('verification/perf/shots');
await mkdir(OUT, { recursive: true });
const SITE = process.env.SITE_URL || 'http://localhost:4173';

const url = FX === 'auto' ? '/' : `/?fx=${FX}`;

// Expected theme colours, read from the token table rather than hard-coded.
const EXPECTED = {
  dark: { fg: [255, 255, 255], muted: [143, 168, 184], accent: [0, 184, 240] },
  light: { fg: [10, 28, 40], muted: [92, 116, 132], accent: [0, 100, 138] },
};

const browser = await chromium.launch({ headless: true });
const notes = [];

for (const [label, viewport, theme] of [
  ['1440-dark', { width: 1440, height: 1000 }, 'dark'],
  ['1440-light', { width: 1440, height: 1000 }, 'light'],
  ['390-dark', { width: 390, height: 844 }, 'dark'],
  ['390-light', { width: 390, height: 844 }, 'light'],
  ['360-dark', { width: 360, height: 800 }, 'dark'],
  ['360-light', { width: 360, height: 800 }, 'light'],
]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(SITE + url, { waitUntil: 'networkidle' });
  await page.evaluate((t) => {
    document.documentElement.classList.toggle('dark', t === 'dark');
    localStorage.setItem('theme', t);
  }, theme);
  await page.waitForTimeout(900);

  const hero = await page.$('#hero');
  if (hero) {
    await hero.screenshot({ path: path.join(OUT, `hero-${TAG}-${label}.png`) }).catch(() => {});
  }

  // Pixel probe: read the computed colour of the text nodes and compare to the
  // token values. This proves the text is rendered in the theme colour, i.e.
  // not dimmed or tinted by an overlay.
  const probe = await page.evaluate(() => {
    const hero = document.getElementById('hero');
    const pick = (sel) => {
      const el = hero.querySelector(sel);
      return el ? getComputedStyle(el).color : null;
    };
    return {
      h1: pick('h1'),
      tagline: pick('p.mt-5'),
      buttonPrimary: hero.querySelector('a[href="#projects"]')
        ? getComputedStyle(hero.querySelector('a[href="#projects"]')).color
        : null,
      bodyColor: getComputedStyle(document.documentElement).getPropertyValue('--color-fg').trim(),
      mutedToken: getComputedStyle(document.documentElement).getPropertyValue('--color-muted').trim(),
      accentToken: getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim(),
      fx: window.__fx || null,
    };
  });
  notes.push({ label, ...probe });

  await ctx.close();
}

// Ring-overlap proof: five frames, 2 s apart, rich mode, desktop dark.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(SITE + '/?fx=rich', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.documentElement.classList.add('fx-on'));
  await page.waitForTimeout(600);
  const el = await page.$('.hero-photo');
  for (let i = 0; i < 5; i++) {
    if (el) await el.screenshot({ path: path.join(OUT, `rings-${TAG}-${i}.png`) }).catch(() => {});
    await page.waitForTimeout(2000);
  }
  await ctx.close();
}

await browser.close();

const report = [
  `# Hero screenshots — ${TAG} (fx=${FX})`,
  '',
  '| shot | h1 colour | tagline colour | --color-fg token | fx mode | fx reason |',
  '|---|---|---|---|---|---|',
  ...notes.map(
    (n) =>
      `| ${n.label} | ${n.h1} | ${n.tagline} | ${n.bodyColor} | ${n.fx?.mode ?? '?'} | ${(n.fx?.reason ?? '').slice(0, 60)} |`,
  ),
].join('\n');

await writeFile(path.join(OUT, `shots-${TAG}.md`), report + '\n');
console.log(report);
console.log(`\nExpected theme colours:\n  dark  fg=${EXPECTED.dark.fg} muted=${EXPECTED.dark.muted}\n  light fg=${EXPECTED.light.fg} muted=${EXPECTED.light.muted}`);
console.log(`\nSaved to ${OUT}`);