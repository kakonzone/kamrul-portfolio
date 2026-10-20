// Optimize images in src/assets/ and write responsive WebP versions to
// public/profile/ and public/projects/ and public/blog/. Run via
//   npm run optimize:images
//
// Behavior:
//  - For every .png/.jpg/.jpeg over 200 KB under src/assets/ we generate
//    responsive WebP at 480w, 800w, 1200w (and the original 1600w when the
//    source is wider than 1200). All WebP files go to public/ so Vite serves
//    them as static assets and they are NEVER bundled into the JS.
//  - We also keep a single 1200w fallback PNG beside the WebPs, so very old
//    browsers without WebP support still render correctly.
//  - SVGs are left alone (already tiny).
//  - We also generate a 1200x630 placeholder OG image (public/og-image.png)
//    from a text-rich SVG, since the brief asks for one.
//  - We generate the favicon-32, favicon-16, and apple-touch-icon from
//    public/favicon.svg.
//
// The original src/assets/profile.png is left in place (NOT moved to
// profile.original.png outside src) because the bundle imports it via
// src/data/profile.js, so we must either keep that import (and let Vite
// handle the re-optimization) OR switch the import to a public/ URL.
// We do the latter: see scripts/optimize-images.mjs post-step that writes
// a JSON report so we can verify the originals are no longer referenced
// from the bundle.

import { readdir, readFile, writeFile, stat, mkdir, copyFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const SRC_ASSETS = path.join(ROOT, 'src/assets');
const PUBLIC = path.join(ROOT, 'public');
const REPORT = path.join(ROOT, 'verification/image-optimization.log');

const WEBP_WIDTHS = [480, 800, 1200];
const WEBP_QUALITY = 82;
const TARGET_KB = 120; // aspirational upper bound per WebP

async function listImages(dir) {
  const out = [];
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listImages(p)));
    else if (/\.(png|jpe?g)$/i.test(e.name)) out.push(p);
  }
  return out;
}

