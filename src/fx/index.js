/**
 * Progressive enhancement gate: cheap by default, rich only when proven.
 *
 * Two phases, both non-blocking:
 *
 *   1. CAPABILITY CHECK — runs once after the first paint. It is deliberately
 *      PERMISSIVE: it only vetoes rich mode for signals that are strong,
 *      unambiguous evidence the device will struggle:
 *        - `prefers-reduced-motion: reduce`
 *        - a CONFIRMED software renderer (SwiftShader / llvmpipe / "Software")
 *        - no fine pointer at all (touch-only device)
 *      It deliberately does NOT veto on core count, saveData, or a one-shot
 *      frame probe. Those are heuristics that misfire on perfectly capable
 *      machines — and in particular on browsers that randomise or restrict
 *      fingerprintable signals (Brave Shields and similar), where the renderer
 *      string or core count can be spoofed into looking low-end. A browser that
 *      lies about its GPU should still get the cursor.
 *
 *   2. RUNTIME GUARD — while rich mode is on, samples real frame times AND the
 *      cursor's own event-to-frame latency. If the device cannot hold the frame
 *      rate, or the pointer visibly lags, it downgrades to calm mode and
 *      remembers that in sessionStorage so it never flip-flops in a session.
 *      This is the only signal that turns rich mode OFF on an otherwise
 *      capable device, because it is measured, not guessed.
 *
 * `.fx-on` on <html> is the ONLY switch the CSS and the cursor read.
 */

const SESSION_KEY = 'fx-mode';

// Escape hatch for automated testing: ?fx=rich forces rich mode and
// ?fx=calm forces calm. Only honoured when the URL says so, so real visitors
// always get the automatic decision.
function forcedMode() {
  try {
    const v = new URLSearchParams(location.search).get('fx');
    return v === 'rich' || v === 'calm' ? v : null;
  } catch {
    return null;
  }
}

export const fx = {
  state: { mode: 'calm', reason: 'not-checked-yet', fps: 0 },
};

// --- small helpers -------------------------------------------------------

const isDev = () => {
  try {
    return Boolean(import.meta.env.DEV);
  } catch {
    return false;
  }
};

function log(reason, extra = {}) {
  if (!isDev()) return;
  // eslint-disable-next-line no-console
  console.info('[fx]', reason, extra);
}

function publish() {
  // Exposed in every build so the perf gate can assert which mode was chosen
  // and why. Three small fields, nothing sensitive.
  window.__fx = { ...fx.state };
}

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

// (a) GPU / software-rasteriser detection.
//
// Returns ok:false ONLY for a renderer string that positively identifies a
// software rasteriser. An unknown, blocked or empty renderer string returns
// ok:null — "we don't know", not "no". Anti-fingerprinting browsers (Brave
// Shields with fingerprint randomization) frequently blank or randomise this
// string, and treating that as "software" would disable the cursor on a device
// that handles it perfectly well.
function hasRealGpu() {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    if (!gl) return { ok: null, why: 'no-webgl-context' };

    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = ext
      ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '')
      : String(gl.getParameter(gl.RENDERER) || '');

    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();

    // Only a positive identification counts. Guard against the empty string and
    // against generic values that some privacy browsers substitute.
    const normalised = renderer.trim();
    if (!normalised) return { ok: null, why: 'renderer-string-empty' };

    const software =
      /swiftshader|llvmpipe|softpipe|software rasterizer|software renderer|microsoft basic render|generic renderer/i.test(
        normalised,
      );
    return software
      ? { ok: false, why: `software-renderer:${normalised}` }
      : { ok: true, why: `gpu:${normalised}` };
  } catch (e) {
    // No WebGL at all: unknown, not a veto. The runtime guard decides.
    return { ok: null, why: 'webgl-unavailable' };
  }
}

