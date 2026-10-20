import useCursorFollower from '../../hooks/useCursorFollower';

/**
 * Custom cursor: an 8px solid dot that snaps to the pointer and a 36px ring
 * that trails behind with lerp.
 *
 * Always rendered on desktop / mixed-input devices. The hook itself
 * self-disables on real touch-only devices (no `any-pointer: fine` /
 * `any-hover: hover`). Under prefers-reduced-motion the cursor still works
 * but the ring sticks to the dot (no trail) — accessibility survives.
 */
export default function CustomCursor() {
  const { containerRef, dotRef, ringRef } = useCursorFollower({ enabled: true });

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[9999] opacity-0 transition-opacity duration-200"
    >
      {/* Ring (trailing). Default scale=1; ringScale() bumps it on hover/down. */}
      <div
        ref={ringRef}
        className="cursor-ring fixed left-0 top-0 h-9 w-9 rounded-full"
        style={{
          transform: 'translate3d(-100px, -100px, 0)',
          willChange: 'transform',
          transition: 'transform 0s, opacity 0.15s ease',
          background: 'transparent',
          border: '1.5px solid var(--color-accent)',
        }}
      />
      {/* Dot (snaps to the pointer) */}
      <div
        ref={dotRef}
        className="cursor-dot fixed left-0 top-0 h-2 w-2 rounded-full"
        style={{
          transform: 'translate3d(-100px, -100px, 0)',
          willChange: 'transform',
          background: 'var(--color-accent)',
          boxShadow:
            '0 0 0 1px color-mix(in srgb, var(--color-bg) 60%, transparent)',
        }}
      />
    </div>
  );
}