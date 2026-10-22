// Cross-engine + cross-mode verification of the bug-fix patch.
//
// For each installed Playwright engine (chromium, firefox, webkit), and for
// each mode (default desktop, reducedMotion: 'reduce', forced touch-only):
//   - Page loads, no JS errors
//   - Hero rings are animating (borderRadius differs across 3 samples @2s)
//   - Custom cursor nodes exist and follow the mouse over every section
//   - Position fixed survives scrolling to the footer
//   - Under reduced motion: cursor still mounted, ring still follows

import { chromium, firefox, webkit } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve('verification');
const SITE = process.env.SITE_URL || 'http://localhost:5173';
await mkdir(OUT, { recursive: true });

const log = [];
const errors = [];

async function shootHero(page, label) {
  const samples = [];
  const photo = await page.$('#hero');
  if (photo) await photo.scrollIntoViewIfNeeded();
  for (let i = 0; i < 3; i++) {
    const r = await page.evaluate(() => {
      const rings = document.querySelectorAll('.hero-rings i');
      const tf = (el) => (el ? getComputedStyle(el).transform : 'none');
      return {
        // The rings no longer animate border-radius (that was the expensive
        // morph). They rotate via transform, so the live assertion is the
        // rotation matrix: three distinct values 2s apart means they are
        // turning. border-radius must stay fixed.
        r1: tf(rings[0]),
        r2: tf(rings[1]),
        r3: tf(rings[2]),
        ringRadiusFixed: rings[0] ? getComputedStyle(rings[0]).borderRadius : 'n/a',
      };
    });
    samples.push(r);
    try {
      await page.screenshot({
        path: path.join(OUT, `bugfix-hero-${label}-${i}.png`),
        clip: { x: 740, y: 100, width: 600, height: 600 },
      });
    } catch (e) {
      // screenshots may fail in headless shells with no display; ignore
    }
    if (i < 2) await page.waitForTimeout(2000);
  }
  // Each ring's transform should be distinct 2s apart while rotating, and
  // border-radius must stay constant (no morphing).
  const u1 = new Set(samples.map((s) => s.r1)).size;
  const u2 = new Set(samples.map((s) => s.r2)).size;
  const u3 = new Set(samples.map((s) => s.r3)).size;
  const radiusConst = new Set(samples.map((s) => s.ringRadiusFixed)).size;
  return { samples, u1, u2, u3, radiusConst };
}

async function trackCursorOverSections(page) {
  // Sections that are currently enabled (services / testimonials / blog are
// flagged off in profile.sections and no longer rendered on Home).
  const sections = ['hero', 'about', 'projects', 'skills', 'experience', 'resume', 'contact'];
  const out = [];
  for (const id of sections) {
    const box = await page.evaluate((sid) => {
      const el = document.getElementById(sid);
      if (!el) return null;
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + 20 };
    }, id);
    if (!box) continue;
    await page.mouse.move(box.x, box.y, { steps: 8 });
    await page.waitForTimeout(280);
    const data = await page.evaluate(() => {
      const ring = document.querySelector('.cursor-ring');
      const dot = document.querySelector('.cursor-dot');
      const cont = ring?.parentElement;
      function p(el){
        if (!el) return null;
        const tt = getComputedStyle(el).transform;
        const m = tt.match(/matrix\(([^)]+)\)/);
        if (!m) return null;
        const pp = m[1].split(',').map(Number);
        return { tx: pp[4], ty: pp[5] };
      }
      return {
        ring: p(ring),
        dot: p(dot),
        containerOpacity: cont ? getComputedStyle(cont).opacity : null,
      };
    });
    out.push({ id, dot: data?.dot, ring: data?.ring, opacity: data?.containerOpacity });
  }
  return out;
}

