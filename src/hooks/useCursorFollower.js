import { useEffect, useRef } from 'react';

/**
 * Drives a custom cursor (dot + ring) entirely via refs and direct style
 * updates so a frame of mouse movement does NOT trigger React re-renders.
 *
 * Returns element refs (container, dot, ring) you render in a component.
 *
 * Eligibility:
 *   - Disabled on real touch-only devices (no `any-pointer: fine`).
 *   - Still enabled on touch-capable laptops with a mouse.
 *   - ENABLED under `prefers-reduced-motion: reduce` (cursor still useful),
 *     but the trail is removed and hover scale is instant.
 *
 * Specs:
 *   - Dot: instantaneous position update.
 *   - Ring: trails behind the dot via lerp inside requestAnimationFrame with
 *     factor `LERP_FACTOR` (~0.15). Under reduced motion, LERP = 1.0.
 *   - Hover/Down states scale the ring (1.6 / 0.8) and shrink the dot (0.7)
 *     via transform scale written every tick.
 *   - Listeners + rAF loop are cleaned up on unmount.
 */

const LERP_FACTOR = 0.15;
// No trail under reduced motion: the ring sticks to the dot exactly.
const LERP_FACTOR_REDUCED = 1.0;

const RING_SIZE = 36;       // px, matches the .cursor-ring class
const RING_HALF = RING_SIZE / 2;
const DOT_SIZE = 8;         // px
const DOT_HALF = DOT_SIZE / 2;

const HOVER_SELECTOR = [
  'a',
  'button',
  '[role="button"]',
  'label',
  '[data-cursor="hover"]',
].join(',');
const TEXT_INPUT_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
].join(',');

function closestInteractive(el) {
  if (!el || typeof el.closest !== 'function') return null;
  return el.closest(HOVER_SELECTOR);
}
function closestTextInput(el) {
  if (!el || typeof el.closest !== 'function') return null;
  return el.closest(TEXT_INPUT_SELECTOR);
}

// Returns true if the user's primary input is touch-only. We intentionally use
// `any-pointer` rather than `pointer` so a touch-capable laptop with a mouse
// still gets the custom cursor.
function isTouchOnly() {
  if (typeof window === 'undefined') return true;
  const anyFine = window.matchMedia('(any-pointer: fine)').matches;
  const anyHover = window.matchMedia('(any-hover: hover)').matches;
  return !anyFine && !anyHover;
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
    cleanupFns: [],
    hovering: false,
    down: false,
    inTextInput: false,
    reducedMotion: false,
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
    s.reducedMotion =
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // The CSS @media (prefers-reduced-motion: no-preference) wrapper around
    // the hero ring animations stays as is for the hero. The cursor always
    // animates; under reduced motion we drop the lerp trail.
    const lerp = () => (s.reducedMotion ? LERP_FACTOR_REDUCED : LERP_FACTOR);

    container.style.opacity = '0';
    container.style.transition = 'opacity 0.18s ease';

    function setDotAt(x, y, scale) {
      dot.style.transform = `translate3d(${x - DOT_HALF}px, ${y - DOT_HALF}px, 0) scale(${scale})`;
    }
    function setRingAt(x, y, scale) {
      ring.style.transform = `translate3d(${x - RING_HALF}px, ${y - RING_HALF}px, 0) scale(${scale})`;
    }

    function ringScale() {
      return s.inTextInput ? 0 : s.down ? 0.8 : s.hovering ? 1.6 : 1;
    }
    function dotScale() {
      return s.inTextInput ? 0 : s.hovering ? 0.7 : 1;
    }

    function onMove(e) {
      const x = e.clientX;
      const y = e.clientY;
      s.mouseX = x;
      s.mouseY = y;
      setDotAt(x, y, dotScale());

      // Step the ring by one lerp on every mousemove so it still catches up
      // even when rAF is throttled (e.g. headless, hidden tab).
      s.ringX += (x - s.ringX) * lerp();
      s.ringY += (y - s.ringY) * lerp();

      if (!s.visible) {
        s.visible = true;
        s.ringX = x;
        s.ringY = y;
        container.style.opacity = '1';
      }

      const target = e.target;
      const inText = !!closestTextInput(target);
      const hovering = !inText && !!closestInteractive(target);

      s.inTextInput = inText;
      s.hovering = hovering;

      if (inText) {
        // Spec: hide the custom cursor and let the native one show.
        container.style.opacity = '0';
        document.documentElement.style.cursor = '';
      } else {
        document.documentElement.style.cursor = 'none';
        if (s.visible) container.style.opacity = '1';
        ring.classList.toggle('cursor-ring--hover', hovering);
        dot.classList.toggle('cursor-dot--hover', hovering);
      }
      startLoop();
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

    // Stop stepping the ring once it has essentially reached the dot, so an
    // idle pointer costs zero main-thread time. The next mousemove restarts the
    // loop. Visually identical: the ring is already on top of the dot.
    const CONVERGED_EPSILON = 0.05;

    function tick() {
      const dx = s.mouseX - s.ringX;
      const dy = s.mouseY - s.ringY;
      const f = lerp();
      s.ringX += dx * f;
      s.ringY += dy * f;
      setRingAt(s.ringX, s.ringY, ringScale());
      setDotAt(s.mouseX, s.mouseY, dotScale());

      if (Math.abs(dx) < CONVERGED_EPSILON && Math.abs(dy) < CONVERGED_EPSILON) {
        // Park the ring exactly on the dot so the next move starts clean.
        s.ringX = s.mouseX;
        s.ringY = s.mouseY;
        setRingAt(s.ringX, s.ringY, ringScale());
        s.rafId = null;
        return;
      }
      s.rafId = requestAnimationFrame(tick);
    }

    function startLoop() {
      if (s.rafId == null) s.rafId = requestAnimationFrame(tick);
    }

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    document.addEventListener('mouseleave', onLeave);
    document.addEventListener('mouseenter', onEnter);

    // The rAF loop is demand-driven: it starts on the first mousemove and stops
    // itself once the ring has converged on the dot (see tick()).

    s.cleanupFns.push(() => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      document.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('mouseenter', onEnter);
      if (s.rafId) cancelAnimationFrame(s.rafId);
      s.rafId = null;
      document.documentElement.style.cursor = '';
      container.style.opacity = '0';
    });

    return () => {
      s.cleanupFns.forEach((fn) => fn());
      s.cleanupFns = [];
    };
  }, [enabled]);

  return { containerRef, dotRef, ringRef };
}