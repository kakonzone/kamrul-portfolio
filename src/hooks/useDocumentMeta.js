import { useEffect } from 'react';

/**
 * Set the document title and meta description for the current route. Replaces
 * the tags on every mount and resets to the site default on unmount.
 *
 *   useDocumentMeta({ title: 'About me', description: '...' })
 *
 * Pass { noindex: true } for routes that should not be indexed (NotFound).
 *
 * No react-helmet / dependency added. Just direct DOM mutation.
 */
export default function useDocumentMeta({
  title,
  description,
  canonical,
  ogImage,
  type = 'website',
  noindex = false,
} = {}) {
  useEffect(() => {
    const SITE_NAME = import.meta.env.VITE_SITE_NAME || 'Portfolio';
    const siteUrl = (import.meta.env.VITE_SITE_URL || '').replace(/\/$/, '');
    const fullTitle = title ? `${title} · ${SITE_NAME}` : SITE_NAME;

    if (title !== undefined) document.title = fullTitle;

    setMeta('description', description);
    setMeta('og:title', title ? `${title} · ${SITE_NAME}` : SITE_NAME, 'property');
    setMeta('og:description', description, 'property');
    setMeta('og:type', type, 'property');
    setMeta('og:url', canonical ? (siteUrl + canonical) : window.location.href, 'property');
    if (ogImage) setMeta('og:image', siteUrl + ogImage, 'property');
    setMeta('twitter:card', ogImage ? 'summary_large_image' : 'summary', 'name');
    setMeta('twitter:title', title ? `${title} · ${SITE_NAME}` : SITE_NAME, 'name');
    setMeta('twitter:description', description, 'name');
    if (ogImage) setMeta('twitter:image', siteUrl + ogImage, 'name');

    // Canonical link element (replace in place)
    let canonicalEl = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      if (!canonicalEl) {
        canonicalEl = document.createElement('link');
        canonicalEl.setAttribute('rel', 'canonical');
        document.head.appendChild(canonicalEl);
      }
      canonicalEl.setAttribute('href', siteUrl + canonical);
    }

    // robots / noindex
    let robotsEl = document.querySelector('meta[name="robots"]');
    if (!robotsEl) {
      robotsEl = document.createElement('meta');
      robotsEl.setAttribute('name', 'robots');
      document.head.appendChild(robotsEl);
    }
    robotsEl.setAttribute('content', noindex ? 'noindex, nofollow' : 'index, follow');
  }, [title, description, canonical, ogImage, type, noindex]);
}

function setMeta(nameOrValue, content, attrName = 'name') {
  if (content === undefined || content === null || content === '') return;
  let el = document.querySelector(`meta[${attrName}="${cssEscape(nameOrValue)}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, nameOrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

// Minimal CSS.escape polyfill for the attribute selector values that may
// contain colons (e.g. "og:title"). Without this, document.querySelector
// throws "is not a valid selector".
function cssEscape(s) {
  if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(s);
  return String(s).replace(/[^\w-]/g, (c) => '\\' + c);
}
