// Step 0 close-out probes for Sprint 4.
//
//   (A) Contact form: intercept the configured endpoint and return 500.
//       Fill the form with values, submit, then read:
//         - the form is still rendered (no success state)
//         - the error alert is visible with text including "HTTP 500"
//         - all input values are kept (user can re-submit without retyping)
//
//   (B) Navbar from /blog/<slug>: click the "Blog" link in the navbar
//       while on a blog detail page. Expect:
//         - URL eventually becomes "/"
//         - #blog section is in viewport (scrolled to)
//       Repeat for /projects/<slug> -> click Contact in navbar.

import { chromium, firefox } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve('verification');
await mkdir(OUT, { recursive: true });
const SITE = process.env.SITE_URL || 'http://localhost:4173';

// We need a working endpoint so the production bundle actually tries to POST.
// vite build inlines `import.meta.env.VITE_CONTACT_ENDPOINT` at build time, so
// for the preview server we mock the fetch via Playwright route instead.
const TEST_ENDPOINT = 'https://contact.test.local/submit';

async function probeContact(engineType, engineName) {
  const browser = await engineType.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    // Browser-emitted network error on mocked 500 is expected for the
    // failure-path probe — it's not an app bug.
    if (/Failed to load resource.*500/.test(text)) return;
    errors.push(`console.error: ${text}`);
  });

  // For any HTTP POST that isn't to /assets/ (which we don't make),
  // respond 500. This covers both build-time VITE_CONTACT_ENDPOINT and
  // the mailto-fallback path's lack of an HTTP call.
  await page.route('**/*', (route) => {
    const req = route.request();
    if (req.method() === 'POST') {
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'mocked failure' }),
      });
    }
    return route.continue();
  });

  await page.goto(SITE + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);

  // Scroll the contact section into view
  await page.evaluate(() => document.getElementById('contact')?.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForTimeout(150);

  // Fill the form
  const fillValues = {
    '#contact-name': 'Probe User',
    '#contact-email': 'probe@example.com',
    '#contact-subject': 'Test 500',
    '#contact-message': 'This message tests the failed-request path with a 500 response.',
  };
  for (const [sel, val] of Object.entries(fillValues)) {
    await page.fill(sel, val);
  }

  // Submit
  await page.click('button[type="submit"]:has-text("Send message")');

  // Wait for the error alert to appear or 4s timeout
  await page
    .waitForSelector('[role="alert"]', { timeout: 4000 })
    .catch(() => null);

  const result = await page.evaluate(() => {
    const alert = document.querySelector('[role="alert"]');
    const name = document.querySelector('#contact-name');
    const email = document.querySelector('#contact-email');
    const subject = document.querySelector('#contact-subject');
    const message = document.querySelector('#contact-message');
    const success = !!document.querySelector('h3');
    const successTxt = Array.from(document.querySelectorAll('h3'))
      .map((h) => h.textContent)
      .find((t) => /message sent/i.test(t));
    return {
      alertText: alert?.textContent?.trim() ?? null,
      alertWith500: alert?.textContent?.includes('HTTP 500') ?? false,
      valuesKept: {
        name: name?.value,
        email: email?.value,
        subject: subject?.value,
        message: message?.value,
      },
      formStillRendered:
        !!document.querySelector('form') &&
        document.querySelector('#contact-name') !== null,
      successShown: successTxt ?? null,
    };
  });

  await ctx.close();
  await browser.close();
  return { engineName, probe: 'contact-fail', ...result, errors };
}

