// Step 1 probe: gather browser capability + per-section cursor data
// in a real headless Chromium (desktop context, NOT isMobile).
import { chromium } from 'playwright';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);

// A. MatchMedia values that decide whether the custom cursor + ring animations run
const media = await page.evaluate(() => {
  function m(q) { return window.matchMedia(q).matches; }
  return {
    prefersReducedMotion: m('(prefers-reduced-motion: reduce)'),
    prefersReducedMotionNoPref: m('(prefers-reduced-motion: no-preference)'),
    hover: m('(hover: hover)'),
    hover_none: m('(hover: none)'),
    anyHover: m('(any-hover: hover)'),
    anyHover_none: m('(any-hover: none)'),
    pointer_fine: m('(pointer: fine)'),
    pointer_coarse: m('(pointer: coarse)'),
    anyPointer_fine: m('(any-pointer: fine)'),
    anyPointer_coarse: m('(any-pointer: coarse)'),
    hasTouch: navigator.maxTouchPoints > 0,
    platform: navigator.platform,
    ua: navigator.userAgent,
  };
});
console.log('=== media queries ===');
console.log(JSON.stringify(media, null, 2));

// B. The custom cursor nodes: do they exist? what is their computed style?
const cursor = await page.evaluate(() => {
  const root = document.querySelector('.cursor-ring')?.parentElement;
  const ring = document.querySelector('.cursor-ring');
  const dot = document.querySelector('.cursor-dot');
  if (!root) return { found: false };
  const cs = getComputedStyle(root);
  const ringCs = ring ? getComputedStyle(ring) : null;
  return {
    found: true,
    container: {
      opacity: cs.opacity,
      position: cs.position,
      zIndex: cs.zIndex,
      pointerEvents: cs.pointerEvents,
    },
    ring: ringCs && {
      width: ringCs.width,
      height: ringCs.height,
      borderWidth: ringCs.borderWidth,
      borderColor: ringCs.borderColor,
      borderRadius: ringCs.borderRadius,
    },
  };
});
console.log('=== custom cursor nodes ===');
console.log(JSON.stringify(cursor, null, 2));

// C. Hero ring animation: is the morph keyframe actually applied?
const heroAnim = await page.evaluate(() => {
  const r1 = document.querySelector('.hero-ring-1');
  const r2 = document.querySelector('.hero-ring-2');
  if (!r1 || !r2) return { found: false };
  const cs1 = getComputedStyle(r1);
  const cs2 = getComputedStyle(r2);
  return {
    found: true,
    ring1: { animationName: cs1.animationName, animationDuration: cs1.animationDuration, borderRadius: cs1.borderRadius },
    ring2: { animationName: cs2.animationName, animationDuration: cs2.animationDuration, borderRadius: cs2.borderRadius },
  };
});
console.log('=== hero rings ===');
console.log(JSON.stringify(heroAnim, null, 2));

// D. CSS feature support probes
const css = await page.evaluate(() => {
  const probe = document.createElement('div');
  document.body.appendChild(probe);
  function supports(decls) {
    Object.assign(probe.style, decls);
    const ok = probe.style.length > 0;
    Object.assign(probe.style, Object.fromEntries(Object.keys(decls).map((k) => [k, ''])));
    return ok;
  }
  return {
    backdropFilter: supports({ WebkitBackdropFilter: 'blur(2px)', backdropFilter: 'blur(2px)' }),
    maskImage: supports({ WebkitMaskImage: 'linear-gradient(black, black)', maskImage: 'linear-gradient(black, black)' }),
    willChange: supports({ willChange: 'transform' }),
    colorMix: supports({ backgroundColor: 'color-mix(in srgb, red 50%, blue)' }),
    inset: supports({ inset: '0' }),
    hasSelector: (() => { try { document.querySelector(':has(*)'); return true; } catch { return false; } })(),
    atProperty: (() => { try { CSS.registerProperty?.({ name: '--x', syntax: '<color>' }); return true; } catch { return false; } })(),
    backdropFilterStaysWebkit: supports({ WebkitBackdropFilter: 'blur(2px)' }),
  };
});
console.log('=== CSS feature support ===');
console.log(JSON.stringify(css, null, 2));

await browser.close();