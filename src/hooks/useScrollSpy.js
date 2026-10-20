import { useEffect, useState } from 'react';

/**
 * Returns the id of the section currently in view.
 *
 * Watches every element that matches `sectionIds` and picks the one with the
 * largest visible area. Falls back to null until something matches.
 *
 * @param {string[]} sectionIds - section ids to observe (without the #).
 * @param {{ rootMargin?: string, threshold?: number }} [opts]
 */
export default function useScrollSpy(sectionIds, opts = {}) {
  const { rootMargin = '-40% 0px -55% 0px', threshold = 0 } = opts;
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !sectionIds?.length) return undefined;

    // Track every observed section's current intersection ratio.
    const ratios = new Map();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          ratios.set(entry.target.id, entry.intersectionRatio);
        });
        // Pick the section with the largest visible ratio.
        let bestId = null;
        let bestRatio = 0;
        for (const [id, ratio] of ratios) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        }
        setActiveId(bestId);
      },
      { rootMargin, threshold },
    );

    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [sectionIds, rootMargin, threshold]);

  return activeId;
}