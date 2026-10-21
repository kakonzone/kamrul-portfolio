// Step 1 measurement harness: BEFORE baseline.
//
// Captures, under one condition:
//   - A CDP Performance trace: 10s idle on the hero, then 5s of mouse movement.
//   - Frame timing (avg/p95/p99), dropped frames, and the
//     Style/Layout/Paint/Raster/Composite breakdown.
//   - Every on-screen element using an expensive paint property
//     (filter / backdrop-filter / mix-blend-mode / big box-shadow /
//     mask-image / animated border-radius) with its box size in px.
//   - Cursor event->frame latency and long tasks during movement.
//   - Overlay analysis with elementsFromPoint over the hero text at a given width.
//
// Conditions:
//   default  : stock chromium headless
//   nogpu    : --disable-gpu  (software rendering)
//   cpu4x    : Emulation.setCPUThrottlingRate(4)
//
// Usage:  node scripts/measure-fx.mjs <condition> <width> [tag]

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CONDITION = process.argv[2] || 'default';
const WIDTH = Number(process.argv[3] || 1440);
const TAG = process.argv[4] || `${CONDITION}-${WIDTH}`;

const OUT = path.resolve('verification/perf');
await mkdir(OUT, { recursive: true });
const SITE = process.env.SITE_URL || 'http://localhost:4173';

const GPU_FLAGS =
  CONDITION === 'nogpu'
    ? [
        '--disable-gpu',
        '--disable-gpu-compositing',
        '--disable-software-rasterizer',
        '--use-gl=swiftshader',
      ]
    : [];

const browser = await chromium.launch({ headless: true, args: GPU_FLAGS });
const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 900 } });
const page = await ctx.newPage();

if (CONDITION === 'cpu4x') {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
}

// FX_OVERRIDE=rich measures the rich path (rings rotating); anything else
// measures whatever the automatic capability check decides on this host.
await page.goto(SITE + (process.env.FX_OVERRIDE === 'rich' ? '/?fx=rich' : '/'), {
  waitUntil: 'networkidle',
});
await page.evaluate(() => document.fonts.ready);
// Let the hero finish entering, then park the pointer outside the text.
await page.mouse.move(WIDTH - 5, 5);
await page.waitForTimeout(1200);

const cdp = await ctx.newCDPSession(page);

// ---------- trace collection ----------
// Collect CDP trace events into a local array for one tracing session.
// The listener must be attached BEFORE Tracing.start so we catch everything.
function collectTrace(label, ms, action) {
  return new Promise(async (resolve) => {
    const events = [];
    const onData = (d) => events.push(...d.value);

    cdp.on('Tracing.dataCollected', onData);
    cdp.once('Tracing.tracingComplete', async () => {
      cdp.off('Tracing.dataCollected', onData);
      resolve({ label, events });
    });

    await cdp.send('Tracing.start', {
      transferMode: 'ReportEvents',
      traceConfig: {
        includedCategories: [
          'devtools.timeline',
          'disabled-by-default-devtools.timeline.frame',
          'cc',
          'gpu',
        ],
      },
    });

    if (action) await action(ms);
    else await new Promise((r) => setTimeout(r, ms));

    await cdp.send('Tracing.end');
  });
}

const traceEvents = [];

// 10s idle on the hero
const idle = await collectTrace('idle', 10000, null);
traceEvents.push(...idle.events);

// 5s of mouse movement
const move = await collectTrace('move', 5000, async (ms) => {
  const end = Date.now() + ms;
  let i = 0;
  while (Date.now() < end) {
    const x = 120 + ((i * 37) % (WIDTH - 240));
    const y = 200 + ((i * 53) % 500);
    await page.mouse.move(x, y);
    i++;
    await page.waitForTimeout(16);
  }
});
traceEvents.push(...move.events);

// ---------- frame timing ----------
// Frame event timestamps in a CDP trace are not frame durations, so measure the
// real thing in-page with rAF: the delta between consecutive animation frames is
// exactly the frame time the user perceives.
async function inPageFrameStats(ms) {
  return page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        const deltas = [];
        let last = 0;
        let raf = 0;
        const t0 = performance.now();
        const tick = (now) => {
          if (last) deltas.push(now - last);
          last = now;
          if (now - t0 < duration) raf = requestAnimationFrame(tick);
          else {
            cancelAnimationFrame(raf);
            if (!deltas.length) return resolve(null);
            const sorted = [...deltas].sort((a, b) => a - b);
            const q = (x) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * x))];
            resolve({
              frames: deltas.length,
              avg: +(deltas.reduce((a, b) => a + b, 0) / deltas.length).toFixed(2),
              p50: +q(0.5).toFixed(2),
              p95: +q(0.95).toFixed(2),
              p99: +q(0.99).toFixed(2),
              droppedOver16_7: deltas.filter((d) => d > 16.7).length,
              droppedOver33_3: deltas.filter((d) => d > 33.3).length,
              longOver50: deltas.filter((d) => d > 50).length,
              fps: +(1000 / (deltas.reduce((a, b) => a + b, 0) / deltas.length)).toFixed(1),
            });
          }
        };
        raf = requestAnimationFrame(tick);
      }),
    ms,
  );
}

