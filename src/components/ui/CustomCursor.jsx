import useCursorFollower from '../../hooks/useCursorFollower';

/**
 * Custom cursor: an 8px dot that snaps to the pointer and a 36px ring that
 * trails behind it.
 *
 * Rendered always but hidden by CSS unless <html> has `.fx-on`, because the
 * capability gate in src/fx decides that. Under `prefers-reduced-motion` the
 * ring sticks to the dot exactly (lerp 1.0). On touch-only devices the hook
 * refuses to start at all, so no listener and no rAF loop ever exist.
 *
 * Visual state is driven purely by transform/opacity — no filter, no
 * backdrop-filter, no mix-blend-mode, no large animated box-shadow.
 */
export default function CustomCursor() {
  const { containerRef, dotRef, ringRef } = useCursorFollower({ enabled: true });

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