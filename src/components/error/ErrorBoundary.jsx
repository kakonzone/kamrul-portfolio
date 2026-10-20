import { Component } from 'react';

/**
 * Top-level Error Boundary. Catches render errors anywhere below it and
 * shows a friendly fallback with a "Back to home" button instead of a
 * white screen.
 *
 * The cursor is rendered ABOVE this in the tree (so the error UI is
 * actually visible — no half-rendered state with a giant dot in the
 * middle of the screen).
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <main
          id="main-content"
          role="alert"
          className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 py-24 text-center"
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-accent">
            Unexpected error
          </p>
          <h1 className="text-3xl font-bold text-fg">Something went wrong</h1>
          <p className="mt-3 max-w-md text-muted">
            An unexpected error stopped the app. Reload the page, or head back home to start over.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Reload page
            </button>
            <a
              href="/"
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-transparent px-5 py-2.5 text-sm font-semibold text-fg transition-colors hover:border-accent hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Back to home
            </a>
          </div>
          {this.props.showDetails && this.state.error ? (
            <pre className="mt-8 max-w-2xl overflow-auto rounded-lg border border-line bg-card p-4 text-left text-xs text-muted">
              {String(this.state.error?.stack || this.state.error?.message || this.state.error)}
            </pre>
          ) : null}
        </main>
      );
    }
    return this.props.children;
  }
}
