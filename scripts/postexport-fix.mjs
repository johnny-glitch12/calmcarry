// Post-export fixes for the Vercel static deploy of the web build.
//
// 1) Vercel SKIPS any file under a `node_modules/` path when deploying a static
//    dir. Expo hashes package-sourced assets (the Google text fonts AND the
//    @expo/vector-icons glyph fonts) under `assets/node_modules/...`, so those
//    fonts 404 (the SPA rewrite returns index.html) → text falls back and icons
//    render as tofu squares. Fix: rename `assets/node_modules` → `assets/nm` and
//    rewrite every reference in the emitted JS/HTML/CSS.
//
// 2) Expo's web index omits `viewport-fit=cover`, so `env(safe-area-inset-*)` is 0
//    in the browser and SafeAreaView can't inset content below the notch / Dynamic
//    Island / Android camera cutout (content renders under it). Add it to every
//    page's viewport meta so the browser exposes the real per-device insets.
import { readdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = 'calmcarry-preview/app';
const FROM = 'assets/node_modules';
const TO = 'assets/nm';

if (existsSync(join(ROOT, FROM))) renameSync(join(ROOT, FROM), join(ROOT, TO));

let files = 0;
let rewritten = 0;
let viewportPatched = 0;
function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      walk(p);
      continue;
    }
    if (!/\.(js|html|css|json|map)$/.test(e.name)) continue;
    files++;
    let s = readFileSync(p, 'utf8');
    let changed = false;
    if (s.includes(FROM)) {
      s = s.split(FROM).join(TO);
      changed = true;
    }
    if (e.name.endsWith('.html') && s.includes('name="viewport"') && !s.includes('viewport-fit=cover')) {
      s = s.replace(/(<meta name="viewport" content="[^"]*?)("\s*\/?>)/i, '$1, viewport-fit=cover$2');
      changed = true;
      viewportPatched++;
    }
    if (changed) {
      writeFileSync(p, s);
      rewritten++;
    }
  }
}
walk(ROOT);
console.log(`postexport-fix: ${FROM} → ${TO}; rewrote ${rewritten}/${files} files; viewport-fit=cover added to ${viewportPatched} html.`);
