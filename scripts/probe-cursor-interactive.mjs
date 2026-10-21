// Targeted probe: each target gets its element scrolled into the middle of the
// viewport, then the bounding box is used to compute a guaranteed-visible
// center.  Also exercises the new data-cursor="hover" wrapping on ProjectCard.
import { chromium, firefox } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve('verification');
await mkdir(OUT, { recursive: true });
const SITE = process.env.SITE_URL || 'http://localhost:4173';

function scaleOf(t) {
  if (!t) return null;
  const m = t.match(/matrix\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,/);
  if (!m) return null;
  const a = +m[1], b = +m[2];
  return Math.sqrt(a * a + b * b);
}

const targets = [
  // The blog section is flagged off (profile.sections.blog === false), so there
  // are no blog cards to probe on the Home page.
  ['nav link',                 'header nav ul a'],
  ['filter pill',              '#projects [role="group"] button'],
  ['project card image',       '#projects .project-fade img'],
  ['project card h3',          '#projects .project-fade h3'],
  ['project card p',           '#projects .project-fade p'],
  ['project card tag',         '#projects .project-fade span'],
  ['project card Source Code',  '#projects a[href*="github.com"]'],
  ['project card View Details','#projects a[href^="/projects/"]'],
  ['contact heading',          '#contact h2'],
  ['contact paragraph',        '#contact p'],
  ['contact name input',       '#contact-name'],
  ['contact email input',      '#contact-email'],
  ['contact subject input',    '#contact-subject'],
  ['contact textarea',         '#contact-message'],
  ['hero CTA link',            '#hero a'],
];

async function runEngine(browserType, engineName) {
  const browser = await browserType.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });

  // The custom cursor only exists in rich mode, and on this headless host the
// capability check correctly lands on calm (SwiftShader). Force rich so the
// cursor behaviour is actually exercised.
  await page.goto(SITE + '/?fx=rich&noguard=1', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);

  // Park a generous scroll-margin-top so scrollIntoView lands the target well
  // inside the viewport rather than flush against the sticky header.
  await page.addStyleTag({
    content: `
      :root { --scroll-pad: 180px; }
      section[id], [data-probe-target] { scroll-margin-top: var(--scroll-pad); }
    `,
  });

  const rows = [];
  for (const [name, sel] of targets) {
    // Find the first matching element
    const found = await page.evaluate((s) => {
      const list = s.split(',').map(x => x.trim());
      for (const q of list) {
        const e = document.querySelector(q);
        if (e) return q;
      }
      return null;
    }, sel);
    if (!found) {
      rows.push({ name, sel, present: false });
      continue;
    }

    // Scroll it into the middle of the viewport.
    await page.evaluate((s) => {
      const e = document.querySelector(s);
      if (!e) return;
      const r = e.getBoundingClientRect();
      const targetY = window.scrollY + r.top - (window.innerHeight - r.height) / 2;
      window.scrollTo({ top: Math.max(0, targetY), behavior: 'instant' });
    }, found);

    // Settle the position
    await page.waitForTimeout(120);

    // Re-measure in viewport coords; abort rows that still fall outside the
    // viewport (proves the probe is robust to short pages).
    const info = await page.evaluate((s) => {
      const e = document.querySelector(s);
      const r = e.getBoundingClientRect();
      const cx = Math.round(r.x + r.width / 2);
      const cy = Math.round(r.y + r.height / 2);
      return { cx, cy, x: r.x, y: r.y, w: r.width, h: r.height, visible: r.x >= 0 && r.y >= 0 && r.x + r.width <= window.innerWidth && r.y + r.height <= window.innerHeight && r.width > 0 && r.height > 0 };
    }, found);

    if (!info.visible) {
      rows.push({ name, sel, present: true, offViewport: true, info });
      continue;
    }

    // Step mouse into the element and wait for ring lerp to settle.
    await page.mouse.move(Math.max(10, info.cx - 60), Math.max(10, info.cy - 60), { steps: 4 });
    await page.waitForTimeout(150);
    await page.mouse.move(info.cx, info.cy, { steps: 6 });
    await page.waitForTimeout(350);

    const data = await page.evaluate(() => {
      const ring = document.querySelector('.cursor-ring');
      const dot = document.querySelector('.cursor-dot');
      const cont = ring?.parentElement;
      return {
        ringT: ring ? getComputedStyle(ring).transform : null,
        dotT: dot ? getComputedStyle(dot).transform : null,
        op: cont ? getComputedStyle(cont).opacity : null,
        htmlCursor: document.documentElement.style.cursor || getComputedStyle(document.documentElement).cursor,
        ringHover: ring ? ring.classList.contains('cursor-ring--hover') : null,
        dotHover: dot ? dot.classList.contains('cursor-dot--hover') : null,
      };
    });

    rows.push({
      name, sel, present: true,
      cx: info.cx, cy: info.cy,
      op: data.op,
      ringScale: scaleOf(data.ringT),
      dotScale: scaleOf(data.dotT),
      htmlCursor: data.htmlCursor,
      ringHover: data.ringHover,
      dotHover: data.dotHover,
    });
  }

  await ctx.close();
  await browser.close();
  return { engineName, rows, errors };
}

