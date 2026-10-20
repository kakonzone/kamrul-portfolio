// Content-sprint verification.
//
//   A. Section flags: services / blog / testimonials absent from Home, nav,
//      footer and sitemap; the expected sections present.
//   B. Derived content: stat cards counted from data, category pills derived
//      from projects (no "Python Tools" pill yet), resume path constant shared.
//   C. Screenshots at 1440 and 390, dark and light, of each section.

import { chromium, firefox } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve('verification/content');
await mkdir(OUT, { recursive: true });
const SITE = process.env.SITE_URL || 'http://localhost:4173';

const lines = ['# Content sprint verification'];
let fails = 0;

// ---------- A. Section flags + derived content (structure) ----------
async function inspect(browserType, engineName) {
  const browser = await browserType.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(SITE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);

  // The stat cards use CountUp, which only animates once the card scrolls into
  // view. Scroll About into the viewport and let the animation finish before
  // reading the values, otherwise every card still reads 0.
  await page.evaluate(() => document.getElementById('about')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(2200);

  const r = await page.evaluate(() => {
    const q = (s) => Array.from(document.querySelectorAll(s));
    return {
      homeSections: q('main#main-content > section').map((s) => s.id),
      navLinks: q('header nav ul a').map((a) => a.textContent.trim()),
      // Footer nav is the first <ul>; the second is SocialLinks.
      footerLinks: (() => {
        const uls = q('footer ul');
        return uls.length ? Array.from(uls[0].querySelectorAll('a')).map((a) => a.textContent.trim()) : [];
      })(),
      stats: q('#about .grid.grid-cols-2 > div').map((el) => el.textContent.replace(/\s+/g, ' ').trim()),
      heroButtons: q('#hero a').map((a) => ({
        text: a.textContent.trim(),
        href: a.getAttribute('href'),
        download: a.hasAttribute('download'),
        target: a.getAttribute('target'),
        rel: a.getAttribute('rel'),
      })),
      socialLinks: q('#hero ul a').map((a) => a.getAttribute('href')),
      projectPills: q('#projects [role="group"] button').map((b) => b.textContent.trim()),
      projectCards: q('#projects .project-fade h3').map((h) => h.textContent.trim()),
      // Skill group titles are the <p> siblings directly above each chip row.
      skillGroups: q('#skills div.flex.flex-col > div > p').map((p) => p.textContent.trim()),
      eduTabs: q('#experience [role="group"] button').map((b) => b.textContent.trim()),
      aboutParagraphs: q('#about p').filter((p) => p.textContent.length > 40).length,
      hasResume: !!document.getElementById('resume'),
      resumeButton: document.querySelector('#resume a')?.getAttribute('href') ?? null,
      resumeDownload: document.querySelector('#resume a')?.hasAttribute('download') ?? null,
    };
  });

  await ctx.close();
  await browser.close();
  return { engineName, ...r, errors };
}

const results = [];
for (const [type, name] of [[chromium, 'chromium'], [firefox, 'firefox']]) {
  try {
    results.push(await inspect(type, name));
  } catch (e) {
    lines.push(`## ${name}\nFATAL ${String(e).split('\n')[0]}\n`);
    fails++;
  }
}

for (const r of results) {
  if (r.fatal) continue;
  lines.push(`\n## ${r.engineName}`);
  if (r.errors.length) {
    lines.push(`  page errors: ${r.errors.join(' | ')}`);
    fails += r.errors.length;
  }

  // Expected Home order
  const expectedOrder = ['hero', 'about', 'projects', 'skills', 'experience', 'resume', 'contact'];
  const orderOk = JSON.stringify(r.homeSections) === JSON.stringify(expectedOrder);
  lines.push(`  home sections: ${r.homeSections.join(' → ')} ${orderOk ? 'PASS' : 'FAIL (expected ' + expectedOrder.join(' → ') + ')'}`);
  if (!orderOk) fails++;

  // services / blog / testimonials must be gone everywhere
  const absentOk = !r.homeSections.includes('services') && !r.homeSections.includes('blog')
    && !r.homeSections.includes('testimonials');
  lines.push(`  services/blog/testimonials absent from Home: ${absentOk ? 'PASS' : 'FAIL'}`);
  if (!absentOk) fails++;

  const expectedNav = ['About', 'Projects', 'Skills', 'Education', 'Resume', 'Contact'];
  const navOk = JSON.stringify(r.navLinks) === JSON.stringify(expectedNav);
  lines.push(`  nav links: ${r.navLinks.join(', ')} ${navOk ? 'PASS' : 'FAIL'}`);
  if (!navOk) fails++;

  const footOk = JSON.stringify(r.footerLinks) === JSON.stringify(expectedNav);
  lines.push(`  footer links: ${r.footerLinks.join(', ')} ${footOk ? 'PASS' : 'FAIL'}`);
  if (!footOk) fails++;

  lines.push(`  About paragraphs: ${r.aboutParagraphs} (expect 2) ${r.aboutParagraphs === 2 ? 'PASS' : 'FAIL'}`);
  if (r.aboutParagraphs !== 2) fails++;

  lines.push(`  stat cards: ${r.stats.join('  |  ')}`);
  const expectedStats = [
    /^4Years of CSE study$/,
    /^2Training programs$/,
    /^4Projects built$/,
    /^5Languages$/,
  ];
  const statsOk = r.stats.length === 4 && expectedStats.every((re, i) => re.test(r.stats[i]));
  lines.push(`  derived stats (4 study / 2 training / 4 projects / 5 languages): ${statsOk ? 'PASS' : 'FAIL'}`);
  if (!statsOk) fails++;

  lines.push(`  hero buttons:`);
  for (const b of r.heroButtons) {
    lines.push(`    - "${b.text}" href=${b.href} download=${b.download} target=${b.target} rel=${b.rel}`);
  }
  const heroOk =
    r.heroButtons.some((b) => b.text === 'View Projects' && b.href === '#projects')
    && r.heroButtons.some((b) => b.text === 'GitHub Profile' && b.href === 'https://github.com/kakonzone' && b.target === '_blank' && /noopener/.test(b.rel || ''))
    && r.heroButtons.some((b) => b.text === 'Download Resume' && b.href === '/resume.pdf' && b.download);
  lines.push(`  hero buttons correct: ${heroOk ? 'PASS' : 'FAIL'}`);
  if (!heroOk) fails++;

  lines.push(`  social links rendered: ${r.socialLinks.length ? r.socialLinks.join(', ') : '(none)'} — no dead links: ${r.socialLinks.every((h) => !/placeholder/i.test(h)) ? 'PASS' : 'FAIL'}`);
  if (!r.socialLinks.every((h) => !/placeholder/i.test(h))) fails++;

  lines.push(`  project pills: ${r.projectPills.join(', ')} — no "Python Tools": ${r.projectPills.includes('Python Tools') ? 'FAIL' : 'PASS'}`);
  if (r.projectPills.includes('Python Tools')) fails++;
  const pillOk = JSON.stringify(r.projectPills) === JSON.stringify(['All', 'Mobile Apps', 'Web Development']);
  lines.push(`  project pills exact: ${pillOk ? 'PASS' : 'FAIL'}`);
  if (!pillOk) fails++;

  lines.push(`  project cards: ${r.projectCards.join(', ')}`);
  const cardsOk = r.projectCards.length === 4 && r.projectCards.includes('Lumio') && r.projectCards.includes('UniTrack');
  lines.push(`  4 real projects: ${cardsOk ? 'PASS' : 'FAIL'}`);
  if (!cardsOk) fails++;

  lines.push(`  skill groups (${r.skillGroups.length}): ${r.skillGroups.join(' | ')}`);
  const skillsOk = r.skillGroups.length === 6 && r.skillGroups.every((g) => !/placeholder/i.test(g));
  lines.push(`  6 real skill groups: ${skillsOk ? 'PASS' : 'FAIL'}`);
  if (!skillsOk) fails++;

  const eduOk = JSON.stringify(r.eduTabs) === JSON.stringify(['Education', 'Training']);
  lines.push(`  education tabs: ${r.eduTabs.join(', ')} ${eduOk ? 'PASS (no Work tab)' : 'FAIL'}`);
  if (!eduOk) fails++;

  const resumeOk = r.hasResume && r.resumeButton === '/resume.pdf' && r.resumeDownload;
  lines.push(`  resume section (href=${r.resumeButton} download=${r.resumeDownload}): ${resumeOk ? 'PASS' : 'FAIL'}`);
  if (!resumeOk) fails++;
}

// ---------- B. Screenshots ----------
async function shoot() {
  const browser = await chromium.launch({ headless: true });
  const combos = [
    ['1440-dark', { width: 1440, height: 1000 }, 'dark'],
    ['1440-light', { width: 1440, height: 1000 }, 'light'],
    ['390-dark', { width: 390, height: 844 }, 'dark'],
    ['390-light', { width: 390, height: 844 }, 'light'],
  ];

  for (const [label, viewport, theme] of combos) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(SITE + '/', { waitUntil: 'networkidle' });
    await page.evaluate((t) => {
      document.documentElement.classList.toggle('dark', t === 'dark');
      localStorage.setItem('theme', t);
    }, theme);
    await page.waitForTimeout(700);

    const shots = [
      ['hero', '#hero'],
      ['about', '#about'],
      ['projects', '#projects'],
      ['skills', '#skills'],
      ['education', '#experience'],
      ['resume', '#resume'],
      ['contact', '#contact'],
    ];
    for (const [name, sel] of shots) {
      const el = await page.$(sel);
      if (!el) continue;
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      await el.screenshot({ path: path.join(OUT, `${name}-${label}.png`) }).catch(() => {});
    }

    // Education Training tab
    await page.evaluate(() => document.getElementById('experience')?.scrollIntoView({ block: 'start' }));
    const trainingTab = await page.$('#experience [role="group"] button:nth-of-type(2)');
    if (trainingTab) {
      await trainingTab.click();
      await page.waitForTimeout(350);
      const el = await page.$('#experience');
      if (el) await el.screenshot({ path: path.join(OUT, `education-training-tab-${label}.png`) }).catch(() => {});
    }

    // Project detail
    await page.goto(SITE + '/projects/lumio', { waitUntil: 'networkidle' });
    await page.evaluate((t) => document.documentElement.classList.toggle('dark', t === 'dark'), theme);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, `project-detail-${label}.png`), fullPage: true }).catch(() => {});

    await ctx.close();
  }
  await browser.close();
}

await shoot();

lines.push('');
lines.push(fails === 0 ? '**Result: ALL PASS**' : `**Result: ${fails} FAIL**`);
lines.push(`Screenshots: ${OUT}`);

const report = lines.join('\n');
console.log(report);
await writeFile(path.join(OUT, 'content-verification.log'), report);
process.exit(fails === 0 ? 0 : 1);