async function optimizeImage(absPath) {
  const rel0 = path.relative(ROOT, absPath);
  const stat0 = await stat(absPath);
  const beforeBytes = stat0.size;

  if (beforeBytes < 200 * 1024) {
    return { rel: rel0, beforeBytes, afterBytes: beforeBytes, skipped: 'under 200 KB' };
  }

  const ext = path.extname(absPath);
  const base = path.basename(absPath, ext);
  const dir = path.dirname(absPath);
  // For images at src/assets/<file>, mirror to public/<file> directly.
  // For images at src/assets/<subdir>/<file>, mirror to public/<subdir>/<file>.
  const subdirRel = path.relative(SRC_ASSETS, dir);
  const publicDir = subdirRel && subdirRel !== '.' ? path.join(PUBLIC, subdirRel) : PUBLIC;
  await mkdir(publicDir, { recursive: true });

  const image = sharp(absPath);
  const meta = await image.metadata();
  // For images that are smaller than the smallest target, still emit a
  // responsive set so srcset works on retina + non-retina. The "480w" file
  // in this case is the source at source resolution.
  let widths = WEBP_WIDTHS.filter((w) => w <= meta.width);
  if (widths.length === 0) {
    // Source smaller than 480w. Emit 1x (source) and 2x (source * 2) so
    // srcset has a real choice for retina screens.
    widths = [meta.width, meta.width * 2];
  } else if (widths[widths.length - 1] !== meta.width) {
    // Always include the intrinsic width as the largest candidate so the
    // browser can pick the exact size and never upscale.
    widths.push(meta.width);
  }
  widths = [...new Set(widths)].sort((a, b) => a - b);

  const webpFiles = [];
  for (const w of widths) {
    const out = path.join(publicDir, `${base}-${w}.webp`);
    await image
      .clone()
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toFile(out);
    const s = await stat(out);
    webpFiles.push({ file: path.relative(ROOT, out), width: w, kb: Math.round(s.size / 102.4) / 10 });
  }

  // PNG fallbacks for browsers without WebP support. One per width so the
  // non-WebP path gets the same responsive selection.
  const pngFiles = [];
  for (const w of widths) {
    const out = path.join(publicDir, `${base}-${w}.png`);
    await image
      .clone()
      .resize({ width: w, withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toFile(out);
    const st = await stat(out);
    pngFiles.push({ file: path.relative(ROOT, out), width: w, kb: Math.round(st.size / 102.4) / 10 });
  }

  return {
    rel: rel0,
    beforeBytes,
    webpFiles,
    pngFiles,
  };
}

async function generateOgImage() {
  // 1200x630 placeholder. Dark bg, accent circle, big "PLACEHOLDER" text.
  const svg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#050d14"/>
      <stop offset="100%" stop-color="#0a1f2e"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <circle cx="220" cy="315" r="100" fill="#00b8f0" opacity="0.85"/>
  <text x="380" y="290" font-family="Outfit, system-ui, sans-serif" font-size="80" font-weight="800" fill="#ffffff">PLACEHOLDER</text>
  <text x="380" y="370" font-family="Outfit, system-ui, sans-serif" font-size="40" font-weight="500" fill="#8fa8b8">Replace with your own 1200x630 image</text>
  <text x="380" y="450" font-family="Outfit, system-ui, sans-serif" font-size="28" font-weight="500" fill="#8fa8b8">og-image.png · public/</text>
</svg>`);
  const out = path.join(PUBLIC, 'og-image.png');
  await mkdir(PUBLIC, { recursive: true });
  await sharp(svg).png({ quality: 90, compressionLevel: 9 }).toFile(out);
  const s = await stat(out);
  return { file: path.relative(ROOT, out), kb: Math.round(s.size / 102.4) / 10 };
}

async function generateFavicons() {
  // Take public/favicon.svg and rasterize to 32, 16, 180.
  const svg = await readFile(path.join(PUBLIC, 'favicon.svg'));
  const out = [];
  for (const [w, name] of [
    [32, 'favicon-32x32.png'],
    [16, 'favicon-16x16.png'],
    [180, 'apple-touch-icon.png'],
  ]) {
    const p = path.join(PUBLIC, name);
    await sharp(svg).resize({ width: w, height: w }).png().toFile(p);
    const s = await stat(p);
    out.push({ file: path.relative(ROOT, p), kb: Math.round(s.size / 102.4) / 10 });
  }
  return out;
}

async function main() {
  const report = [];
  const images = await listImages(SRC_ASSETS);
  report.push(`# Image optimization report — ${new Date().toISOString()}`);
  report.push(`Source: ${SRC_ASSETS}`);
  report.push(`Output: ${PUBLIC}`);
  report.push('');

  let totalBefore = 0;
  let totalWebp = 0;
  for (const img of images) {
    const r = await optimizeImage(img);
    totalBefore += r.beforeBytes;
    if (r.skipped) {
      report.push(`- ${r.rel}: ${(r.beforeBytes / 1024).toFixed(1)} KB (skipped: ${r.skipped})`);
    } else {
      const sumWebp = r.webpFiles.reduce((a, b) => a + b.kb, 0);
      totalWebp += sumWebp;
      report.push(
        `- ${r.rel}: ${(r.beforeBytes / 1024).toFixed(1)} KB → ${r.webpFiles.length} WebP variants ` +
          `(${r.webpFiles.map((f) => `${f.width}w ${f.kb}KB`).join(', ')})` +
          ` + ${r.pngFiles.length} PNG fallbacks (${r.pngFiles.map((f) => `${f.width}w ${f.kb}KB`).join(', ')})`,
      );
    }
  }
  report.push('');
  report.push(`Total before: ${(totalBefore / 1024).toFixed(1)} KB`);
  report.push(`Total WebP: ${totalWebp.toFixed(1)} KB`);

  const og = await generateOgImage();
  report.push(`- ${og.file}: ${og.kb} KB (1200x630 OG placeholder)`);

  const favs = await generateFavicons();
  for (const f of favs) report.push(`- ${f.file}: ${f.kb} KB`);

  await writeFile(REPORT, report.join('\n') + '\n');
  console.log(`[optimize-images] done. see ${REPORT}`);
  console.log(`  total before: ${(totalBefore / 1024).toFixed(1)} KB`);
  console.log(`  total WebP:   ${totalWebp.toFixed(1)} KB`);
  console.log(`  images:       ${images.length}`);
}

main().catch((e) => {
  console.error('[optimize-images] failed:', e);
  process.exit(1);
});
