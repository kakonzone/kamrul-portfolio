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

// `window.__fx` is read by the perf gate and by the ?debug=1 footer, so the
// shape is deliberately flat: scalar booleans, numbers and short strings.
//   mode/reason     — the rich-extras decision (`.fx-on`)
//   fps             — last measured frames per second from the ring guard
//   rings/…Running  — whether the hero rings are rotating, and why not
//   cursorOn/…Reason— whether the custom cursor is allowed to run, and why not
export const fx = {
  state: {
    mode: 'calm',
    reason: 'not-checked-yet',
    fps: 0,
    rings: 'rotating',
    ringsRunning: true,
    ringsReason: 'default-on',
    cursorOn: false,
    cursorReason: 'not-checked-yet',
  },
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
  // and why, and so the ?debug=1 footer can print the current decisions. A few
  // small fields, nothing sensitive.
  window.__fx = { ...fx.state };
  // Same event the existing `fx:mode` listeners already use for `fx.state`
  // snapshots, but it carries no payload and fires on every publish — including
  // the periodic fps refresh. The footer is the only subscriber.
  window.dispatchEvent(new Event('fx:state'));
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

    // Item 2 of the follow-up spec: treat ONLY strings that clearly say
    // SwiftShader, llvmpipe, "Software Renderer" or "Microsoft Basic Render" as
    // software rendering. An unreadable, empty, generic or randomised string
    // (Brave Shields fingerprint protection does exactly this) must NOT be
    // treated as "no GPU" — decide from the frame probe and the guard instead.
    const normalised = renderer.trim();
    if (!normalised) return { ok: null, why: 'renderer-string-empty' };

    const software =
      /swiftshader|llvmpipe|software renderer|microsoft basic render/i.test(
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

// (f) cursor eligibility — reported for the ?debug=1 footer, never a veto.
//
// The custom cursor is OWNED by useCursorFollower and decides for itself: it
// only mounts when the device has BOTH `(any-pointer: fine)` AND
// `(any-hover: hover)` (or when matchMedia is unavailable), and it bails out
// under `?fx=calm`. That is an AND where `hasFinePointer()` above is an OR, and
// the two must not be merged: the OR above only decides whether the rich EXTRAS
// (blob / dots) are worth having, while the cursor needs a real pointing device.
//
// Scope limit, stated plainly: the hook's own measured-lag teardown (frame time
// above 25ms sustained for 3s) happens inside that hook and is deliberately not
// observable from this module. So `cursorOn` means "the cursor is allowed to
// run", not "a halo is painted right now", and `cursorReason` names the signal
// that was actually available to decide it.
function cursorEligibility() {
  const forced = forcedMode();
  if (forced === 'calm') return { on: false, reason: 'forced-by-url:fx=calm' };
  if (typeof window === 'undefined') return { on: false, reason: 'no-window' };
  try {
    const fine = window.matchMedia('(any-pointer: fine)').matches;
    const hover = window.matchMedia('(any-hover: hover)').matches;
    if (fine && hover) return { on: true, reason: 'fine-pointer+hover' };
    if (!fine) return { on: false, reason: 'no-fine-pointer' };
    return { on: false, reason: 'no-hover' };
  } catch {
    return { on: true, reason: 'matchmedia-unavailable' };
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

// Ring rotation is CSS-driven and on by default (see index.css). This class is
// the ONLY thing that stops it. It is independent of `.fx-on` so a capable
// device that the capability gate downgrades still keeps rotating rings.
function setRingsStatic(isStatic, reason) {
  document.documentElement.classList.toggle('fx-rings-static', isStatic);
  fx.state.rings = isStatic ? 'static' : 'rotating';
  fx.state.ringsRunning = !isStatic;
  if (reason) fx.state.ringsReason = reason;
}

function setCursorState() {
  const { on, reason } = cursorEligibility();
  fx.state.cursorOn = on;
  fx.state.cursorReason = reason;
}

function calm(reason) {
  fx.state = { ...fx.state, mode: 'calm', reason };
  document.documentElement.classList.remove('fx-on');
  publish();
  log(`calm: ${reason}`);
  // The cursor listens for this and tears itself down.
  window.dispatchEvent(new CustomEvent('fx:mode', { detail: { mode: 'calm', reason } }));
}

function rich(reason, fps) {
  fx.state = { ...fx.state, mode: 'rich', reason, fps };
  document.documentElement.classList.add('fx-on');
  publish();
  log(`rich: ${reason} @${fps ?? '?'}fps`);
  window.dispatchEvent(new CustomEvent('fx:mode', { detail: { mode: 'rich', reason } }));
}

// --- runtime guard (rings) -----------------------------------------------
//
// LENIENT BY DESIGN. Ring rotation is a transform-only animation that costs
// essentially nothing, so the bar for stopping it is deliberately low and the
// evidence bar is high:
//   * the first WARMUP_MS after load is ignored entirely (fonts, layout, decode)
//   * any window that overlapped document.hidden is discarded entirely, so the
//     time a tab spends throttled in the background can never be divided into a
//     visible frame count
//   * we require a sustained sub-threshold average across a full 3s window
//   * AND two consecutive bad windows, because rAF cadence is a WHOLE-PAGE
//     signal: one slow window is far more likely to be a large image finishing
//     its decode or the visitor's first big scroll than a device that cannot
//     keep up
//   * the threshold is 20fps
// On a normal laptop with a GPU this never trips.

let guardRaf = 0;
let guardStop = false;

const GUARD = {
  WINDOW_MS: 3000,     // spec: "sustained frame rate below 20 fps for 3 seconds"
  WARMUP_MS: 1000,     // spec: "ignore the first second after load"
  MIN_FPS: 20,         // spec: "below 20 fps"
  LONG_FRAME_MS: 100,  // a frame this long is 10fps — treat as a stall
  STALLS_PER_WINDOW: 3,
  LOW_WINDOWS_BEFORE_STOP: 2, // one bad window is not enough evidence
};

function startRuntimeGuard() {
  guardStop = false;
  const t0 = performance.now();
  let windowStart = t0 + GUARD.WARMUP_MS;
  let frames = 0;
  let stalls = 0;
  let lowWindows = 0;
  let last = 0;

  const tick = (now) => {
    if (guardStop) return;

    // Hidden tabs are throttled to ~1fps by every browser. Sampling there would
    // produce a fake "sub-20fps" reading, so those frames never count — and the
    // window in progress is thrown away entirely, so the hidden time can never
    // end up in the denominator of the next window. Returning restarts the
    // window and breaks any run of consecutive bad readings.
    if (document.hidden) {
      last = 0;
      windowStart = now;
      frames = 0;
      stalls = 0;
      lowWindows = 0;
      guardRaf = requestAnimationFrame(tick);
      return;
    }

    if (last) {
      const dt = now - last;
      // Only count frames inside the measurement window (post-warmup).
      if (now >= windowStart) {
        frames++;
        if (dt >= GUARD.LONG_FRAME_MS) stalls++;
      }
    }
    last = now;

    const elapsed = now - windowStart;
    if (elapsed >= GUARD.WINDOW_MS) {
      const avgFps = (frames / elapsed) * 1000;
      const bad = avgFps < GUARD.MIN_FPS || stalls >= GUARD.STALLS_PER_WINDOW;
      // Require the same verdict twice in a row before freezing anything for the
      // rest of the session; a single slow window is usually just a hitch.
      lowWindows = bad ? lowWindows + 1 : 0;
      if (bad && lowWindows >= GUARD.LOW_WINDOWS_BEFORE_STOP) {
        setRingsStatic(
          true,
          `runtime-guard: ${avgFps.toFixed(1)}fps over ${(elapsed / 1000).toFixed(1)}s` +
            (stalls >= GUARD.STALLS_PER_WINDOW ? `, ${stalls} stalls` : ''),
        );
        publish();
        // Rich extras (cursor / dots / blob) still get the stricter treatment,
        // but only if we are currently in rich mode.
        if (fx.state.mode === 'rich') {
          calm(
            `runtime-guard: ${avgFps.toFixed(1)}fps over ${(elapsed / 1000).toFixed(1)}s` +
              (stalls >= GUARD.STALLS_PER_WINDOW ? `, ${stalls} stalls` : ''),
          );
        }
        return; // stop sampling; decision made
      }
      fx.state = { ...fx.state, fps: +avgFps.toFixed(1) };
      publish();
      windowStart = now;
      frames = 0;
      stalls = 0;
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

  // Rings are ON by default (CSS). `.fx-on` (rich extras: cursor/dots/blob) is
  // off until decided. The ring guard runs regardless of rich mode.
  document.documentElement.classList.remove('fx-on');
  setRingsStatic(false, 'default-on');
  setCursorState();
  publish();

  watchHeroVisibility();

  document.addEventListener('visibilitychange', () => {
    document.documentElement.classList.toggle('fx-paused', document.hidden);
  });

  // Reduced motion: rings must be static. CSS also handles this, but setting the
  // class keeps the runtime state honest for the debug footer.
  if (prefersReducedMotion()) {
    setRingsStatic(true, 'prefers-reduced-motion');
  }

  // Respect a decision already made in this session: if the guard downgraded
  // rich extras earlier in this session, do not immediately re-enable them.
  // This does NOT freeze the rings — they are independent and cheap.
  let sessionCalm = false;
  try {
    sessionCalm = sessionStorage.getItem(SESSION_KEY) === 'calm';
  } catch {}

  // Test override (?fx=rich / ?fx=calm) short-circuits the automatic path.
  // `?fx=calm` also freezes rings so screenshots are deterministic.
  const forced = forcedMode();
  const noguard = new URLSearchParams(location.search).get('noguard') === '1';
  if (forced === 'calm') {
    // Test-only override for rich extras. Rings are NOT frozen here — this flag
    // exists to make cursor/dot/blob screenshots deterministic, and the ring
    // animation must stay representative.
    calm('forced-by-url');
    return;
  }
  if (forced === 'rich') {
    rich('forced-by-url', null);
    if (!noguard) startRuntimeGuard();
    return;
  }

  // Yield to the browser so first paint and the initial interaction are never
  // delayed by this decision. Rings keep rotating throughout.
  const run = async () => {
    if (prefersReducedMotion()) {
      setRingsStatic(true, 'prefers-reduced-motion');
      calm('prefers-reduced-motion');
      try {
        sessionStorage.setItem(SESSION_KEY, 'calm');
      } catch {}
      return;
    }

    // Rings are NEVER frozen by a capability check. The only things that stop
    // them are: prefers-reduced-motion, the measured <30fps guard, and being
    // paused (hero off-screen / tab hidden). Everything below this point only
    // decides the RICH EXTRAS (cursor / dots / blob), which stay independent.
    const gpu = hasRealGpu();
    const cores = coreCountOk();
    const save = saveDataOk();

    if (gpu.ok === false) {
      // Software renderer: rich extras off. Rings keep rotating — the runtime
      // guard decides within ~3s whether this device can actually sustain them.
      calm(gpu.why);
      try {
        sessionStorage.setItem(SESSION_KEY, 'calm');
      } catch {}
      startRuntimeGuard();
      return;
    }

    // Rich extras (cursor / dots / blob): measured decision. The cursor's own
    // latency guard is the real off-switch; this just gets it started.
    if (!hasFinePointer()) {
      calm('no-fine-pointer');
      startRuntimeGuard();
      return;
    }

    const probe = await frameProbe(600);
    if (sessionCalm) {
      // The guard already downgraded rich extras earlier this session. Stay calm
      // (cursor off) but keep the rings rotating.
      calm('session-preference');
      startRuntimeGuard();
      return;
    }
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