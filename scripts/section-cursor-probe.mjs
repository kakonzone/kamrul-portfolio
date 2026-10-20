// Per-section cursor tracking: move mouse across each section's bounding box
// and confirm both dot and ring follow.

import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);

// Move mouse somewhere to wake the cursor
await page.mouse.move(700, 500, { steps: 5 });
await page.waitForTimeout(200);

const sections = ['hero', 'about', 'skills', 'services', 'projects', 'experience', 'testimonials', 'blog', 'contact', 'footer'];

console.log('section | top | bottom | dot.y | ring.y | delta | zOver | occluded?');
for (const id of sections) {
  const box = await page.evaluate((id) => {
    const el = document.getElementById(id) || document.querySelector(id);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width/2, y: r.y + 20, top: r.top, bottom: r.bottom };
  }, id);
  if (!box) { console.log(id, 'NOT FOUND'); continue; }
  // Move mouse to the section center top
  await page.mouse.move(box.x, box.y, { steps: 6 });
  await page.waitForTimeout(220);
  const data = await page.evaluate(() => {
    const dot = document.querySelector('.cursor-dot');
    const ring = document.querySelector('.cursor-ring');
    function m(el) {
      if (!el) return null;
      const t = getComputedStyle(el).transform;
      const mat = t.match(/matrix\(([^)]+)\)/);
      if (!mat) return null;
      const parts = mat[1].split(',').map(Number);
      return { tx: parts[4], ty: parts[5] };
    }
    // Element at the cursor point
    const cx = window.__lastX ?? null;
    const cy = window.__lastY ?? null;
    let occluded = null;
    if (cx != null && cy != null) {
      const top = document.elementFromPoint(cx, cy);
      occluded = top ? top.tagName + (top.id ? '#'+top.id : '') : null;
    }
    return { dot: m(dot), ring: m(ring), occluded };
  });
  console.log(`${id.padEnd(12)} | top=${Math.round(box.top)} bot=${Math.round(box.bottom)} | dot.y=${data.dot?.ty} ring.y=${data.ring?.ty} | delta=${(data.dot?.ty ?? 0) - (data.ring?.ty ?? 0)} | over=${data.occluded}`);
}

await browser.close();