async function probeNav(engineType, engineName, fromSlug, clickLabel, expectId) {
  const browser = await engineType.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });

  await page.goto(SITE + fromSlug, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);

  // Read URL before
  const urlBefore = page.url();

  // Find the navbar <a> matching the label (not a footer link)
  const targetHref = await page.evaluate((label) => {
    const desktopNav = document.querySelector('header nav ul');
    if (!desktopNav) return null;
    const a = Array.from(desktopNav.querySelectorAll('a')).find(
      (x) => x.textContent.trim() === label,
    );
    return a ? a.getAttribute('href') : null;
  }, clickLabel);

  // Click via the locator so React Router handles the navigation
  await page.locator(`header nav a:text-is("${clickLabel}")`).first().click();

  // Give the router + scrollIntoView time. The Home page has many sections, so
  // we poll until either the element is in view or 2s elapses.
  let sectionInView = null;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(120);
    sectionInView = await page.evaluate((id) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        top: Math.round(r.top),
        windowH: window.innerHeight,
        // Smooth-scroll lands the section top near 0; allow up to 0.6 viewport
        inView: r.top >= -10 && r.top <= window.innerHeight * 0.6,
      };
    }, expectId);
    if (sectionInView?.inView) break;
  }

  const urlAfter = page.url();

  await ctx.close();
  await browser.close();
  return {
    engineName,
    probe: `nav-from-${fromSlug}-click-${clickLabel}`,
    urlBefore,
    urlAfter,
    targetHref,
    sectionInView,
    passed: urlAfter.endsWith('/#' + expectId) || urlAfter === SITE + '/',
    errors,
  };
}

const lines = ['# Sprint 4 Step 0 probes'];
let fails = 0;

// (A) Contact form 500 path
for (const [type, name] of [[chromium, 'chromium'], [firefox, 'firefox']]) {
  try {
    const r = await probeContact(type, name);
    lines.push(
      `## ${name} · ${r.probe}\n` +
        `- error alert text: "${r.alertText ?? '(none)'}"\n` +
        `- error alert mentions HTTP 500: ${r.alertWith500}\n` +
        `- form still rendered: ${r.formStillRendered}\n` +
        `- "Message sent" panel: ${r.successShown ?? '(no)'}\n` +
        `- values kept: ${JSON.stringify(r.valuesKept)}\n` +
        `- console errors: ${r.errors.length ? r.errors.join(' | ') : '(none)'}\n`,
    );
    const pass =
      r.alertWith500 &&
      r.formStillRendered &&
      r.valuesKept.name === 'Probe User' &&
      r.valuesKept.email === 'probe@example.com' &&
      r.valuesKept.subject === 'Test 500' &&
      r.valuesKept.message?.startsWith('This message tests') &&
      !r.successShown &&
      r.errors.length === 0;
    lines.push(pass ? '  RESULT: **PASS**\n' : '  RESULT: **FAIL**\n');
    if (!pass) fails++;
  } catch (e) {
    lines.push(`## ${name}\nFATAL ${e.message}\n`);
    fails++;
  }
}

// (B) Navbar from detail routes -> Home + scroll.
const blogSlug = '/blog/a-release-checklist-i-actually-use';
const projectSlug = '/projects/lumio';
for (const [type, name] of [[chromium, 'chromium'], [firefox, 'firefox']]) {
  for (const route of [
    { from: blogSlug, click: 'Projects', expect: 'projects' },
    { from: blogSlug, click: 'Contact', expect: 'contact' },
    { from: projectSlug, click: 'Projects', expect: 'projects' },
    { from: projectSlug, click: 'Contact', expect: 'contact' },
  ]) {
    try {
      const r = await probeNav(type, name, route.from, route.click, route.expect);
      lines.push(
        `## ${name} · ${r.probe}\n` +
          `- url before: ${r.urlBefore}\n` +
          `- url after:  ${r.urlAfter}\n` +
          `- link href:   ${r.targetHref}\n` +
          `- #${route.expect} in view: ${JSON.stringify(r.sectionInView)}\n` +
          `- console errors: ${r.errors.length ? r.errors.join(' | ') : '(none)'}\n`,
      );
      const inView = r.sectionInView?.inView === true;
      const onHome =
        r.urlAfter.endsWith('/#' + route.expect) || r.urlAfter === SITE + '/';
      const pass = inView && onHome && r.errors.length === 0;
      lines.push(pass ? '  RESULT: **PASS**\n' : '  RESULT: **FAIL**\n');
      if (!pass) fails++;
    } catch (e) {
      lines.push(`## ${name} · from ${route.from}\nFATAL ${e.message}\n`);
      fails++;
    }
  }
}

const report = lines.join('\n');
console.log(report);
await writeFile(path.join(OUT, 'step0-probes.log'), report);
process.exit(fails === 0 ? 0 : 1);
