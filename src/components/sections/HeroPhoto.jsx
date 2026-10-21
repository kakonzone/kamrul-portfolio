// Hero decoration: glow → blob → 3 rings → photo → dots.
//
// COST MODEL (this is the whole point of the rewrite):
//   - Glow and blob are STATIC radial-gradients. The soft falloff lives inside
//     the gradient stops, so there is no `filter: blur()` and therefore no
//     re-raster of a large blurred layer.
//   - The three rings have FIXED border-radius and only rotate, so the browser
//     rasterises them once and then only re-composites (transform-only animation
//     never touches Style, Layout, Paint or Raster).
//   - Nothing here animates unless <html> has `.fx-on`, which is only added
//     after a capability check passes. The calm version is the default and
//     already looks complete.
//
// Layer order is enforced here (glow, blob, rings, photo, dots) and every
// decoration is aria-hidden + pointer-events-none. The photo wrapper is the
// clipping context on narrow screens so no decoration can bleed onto the text.

export default function HeroPhoto({ photo, alt }) {
  const w = photo.width;
  const h = photo.height;
  const sizes = '(max-width: 768px) 80vw, 460px';

  const webpSources = photo.webp.map((s) => (
    <source key={s.src} type="image/webp" srcSet={`${s.src} ${s.w}w`} sizes={sizes} />
  ));
  const pngSrcSet = photo.png.map((s) => `${s.src} ${s.w}w`).join(', ');

  return (
    <div className="hero-photo relative mx-auto w-full max-w-[460px] aspect-[415/480]">
      {/* 1. Glow — static radial gradient, no filter: blur(). The gradient
          itself carries the falloff, so this costs one paint, never a re-raster. */}
      <div aria-hidden="true" className="hero-glow pointer-events-none absolute -inset-20" />

      {/* 2. Blob — static radial gradient. Under .fx-on it drifts extremely
          slowly (transform only). */}
      <div aria-hidden="true" className="hero-blob pointer-events-none absolute" />

      {/* 3. Rings — three fixed organic shapes, rotation only under .fx-on. */}
      <div aria-hidden="true" className="hero-rings pointer-events-none absolute">
        <i />
        <i />
        <i />
      </div>

      {/* 4. Photo. The wrapper clips on narrow screens so nothing above can
          bleed onto the text column or under the navbar. */}
      <div className="hero-clip relative h-full w-full overflow-hidden rounded-[50%] bg-transparent">
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
            // A STATIC filter on a STATIC image. The rings above are separate
            // siblings animated with transform-only, so rotating them never
            // invalidates this image or re-runs the filter. Verified with a CDP
            // trace — see verification/perf/saturate-cost.md.
            style={{ filter: 'saturate(1.05)' }}
          />
        </picture>
      </div>

      {/* 5. Dots — static by default, tiny float under .fx-on. */}
      <span aria-hidden="true" className="hero-dot hero-dot-1 absolute" />
      <span aria-hidden="true" className="hero-dot hero-dot-2 absolute" />
      <span aria-hidden="true" className="hero-dot hero-dot-3 absolute" />
    </div>
  );
}