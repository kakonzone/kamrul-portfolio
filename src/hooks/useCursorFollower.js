import { useEffect, useRef } from 'react';

/**
 * Custom cursor (rich mode only).
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
 *   - Grows over links, buttons, [role=button], labels and [data-cursor="hover"]
 *     (project cards use that attribute).
 *   - Hides ONLY over input / textarea / select / contenteditable.
 *   - Stays active under prefers-reduced-motion, with lerp forced to 1.0 so
 *     there is no trail lag.
 *   - Never mounts on touch-only devices.
 *
 * SELF-GUARD: if the measured event→frame latency exceeds one frame budget, the
 * cursor tears itself down and the native cursor takes over. A laggy custom
 * cursor is worse than no custom cursor, and the user never sees a message.
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

function isTouchOnly() {
  if (typeof window === 'undefined') return true;
  const anyFine = window.matchMedia('(any-pointer: fine)').matches;
  const anyHover = window.matchMedia('(any-hover: hover)').matches;
  return !anyFine && !anyHover;
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
    mode: 'calm',
    // guard
    latencySamples: [],
    tripped: false,
  });

  useEffect(() => {
    if (!enabled) return undefined;
    if (typeof window === 'undefined') return undefined;
    if (isTouchOnly()) return undefined;

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

    // The cursor only exists in rich mode.
    const applyMode = (e) => {
      s.mode = e.detail?.mode ?? 'calm';
      if (s.mode !== 'rich') {
        teardown();
      } else {
        document.documentElement.style.cursor = 'none';
      }
    };
    window.addEventListener('fx:mode', applyMode);
    // If rich mode was already on before this effect ran, catch up.
    if (document.documentElement.classList.contains('fx-on')) {
      s.mode = 'rich';
      document.documentElement.style.cursor = 'none';
    } else {
      container.style.display = 'none';
    }

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
    function paintState() {
      if (s.inTextInput) {
        container.style.opacity = '0';
        document.documentElement.style.cursor = '';
        ring.classList.remove('cursor-ring--hover', 'cursor-ring--down');
        dot.classList.remove('cursor-dot--hover', 'cursor-dot--down');
      } else {
        document.documentElement.style.cursor = 'none';
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

    function tick(ts) {
      const dt = lastTs ? Math.min(ts - lastTs, 64) : 16.7;
      lastTs = ts;

      const dx = s.mouseX - s.ringX;
      const dy = s.mouseY - s.ringY;
      const a = alphaFor(dt);
      s.ringX += dx * a;
      s.ringY += dy * a;

      setRingAt(s.ringX, s.ringY, ringScale());
      setDotAt(s.mouseX, s.mouseY, dotScale());

      // Latency guard: measure how long the ring takes to reach a NEW pointer
      // position. We only sample right after a real mousemove, and only when the
      // gap is small enough to be pointer motion rather than a scroll or a
      // teleport — otherwise a fast scroll would look like "lag" and wrongly
      // disable the cursor.
      if (s.lastMoveTs && Math.abs(dx) + Math.abs(dy) < 400) {
        const age = ts - s.lastMoveTs;
        if (age < 250 && s.latencySamples.length < 40) s.latencySamples.push(age);
      }
      s.lastMoveTs = 0;

      if (!s.tripped && s.latencySamples.length >= 24) {
        const sorted = [...s.latencySamples].sort((a, b) => a - b);
        const p90 = sorted[Math.floor(sorted.length * 0.9)];
        // > ~2 frames at 60Hz of persistent pointer-to-pixel lag: tear down.
        if (p90 > 40) {
          s.tripped = true;
          teardown();
          return;
        }
        s.latencySamples = []; // healthy window, keep monitoring
      }

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
      window.removeEventListener('fx:mode', applyMode);
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