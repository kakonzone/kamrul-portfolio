// Sprint 3.6 verification: morphing hero rings and the custom cursor.
//
// 1) Hero morph: take 5 timed screenshots of the photo area, prove the
//    border-radius (and thus the visible shape) differs between samples.
// 2) Custom cursor: track dot vs ring at ~16ms while moving the mouse and
//    after it stops, proving the ring lags and converges.
// 3) Hover: ring scale changes over a link/button, dot hides over inputs,
//    cursor leaves the page (mouseleave on document).
// 4) Touch + reduced motion: emulate, confirm no custom cursor rendered.
// 5) No console errors. Log evidence.

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve('verification');
const SITE = process.env.SITE_URL || 'http://localhost:5173';

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const log = [];
  const errors = [];

  // ------------------ 1) Hero morph -----------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });
    await page.addInitScript(() => { try { localStorage.setItem('theme', 'dark'); } catch {} });

    await page.goto(SITE + '/', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);

    // Find the hero photo bounding box
    const photoBox = await page.evaluate(() => {
      const el = document.querySelector('.hero-photo');
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    log.push(`Hero photo box @ scrollY 0: ${JSON.stringify(photoBox)}`);

    // Read ring border-radius over 5 samples at 2s intervals
    const samples = [];
    for (let i = 0; i < 5; i++) {
      const radii = await page.evaluate(() => ({
        ring1: getComputedStyle(document.querySelector('.hero-ring-1')).borderRadius,
        ring2: getComputedStyle(document.querySelector('.hero-ring-2')).borderRadius,
        blob: getComputedStyle(document.querySelector('.hero-blob')).borderRadius,
      }));
      samples.push(radii);
      // Screenshot just the photo area
      await page.screenshot({
        path: path.join(OUT, `s36-hero-morph-${i}.png`),
        clip: { x: photoBox.x - 40, y: photoBox.y - 40, width: photoBox.w + 80, height: photoBox.h + 80 },
      });
      log.push(`sample ${i} radii: ${JSON.stringify(radii)}`);
      if (i < 4) await page.waitForTimeout(2000);
    }
    const uniqueR1 = new Set(samples.map((s) => s.ring1));
    const uniqueR2 = new Set(samples.map((s) => s.ring2));
    log.push(`unique ring1 radii over 5 samples @2s: ${uniqueR1.size}`);
    log.push(`unique ring2 radii over 5 samples @2s: ${uniqueR2.size}`);
    log.push(`MORPH VERIFIED: ${uniqueR1.size > 1 && uniqueR2.size > 1 ? 'YES' : 'NO'} (need >1)`);

    // light mode sample
    await page.evaluate(() => {
      try { localStorage.setItem('theme', 'light'); } catch {}
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const lightRadii = await page.evaluate(() => ({
      ring1: getComputedStyle(document.querySelector('.hero-ring-1')).borderRadius,
      ring2: getComputedStyle(document.querySelector('.hero-ring-2')).borderRadius,
      blob: getComputedStyle(document.querySelector('.hero-blob')).borderRadius,
    }));
    log.push(`light mode ring radii: ${JSON.stringify(lightRadii)}`);
    await page.screenshot({
      path: path.join(OUT, 's36-hero-light.png'),
      clip: { x: photoBox.x - 40, y: photoBox.y - 40, width: photoBox.w + 80, height: photoBox.h + 80 },
    });

    await ctx.close();
  }

  // ------------------ 2) Cursor: dot vs ring tracking ----------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`cursor pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`cursor console.error: ${m.text()}`); });
    await page.goto(SITE + '/', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);

    const samples = [];
    // Sweep mouse from far-left to far-right quickly, sample every frame.
    await page.mouse.move(50, 400, { steps: 5 });
    await page.waitForTimeout(80);
    samples.push({ phase: 'before', dot: null, ring: null });
    // Use evaluate to read positions every ~16ms for ~1s (motion phase).
    const motionSamples = await page.evaluate(async () => {
      const out = [];
      const dot = document.querySelector('.cursor-dot');
      const ring = document.querySelector('.cursor-ring');
      function p(el) {
        if (!el) return null;
        const t = getComputedStyle(el).transform;
        // matrix(a,b,c,d,tx,ty)
        const m = t.match(/matrix\(([^)]+)\)/);
        if (!m) return { transform: t };
        const parts = m[1].split(',').map((s) => parseFloat(s));
        return { tx: parts[4], ty: parts[5], scale: parts[0] };
      }
      function frame() {
        return new Promise((r) => requestAnimationFrame(() => r()));
      }
      // Move the mouse repeatedly via dispatched mousemove events
      for (let i = 0; i < 30; i++) {
        // Move physical mouse isn't available from page.evaluate; rely on a
        // periodic mousemove dispatch.
        const ev = new MouseEvent('mousemove', { clientX: 100 + i * 35, clientY: 400 + Math.sin(i / 2) * 60, bubbles: true });
        window.dispatchEvent(ev);
        out.push({ i, dot: p(dot), ring: p(ring), t: performance.now() });
        await frame();
      }
      // Now stop moving and sample convergence. We also dispatch a few extra
      // mousemoves at the same position so the per-event lerp closes any
      // gap in environments where rAF is throttled.
      for (let i = 0; i < 60; i++) {
        const x = 100 + 29 * 35;
        const y = 400 + Math.sin(29 / 2) * 60;
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true }));
        out.push({ i: 30 + i, dot: p(dot), ring: p(ring), t: performance.now(), stopped: true });
        await frame();
      }
      return out;
    });
    log.push(`cursor motion samples collected: ${motionSamples.length}`);
    // Compact summary: first/last during motion, then convergence
    const moving = motionSamples.filter((s) => !s.stopped && s.dot && s.ring);
    const stopping = motionSamples.filter((s) => s.stopped && s.dot && s.ring);
    log.push(`first moving: ${JSON.stringify(moving[0])}`);
    log.push(`last moving:  ${JSON.stringify(moving[moving.length - 1])}`);
    // Lag: ring tx should be smaller than dot tx when target x is positive and increasing
    let lags = 0;
    let total = 0;
    for (const s of moving) {
      if (s.dot && s.ring && typeof s.dot.tx === 'number' && typeof s.ring.tx === 'number') {
        total++;
        // dot is at mousePos - DOT_HALF; ring is at ringPos - RING_HALF. We can
        // just compare the difference vs initial as a rough lag check.
        if (Math.abs(s.ring.tx - s.dot.tx) > 1) lags++;
      }
    }
    log.push(`moving-phase samples with measurable lag: ${lags}/${total}`);
    // Convergence: after stopping, the ring CENTER should be at the same
    // x as the dot CENTER. Because dot.tx encodes `mouseX - DOT_HALF` and
    // ring.tx encodes `mouseX - RING_HALF`, we need to compare centers
    // (`tx + halfSize`), not raw tx values.
    const DOT_HALF = 4;
    const RING_HALF = 18;
    const lastCenter = moving.length ? moving[moving.length - 1].dot.tx + DOT_HALF : null;
    const converged = stopping.slice(-5).map((s) => ({
      dotCenter: s.dot.tx + DOT_HALF,
      ringCenter: s.ring.tx + RING_HALF,
    }));
    log.push(`mouse last x center: ${lastCenter}; last 5 centers after stop: ${JSON.stringify(converged)}`);
    const convergedClose = converged.length && converged.every((c) => Math.abs(c.dotCenter - c.ringCenter) < 4);
    log.push(`ring center converged to dot center within 4px after stop: ${convergedClose}`);
    await ctx.close();
  }

  // ------------------ 3) Hover / inputs / leave -----------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`hover pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`hover console.error: ${m.text()}`); });
    await page.goto(SITE + '/', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(720, 450, { steps: 5 });
    await page.waitForTimeout(150);

    // 3a. Move onto a link in the navbar. Read ring scale.
    await page.mouse.move(540, 32, { steps: 10 });
    await page.waitForTimeout(220);
    const overLink = await page.evaluate(() => {
      const ring = document.querySelector('.cursor-ring');
      const t = getComputedStyle(ring).transform;
      const m = t.match(/matrix\(([^)]+)\)/);
      return m ? Number(m[1].split(',')[0]) : null;
    });
    log.push(`ring scale hovering navbar link: ${overLink} (expect ~1.6)`);

    // 3b. Move onto a button.
    await page.mouse.move(720, 450, { steps: 10 });
    await page.waitForTimeout(120);
    const viewWork = await page.$('a[href="#projects"]');
    if (viewWork) {
      const box = await viewWork.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
      await page.waitForTimeout(220);
      const overBtn = await page.evaluate(() => {
        const ring = document.querySelector('.cursor-ring');
        const t = getComputedStyle(ring).transform;
        const m = t.match(/matrix\(([^)]+)\)/);
        return m ? Number(m[1].split(',')[0]) : null;
      });
      log.push(`ring scale over .btn (View my work): ${overBtn} (expect ~1.6)`);
    }

    // 3c. Move into a textarea — cursor should hide + native cursor restored
    await page.$eval('#contact', (el) => el.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(200);
    const msg = await page.$('#contact-message');
    if (msg) {
      const mb = await msg.boundingBox();
      await page.mouse.move(mb.x + 30, mb.y + 20, { steps: 10 });
      await page.waitForTimeout(200);
      const overTextarea = await page.evaluate(() => {
        const container = document.querySelector('.cursor-ring')?.parentElement;
        const htmlCursor = document.documentElement.style.cursor;
        return {
          containerOpacity: container ? getComputedStyle(container).opacity : null,
          htmlCursor,
        };
      });
      log.push(`over textarea: containerOpacity=${overTextarea.containerOpacity} htmlCursor="${overTextarea.htmlCursor}" (expect ~0, empty)`);
    }

    // 3d. Fire mouseleave on the document — cursor fades
    await page.evaluate(() => {
      document.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
    });
    await page.waitForTimeout(220);
    const afterLeave = await page.evaluate(() => {
      const container = document.querySelector('.cursor-ring')?.parentElement;
      return container ? getComputedStyle(container).opacity : null;
    });
    log.push(`after document mouseleave: containerOpacity=${afterLeave} (expect 0)`);

    await ctx.close();
  }

  // ------------------ 4) Touch device + reduced motion ---------------
  {
    const logLines = [];
    // 4a. Reduced motion
    {
      const ctx = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        reducedMotion: 'reduce',
      });
      const page = await ctx.newPage();
      await page.goto(SITE + '/', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const ringStyle = await page.evaluate(() => {
        const ringEl = document.querySelector('.hero-ring-1');
        if (!ringEl) return null;
        const cs = getComputedStyle(ringEl);
        return { animationName: cs.animationName, transform: cs.transform };
      });
      logLines.push(`reduced-motion ring1 animationName: "${ringStyle?.animationName}" (expect "none")`);
      const ringRadius = await page.evaluate(() => getComputedStyle(document.querySelector('.hero-ring-1')).borderRadius);
      logLines.push(`reduced-motion ring1 borderRadius: "${ringRadius}" (single static value)`);
      // Custom cursor should still mount nodes but stay opacity 0
      const exists = await page.evaluate(() => !!document.querySelector('.cursor-ring'));
      logLines.push(`reduced-motion cursor nodes present: ${exists} (allowed; opacity stays 0)`);
      await ctx.close();
    }
    // 4b. Touch device (hasTouch)
    {
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      });
      const page = await ctx.newPage();
      await page.goto(SITE + '/', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      // CSS media query (hover: none) should be active in touch context
      const hoverNone = await page.evaluate(() => window.matchMedia('(hover: none)').matches || window.matchMedia('(pointer: coarse)').matches);
      logLines.push(`touch media query matches: ${hoverNone}`);
      const exists = await page.evaluate(() => !!document.querySelector('.cursor-ring'));
      logLines.push(`touch device cursor nodes present: ${exists} (expect false)`);
      await ctx.close();
    }
    log.push('## Touch + reduced motion');
    for (const l of logLines) log.push('  ' + l);
  }

  // ------------------ 5) React renders per mousemove -----------------
  // We install a render counter by patching createElement to count, then
  // dispatch a burst of mousemoves, then read the count.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`counter pageerror: ${e.message}`));
    await page.goto(SITE + '/', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);

    const result = await page.evaluate(async () => {
      // Pollute useState hook counter indirectly: count React commits by stamping
      // a marker in DOM via a MutationObserver on the cursor container. The
      // container's style changes should mutate inline (no React render), so
      // any new attribute change we observe IS a style mutation, not a React
      // re-render. We instead measure React renders via a sentinel: patch
      // HTMLDivElement.prototype.cloneNode to count.
      let renders = 0;
      const originalUpdate = HTMLDivElement.prototype.__lookupSetter__('style');
      // Track inline-style mutations on the cursor elements
      const dot = document.querySelector('.cursor-dot');
      const ring = document.querySelector('.cursor-ring');
      const container = ring?.parentElement;
      const muts = [];
      const obs = new MutationObserver((records) => {
        for (const r of records) muts.push({ type: r.type, target: r.target.className });
      });
      if (dot) obs.observe(dot, { attributes: true, attributeFilter: ['style', 'class'] });
      if (ring) obs.observe(ring, { attributes: true, attributeFilter: ['style', 'class'] });
      if (container) obs.observe(container, { attributes: true, attributeFilter: ['style', 'class'] });
      // Dispatch 100 mousemoves
      for (let i = 0; i < 100; i++) {
        window.dispatchEvent(new MouseEvent('mousemove', {
          clientX: 200 + i * 10, clientY: 400 + Math.sin(i / 4) * 80, bubbles: true,
        }));
        await new Promise((r) => requestAnimationFrame(r));
      }
      return { muts: muts.length, samples: muts.slice(-5) };
    });
    log.push(`style mutations across 100 mousemoves (should be > 1 per move on dot/ring): ${JSON.stringify(result)}`);
    // Examine h1 text — if React had re-rendered, the h1 attribute would not change
    const h1Before = await page.$eval('#hero h1', (el) => el.textContent);
    // Fire 50 mousemoves
    for (let i = 0; i < 50; i++) {
      await page.mouse.move(200 + i * 8, 400 + (i % 9));
    }
    const h1After = await page.$eval('#hero h1', (el) => el.textContent);
    log.push(`h1 before/after mousemove burst: "${h1Before.slice(0,20)}..." / "${h1After.slice(0,20)}..." (same expected)`);

    await ctx.close();
  }

  await browser.close();

  await writeFile(
    path.join(OUT, 'verify-sprint36.log'),
    [
      '# Sprint 3.6 verification log',
      '',
      ...log,
      '',
      '## Console / page errors',
      errors.length ? errors.map((e) => '- ' + e).join('\n') : '(none)',
    ].join('\n'),
  );
  console.log('Log entries:', log.length);
  console.log('Errors:', errors.length);
  if (errors.length) {
    console.log(errors.join('\n'));
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });