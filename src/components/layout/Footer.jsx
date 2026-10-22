import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
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

  // Build identity, injected into index.html by scripts/inject-meta.mjs.
  const build =
    (typeof window !== 'undefined' && window.__BUILD__) || {
      builtAt: 'unknown',
      commit: 'unknown',
      short: 'unknown',
    };
  // The debug line is opt-in: only when the URL carries ?debug=1.
  const showBuild = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('debug') === '1';
  }, []);

  // Current FX decisions, mirrored from window.__fx by src/fx/index.js. No
  // logic is duplicated here: the FX module already owns the decisions, so this
  // only reads the published snapshot and re-reads it when `publish()` fires the
  // `fx:state` event (on every decision change and on each fps window). The
  // listener is registered ONLY under ?debug=1, so a normal visitor never
  // subscribes and never re-renders for this.
  const [fxState, setFxState] = useState(null);
  useEffect(() => {
    if (!showBuild) return undefined;
    const read = () => setFxState(window.__fx ? { ...window.__fx } : null);
    read();
    window.addEventListener('fx:state', read);
    return () => window.removeEventListener('fx:state', read);
  }, [showBuild]);

  const fxLine = (() => {
    if (!showBuild || !fxState) return null;
    const rings = fxState.ringsRunning
      ? 'running'
      : `stopped (${fxState.ringsReason || 'no reason recorded'})`;
    const cursor = fxState.cursorOn
      ? 'on'
      : `off (${fxState.cursorReason || 'no reason recorded'})`;
    const fps = fxState.fps > 0 ? Math.round(fxState.fps) : '--';
    return `rings: ${rings} | cursor: ${cursor} | fps: ${fps}`;
  })();

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

        {/* Build identity — visible ONLY with ?debug=1 in the URL. This is how
            you confirm on a phone that you are looking at the deploy you just
            pushed and not a cached older copy. Both values are injected into
            index.html at build time by scripts/inject-meta.mjs (which reads the
            git hash, or the Cloudflare CI commit variable when git is absent). */}
        {showBuild ? (
          <>
            <p className="mt-2 text-center font-mono text-[11px] text-muted/70" data-testid="build-id">
              build {build.builtAt} · commit {build.short}
              {build.commit === 'unknown' ? ' (commit unknown)' : ''}
            </p>
            {/* FX decisions — same ?debug=1 gate. Replaces the guesswork of
                "is the ring spinning / is the halo on this device?" with the
                live answer: rings, cursor and the last measured fps, plus the
                reason whenever one of them is off. */}
            {fxLine ? (
              <p className="mt-1 text-center font-mono text-[11px] text-muted/70" data-testid="fx-debug">
                {fxLine}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </footer>
  );
}