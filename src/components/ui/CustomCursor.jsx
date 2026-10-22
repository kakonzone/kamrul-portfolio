import { useState } from 'react';
import useCursorFollower from '../../hooks/useCursorFollower';

/**
 * Custom cursor: an 8px dot that snaps to the pointer and a 36px ring that
 * trails behind it.
 *
 * ON by default for any device reporting a fine pointer — it does NOT depend on
 * `.fx-on`, the WebGL renderer string, core count, saveData or a frame probe.
 * The layer starts at opacity 0 and is only revealed on the first real
 * mousemove, so the native cursor stays visible until the custom one is
 * genuinely tracking. Under `prefers-reduced-motion` the ring sticks to the
 * dot exactly (lerp 1.0). On touch-only devices the hook refuses to start at
 * all, so no listener and no rAF loop ever exist.
 *
 * The hook hides itself and restores the native cursor if it MEASURES real lag
 * (frame time above 25 ms sustained for 3 s, ignoring the first second).
 *
 * Visual state is driven purely by transform/opacity — no filter, no
 * backdrop-filter, no mix-blend-mode, no large animated box-shadow.
 */

// Same condition the hook guards on (useCursorFollower.hasFinePointer), so the
// layer is only in the DOM when the hook is actually going to drive it.
// Deliberately `any-pointer`/`any-hover` rather than `pointer`: a touch-capable
// laptop that also has a mouse must keep the custom cursor. `(pointer: fine)`
// would be false there and would wrongly strip it.
const FINE_POINTER = '(any-pointer: fine) and (any-hover: hover)';

function hasFinePointer() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(FINE_POINTER).matches;
}

export default function CustomCursor() {
  const { containerRef, dotRef, ringRef } = useCursorFollower({ enabled: true });

  // Decided once at mount rather than resubscribed to: if we re-rendered on a
  // mid-session pointer-type change, the hook's effect would already have bailed
  // (its refs were null) and would not re-run, leaving a visible but dead layer.
  const [canPointer] = useState(hasFinePointer);

  if (!canPointer) return null;

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="cursor-layer pointer-events-none fixed left-0 top-0 z-[9999] opacity-0 transition-opacity duration-200"
    >
      <div
        ref={ringRef}
        className="cursor-ring fixed left-0 top-0 h-9 w-9 rounded-full"
        style={{
          transform: 'translate3d(-100px, -100px, 0)',
          willChange: 'transform',
          background: 'transparent',
          border: '1.5px solid var(--color-accent)',
        }}
      />
      <div
        ref={dotRef}
        className="cursor-dot fixed left-0 top-0 h-2 w-2 rounded-full"
        style={{
          transform: 'translate3d(-100px, -100px, 0)',
          willChange: 'transform',
          background: 'var(--color-accent)',
          // Static outline halo. It is written once here and never animated, so
          // it costs nothing per frame and keeps the dot readable against any
          // background it crosses.
          boxShadow:
            '0 0 0 1px color-mix(in srgb, var(--color-bg) 60%, transparent)',
        }}
      />
    </div>
  );
}