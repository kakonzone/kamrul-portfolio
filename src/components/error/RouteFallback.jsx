/**
 * Tiny fallback shown inside <Suspense> while a lazy route chunk is loading.
 * Visual is a centered accent ring + label, low CLS.
 */
export default function RouteFallback() {
  return (
    <main
      id="main-content"
      className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center bg-bg px-6"
      aria-busy="true"
      aria-live="polite"
    >
      <span
        className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent"
        aria-hidden="true"
      />
      <p className="mt-4 text-sm text-muted">Loading…</p>
    </main>
  );
}
