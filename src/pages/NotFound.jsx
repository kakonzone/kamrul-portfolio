import Button from '../components/ui/Button';
import useDocumentMeta from '../hooks/useDocumentMeta';

export default function NotFound() {
  useDocumentMeta({
    title: 'Page not found',
    description: 'The page you are looking for does not exist.',
    noindex: true,
  });
  return (
    <main id="main-content" className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 py-24 text-center">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-accent">404</p>
      <h1 className="text-3xl font-bold text-fg">Page not found</h1>
      <p className="mt-3 max-w-md text-muted">
        The page you are looking for does not exist.
      </p>
      <Button to="/" className="mt-8">
        Back to home
      </Button>
    </main>
  );
}
