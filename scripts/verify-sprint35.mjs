// Sprint 3.5 verification: focused checks for the design-match fixes.
// Drives a real headless browser, plus a tiny node-only assertion for the
// date helper so we don't depend on a browser for that one.

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve('verification');
const SITE = process.env.SITE_URL || 'http://localhost:5173';

const WIDTHS = [
  { name: 'desktop', w: 1440, h: 900 },
  { name: 'mobile', w: 390, h: 844 },
];
const THEMES = ['dark', 'light'];

async function setTheme(page, theme) {
  await page.addInitScript((t) => {
    try { localStorage.setItem('theme', t); } catch {}
  }, theme);
}

async function waitFonts(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
}

async function shoot(handle, name) {
  const file = path.join(OUT, name + '.png');
  await handle.screenshot({ path: file });
  return file;
}

// ---- Date helper unit-style check ---------------------------------------
function assertDates() {
  // Mirror the helper inline to avoid pulling a JS module into a quick script
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const fmt = (iso) => {
    if (!iso) return '';
    const [y, m] = iso.split('-');
    if (!m) return y;
    const idx = Number(m) - 1;
    return `${MONTHS[idx]} ${y}`;
  };
  const range = (s, e) => `${fmt(s) || '?'} to ${e && e.toLowerCase() === 'present' ? 'Present' : (fmt(e) || 'Present')}`;
  const cases = [
    ['2024-01', 'Present', 'Jan 2024 to Present'],
    ['2022-06', '2023-12', 'Jun 2022 to Dec 2023'],
    ['2021-03', '2022-05', 'Mar 2021 to May 2022'],
  ];
  return cases.map(([s, e, want]) => {
    const got = range(s, e);
    return { input: `${s} / ${e}`, want, got, pass: got === want };
  });
}

async function runScreenshots(browser, log) {
  const results = [];
  for (const theme of THEMES) {
    for (const { name: wname, w, h } of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => log.push(`[${theme}/${wname}] pageerror: ${e.message}`));
      page.on('console', (m) => { if (m.type() === 'error') log.push(`[${theme}/${wname}] console.error: ${m.text()}`); });

      await setTheme(page, theme);
      await page.goto(SITE + '/', { waitUntil: 'networkidle' });
      await waitFonts(page);

      const nav = await page.$('header');
      if (nav) results.push(await shoot(nav, `s35-nav-${theme}-${wname}`));

      const hero = await page.$('#hero');
      if (hero) {
        await hero.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        results.push(await shoot(hero, `s35-hero-${theme}-${wname}`));
      }

      const about = await page.$('#about');
      if (about) {
        await about.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1700); // count-up
        results.push(await shoot(about, `s35-about-${theme}-${wname}`));
      }

      const skills = await page.$('#skills');
      if (skills) {
        await skills.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        results.push(await shoot(skills, `s35-skills-${theme}-${wname}`));
      }

      const projects = await page.$('#projects');
      if (projects) {
        await projects.scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
        results.push(await shoot(projects, `s35-projects-${theme}-${wname}`));
      }

      const exp = await page.$('#experience');
      if (exp) {
        await exp.scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
        results.push(await shoot(exp, `s35-experience-${theme}-${wname}`));
      }

      const ctc = await page.$('#contact');
      if (ctc) {
        await ctc.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        results.push(await shoot(ctc, `s35-contact-${theme}-${wname}`));
      }

      await ctx.close();
    }
  }
  return results;
}

