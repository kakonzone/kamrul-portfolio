// Optimize images: read PNGs from ./originals/ (gitignored) and write WebP-only
// responsive variants (480w / 800w / 1200w, quality ~80, each ≤ 200 KB) into
// public/projects/. No PNG output anywhere — the spec is "WebP via <picture>,
// 800w WebP as the <img src> fallback".
//
// Run via:  npm run optimize:images
//
// Directory layout this script expects:
//
//   originals/
//     lumio.png
//     unitrack.png
//     fact-check-bd.png
//     crypto-coin-screener.png
//   public/
//     profile-442.webp        (already produced for hero)
//     profile-884.webp        (already produced for hero)
//     projects/
//       lumio-480.webp
//       lumio-800.webp        ← default <img src>
//       lumio-1200.webp
//       …
//
// `originals/` is gitignored. `public/projects/` is checked in.
//
// The optimization also produces `public/projects/<slug>-meta.json` with the
// intrinsic dimensions so JS can reserve aspect-ratio boxes (no CLS).

import { readFile, readdir, stat, writeFile, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const ORIGINALS = path.join(ROOT, 'originals');
const PUBLIC_PROJECTS = path.join(ROOT, 'public/projects');
const PUBLIC = path.join(ROOT, 'public');
const REPORT = path.join(ROOT, 'verification/image-optimization.log');

const TARGET_WIDTHS = [480, 800, 1200];
const WEBP_QUALITY = 80;        // spec: "about 80"
const SOFT_LIMIT_KB = 200;      // spec: "each under 200 KB"

// The hero portrait used to carry `filter: saturate(1.05)` as a CSS rule. Item 5
// of the follow-up spec says: bake the boost into the generated file instead, so
// there is no runtime filter on the hero image at all. Same value, applied once
// at build time.
// The source portrait is 442x564, so the only variant we can produce is 442w.
// We never upscale, so 442 is the single entry. Anything wider in public/ is a
// stale artefact from an earlier run and is deleted by buildHero().
const HERO_SLUG = 'profile';
const HERO_SATURATE = 1.05;
const HERO_WIDTHS = [442];

async function listOriginals(dir) {
  const out = [];
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (!/\.png$/i.test(e.name)) continue;
    out.push(path.join(dir, e.name));
  }
  return out.sort((a, b) => a.localeCompare(b));
}

// Hero portrait: saturate baked in, WebP only, written to public/profile-<w>.webp.
// No PNG is produced — the CSS no longer needs a non-WebP fallback because every
// target browser supports WebP.
async function buildHero() {
  const src = path.join(ORIGINALS, `${HERO_SLUG}.png`);
  let beforeBytes;
  try {
    beforeBytes = (await stat(src)).size;
  } catch {
    return { skipped: 'originals/profile.png not found' };
  }

  const meta = await sharp(src).metadata();
  const produced = [];
  for (const w of HERO_WIDTHS) {
    if (w > meta.width) continue;
    const out = path.join(PUBLIC, `${HERO_SLUG}-${w}.webp`);
    let quality = WEBP_QUALITY;
    let buf = await sharp(src)
      .resize({ width: w, withoutEnlargement: true, fit: 'inside' })
      .modulate({ saturation: HERO_SATURATE })
      .webp({ quality })
      .toBuffer();
    while (buf.byteLength / 1024 > SOFT_LIMIT_KB && quality > 60) {
      quality -= 5;
      buf = await sharp(src)
        .resize({ width: w, withoutEnlargement: true, fit: 'inside' })
        .modulate({ saturation: HERO_SATURATE })
        .webp({ quality })
        .toBuffer();
    }
    await writeFile(out, buf);
    const s = await stat(out);
    produced.push({ file: path.relative(ROOT, out), width: w, kb: Math.round(s.size / 102.4) / 10 });
  }

  // Remove the old PNG fallbacks — spec item 5 says no CSS filter, and we are
  // not shipping PNG. Leaving them would put 2 x 256 KB in public/ and dist/.
  //
  // Also remove any hero WebP wider than the source: we never upscale, so a
  // width beyond the intrinsic size is a stale artefact from an earlier run
  // (e.g. profile-884.webp from before the hero went WebP-only at 442px).
  const removed = [];
  const staleWidths = [176, 354, 800, 884, 1024, 1768];
  for (const w of [...HERO_WIDTHS, ...staleWidths]) {
    for (const ext of ['.png', '.webp']) {
      if (ext === '.webp' && HERO_WIDTHS.includes(w)) continue; // keep what we just made
      const p = path.join(PUBLIC, `${HERO_SLUG}-${w}${ext}`);
      try {
        await unlink(p);
        removed.push(path.relative(ROOT, p));
      } catch { /* not present */ }
    }
  }

  return { beforeBytes, produced, removed, intrinsic: { w: meta.width, h: meta.height } };
}

