// Capture hero screenshots (dark + light, desktop + mobile) against the
// running preview server. Used for before/after comparison of the image
// optimization work.

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve('verification');
await mkdir(OUT, { recursive: true });
const SITE = process.env.SITE_URL || 'http://localhost:4173';
const TAG = process.env.SHOT_TAG || 'after';

const browser = await chromium.launch({ headless: true });

for (const [label, viewport, theme] of [
  ['desktop-dark', { width: 1440, height: 900 }, 'dark'],
  ['desktop-light', { width: 1440, height: 900 }, 'light'],
  ['mobile-dark', { width: 390, height: 844 }, 'dark'],
]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(SITE + '/', { waitUntil: 'networkidle' });
  await page.evaluate((t) => {
    document.documentElement.classList.toggle('dark', t === 'dark');
    localStorage.setItem('theme', t);
  }, theme);
  await page.waitForTimeout(900); // let the hero photo decode and rings settle

  await page.screenshot({
    path: path.join(OUT, `hero-${TAG}-${label}.png`),
    clip: { x: 0, y: 0, width: viewport.width, height: Math.min(viewport.height, 1000) },
  });

  // Also a tight crop of just the photo + rings so the mask/rings/blobs can be
  // compared pixel-for-pixel between builds.
  const box = await page.$eval('.hero-photo', (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }).catch(() => null);
  if (box && box.width > 0) {
    const pad = 70;
    await page.screenshot({
      path: path.join(OUT, `hero-${TAG}-${label}-photo.png`),
      clip: {
        x: Math.max(0, box.x - pad),
        y: Math.max(0, box.y - pad),
        width: Math.min(box.width + pad * 2, viewport.width),
        height: Math.min(box.height + pad * 2, viewport.height),
      },
    });
  }

  await ctx.close();
}

await browser.close();
console.log(`[hero-shots] wrote ${TAG} hero screenshots to ${OUT}`);