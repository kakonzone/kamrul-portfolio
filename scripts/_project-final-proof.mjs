// Item 1 evidence: the four project cards + one detail page, dark and light,
// on the BUILT site. Also prints every file in public/projects with its size and
// `du -sh public dist`, and asserts no PNG/JPG survives.
import { chromium } from 'playwright';
import { mkdir, readdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const SITE = process.env.SITE_URL || 'http://localhost:4173';
const OUT = path.resolve('verification/project-images-final');
await mkdir(OUT, { recursive: true });

console.log('== public/projects sizes ==');
const dir = path.resolve('public/projects');
const files = (await readdir(dir)).sort();
let total = 0;
for (const f of files) {
  const s = await stat(path.join(dir, f));
  total += s.size;
  console.log(`  ${f.padEnd(38)} ${(s.size / 1024).toFixed(1).padStart(8)} KB`);
}
console.log(`  ${'TOTAL'.padEnd(38)} ${(total / 1024).toFixed(1).padStart(8)} KB`);

const raster = files.filter((f) => /\.(png|jpe?g)$/i.test(f));
console.log(`\n  raster files remaining in public/projects: ${raster.length}${raster.length ? ' -> ' + raster.join(', ') : ''}`);

console.log('\n== du ==');
console.log('  ' + execFileSync('du', ['-sh', 'public']).toString().trim());
console.log('  ' + execFileSync('du', ['-sh', 'dist']).toString().trim());
const big = execFileSync('bash', ['-lc', "find public dist -type f -size +300k ! -name og-image.png -printf '%s %p\\n' 2>/dev/null | sort -rn | head -10"]).toString().trim();
console.log('\n== files > 300 KB (og-image.png exempt) ==');
console.log(big ? big.split('\n').map((l) => '  ' + l).join('\n') : '  (none)');

const browser = await chromium.launch({ headless: true });
for (const theme of ['dark', 'light']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: theme === 'dark' ? 'dark' : 'light' });
  const page = await ctx.newPage();

  await page.goto(SITE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate((t) => document.documentElement.classList.toggle('dark', t === 'dark'), theme);
  await page.evaluate(() => document.getElementById('projects')?.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.waitForTimeout(1500);

  const probe = await page.evaluate(() =>
    [...document.querySelectorAll('#projects img')].map((i) => ({
      src: i.getAttribute('src'),
      resolved: i.currentSrc.split('/').pop(),
      natural: i.naturalWidth ? `${i.naturalWidth}x${i.naturalHeight}` : 'NOT LOADED',
      complete: i.complete,
      srcset: (i.getAttribute('srcset') || '').slice(0, 60) + '…',
      loading: i.getAttribute('loading'),
      w: i.getAttribute('width'),
      h: i.getAttribute('height'),
      inPicture: !!i.closest('picture'),
    })),
  );
  console.log(`\n== cards (${theme}) ==`);
  for (const c of probe) {
    console.log(`  src=${c.src}  resolved=${c.resolved}  natural=${c.natural} complete=${c.complete}`);
    console.log(`    loading=${c.loading} w=${c.w} h=${c.h} <picture>=${c.inPicture}`);
    console.log(`    srcset=${c.srcset}`);
  }
  await page.screenshot({ path: path.join(OUT, `cards-${theme}.png`), fullPage: false });

  await page.goto(SITE + '/projects/lumio', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate((t) => document.documentElement.classList.toggle('dark', t === 'dark'), theme);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, `detail-${theme}.png`), fullPage: false });
  await page.evaluate(() => {
    const h = [...document.querySelectorAll('h2')].find((x) => /gallery/i.test(x.textContent || ''));
    h?.scrollIntoView({ block: 'start', behavior: 'instant' });
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, `detail-gallery-${theme}.png`), fullPage: false });
  await ctx.close();
}
await browser.close();
console.log(`\nscreenshots → ${OUT}`);