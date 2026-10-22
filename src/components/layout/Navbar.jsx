import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Sun, Moon, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import useScrollSpy from '../../hooks/useScrollSpy';
import { profile } from '../../data/profile';

// All possible section ids. Used both for smooth scroll and for scroll spy.
// `flag` links are hidden when the matching profile.sections entry is false.
// Toggling a section in profile.sections removes it from the rendered list.
const ALL_LINKS = [
  { id: 'about', label: 'About' },
  { id: 'projects', label: 'Projects' },
  { id: 'skills', label: 'Skills' },
  // The Education & Training section keeps the id "experience" for backwards
  // compatibility with existing anchors; the label is "Education".
  { id: 'experience', label: 'Education' },
  { id: 'resume', label: 'Resume' },
  { id: 'contact', label: 'Contact' },
];

function scrollToSection(sectionId) {
  const el = document.getElementById(sectionId);
  if (!el) return;
  // Keep the URL in step with the scroll, so the section can be linked and the
  // browser Back button returns to where the visitor was reading. `replaceState`
  // (not pushState) so scrolling never floods the history stack.
  window.history.replaceState(null, '', `#${sectionId}`);
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Filter the link list based on which sections are currently enabled.
  const NAV_LINKS = useMemo(() => {
    const f = profile.sections || {};
    return ALL_LINKS.filter((l) => {
      if (l.id === 'testimonials') return !!f.testimonials;
      if (l.id === 'blog') return f.blog !== false;
      return true;
    });
  }, []);
  const SECTION_IDS = useMemo(() => NAV_LINKS.map((l) => l.id), [NAV_LINKS]);

  const isHome = location.pathname === '/';
  const activeId = useScrollSpy(isHome ? SECTION_IDS : []);

  // Close mobile menu on route change.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const handleLink = (e, sectionId) => {
    e.preventDefault();
    setOpen(false);
    if (isHome) {
      scrollToSection(sectionId);
    } else {
      navigate('/');
      window.requestAnimationFrame(() => {
        window.setTimeout(() => scrollToSection(sectionId), 60);
      });
    }
  };

  const handleBrand = (e) => {
    e.preventDefault();
    setOpen(false);
    if (isHome) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate('/');
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg">
      {/* Desktop: 3-col grid so the link list is centered relative to the viewport. */}
      <nav aria-label="Primary" className="relative mx-auto hidden h-16 max-w-content items-center px-6 md:grid md:grid-cols-3">
        <a
          href="/"
          onClick={handleBrand}
          className="justify-self-start text-base font-bold tracking-tight text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md px-1"
        >
          <span>Kamrul</span>
          <span className="text-accent">.</span>
        </a>

        <ul className="flex items-center justify-center gap-8">
          {NAV_LINKS.map((link) => {
            const isActive = isHome && activeId === link.id;
            return (
              <li key={link.id}>
                <a
                  href={isHome ? `#${link.id}` : `/#${link.id}`}
                  onClick={(e) => handleLink(e, link.id)}
                  className={`text-sm font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md px-1 ${
                    isActive ? 'text-accent' : 'text-muted hover:text-fg'
                  }`}
                  aria-current={isActive ? 'true' : undefined}
                >
                  {link.label}
                </a>
              </li>
            );
          })}
        </ul>

        <div className="justify-self-end">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-bg-alt hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </nav>

      {/* Mobile: simple row with logo + right cluster */}
      <nav aria-label="Mobile" className="mx-auto flex h-16 max-w-content items-center justify-between px-6 md:hidden">
        <a
          href="/"
          onClick={handleBrand}
          className="text-base font-bold tracking-tight text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md px-1"
        >
          <span>Kamrul</span>
          <span className="text-accent">.</span>
        </a>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-bg-alt hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-bg-alt hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown */}
      {open ? (
        <div className="border-t border-line bg-bg md:hidden">
          <ul className="mx-auto flex max-w-content flex-col gap-1 px-6 py-4">
            {NAV_LINKS.map((link) => {
              const isActive = isHome && activeId === link.id;
              return (
                <li key={link.id}>
                  <a
                    href={isHome ? `#${link.id}` : `/#${link.id}`}
                    onClick={(e) => handleLink(e, link.id)}
                    className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive ? 'text-accent' : 'text-muted hover:bg-bg-alt hover:text-fg'
                    }`}
                    aria-current={isActive ? 'true' : undefined}
                  >
                    {link.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </header>
  );
}