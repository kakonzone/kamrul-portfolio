import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import Card from '../ui/Card';
import SectionHeading from '../ui/SectionHeading';
import { testimonials } from '../../data/testimonials';

const AUTO_ADVANCE_MS = 7000;

function initialsFor(name) {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function Avatar({ name, src }) {
  const [errored, setErrored] = useState(false);
  if (!src || errored) {
    return (
      <div
        aria-hidden="true"
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-bg-alt text-sm font-semibold text-accent ring-1 ring-line"
      >
        {initialsFor(name) || '?'}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      onError={() => setErrored(true)}
      className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-line"
    />
  );
}

function Stars({ count = 5 }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${count} out of 5 stars`}>
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} size={18} fill="#facc15" color="#facc15" strokeWidth={0} aria-hidden="true" />
      ))}
    </div>
  );
}

export default function Testimonials() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = testimonials.length;
  const item = testimonials[index];
  const intervalRef = useRef(null);

  // Auto-advance (paused on hover/focus, or when reduced-motion is on).
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const reduce =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return undefined;
    if (paused || total <= 1) return undefined;
    intervalRef.current = window.setInterval(() => {
      setIndex((i) => (i + 1) % total);
    }, AUTO_ADVANCE_MS);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [paused, total]);

  const goPrev = () => setIndex((i) => (i - 1 + total) % total);
  const goNext = () => setIndex((i) => (i + 1) % total);
  const goTo = (i) => setIndex(i);

  return (
    <section id="testimonials" className="bg-bg-alt px-6 py-24">
      <div className="mx-auto max-w-4xl">
        <SectionHeading label="Testimonials" title="What people say" />

        <Card
          className="mt-12 p-6 md:p-10"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <div key={item.id} className="testimonial-fade">
            <Stars />

            <blockquote className="mt-6 text-lg leading-relaxed text-fg">
              <span aria-hidden="true" className="mr-1 text-accent">“</span>
              {item.quote}
              <span aria-hidden="true" className="ml-1 text-accent">”</span>
            </blockquote>

            <div className="mt-8 flex items-center gap-4">
              <Avatar name={item.name} src={item.avatar} />
              <div>
                <p className="text-sm font-semibold text-fg">{item.name}</p>
                <p className="text-xs text-muted">
                  {item.role}{item.company ? `, ${item.company}` : ''}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-line pt-6">
            <div className="flex items-center gap-2" role="tablist" aria-label="Testimonials">
              {testimonials.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Go to testimonial ${i + 1}`}
                  onClick={() => goTo(i)}
                  className={`h-2.5 w-2.5 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    i === index ? 'bg-accent' : 'bg-transparent border border-line'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goPrev}
                aria-label="Previous testimonial"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line text-fg transition-colors hover:border-accent hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="Next testimonial"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line text-fg transition-colors hover:border-accent hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}