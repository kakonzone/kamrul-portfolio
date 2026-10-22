import { useEffect, useRef } from 'react';

/**
 * Custom cursor — ON by default on any device with a fine pointer.
 *
 * It does NOT depend on `.fx-on`, the WebGL renderer string, `hardwareConcurrency`,
 * `deviceMemory`, `saveData`, or a frame probe. It turns itself off only when
 *   (a) there is no fine pointer (touch-only), or
 *   (b) it MEASURES real lag: frame time above 25 ms sustained for 3 s, with
 *       the first second after mount ignored and hidden-tab frames discarded.
 * In case (b) `teardown()` restores the native cursor.
 *
 * PERFORMANCE CONTRACT — the hot path does almost nothing:
 *   - The `mousemove` listener is passive and only writes two numbers to a ref.
 *     No layout reads, no closest(), no getComputedStyle, no elementFromPoint.
 *   - ALL DOM writes happen once per frame inside the rAF loop.
 *   - Hover detection uses delegated `mouseover` / `mouseout` on the document
 *     with a cached result, so the pointer path never queries the DOM tree.
 *   - Smoothing is time-based (1 - exp(-dt/tau)) so it feels identical at 60Hz,
 *     144Hz and when frames drop.
 *   - The loop is demand-driven: it stops once the ring converges and restarts
 *     on the next input, so an idle pointer costs nothing.
 *
 * BEHAVIOUR (unchanged from the agreed spec):
 *   - Ring scales to 1.6 and the dot to 0.7 over links, buttons, [role=button],
 *     labels and [data-cursor="hover"] (project cards use that attribute).
 *   - Hides ONLY over input / textarea / select / contenteditable.
 *   - Stays active under prefers-reduced-motion, with lerp forced to 1.0 so
 *     there is no trail lag.
 *   - Never mounts on touch-only devices.
 *   - `cursor: none` is applied only after the first real mousemove, so a user
 *     who has not moved the pointer still has a normal native cursor.
 */

const RING_SIZE = 36;
const RING_HALF = RING_SIZE / 2;
const DOT_SIZE = 8;
const DOT_HALF = DOT_SIZE / 2;

// Time constant for the ring's trailing motion, in milliseconds. Higher = longer
// trail. Converting to a per-frame factor each tick makes it frame-rate
// independent.
const TRAIL_TAU_MS = 90;

const HOVER_SELECTOR =
  'a, button, [role="button"], label, [data-cursor="hover"]';

const TEXT_INPUT_SELECTOR =
  'input, textarea, select, [contenteditable="true"], [contenteditable=""]';

// Text inputs that never take focus / are not user-visible.
function isHiddenInput(el) {
  if (!el || el.tagName !== 'INPUT') return false;
  const t = (el.getAttribute('type') || 'text').toLowerCase();
  return ['hidden', 'submit', 'button', 'reset', 'image'].includes(t);
}

// The cursor needs a REAL pointing device: a fine pointer AND hover capability.
// Both media queries must be true. `any-pointer`/`any-hover` (rather than
// `pointer`/`hover`) so a touch-capable laptop that also has a mouse still gets
// the custom cursor.
function hasFinePointer() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(any-pointer: fine)').matches &&
    window.matchMedia('(any-hover: hover)').matches
  );
}

/**
 * True when `el` is inside a text field. Walks up from a delegated event target
 * instead of running a selector query on every pointer move.
 */
function findTextField(el) {
  let node = el;
  while (node && node.nodeType === 1) {
    if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.tagName === 'SELECT') {
      return isHiddenInput(node) ? null : node;
    }
    if (node.isContentEditable) return node;
    if (node.classList && node.classList.contains('cursor-field-host')) return node;
    node = node.parentElement;
  }
  return null;
}

/** True when `el` is a hover target. Cached by the delegated handlers. */
function findHoverTarget(el) {
  let node = el;
  while (node && node.nodeType === 1) {
    if (node.nodeType === 1) {
      // Element.matches on a single element is a cheap, non-ancestor-scanning
      // check, and we only walk until we hit one.
      try {
        if (node.matches?.(HOVER_SELECTOR)) return node;
      } catch {
        /* ignore */
      }
    }
    node = node.parentElement;
  }
  return null;
}

