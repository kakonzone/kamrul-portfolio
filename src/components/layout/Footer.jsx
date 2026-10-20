import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import SocialLinks from '../sections/SocialLinks';
import { profile } from '../../data/profile';

const ALL_LINKS = [
  { id: 'about', label: 'About' },
  { id: 'projects', label: 'Projects' },
  { id: 'skills', label: 'Skills' },
  { id: 'experience', label: 'Education' },
  { id: 'resume', label: 'Resume' },
  { id: 'contact', label: 'Contact' },
];

function scrollToSection(sectionId) {
  const el = document.getElementById(sectionId);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function Footer() {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';
  const year = new Date().getFullYear();

  const NAV_LINKS = useMemo(() => {
    const f = profile.sections || {};
    return ALL_LINKS.filter((l) => {
      if (l.id === 'testimonials') return !!f.testimonials;
      if (l.id === 'blog') return f.blog !== false;
      return true;
    });
  }, []);

  const handleLink = (e, sectionId) => {
    e.preventDefault();
    if (isHome) {
      scrollToSection(sectionId);
    } else {
      navigate('/');
      window.requestAnimationFrame(() => {
        window.setTimeout(() => scrollToSection(sectionId), 60);
      });
    }
  };

  const handleHome = (e) => {
    e.preventDefault();
    if (isHome) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate('/');
    }
  };

  return (
    <footer className="border-t border-line bg-bg">
      <div className="mx-auto max-w-content px-6 py-8">
        <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
          <a
            href="/"
            onClick={handleHome}
            className="text-base font-bold tracking-tight text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md px-1"
            aria-label="Kamrul. — back to top"
          >
            {profile.name}<span className="text-accent">.</span>
          </a>

          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {NAV_LINKS.map((link) => (
              <li key={link.id}>
                <a
                  href={isHome ? `#${link.id}` : `/#${link.id}`}
                  onClick={(e) => handleLink(e, link.id)}
                  className="text-sm text-muted transition-colors hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <SocialLinks items={profile.social} />
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          © {year} {profile.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}