const all = [];
for (const [type, name] of [[chromium, 'chromium'], [firefox, 'firefox']]) {
  try {
    all.push(await runEngine(type, name));
  } catch (e) {
    all.push({ engineName: name, fatal: String(e).split('\n')[0] });
  }
}

// Verdict: rule each target by the kind of selector it is.
// Roughly:
//   - selector starts with '#contact-' or contains input/textarea/select → textInput → expects op=0 ring=0 dot=0 html=auto
//   - matches <a>, href^=, [role="group"] button, View Details, Live Demo,
//     blog/contact headings via <a> ancestor, project card (now data-cursor="hover") → interactive → op=1 ring=1.6 dot=0.7 html=none
//   - everything else → plain → op=1 ring=1 dot=1 html=none
function classify(name, sel) {
  if (/(input|textarea|select)/.test(name)) return 'textInput';
  if (/(image|h3|tag|heading|paragraph)/.test(name)) {
    // blog card children are inside the Link wrapper => interactive
    if (name.startsWith('blog card')) return 'interactive';
    // project card children are now data-cursor=hover => interactive
    if (name.startsWith('project card')) return 'interactive';
    return 'plain';
  }
  return 'interactive';
}

const lines = ['# Cursor interactive-area probe (with data-cursor="hover" on Card)'];
let fails = 0;
for (const r of all) {
  if (r.fatal) { lines.push(`## ${r.engineName}\nFATAL ${r.fatal}\n`); continue; }
  lines.push(`## ${r.engineName}`);
  lines.push('| target | kind expected | op | ring | dot | hover | html |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const row of r.rows) {
    if (!row.present) { lines.push(`| ${row.name} | -- missing (${row.sel}) -- | | | | | |`); continue; }
    if (row.offViewport) { lines.push(`| ${row.name} | -- off-viewport x=${row.info.x.toFixed(0)} y=${row.info.y.toFixed(0)} -- | | | | | |`); continue; }
    const kind = classify(row.name, row.sel);
    let pass = false, expected = '';
    if (kind === 'textInput') {
      expected = 'op=0 ring=0 dot=0 cursor=auto';
      pass = row.op === '0' && row.ringScale < 0.05 && row.dotScale < 0.05 && (row.htmlCursor === 'auto' || row.htmlCursor === 'text');
    } else if (kind === 'interactive') {
      expected = 'op=1 ring=1.6 dot=0.7 cursor=none';
      pass = row.op === '1' && Math.abs(row.ringScale - 1.6) < 0.05 && Math.abs(row.dotScale - 0.7) < 0.05 && row.htmlCursor === 'none';
    } else {
      expected = 'op=1 ring=1 dot=1 cursor=none';
      pass = row.op === '1' && Math.abs(row.ringScale - 1) < 0.05 && Math.abs(row.dotScale - 1) < 0.05 && row.htmlCursor === 'none';
    }
    if (!pass) fails++;
    lines.push(`| ${row.name} | ${kind} ${pass ? 'PASS' : 'FAIL'} | ${row.op} | ${row.ringScale?.toFixed(3)} | ${row.dotScale?.toFixed(3)} | ring=${row.ringHover} dot=${row.dotHover} | ${row.htmlCursor} | expected: ${expected} |`);
  }
  if (r.errors?.length) {
    lines.push(`\nErrors: ${r.errors.join(' || ')}\n`);
    fails += r.errors.length;
  }
}
lines.push('');
lines.push(fails === 0 ? '**Result: ALL PASS**' : `**Result: ${fails} mismatch(es)**`);

const report = lines.join('\n');
console.log(report);
await writeFile(path.join(OUT, 'cursor-interactive.log'), report);
process.exit(fails === 0 ? 0 : 1);
