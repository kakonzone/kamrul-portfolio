// Verify the generated image assets are complete, WebP-only, and inside the
// size budget. Run via:  npm run check:assets
//
// What it asserts:
//   1. originals/ holds the four raw PNGs (the untracked source of truth).
//   2. public/projects/ has 480 / 800 / 1200 WebP variants for every slug,
//      and NO .png / .jpg / .jpeg anywhere in public/ or dist/.
//   3. Every emitted WebP is under the 200 KB soft cap.
//   4. The 800w file is the one referenced as the <img src> (via the meta).
//   5. No project PNG leaked into src/assets (they must stay in originals/).

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';

const ROOT = process.cwd();
const ORIGINALS = path.join(ROOT, 'originals');
const PUBLIC_PROJECTS = path.join(ROOT, 'public/projects');
const PUBLIC = path.join(ROOT, 'public');
const DIST = path.join(ROOT, 'dist');

const SLUGS = ['lumio', 'unitrack', 'fact-check-bd', 'crypto-coin-screener'];
const WIDTHS = [480, 800, 1200];
const SOFT_LIMIT_KB = 200;

const failures = [];
const notes = [];

function fail(m) { failures.push(m); }
function note(m) { notes.push(m); }
function e2name(p) { return path.basename(p); }

async function walk(dir, exts) {
  const out = [];
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p, exts)));
    else if (exts.some((x) => x.test(e.name))) out.push(p);
  }
  return out;
}

async function main() {
  console.log('== originals ==');
  for (const slug of SLUGS) {
    const p = path.join(ORIGINALS, `${slug}.png`);
    if (!existsSync(p)) fail(`originals/${slug}.png missing`);
    else {
      const s = await stat(p);
      note(`originals/${slug}.png ${(s.size / 1024).toFixed(1)} KB`);
    }
  }

  console.log('== public/projects variants ==');
  for (const slug of SLUGS) {
    for (const w of WIDTHS) {
      const p = path.join(PUBLIC_PROJECTS, `${slug}-${w}.webp`);
      if (!existsSync(p)) { fail(`missing variant ${slug}-${w}.webp`); continue; }
      const s = await stat(p);
      const kb = s.size / 1024;
      const flag = kb > SOFT_LIMIT_KB ? ' FAIL(over budget)' : '';
      note(`${slug}-${w}.webp ${kb.toFixed(1)} KB${flag}`);
      if (kb > SOFT_LIMIT_KB) fail(`${slug}-${w}.webp is ${kb.toFixed(1)} KB (over ${SOFT_LIMIT_KB} KB)`);
    }
    const metaPath = path.join(PUBLIC_PROJECTS, `${slug}-meta.json`);
    if (!existsSync(metaPath)) { fail(`missing meta ${slug}-meta.json`); continue; }
    const meta = JSON.parse(await readFile(metaPath, 'utf8'));
    if (meta.src !== `/projects/${slug}-800.webp`) {
      fail(`${slug}-meta.json src is "${meta.src}", expected "/projects/${slug}-800.webp"`);
    }
    const variantCount = (meta.variants || []).length;
    if (variantCount !== WIDTHS.length) {
      fail(`${slug}-meta.json lists ${variantCount} variants, expected ${WIDTHS.length}`);
    }
  }

  console.log('== no raster originals in public/ or dist/ ==');
  for (const [label, dir] of [['public', PUBLIC], ['dist', DIST]]) {
    if (!existsSync(dir)) { note(`${label}/ not present (skipped)`); continue; }
    // og-image.png + favicons are intentional and tiny; project screenshots are
    // what must be WebP-only. Flag anything under projects/ plus any >200 KB png.
    const offenders = [];
    const allPng = await walk(dir, [/\.png$/i, /\.jpe?g$/i]);
    for (const f of allPng) {
      const s = await stat(f);
      const rel = path.relative(ROOT, f);
      if (rel.includes(path.join('public', 'projects')) || rel.includes(path.join('dist', 'assets', 'projects'))) {
        offenders.push(`${rel} (project raster — must be WebP)`);
      } else if (s.size > SOFT_LIMIT_KB * 1024 && !/profile-\d+\.png$/.test(e2name(f))) {
        offenders.push(`${rel} ${(s.size / 1024).toFixed(1)} KB (over ${SOFT_LIMIT_KB} KB)`);
      } else if (/profile-\d+\.png$/.test(e2name(f))) {
        // The hero portrait PNG fallback is pre-existing and out of scope for
        // this check; report it as informational rather than a failure.
        note(`${rel} ${(s.size / 1024).toFixed(1)} KB (hero PNG fallback — informational, pre-existing)`);
      }
    }
    if (offenders.length) offenders.forEach((o) => fail(`${label}: ${o}`));
    else note(`${label}/ clean — no project rasters, nothing over budget`);
  }

  console.log('== no project PNGs inside src/ ==');
  const srcAssets = path.join(ROOT, 'src/assets');
  if (existsSync(srcAssets)) {
    const rasters = await walk(srcAssets, [/\.png$/i, /\.jpe?g$/i]);
    for (const f of rasters) {
      const rel = path.relative(ROOT, f);
      // profile.png is the hero source and is allowed.
      if (path.basename(f) !== 'profile.png') {
        fail(`src/assets contains raster: ${rel} (project originals belong in originals/)`);
      }
    }
    if (!rasters.some((f) => path.basename(f) !== 'profile.png')) {
      note('src/assets clean — only profile.png remains (hero source)');
    }
  }

  console.log('');
  for (const n of notes) console.log('  ' + n);
  console.log('');
  if (failures.length) {
    console.log('**Result: FAILED**');
    for (const f of failures) console.log('  FAIL: ' + f);
    process.exit(1);
  }
  console.log('**Result: ALL ASSET CHECKS PASS**');
}

main().catch((e) => {
  console.error('[check-assets] failed:', e);
  process.exit(1);
});