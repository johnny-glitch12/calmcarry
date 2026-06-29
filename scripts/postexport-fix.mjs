// Post-export fix for the Vercel static deploy of the web build.
//
// Expo's web export hashes package-sourced assets (the Google text fonts AND the
// @expo/vector-icons glyph fonts) under `assets/node_modules/...`. Vercel SKIPS any
// file under a `node_modules/` path when deploying a static dir, so those fonts 404
// (the SPA rewrite then returns index.html) → text falls back and icons render as
// tofu squares. Non-node_modules assets (covers, JS) serve fine.
//
// Fix: rename `assets/node_modules` → `assets/nm` and rewrite every reference to it
// in the emitted JS/HTML/CSS so the URLs point at the (uploaded) `assets/nm` path.
import { readdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = 'calmcarry-preview/app';
const FROM = 'assets/node_modules';
const TO = 'assets/nm';

if (!existsSync(join(ROOT, FROM))) {
  console.log(`postexport-fix: no ${FROM} in export — nothing to do.`);
  process.exit(0);
}

renameSync(join(ROOT, FROM), join(ROOT, TO));

let files = 0;
let rewritten = 0;
function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|html|css|json|map)$/.test(e.name)) {
      files++;
      const s = readFileSync(p, 'utf8');
      if (s.includes(FROM)) {
        writeFileSync(p, s.split(FROM).join(TO));
        rewritten++;
      }
    }
  }
}
walk(ROOT);
console.log(`postexport-fix: ${FROM} → ${TO}; rewrote ${rewritten}/${files} text files.`);
