import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import ScrollToTop from './components/layout/ScrollToTop';
import ScrollToTopButton from './components/layout/ScrollToTopButton';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import CustomCursor from './components/ui/CustomCursor';
import ErrorBoundary from './components/error/ErrorBoundary';
import RouteFallback from './components/error/RouteFallback';
import Home from './pages/Home';

// Lazy-loaded route chunks. Home is eager (it's the LCP route).
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const BlogList = lazy(() => import('./pages/BlogList'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const NotFound = lazy(() => import('./pages/NotFound'));

export default function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <ScrollToTop />
          <CustomCursor />
          <Navbar />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/projects/:slug" element={<ProjectDetail />} />
              <Route path="/blog" element={<BlogList />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <Footer />
          <ScrollToTopButton />
        </BrowserRouter>
      </ErrorBoundary>
    </ThemeProvider>
  );
}