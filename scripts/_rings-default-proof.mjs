// Item 2 evidence: hero rings must rotate by DEFAULT (no URL flags).
//
//   1. five screenshots 3s apart in the DEFAULT state, proving the ring
//      transform keeps changing (overlap pattern shifts)
//   2. the same under prefers-reduced-motion: reduce, proving they hold still
//   3. a CDP trace of the hero in the default state, reporting the
//      Style/Layout/Paint/Raster/Composite totals per animation
//
// Run: node scripts/_rings-default-proof.mjs

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const SITE = process.env.SITE_URL || 'http://localhost:4173';
const OUT = path.resolve('verification/perf/rings-default');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });

// ---------- 1. five screenshots, 3s apart, DEFAULT (no flags) ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(SITE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);

  const state = await page.evaluate(() => ({
    fx: window.__fx || null,
    fxOn: document.documentElement.classList.contains('fx-on'),
    ringsStatic: document.documentElement.classList.contains('fx-rings-static'),
  }));
  console.log('== DEFAULT state (no URL flags) ==');
  console.log('  window.__fx      :', JSON.stringify(state.fx));
  console.log('  html.fx-on       :', state.fxOn);
  console.log('  html.fx-rings-static:', state.ringsStatic);
  console.log('');

  const transforms = [];
  for (let i = 0; i < 5; i++) {
    const t = await page.evaluate(() =>
      [...document.querySelectorAll('.hero-rings i')].map(
        (el) => getComputedStyle(el).transform,
      ),
    );
    transforms.push(t);
    await page.screenshot({
      path: path.join(OUT, `rings-default-${i}.png`),
      clip: { x: 740, y: 100, width: 600, height: 600 },
    });
    console.log(`  shot ${i}: r1=${t[0].slice(0, 42)}…`);
    if (i < 4) await page.waitForTimeout(3000);
  }

  const uniq = (idx) => new Set(transforms.map((t) => t[idx])).size;
  console.log('');
  console.log(`  ring1 distinct transforms: ${uniq(0)}/5`);
  console.log(`  ring2 distinct transforms: ${uniq(1)}/5`);
  console.log(`  ring3 distinct transforms: ${uniq(2)}/5`);
  const moving = uniq(0) === 5 && uniq(1) === 5 && uniq(2) === 5;
  console.log(
    `  VERDICT: ${moving ? 'rings ROTATE by default — PASS' : 'rings are static — FAIL'}`,
  );
  await ctx.close();
}

// ---------- 2. prefers-reduced-motion: reduce ----------
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  await page.goto(SITE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);

  console.log('\n== prefers-reduced-motion: reduce ==');
  const st = await page.evaluate(() => ({
    ringsStatic: document.documentElement.classList.contains('fx-rings-static'),
    fx: window.__fx || null,
  }));
  console.log('  html.fx-rings-static:', st.ringsStatic);
  console.log('  window.__fx         :', JSON.stringify(st.fx));

  const transforms = [];
  for (let i = 0; i < 5; i++) {
    const t = await page.evaluate(() =>
      [...document.querySelectorAll('.hero-rings i')].map(
        (el) => getComputedStyle(el).transform,
      ),
    );
    transforms.push(t);
    await page.screenshot({
      path: path.join(OUT, `rings-rm-${i}.png`),
      clip: { x: 740, y: 100, width: 600, height: 600 },
    });
    if (i < 4) await page.waitForTimeout(3000);
  }
  const uniq = (idx) => new Set(transforms.map((t) => t[idx])).size;
  console.log(`  ring1 distinct: ${uniq(0)}/5  ring2: ${uniq(1)}/5  ring3: ${uniq(2)}/5`);
  console.log(
    `  VERDICT: ${uniq(0) === 1 && uniq(1) === 1 && uniq(2) === 1 ? 'rings STATIC under reduced-motion — PASS' : 'rings still moving under reduced-motion — FAIL'}`,
  );
  await ctx.close();
}

// ---------- 3. trace of the hero in the DEFAULT state ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(SITE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);

  const client = await ctx.newCDPSession(page);
  const events = [];
  client.on('Tracing.dataCollected', (e) => events.push(...(e.value || [])));

  await client.send('Tracing.start', {
    categories:
      'devtools.timeline,disabled-by-default-devtools.timeline.frame,cc,gpu',
    transferMode: 'ReportEvents',
    options: 'sampling-frequency=10000',
  });
  await page.waitForTimeout(6000); // let the rings turn for 6s
  const done = new Promise((r) => client.once('Tracing.tracingComplete', r));
  await client.send('Tracing.end');
  await done;

  // Sum dur of the main-thread work each frame does.
  const buckets = {
    UpdateLayoutTree: 'Style',
    Layout: 'Layout',
    Paint: 'Paint',
    'RasterTask': 'Raster',
    CompositeLayers: 'Composite',
    'FunctionCall': 'Script',
  };
  const totals = {};
  let frames = 0;
  const frameEvents = new Set();

  for (const e of events) {
    if (!e.dur) continue;
    const name = e.name;
    if (buckets[name]) {
      totals[buckets[name]] = (totals[buckets[name]] || 0) + e.dur / 1000;
    }
    if (name === 'DrawFrame' || name === 'BeginFrame') {
      frames++;
      frameEvents.add(e.id);
    }
  }

  console.log('\n== CDP trace, hero idle in DEFAULT state (6s) ==');
  console.log(`  frames seen: ${frames}`);
  for (const k of ['Style', 'Layout', 'Paint', 'Raster', 'Composite', 'Script']) {
    console.log(`  ${k.padEnd(10)} ${(totals[k] || 0).toFixed(1)} ms`);
  }
  console.log(
    '\n  Ring rotation is transform-only, so Paint/Raster should be ~0 across the',
  );
  console.log('  whole window while Composite carries the per-frame re-composite.');

  await ctx.close();
}

await browser.close();
console.log(`\nscreenshots → ${OUT}`);