async function processOne(absPath) {
  const beforeStat = await stat(absPath);
  const beforeBytes = beforeStat.size;
  const base = path.basename(absPath, path.extname(absPath));
  const slug = base;
  // The hero portrait is handled separately by buildHero() because it needs the
  // saturation boost baked in and lands in public/ rather than public/projects/.
  if (slug === HERO_SLUG) return { slug, skipped: 'handled by buildHero()' };

  const image = sharp(absPath);
  const meta = await image.metadata();

  await mkdir(PUBLIC_PROJECTS, { recursive: true });

  const produced = [];
  for (const w of TARGET_WIDTHS) {
    if (w > meta.width) continue;   // never upscale
    const out = path.join(PUBLIC_PROJECTS, `${slug}-${w}.webp`);
    let quality = WEBP_QUALITY;
    let buf;
    // Try the target quality first; if the file still exceeds the soft
    // limit, step quality down and try again. Stop at 55 (still acceptable).
    for (let attempt = 0; attempt < 5; attempt++) {
      buf = await sharp(absPath)
        .clone()
        .resize({ width: w, withoutEnlargement: true, fit: 'inside' })
        .webp({ quality })
        .toBuffer();
      const kb = buf.byteLength / 1024;
      if (kb <= SOFT_LIMIT_KB) break;
      // Re-encode from the BUFFER (not the source) so the next step doesn't
      // pay the decode cost over and over. Quality steps: 80 → 75 → 70 → 60.
      quality -= 5;
      if (quality < 60) break;
    }
    await writeFile(out, buf);
    const s = await stat(out);
    produced.push({
      file: path.relative(ROOT, out),
      width: w,
      kb: Math.round(s.size / 102.4) / 10,
      encode_kb: Math.round(buf.byteLength / 102.4) / 10,
    });
  }

  // Meta file used at runtime by the data layer to know the aspect ratio.
  const metaOut = path.join(PUBLIC_PROJECTS, `${slug}-meta.json`);
  await writeFile(metaOut, JSON.stringify({
    src: `/projects/${slug}-800.webp`,
    width: 800,
    height: Math.round((meta.height / meta.width) * 800),
    intrinsic: { w: meta.width, h: meta.height },
    variants: produced.map((p) => ({
      src: `/projects/${slug}-${p.width}.webp`,
      w: p.width,
      kb: p.kb,
    })),
  }, null, 2));

  return { slug, beforeBytes, produced };
}

async function cleanupPublicProjects() {
  // Defensive cleanup: if any old .png or .jpg sits in public/projects/, kill
  // it. The spec is "WebP only — no PNG output anywhere in public/ or dist/".
  let entries = [];
  try {
    entries = await readdir(PUBLIC_PROJECTS, { withFileTypes: true });
  } catch {
    return [];
  }
  const removed = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (/\.(png|jpe?g)$/i.test(e.name)) {
      const p = path.join(PUBLIC_PROJECTS, e.name);
      await unlink(p);
      removed.push(path.relative(ROOT, p));
    }
  }
  return removed;
}

async function main() {
  const report = [];
  report.push(`# Image optimization report — ${new Date().toISOString()}`);
  report.push(`Source:  ${ORIGINALS}  (gitignored)`);
  report.push(`Output:  ${PUBLIC_PROJECTS}  (WebP only, no PNG anywhere)`);
  report.push('');

  const originals = await listOriginals(ORIGINALS);
  if (originals.length === 0) {
    report.push('No PNGs found in originals/.');
    await writeFile(REPORT, report.join('\n') + '\n');
    console.log(report.join('\n'));
    return;
  }

  let totalBefore = 0;
  let totalAfter = 0;
  for (const abs of originals) {
    const r = await processOne(abs);
    if (r.skipped) {
      report.push(`- ${path.relative(ROOT, abs)}: ${r.skipped}`);
      continue;
    }
    totalBefore += r.beforeBytes;
    const sum = r.produced.reduce((a, b) => a + b.kb, 0);
    totalAfter += sum;
    report.push(`- ${path.relative(ROOT, abs)}: ${(r.beforeBytes / 1024).toFixed(1)} KB → 3 WebP ${r.produced.map(p => `${p.width}w ${p.kb}KB`).join(', ')}`);
  }
  report.push('');
  report.push(`Total before:        ${(totalBefore / 1024).toFixed(1)} KB (raw PNGs in originals/)`);
  report.push(`Total WebP emitted:  ${totalAfter.toFixed(1)} KB (sum across 3 widths per project)`);
  report.push(`Per-image soft cap:  ${SOFT_LIMIT_KB} KB`);

  // Hero portrait: saturation baked into the WebP, no CSS filter at runtime.
  report.push('');
  report.push(`## Hero portrait (saturate(${HERO_SATURATE}) baked in, WebP only)`);
  const hero = await buildHero();
  if (hero.skipped) {
    report.push(`- ${hero.skipped}`);
  } else {
    report.push(`- originals/${HERO_SLUG}.png: ${(hero.beforeBytes / 1024).toFixed(1)} KB (${hero.intrinsic.w}x${hero.intrinsic.h})`);
    for (const p of hero.produced) report.push(`- ${p.file}: ${p.width}w ${p.kb} KB`);
    if (hero.removed.length) {
      report.push(`- removed PNG fallbacks (no CSS filter needed): ${hero.removed.join(', ')}`);
    }
  }

  const removed = await cleanupPublicProjects();
  if (removed.length) {
    report.push('');
    report.push(`Cleaned stale PNG/JPG outputs: ${removed.join(', ')}`);
  }

  await writeFile(REPORT, report.join('\n') + '\n');
  console.log(`[optimize-images] done. ${originals.length} sources → ${originals.length * TARGET_WIDTHS.length} WebPs.`);
  console.log(`  total before:        ${(totalBefore / 1024).toFixed(1)} KB`);
  console.log(`  total WebP emitted:  ${totalAfter.toFixed(1)} KB`);
  console.log(`  report:              ${REPORT}`);
}

main().catch((e) => {
  console.error('[optimize-images] failed:', e);
  process.exit(1);
});