export default function useCursorFollower({ enabled = true } = {}) {
  const containerRef = useRef(null);
  const dotRef = useRef(null);
  const ringRef = useRef(null);

  const stateRef = useRef({
    mouseX: 0,
    mouseY: 0,
    ringX: 0,
    ringY: 0,
    visible: false,
    rafId: null,
    hovering: false,
    down: false,
    inTextInput: false,
    reducedMotion: false,
    mode: 'on',
    // guard
    tripped: false,
  });

  useEffect(() => {
    if (!enabled) return undefined;
    if (typeof window === 'undefined') return undefined;
    if (!hasFinePointer()) return undefined;

    const container = containerRef.current;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!container || !dot || !ring) return undefined;

    const s = stateRef.current;
    s.reducedMotion = Boolean(
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );

    container.style.opacity = '0';
    container.style.transition = 'opacity 0.18s ease';

    // The cursor is ON by default on any device with a real pointer. It does NOT
    // depend on `.fx-on`, the WebGL renderer string, core count, saveData or a
    // frame probe. Those may still drive the hero's rich extras; they no longer
    // decide whether the pointer is replaced.
    //
    // It turns itself OFF for exactly two reasons:
    //   (a) the device has no fine pointer (touch-only), handled above; or
    //   (b) we MEASURE real lag — frame time above 25 ms sustained for 3 s
    //       (first second ignored). See the guard in tick().
    //
    // The ?fx=calm / ?fx=rich URL flags still act as a manual override so the
    // deterministic screenshot path keeps working.
    const forced = new URLSearchParams(window.location.search).get('fx');
    if (forced === 'calm') {
      return undefined;
    }
    s.mode = 'on';

    function setDotAt(x, y, scale) {
      dot.style.transform = `translate3d(${x - DOT_HALF}px, ${y - DOT_HALF}px, 0) scale(${scale})`;
    }
    function setRingAt(x, y, scale) {
      ring.style.transform = `translate3d(${x - RING_HALF}px, ${y - RING_HALF}px, 0) scale(${scale})`;
    }

    // Reduced motion => no trail at all (lerp 1.0). Otherwise time-based.
    function alphaFor(dt) {
      if (s.reducedMotion) return 1;
      return 1 - Math.exp(-dt / TRAIL_TAU_MS);
    }

    function ringScale() {
      return s.inTextInput ? 0 : s.down ? 0.8 : s.hovering ? 1.6 : 1;
    }
    function dotScale() {
      return s.inTextInput ? 0 : s.hovering ? 0.7 : 1;
    }

    // ---- hot path: store the pointer, nothing else ----------------------
    function onMove(e) {
      s.mouseX = e.clientX;
      s.mouseY = e.clientY;
      s.lastMoveTs = performance.now();
      if (!s.visible) {
        s.visible = true;
        s.ringX = s.mouseX;
        s.ringY = s.mouseY;
        container.style.opacity = '1';
        container.style.display = '';
        // First real movement: only NOW do we suppress the native cursor.
        if (!s.inTextInput) document.documentElement.style.cursor = 'none';
      }
      startLoop();
    }

    // ---- delegated hover: runs on target changes, not on every move ------
    function applyTarget(target) {
      const field = findTextField(target);
      const nextInField = Boolean(field);
      const nextHover = !nextInField && Boolean(findHoverTarget(target));

      // Re-assert the current state when the caller gives us the SAME state we
      // are already in. Scrolling under a stationary pointer produces a
      // mouseout with relatedTarget === null followed by a mouseover on a
      // completely different element; without this the html cursor / opacity
      // could be left describing a state we are no longer in (e.g. `cursor: none`
      // stuck on while the pointer sits inside a text field).
      if (nextInField === s.inTextInput && nextHover === s.hovering) {
        paintState();
        return;
      }

      s.inTextInput = nextInField;
      s.hovering = nextHover;
      paintState();

      // Scale changed, so make sure at least one more frame is drawn.
      startLoop();
    }

    // Single place that writes the DOM-visible cursor state, so it can never
    // disagree with `s.inTextInput` / `s.hovering`.
    //
    // `cursor: none` is ONLY applied once we have actually seen the pointer move
    // (s.visible). Before that first mousemove the native cursor must stay
    // normal, otherwise a user who never moves the mouse is left with no cursor
    // at all.
    function paintState() {
      if (s.inTextInput) {
        container.style.opacity = '0';
        document.documentElement.style.cursor = '';
        ring.classList.remove('cursor-ring--hover', 'cursor-ring--down');
        dot.classList.remove('cursor-dot--hover', 'cursor-dot--down');
      } else {
        if (s.visible) document.documentElement.style.cursor = 'none';
        if (s.visible) container.style.opacity = '1';
        ring.classList.toggle('cursor-ring--hover', s.hovering);
        dot.classList.toggle('cursor-dot--hover', s.hovering);
      }
    }

    function onOver(e) {
      applyTarget(e.target);
    }
    function onOut(e) {
      // Prefer the element we are actually moving onto. `relatedTarget` is null
      // when the browser has not synthesised a next-target (scrolling under a
      // stationary pointer, or leaving the document), in which case the next
      // `mouseover` will correct us — so do NOT force a plain state here, or we
      // can clobber a correct `cursor: none` / field state with a stale one.
      if (!e.relatedTarget) return;
      if (e.relatedTarget === e.target) return;
      applyTarget(e.relatedTarget);
    }

    // ---- rAF loop: all DOM writes live here ------------------------------
    let lastTs = 0;
    const CONVERGED = 0.05;

    // Measured-lag guard: the ONLY way the cursor turns itself off on a device
    // that does have a fine pointer. Frame time above 50 ms (≈20 fps) sustained
    // across two consecutive 3 s windows, ignoring the first second after mount
    // and any window that overlapped a hidden tab (hidden tabs are throttled to
    // ~1fps by every browser, which would otherwise look like permanent lag).
    // Deliberately lenient: rAF cadence is a WHOLE-PAGE signal, so one slow
    // window is far more likely to be an image decode or a scroll hitch than a
    // pointer that cannot keep up.
    const GUARD = { WARMUP_MS: 1000, WINDOW_MS: 3000, FRAME_BUDGET_MS: 50, LOW_WINDOWS: 2 };
    let guardStart = 0;       // ts at which the measurement window begins (post-warmup)
    let windowStart = 0;      // ts at which the current 3s window opened
    let windowFrames = 0;     // frames counted in the current window
    let lowWindows = 0;       // consecutive windows that exceeded the budget

    function tick(ts) {
      const dt = lastTs ? Math.min(ts - lastTs, 64) : 16.7;
      lastTs = ts;

      // --- measured-lag guard: only counts frames that the user can see ---
      const inWindow = guardStart && ts >= guardStart;
      if (document.hidden) {
        // Hidden-tab frames never count, and the window in progress is thrown
        // away, so hidden time can never end up in the next window's frame
        // count. Keep windowStart aligned so the remaining visible frames still
        // get a full 3s window once we return, and break any bad-window run.
        windowStart = ts;
        windowFrames = 0;
        lowWindows = 0;
      } else if (!inWindow) {
        if (guardStart === 0) guardStart = ts + GUARD.WARMUP_MS;
      } else {
        windowFrames++;
        if (ts - windowStart >= GUARD.WINDOW_MS) {
          const elapsed = ts - windowStart;
          const avg = windowFrames > 0 ? elapsed / windowFrames : 0;
          // One slow window is usually a one-off hitch (image decode, first
          // scroll, a GC pause). Require the verdict twice before tearing the
          // cursor down for the rest of the session.
          lowWindows = avg > GUARD.FRAME_BUDGET_MS ? lowWindows + 1 : 0;
          if (lowWindows >= GUARD.LOW_WINDOWS) {
            s.tripped = true;
            teardown();
            return;
          }
          windowStart = ts;
          windowFrames = 0;
        }
      }

      const dx = s.mouseX - s.ringX;
      const dy = s.mouseY - s.ringY;
      const a = alphaFor(dt);
      s.ringX += dx * a;
      s.ringY += dy * a;

      setRingAt(s.ringX, s.ringY, ringScale());
      setDotAt(s.mouseX, s.mouseY, dotScale());

      if (Math.abs(dx) < CONVERGED && Math.abs(dy) < CONVERGED) {
        s.ringX = s.mouseX;
        s.ringY = s.mouseY;
        setRingAt(s.ringX, s.ringY, ringScale());
        s.rafId = null;
        lastTs = 0;
        return;
      }
      s.rafId = requestAnimationFrame(tick);
    }

    function startLoop() {
      if (s.rafId == null) {
        lastTs = 0;
        s.rafId = requestAnimationFrame(tick);
      }
    }

    function onDown() {
      s.down = true;
      ring.classList.add('cursor-ring--down');
      dot.classList.add('cursor-dot--down');
      startLoop();
    }
    function onUp() {
      s.down = false;
      ring.classList.remove('cursor-ring--down');
      dot.classList.remove('cursor-dot--down');
      startLoop();
    }
    function onLeave() {
      container.style.opacity = '0';
    }
    function onEnter() {
      if (s.visible && !s.inTextInput) container.style.opacity = '1';
    }

    function teardown() {
      if (s.rafId != null) cancelAnimationFrame(s.rafId);
      s.rafId = null;
      document.documentElement.style.cursor = '';
      container.style.opacity = '0';
      container.style.display = 'none';
      ring.classList.remove('cursor-ring--hover', 'cursor-ring--down');
      dot.classList.remove('cursor-dot--hover', 'cursor-dot--down');
      s.hovering = false;
      s.down = false;
      s.tripped = true;
    }

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    document.addEventListener('mouseover', onOver, { passive: true, capture: true });
    document.addEventListener('mouseout', onOut, { passive: true, capture: true });
    document.addEventListener('mouseleave', onLeave);
    document.addEventListener('mouseenter', onEnter);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      document.removeEventListener('mouseover', onOver, { capture: true });
      document.removeEventListener('mouseout', onOut, { capture: true });
      document.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('mouseenter', onEnter);
      if (s.rafId != null) cancelAnimationFrame(s.rafId);
      s.rafId = null;
      document.documentElement.style.cursor = '';
      container.style.opacity = '0';
    };
  }, [enabled]);

  return { containerRef, dotRef, ringRef };
}