// Frame stats while the mouse is actually moving.
async function frameStatsWhileMoving(ms) {
  const end = Date.now() + ms;
  let i = 0;
  const driver = (async () => {
    while (Date.now() < end) {
      const x = 120 + ((i * 37) % (WIDTH - 240));
      const y = 200 + ((i * 53) % 500);
      await page.mouse.move(x, y);
      i++;
      await page.waitForTimeout(16);
    }
  })();

  const samples = page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        const deltas = [];
        let last = 0;
        let raf = 0;
        const t0 = performance.now();
        const tick = (now) => {
          if (last) deltas.push(now - last);
          last = now;
          if (now - t0 < duration) raf = requestAnimationFrame(tick);
          else {
            cancelAnimationFrame(raf);
            if (!deltas.length) return resolve(null);
            const s = [...deltas].sort((a, b) => a - b);
            resolve({
              frames: deltas.length,
              avg: +(deltas.reduce((a, b) => a + b, 0) / deltas.length).toFixed(2),
              p50: +s[Math.floor(s.length * 0.5)].toFixed(2),
              p95: +s[Math.floor(s.length * 0.95)].toFixed(2),
              p99: +s[Math.floor(s.length * 0.99)].toFixed(2),
              droppedOver16_7: deltas.filter((d) => d > 16.7).length,
              longOver50: deltas.filter((d) => d > 50).length,
              fps: +(1000 / (deltas.reduce((a, b) => a + b, 0) / deltas.length)).toFixed(1),
            });
          }
        };
        raf = requestAnimationFrame(tick);
      }),
    ms,
  );

  const [stats] = await Promise.all([samples, driver]);
  return stats;
}

const idleFrames = await inPageFrameStats(4000);
const moveFrames2 = await frameStatsWhileMoving(4000);

// ---------- pipeline breakdown ----------
function pipelineBreakdown(events) {
  const buckets = { Style: 0, Layout: 0, Paint: 0, Raster: 0, Composite: 0, Script: 0 };
  const patterns = [
    ['UpdateLayoutTree', 'Style'],
    ['RecalculateStyles', 'Style'],
    ['Layout', 'Layout'],
    ['Paint', 'Paint'],
    ['PaintImage', 'Paint'],
    ['RasterTask', 'Raster'],
    ['Rasterize', 'Raster'],
    ['CompositeLayers', 'Composite'],
    ['DrawFrame', 'Composite'],
    ['FunctionCall', 'Script'],
    ['EvaluateScript', 'Script'],
  ];
  for (const e of events) {
    if (e.ph === 'X' && typeof e.dur === 'number') {
      for (const [pattern, bucket] of patterns) {
        if (e.name === pattern || e.name?.startsWith(pattern)) {
          buckets[bucket] += e.dur / 1000;
          break;
        }
      }
    }
  }
  return Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, +v.toFixed(1)]));
}

const longTasks = await page.evaluate(() => {
  const out = [];
  try {
    const entries = performance.getEntriesByType('longtask') || [];
    for (const e of entries) out.push({ start: Math.round(e.startTime), dur: Math.round(e.duration) });
  } catch {}
  return out;
});

// ---------- expensive paint properties on screen ----------
const expensive = await page.evaluate(() => {
  const props = [
    'filter',
    'backdropFilter',
    'mixBlendMode',
    'boxShadow',
    'maskImage',
    'webkitMaskImage',
  ];
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const found = [];
    for (const p of props) {
      const v = cs[p];
      if (!v || v === 'none' || v === 'normal') continue;
      // Ignore trivial shadows.
      if (p === 'boxShadow' && (v === 'none' || v.length < 6)) continue;
      found.push(`${p}:${v}`);
    }
    // Animated border-radius?
    let animatedRadius = false;
    if (el.closest('.hero-ring-1,.hero-ring-2,.hero-blob,.hero-dot-1,.hero-dot-2,.hero-dot-3')) {
      animatedRadius = true;
    }
    if (!found.length && !animatedRadius) continue;
    out.push({
      sel:
        el.tagName.toLowerCase() +
        (el.className && typeof el.className === 'string'
          ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
          : ''),
      w: Math.round(r.width),
      h: Math.round(r.height),
      area: Math.round(r.width * r.height),
      props: found,
      animatedBorderRadius: animatedRadius,
    });
  }
  return out.sort((a, b) => b.area - a.area).slice(0, 25);
});