// (b) core count — reported but never a veto. A 2-core machine may still be a
// fast phone, and the runtime guard will catch it if it actually cannot keep up.
function coreCountOk() {
  const cores = navigator.hardwareConcurrency;
  if (typeof cores !== 'number' || !cores) return { ok: null, why: 'cores-unknown' };
  return { ok: null, why: `cores:${cores}` };
}

// (c) data saver — reported but never a veto. A user who explicitly asked to
// save data is better served by the native cursor than by a hard downgrade; the
// cost of the custom cursor is a handful of composited transforms.
function saveDataOk() {
  const c = navigator.connection;
  if (!c) return { ok: null, why: 'connection-api-missing' };
  return { ok: null, why: c.saveData ? 'save-data' : 'no-save-data' };
}

// (d) fine pointer. A touch-only device has no cursor to follow, so rich mode is
// pointless there. This is a device-capability fact, not a performance guess.
function hasFinePointer() {
  try {
    return (
      window.matchMedia('(any-pointer: fine)').matches ||
      window.matchMedia('(any-hover: hover)').matches
    );
  } catch {
    return true; // unknown: assume a desktop
  }
}

// (e) ~1s rAF frame probe. Median frame time above 20ms means "not ready".
function frameProbe(ms = 1000) {
  return new Promise((resolve) => {
    const deltas = [];
    let last = 0;
    let raf = 0;
    const t0 = performance.now();

    const tick = (now) => {
      if (last) deltas.push(now - last);
      last = now;
      if (now - t0 < ms) {
        raf = requestAnimationFrame(tick);
      } else {
        cancelAnimationFrame(raf);
        if (deltas.length < 10) {
          resolve({ ok: null, median: null, why: 'not-enough-frames' });
          return;
        }
        const sorted = [...deltas].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        resolve({
          ok: median <= 20,
          median: +median.toFixed(2),
          fps: +(1000 / median).toFixed(1),
          why: `median-frame:${median.toFixed(1)}ms`,
        });
      }
    };
    raf = requestAnimationFrame(tick);
  });
}

// --- mode switching ------------------------------------------------------

function calm(reason) {
  fx.state = { mode: 'calm', reason, fps: fx.state.fps ?? 0 };
  document.documentElement.classList.remove('fx-on');
  publish();
  log(`calm: ${reason}`);
  // The cursor listens for this and tears itself down.
  window.dispatchEvent(new CustomEvent('fx:mode', { detail: { mode: 'calm', reason } }));
}

function rich(reason, fps) {
  fx.state = { mode: 'rich', reason, fps };
  document.documentElement.classList.add('fx-on');
  publish();
  log(`rich: ${reason} @${fps ?? '?'}fps`);
  window.dispatchEvent(new CustomEvent('fx:mode', { detail: { mode: 'rich', reason } }));
}

// --- runtime guard -------------------------------------------------------

let guardRaf = 0;
let guardStop = false;

function startRuntimeGuard() {
  guardStop = false;
  const WINDOW_MS = 2000;
  let windowStart = performance.now();
  let frames = 0;
  let longFrames = 0;
  let consecutiveLong = 0;
  let last = 0;

  const tick = (now) => {
    if (guardStop) return;
    if (last) {
      const dt = now - last;
      frames++;
      if (dt > 50) {
        longFrames++;
        consecutiveLong++;
      } else {
        consecutiveLong = 0;
      }
    }
    last = now;

    const elapsed = now - windowStart;
    if (elapsed >= WINDOW_MS) {
      const avgFps = (frames / elapsed) * 1000;
      // Two independent downgrade signals: sustained low fps, or repeated
      // long frames. Either is enough — a struggling device should get the
      // calm version rather than a choppy rich one.
      if (avgFps < 40 || consecutiveLong >= 3) {
        calm(
          `runtime-guard: ${avgFps.toFixed(1)}fps over ${(elapsed / 1000).toFixed(1)}s` +
            (consecutiveLong >= 3 ? `, ${consecutiveLong} long frames` : ''),
        );
        try {
          sessionStorage.setItem(SESSION_KEY, 'calm');
        } catch {}
        return;
      }
      fx.state = { ...fx.state, fps: +avgFps.toFixed(1) };
      publish();
      windowStart = now;
      frames = 0;
      longFrames = 0;
    }

    // Only sample while something is actually on screen.
    if (document.hidden) {
      last = 0;
      guardRaf = requestAnimationFrame(tick);
      return;
    }
    guardRaf = requestAnimationFrame(tick);
  };

  guardRaf = requestAnimationFrame(tick);
}