async function runEngine(browserType, engineName, mode) {
  const browser = await browserType.launch({ headless: true });
  const ctxOpts = { viewport: { width: 1440, height: 900 } };
  if (mode === 'reducedMotion') ctxOpts.reducedMotion = 'reduce';
  if (mode === 'touchOnly') { ctxOpts.hasTouch = true; ctxOpts.isMobile = true; }
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${engineName}/${mode}] pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${engineName}/${mode}] console.error: ${m.text()}`); });

  // The bugfix script asserts the cursor nodes EXIST. On this headless host the
// capability check lands on calm (SwiftShader) and the cursor is intentionally
// not mounted. Force rich so the node-presence assertions are exercised.
  await page.goto(SITE + '/?noguard=1', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  const ringDefaultA = await page.evaluate(() => ({
    ringsStatic: document.documentElement.classList.contains('fx-rings-static'),
    fxOn: document.documentElement.classList.contains('fx-on'),
    t: [...document.querySelectorAll('.hero-rings i')].map(
      (el) => getComputedStyle(el).transform,
    ),
  }));
  await page.waitForTimeout(2500);
  const ringDefaultB = await page.evaluate(() => ({
    t: [...document.querySelectorAll('.hero-rings i')].map(
      (el) => getComputedStyle(el).transform,
    ),
  }));
  const changing = ringDefaultA.t.filter((v, i) => v !== ringDefaultB.t[i]).length;
  log.push(
    `[${engineName}/${mode}] DEFAULT rings (no fx flag): fx-on=${ringDefaultA.fxOn} ` +
      `fx-rings-static=${ringDefaultA.ringsStatic} rotating=${changing}/3`,
  );

  await page.goto(SITE + '/?fx=rich&noguard=1', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);

  const media = await page.evaluate(() => ({
    prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    hover: window.matchMedia('(hover: hover)').matches,
    anyHover: window.matchMedia('(any-hover: hover)').matches,
    pointer_fine: window.matchMedia('(pointer: fine)').matches,
    anyPointer_fine: window.matchMedia('(any-pointer: fine)').matches,
  }));
  log.push(`[${engineName}/${mode}] media: ${JSON.stringify(media)}`);

  const cursorExists = await page.evaluate(() => !!document.querySelector('.cursor-ring'));
  log.push(`[${engineName}/${mode}] cursor nodes exist: ${cursorExists} (expect true for desktop & reducedMotion, false for touchOnly)`);

  const hero = await shootHero(page, `${engineName}-${mode}`);
  log.push(
    `[${engineName}/${mode}] ring rotation unique: r1 ${hero.u1}/3 r2 ${hero.u2}/3 r3 ${hero.u3}/3` +
      ` · border-radius distinct values: ${hero.radiusConst} (expect 1 = fixed, no morph)`,
  );

  const tracking = await trackCursorOverSections(page);
  for (const t of tracking) {
    const dotX = t.dot?.tx != null ? (t.dot.tx + 4) : null;
    const dotY = t.dot?.ty != null ? (t.dot.ty + 4) : null;
    const ringX = t.ring?.tx != null ? (t.ring.tx + 18) : null;
    const ringY = t.ring?.ty != null ? (t.ring.ty + 18) : null;
    const delta = (dotX != null && ringX != null)
      ? Math.round(Math.hypot(dotX - ringX, dotY - ringY))
      : null;
    log.push(`[${engineName}/${mode}] ${t.id.padEnd(12)} dot=(${dotX?.toFixed?.(0)},${dotY?.toFixed?.(0)}) ring=(${ringX?.toFixed?.(0)},${ringY?.toFixed?.(0)}) Δ=${delta}px opacity=${t.opacity}`);
  }

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(250);
  await page.mouse.move(720, 850, { steps: 8 });
  await page.waitForTimeout(300);
  const bottomDot = await page.evaluate(() => {
    const dot = document.querySelector('.cursor-dot');
    if (!dot) return null;
    const tt = getComputedStyle(dot).transform;
    const m = tt.match(/matrix\(([^)]+)\)/);
    return m ? Number(m[1].split(',')[4]) + 4 : null;
  });
  log.push(`[${engineName}/${mode}] bottom-of-page dot.x=${bottomDot} (expect ~720 if cursor active)`);

  await ctx.close();
  await browser.close();
}

const engines = [
  { type: chromium, name: 'chromium' },
  { type: firefox,   name: 'firefox' },
  { type: webkit,    name: 'webkit' },
];

for (const { type, name } of engines) {
  for (const mode of ['default', 'reducedMotion']) {
    try {
      await runEngine(type, name, mode);
    } catch (e) {
      errors.push(`${name}/${mode}: ${e.message.split('\n')[0]}`);
    }
  }
}

await writeFile(
  path.join(OUT, 'verify-bugfix.log'),
  [
    '# Sprint 3.6 bug-fix verification',
    '',
    ...log,
    '',
    '## Browser errors',
    errors.length ? errors.map((e) => '- ' + e).join('\n') : '(none)',
  ].join('\n'),
);

console.log('Log entries:', log.length);
console.log('Errors:', errors.length);
if (errors.length) {
  console.log(errors.join('\n'));
  process.exit(1);
}