// ---------- cursor latency: mousemove -> frame that moves the dot ----------
const cursorLatency = await page.evaluate(async () => {
  const dot = document.querySelector('.cursor-dot');
  if (!dot) return { mounted: false };
  return new Promise((resolve) => {
    const samples = [];
    let lastMoveTs = 0;
    const onMove = () => {
      lastMoveTs = performance.now();
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    let frames = 0;
    const start = performance.now();
    const tick = () => {
      frames++;
      if (lastMoveTs && samples.length < 30) {
        const tf = getComputedStyle(dot).transform;
        if (tf && tf !== 'none') samples.push(performance.now() - lastMoveTs);
        lastMoveTs = 0;
      }
      if (performance.now() - start < 2500) requestAnimationFrame(tick);
      else {
        window.removeEventListener('mousemove', onMove);
        const sorted = [...samples].sort((a, b) => a - b);
        resolve({
          mounted: true,
          frames,
          samples: samples.length,
          avg: samples.length ? +(samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(1) : null,
          p95: sorted.length ? +sorted[Math.floor(sorted.length * 0.95)].toFixed(1) : null,
          max: sorted.length ? +sorted[sorted.length - 1].toFixed(1) : null,
        });
      }
    };
    requestAnimationFrame(tick);
  });
});

// ---------- overlay analysis ----------
async function overlayAt(width) {
  await page.setViewportSize({ width, height: 900 });
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const targets = [];
    const push = (label, el) => {
      if (el) targets.push({ label, el });
    };
    const hero = document.getElementById('hero');
    push('h1', hero?.querySelector('h1'));
    push('tagline', hero?.querySelector('p.mt-5'));
    const btns = hero ? [...hero.querySelectorAll('a[href="#projects"], a[href*="github"], a[href*="resume"]')] : [];
    btns.forEach((b, i) => push(`button${i + 1}`, b));
    const social = hero?.querySelector('ul li a');
    push('social', social);

    const results = [];
    for (const { label, el } of targets) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const cx = Math.min(window.innerWidth - 2, Math.max(2, Math.round(r.x + r.width / 2)));
      const cy = Math.min(window.innerHeight - 2, Math.max(2, Math.round(r.y + r.height / 2)));
      const stack = document.elementsFromPoint(cx, cy).slice(0, 5);
      results.push({
        label,
        at: [cx, cy],
        topmost: stack[0]?.tagName.toLowerCase() ?? null,
        topIsTarget: stack[0] === el,
        stack: stack.map((n) => {
          const cs = getComputedStyle(n);
          const rr = n.getBoundingClientRect();
          return {
            tag: n.tagName.toLowerCase(),
            cls: typeof n.className === 'string' ? n.className.trim().split(/\s+/).slice(0, 2).join('.') : '',
            z: cs.zIndex,
            pos: cs.position,
            filter: cs.filter !== 'none' ? cs.filter : null,
            blend: cs.mixBlendMode !== 'normal' ? cs.mixBlendMode : null,
            opacity: cs.opacity,
            w: Math.round(rr.width),
            h: Math.round(rr.height),
          };
        }),
      });
    }
    return { width: window.innerWidth, results };
  });
}

const overlay390 = await overlayAt(390);
const overlay360 = await overlayAt(360);
await page.setViewportSize({ width: WIDTH, height: 900 });

const mode = await page.evaluate(() => ({
  fxMode: document.documentElement.className,
  cursorMounted: !!document.querySelector('.cursor-ring'),
}));

const report = {
  condition: CONDITION,
  width: WIDTH,
  tag: TAG,
  idleFrames,
  moveFrames: moveFrames2,
  idlePipeline: pipelineBreakdown(idle.events),
  movePipeline: pipelineBreakdown(move.events),
  longTasks,
  cursorLatency,
  expensive,
  overlay390,
  overlay360,
  mode,
};

const jsonPath = path.join(OUT, `trace-${TAG}.json`);
await writeFile(jsonPath, JSON.stringify(report, null, 2));

console.log(`=== ${TAG} ===`);
console.log('idle frames :', JSON.stringify(idleFrames));
console.log('move frames :', JSON.stringify(moveFrames2));
console.log('idle pipe   :', JSON.stringify(report.idlePipeline));
console.log('move pipe   :', JSON.stringify(report.movePipeline));
console.log('longTasks   :', longTasks.length);
console.log('cursor      :', JSON.stringify(cursorLatency));
console.log('mode        :', JSON.stringify(mode));
console.log('expensive   :', expensive.length, 'elements');
for (const e of expensive.slice(0, 10)) {
  console.log(`   ${e.sel} ${e.w}x${e.h}  ${e.props.join(' | ').slice(0, 110)}`);
}
console.log(`saved ${jsonPath}`);

await browser.close();