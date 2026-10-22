// npm run check:assets
//
// Fails (non-zero) if any file under public/ or dist/ is larger than 300 KB.
// public/og-image.png is exempt: it is the Open Graph card and is served to
// social crawlers only, never as page content.
//
// Run automatically as the last step of `npm run build`.

import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';

const ROOT = process.cwd();
const MAX_KB = 300;
const EXEMPT = [
  // Social preview card — not page content, must stay PNG per platform rules.
  path.join('public', 'og-image.png'),
];

async function walk(dir) {
  const out = [];
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

async function main() {
  const failures = [];
  const rows = [];

  for (const rel of ['public', 'dist']) {
    const dir = path.join(ROOT, rel);
    if (!existsSync(dir)) {
      rows.push(`  ${rel}/ not present (skipped)`);
      continue;
    }
    const files = await walk(dir);
    for (const f of files) {
      const relPath = path.relative(ROOT, f);
      if (EXEMPT.includes(relPath)) {
        const s = await stat(f);
        rows.push(`  EXEMPT  ${relPath} ${(s.size / 1024).toFixed(1)} KB`);
        continue;
      }
      const s = await stat(f);
      const kb = s.size / 1024;
      if (kb > MAX_KB) {
        failures.push(`${relPath} is ${kb.toFixed(1)} KB (limit ${MAX_KB} KB)`);
      }
    }
    rows.push(`  ${rel}/ scanned ${files.length} files`);
  }

  console.log('== check:assets ==');
  console.log(`  limit: ${MAX_KB} KB per file (public/og-image.png exempt)`);
  for (const r of rows) console.log(r);

  if (failures.length) {
    console.log('\n**Result: FAILED**');
    for (const f of failures) console.log(`  FAIL: ${f}`);
    process.exit(1);
  }
  console.log('\n**Result: ALL ASSET CHECKS PASS** (no file over 300 KB)');
}

main().catch((e) => {
  console.error('[check-assets] failed:', e);
  process.exit(1);
});