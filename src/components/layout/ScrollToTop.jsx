import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * On route change:
 *   - scroll to top (unless a hash is present and the target exists, in which
 *     case the browser handles the anchor jump and we skip the reset)
 *   - move focus to the <main> element so screen readers announce the new page
 *   - announce the new page title via a visually-hidden live region
 *
 * This replaces the old ScrollToTop, which only did the scroll reset.
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    // If there's a hash and the element exists after render, let the browser
    // do the anchor scroll. Otherwise reset to the top.
    if (hash) {
      const id = decodeURIComponent(hash.slice(1));
      // Wait a frame for the target section to mount.
      requestAnimationFrame(() => {
        if (document.getElementById(id)) return;
        window.scrollTo(0, 0);
      });
    } else {
      window.scrollTo(0, 0);
    }

    // Move focus to main so keyboard + screen-reader users land in the new page.
    const main = document.getElementById('main-content');
    if (main) {
      // main is not focusable by default; make it programmatically focusable
      // without adding a visible outline.
      if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
      main.focus({ preventScroll: true });
    }
  }, [pathname, hash]);

  useEffect(() => {
    const title = document.title;
    let live = document.getElementById('route-announcer');
    if (!live) {
      live = document.createElement('div');
      live.id = 'route-announcer';
      live.setAttribute('aria-live', 'polite');
      live.setAttribute('aria-atomic', 'true');
      live.style.position = 'absolute';
      live.style.width = '1px';
      live.style.height = '1px';
      live.style.overflow = 'hidden';
      live.style.clip = 'rect(0 0 0 0)';
      live.style.whiteSpace = 'nowrap';
      document.body.appendChild(live);
    }
    live.textContent = title;
  }, [pathname, hash]);

  return null;
}