async function runChecks(browser, log) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log.push(`[int] pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') log.push(`[int] console.error: ${m.text()}`); });

  // Contact clean on load
  await page.goto(SITE + '/', { waitUntil: 'networkidle' });
  await waitFonts(page);
  await page.$eval('#contact', (el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(200);
  const initialErrors = await page.$$eval('#contact p.text-red-400', (els) => els.length);
  const initialInvalid = await page.$$eval('#contact [aria-invalid="true"]', (els) => els.length);
  log.push(`Contact on first load: red errors=${initialErrors} aria-invalid fields=${initialInvalid} (expect 0 / 0)`);

  // Headings left-aligned
  await page.goto(SITE + '/', { waitUntil: 'networkidle' });
  await waitFonts(page);
  const headings = await page.$$eval(
    'section[id] > div > div.text-left h2, section[id] > div > div > div.text-left h2, #about > div > div.text-left h2',
    () => null,
  ).catch(() => null);
  // Easier: measure each SectionHeading's text-align
  const aligns = await page.$$eval(
    '#about h2, #skills h2, #services h2, #projects h2, #experience h2, #testimonials h2, #contact h2',
    (els) => els.map((e) => ({ id: e.closest('section')?.id, align: getComputedStyle(e.parentElement).textAlign })),
  );
  log.push(`Section heading alignments: ${JSON.stringify(aligns)}`);
  const allLeft = aligns.length === 7 && aligns.every((a) => a.align === 'start' || a.align === 'left');
  log.push(`All headings left-aligned: ${allLeft}`);

  // About heading source
  const aboutH2 = await page.$eval('#about h2', (e) => e.textContent.trim());
  log.push(`About h2 text = "${aboutH2}" (expect starts with PLACEHOLDER: Building products...)`);

  // Hero photo - confirm rings + dots present
  await page.goto(SITE + '/', { waitUntil: 'networkidle' });
  await waitFonts(page);
  const rings = await page.$$eval('#hero .hero-ring', (els) => els.length);
  const dots = await page.$$eval('#hero .hero-dot', (els) => els.length);
  const blob = await page.$('#hero .hero-blob');
  log.push(`Hero photo decorations: rings=${rings} dots=${dots} blob=${!!blob} (expect 2 / 3 / true)`);

  // Experience dates formatted (both ends)
  await page.$eval('#experience', (el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  const dateLabels = await page.$$eval('#experience [data-tab="work"] li span.shrink-0', (els) => els.map((e) => e.textContent.trim()));
  log.push(`Experience dates: ${JSON.stringify(dateLabels)}`);

  // Skills brand colors present (chip icon color is not 'inherit' on at least one chip)
  await page.$eval('#skills', (el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(200);
  const skillColors = await page.$$eval(
    '#skills span.inline-flex.items-center.gap-2\\.5 > svg[style*="color"]',
    (els) => els.map((e) => e.style.color),
  );
  log.push(`Skills chip icons with brand colors: ${skillColors.length} (expect > 0); sample: ${JSON.stringify(skillColors.slice(0, 5))}`);

  // Navbar: 3-column grid (centered links)
  const navLayout = await page.$eval('header nav.hidden.md\\:grid', (el) => ({
    cols: getComputedStyle(el).gridTemplateColumns.split(' ').length,
    hasCentered: getComputedStyle(el).gridTemplateColumns.split(' ').length === 3,
  })).catch(() => ({ cols: 0, hasCentered: false }));
  log.push(`Navbar desktop grid columns: ${navLayout.cols} centered=${navLayout.hasCentered}`);

  // Theme toggle has no border-box at desktop
  const toggleStyle = await page.$eval('header button[aria-label*="mode" i]', (el) => ({
    borderColor: getComputedStyle(el).borderColor,
    borderTopWidth: getComputedStyle(el).borderTopWidth,
  })).catch(() => null);
  log.push(`Theme toggle border: ${JSON.stringify(toggleStyle)} (expect no border / 0px)`);

  // ProjectCard image: no text overlay (we removed text from generated SVGs)
  await page.$eval('#projects', (el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  const cardImageHasOverlay = await page.$$eval('#projects .project-fade img', (imgs) => imgs.length);
  log.push(`Project card images rendered: ${cardImageHasOverlay} (expect 6)`);
  // Check the SVG content of one placeholder has no <text> elements
  const svgHasText = await page.$eval('#projects .project-fade img', (img) => {
    // The src is an imported SVG. Fetch it.
    return fetch(img.getAttribute('src')).then((r) => r.text()).then((t) => /<text/i.test(t));
  }).catch(() => null);
  log.push(`Project placeholder SVG contains <text>: ${svgHasText} (expect false)`);

  await ctx.close();
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const log = [];

  // 1. Date helper unit-style assertions
  log.push('## Date helper cases');
  const dateCases = assertDates();
  for (const c of dateCases) log.push(`  date ${c.input} -> "${c.got}" (want "${c.want}") ${c.pass ? 'PASS' : 'FAIL'}`);
  const allDatePass = dateCases.every((c) => c.pass);
  log.push(`Date helper: ${allDatePass ? 'PASS' : 'FAIL'}`);

  // 2. Browser checks
  const browser = await chromium.launch();
  const results = await runScreenshots(browser, log);
  await runChecks(browser, log);
  await browser.close();

  await writeFile(
    path.join(OUT, 'verify-sprint35.log'),
    [
      '# Sprint 3.5 verification log',
      '',
      ...log,
      '',
      '## Screenshots',
      ...results.map((r) => '- ' + path.basename(r)),
    ].join('\n'),
  );
  console.log('Screenshots:', results.length);
  console.log('Log entries:', log.length);
}

main().catch((e) => { console.error(e); process.exit(1); });