import { useEffect, useRef, useState } from 'react';

/**
 * Parses a stat string like "3+", "120+", "5k+" into a target number + suffix.
 * Returns { target, suffix } where target is the numeric portion (or null if the
 * string has no leading digits, in which case CountUp renders the value as-is).
 */
function parseStat(value) {
  if (typeof value !== 'string') return { target: null, suffix: '' };
  const match = value.match(/^(\d+(?:\.\d+)?)(.*)$/);
  if (!match) return { target: null, suffix: '' };
  return { target: Number(match[1]), suffix: match[2] };
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Animates from 0 to the numeric portion of `value` once it scrolls into view.
 * Respects prefers-reduced-motion (renders the final value immediately).
 */
export default function CountUp({ value, duration = 1200 }) {
  const { target, suffix } = parseStat(value);
  const [display, setDisplay] = useState(target === null ? value : '0');
  const ref = useRef(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (target === null) return undefined;
    if (typeof window === 'undefined') return undefined;

    const reduce =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setDisplay(`${target}${suffix}`);
      return undefined;
    }

    const el = ref.current;
    if (!el) return undefined;

    const start = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      const t0 = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - t0) / duration);
        const eased = easeOutCubic(t);
        const current = Math.round(target * eased);
        setDisplay(`${current}${suffix}`);
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            start();
            observer.disconnect();
          }
        });
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, suffix, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {display}
    </span>
  );
}