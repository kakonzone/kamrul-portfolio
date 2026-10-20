// Decorative photo oval: glow → blob → ring 2 → ring 1 → photo → dots.
// Rings morph continuously via animated border-radius and rotate slowly.
// Markup matters: the layer order in this file matches the spec.
//
// The photo is a <picture> with WebP sources + a PNG fallback, served from
// /public (NEVER bundled) via srcset + sizes. Eager + fetchpriority="high"
// because the hero image is the LCP element on /.

export default function HeroPhoto({ photo, alt }) {
  const w = photo.width;
  const h = photo.height;
  const sizes = '(max-width: 768px) 80vw, 460px';

  // <source> children for each WebP variant; the <img> carries the PNG
  // fallback srcset so non-WebP browsers get the same responsive choice.
  const webpSources = photo.webp.map((s) => (
    <source key={s.src} type="image/webp" srcSet={`${s.src} ${s.w}w`} sizes={sizes} />
  ));
  const pngSrcSet = photo.png.map((s) => `${s.src} ${s.w}w`).join(', ');

  return (
    <div className="hero-photo relative mx-auto w-full max-w-[460px] aspect-[415/480]">
      {/* 1. Cyan radial glow (back) — blur 80px, opacity ~0.25 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-20"
        style={{
          background:
            'radial-gradient(closest-side, color-mix(in srgb, var(--color-accent) 25%, transparent) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />

      {/* 2. Filled teal blob (accent ~25-35% opacity, larger, offset down-left).
         border-radius is animated by .hero-blob. */}
      <div
        aria-hidden="true"
        className="hero-blob pointer-events-none absolute"
        style={{
          inset: '-18% -10% -8% -16%',
          background:
            'radial-gradient(45% 55% at 35% 60%, color-mix(in srgb, var(--color-accent) 55%, transparent) 0%, color-mix(in srgb, var(--color-accent) 22%, transparent) 60%, transparent 100%)',
          borderRadius: '60% 40% 50% 50% / 50% 50% 60% 40%',
          filter: 'blur(40px)',
        }}
      />

      {/* 3. Ring 2 — 1px accent @ 50% opacity, slightly larger than ring 1. */}
      <div
        aria-hidden="true"
        className="hero-ring-2 pointer-events-none absolute inset-0"
        style={{
          border: '1px solid var(--color-accent)',
          opacity: 0.5,
          borderRadius: '54% 46% 60% 40% / 50% 50% 50% 50%',
          transform: 'translate(0,0)',
        }}
      />

      {/* 4. Ring 1 — 2px accent border. */}
      <div
        aria-hidden="true"
        className="hero-ring-1 pointer-events-none absolute"
        style={{
          inset: '4%',
          border: '2px solid var(--color-accent)',
          borderRadius: '60% 40% 55% 45% / 50% 60% 40% 50%',
          transform: 'translate(0,0)',
        }}
      />

      {/* 5. Photo. <picture> with WebP srcset + PNG fallback. The outer
         container is round so the photo is clipped to a circle. Explicit
         width/height on the <img> prevents CLS. Eager + fetchpriority="high"
         because the hero photo is the LCP element. */}
      <div className="relative h-full w-full overflow-hidden rounded-[50%] bg-transparent">
        <picture>
          {webpSources}
          <img
            src={photo.png[0].src}
            srcSet={pngSrcSet}
            sizes={sizes}
            alt={alt}
            width={w}
            height={h}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-top"
            style={{
              WebkitMaskImage:
                'radial-gradient(closest-side, #000 70%, transparent 100%)',
              maskImage:
                'radial-gradient(closest-side, #000 70%, transparent 100%)',
              filter: 'saturate(1.05)',
            }}
          />
        </picture>
      </div>

      {/* 6. Dots — float around the rings. */}
      <span
        aria-hidden="true"
        className="hero-dot-1 absolute right-[2%] top-[18%] h-2.5 w-2.5 rounded-full"
        style={{ background: 'var(--color-accent)' }}
      />
      <span
        aria-hidden="true"
        className="hero-dot-2 absolute bottom-[10%] left-[8%] h-2 w-2 rounded-full"
        style={{ background: 'var(--color-accent)' }}
      />
      <span
        aria-hidden="true"
        className="hero-dot-3 absolute left-[4%] top-[55%] h-1.5 w-1.5 rounded-full"
        style={{ background: 'var(--color-accent)' }}
      />
    </div>
  );
}