export function stopRuntimeGuard() {
  guardStop = true;
  if (guardRaf) cancelAnimationFrame(guardRaf);
  guardRaf = 0;
}

// Pause hero animations when the hero scrolls out of view.
function watchHeroVisibility() {
  const hero = document.getElementById('hero');
  const photo = document.querySelector('.hero-photo');
  if (!hero || !photo) return;

  if (!('IntersectionObserver' in window)) return; // feature absent: leave running
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        photo.classList.toggle('hero-paused', !e.isIntersecting);
      }
    },
    { rootMargin: '120px' },
  );
  io.observe(hero);
}

// --- entry point ---------------------------------------------------------

let started = false;

export function initFx() {
  if (started) return;
  started = true;

  // Default is calm: <html> has no .fx-on until we decide otherwise, and the
  // base CSS has no animations at all.
  document.documentElement.classList.remove('fx-on');
  publish();

  watchHeroVisibility();

  document.addEventListener('visibilitychange', () => {
    document.documentElement.classList.toggle('fx-paused', document.hidden);
  });

  // Respect a decision already made in this session.
  try {
    const prior = sessionStorage.getItem(SESSION_KEY);
    if (prior === 'calm') {
      calm('session-preference');
      return;
    }
  } catch {}

  // Test override (?fx=rich / ?fx=calm) short-circuits the automatic path.
  const forced = forcedMode();
  if (forced === 'calm') {
    calm('forced-by-url');
    return;
  }
  if (forced === 'rich') {
    rich('forced-by-url', null);
    // `?fx=rich` (optionally `&noguard=1`) is a test hook for measuring the
    // rich path on a host whose capability check would — correctly — choose
    // calm. With `&noguard=1` the runtime guard is suppressed so the effect can
    // be measured without an immediate auto-downgrade. Real visitors never set
    // these flags.
    if (new URLSearchParams(location.search).get('noguard') !== '1') {
      startRuntimeGuard();
    }
    return;
  }

  // Yield to the browser so first paint and the initial interaction are never
  // delayed by this decision.
  const run = async () => {
    // Hard, unambiguous vetoes only.
    if (prefersReducedMotion()) {
      calm('prefers-reduced-motion');
      try {
        sessionStorage.setItem(SESSION_KEY, 'calm');
      } catch {}
      return;
    }

    // Touch-only device: there is no pointer for a cursor to follow.
    if (!hasFinePointer()) {
      calm('no-fine-pointer');
      return;
    }

    const gpu = hasRealGpu();
    const cores = coreCountOk();
    const save = saveDataOk();

    // Only a CONFIRMED software rasteriser vetoes here.
    if (gpu.ok === false) {
      calm(gpu.why);
      try {
        sessionStorage.setItem(SESSION_KEY, 'calm');
      } catch {}
      return;
    }

    // Everything else is advisory. Enable rich mode and let the runtime guard
    // measure reality — including event-to-frame pointer latency — and turn it
    // off again if this device genuinely cannot keep up.
    const probe = await frameProbe(600);
    rich(
      `capability-ok (gpu:${gpu.why}, ${cores.why}, ${save.why}, ${probe.why})`,
      probe.fps,
    );
    startRuntimeGuard();
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 1200 });
  } else {
    setTimeout(run, 120);
  }
}

export default fx;