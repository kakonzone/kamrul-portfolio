// Scan src/data/*.js and the project root index.html for placeholder strings.
// Exits non-zero if any match. Each match prints as `file:line:column`.
//
// Strings flagged:
//   - "PLACEHOLDER"      : the deliberate "PLACEHOLDER: ..." markers
//   - "Lorem"            : lorem ipsum leftover
//   - "example.com"      : reserved example domains
//   - "Founder Name"     : popular "tutorial" name placeholder
//
// Optional CLI flag:  --json   to emit a JSON report and a non-zero exit only
//                                when --strict is also passed.
//
// Data files use ES module `export const profile = { ... }` syntax — we can
// read them as text and grep without parsing JS.

import { readFile, stat } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const SCAN_PATHS = ['src/data/*.js'];
// index.html and README.md legitimately *mention* the words PLACEHOLDER /
// example.com when documenting the checker and the pre-launch steps, so
// scanning them produces false positives. Content placeholders live in
// src/data/*.js, which is what we scan.
const ROOT_FILES = [];

// Assets that must exist before the site goes live. We do NOT generate these
// — they are the user's own files.
const REQUIRED_ASSETS = [
  {
    file: 'public/resume.pdf',
    what: 'the resume PDF linked by the hero "Download Resume" button and the Resume section',
  },
  {
    file: 'public/og-image.png',
    what: 'the Open Graph / Twitter card image (1200x630)',
  },
];

const STRINGS = ['PLACEHOLDER', 'Lorem', 'example.com', 'Founder Name'];

async function collectFiles() {
  const out = [];
  for (const pat of SCAN_PATHS) {
    for await (const f of glob(pat)) out.push(path.join(ROOT, f));
  }
  for (const f of ROOT_FILES) {
    const abs = path.join(ROOT, f);
    try {
      await readFile(abs);
      out.push(abs);
    } catch {}
  }
  return out;
}

async function scan(file) {
  const text = await readFile(file, 'utf8').catch(() => '');
  const lines = text.split('\n');
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const needle of STRINGS) {
      const idx = line.indexOf(needle);
      if (idx !== -1) {
        hits.push({ file, line: i + 1, column: idx + 1, needle, text: line.trim() });
      }
    }
  }
  return hits;
}

const files = await collectFiles();
const all = [];
for (const f of files) all.push(...(await scan(f)));

// Missing required assets (resume.pdf etc.). Checked separately from the
// placeholder scan because these are binary files, not text.
const missingAssets = [];
for (const asset of REQUIRED_ASSETS) {
  const abs = path.join(ROOT, asset.file);
  try {
    const s = await stat(abs);
    if (!s.isFile() || s.size === 0) missingAssets.push({ ...asset, reason: 'file is empty' });
  } catch {
    missingAssets.push({ ...asset, reason: 'file not found' });
  }
}

if (process.argv.includes('--json')) {
  console.log(
    JSON.stringify({ count: all.length, hits: all, missingAssets }, null, 2),
  );
} else {
  if (all.length === 0) {
    console.log('[check:content] no placeholders found — OK');
  } else {
    console.log(`[check:content] found ${all.length} placeholder string(s):`);
    for (const h of all) {
      const rel = path.relative(ROOT, h.file);
      console.log(`  ${rel}:${h.line}:${h.column}  [${h.needle}]  ${h.text}`);
    }
  }

  if (missingAssets.length) {
    console.log('');
    console.log(
      `[check:content] WARNING — ${missingAssets.length} required file(s) missing before launch:`,
    );
    for (const m of missingAssets) {
      console.log(`  ${m.file} — ${m.reason}`);
      console.log(`      needed for: ${m.what}`);
    }
  }
}

// In default mode, exit non-zero so CI / pre-deploy catches the placeholders
// and the missing assets. Pass --warning to exit 0 instead (useful while
// intentionally still drafting).
const soft = process.argv.includes('--warning');
const problems = all.length + missingAssets.length;
process.exit(problems === 0 || soft ? 0 : 1);
