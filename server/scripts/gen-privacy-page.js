// Regenerate server/src/common/privacy-policy.page.ts from the canonical
// docs/legal/privacy-policy.public.html so the served copy can never drift.
const fs = require('fs');
const root = '/Users/nidhalabbassi/calmcarry';
let body = fs.readFileSync(root + '/docs/legal/privacy-policy.public.html', 'utf8');
// strip the leading HTML comment (publish note)
body = body.replace(/^<!--[\s\S]*?-->\s*/, '').trim();
// escape for a JS template literal
const esc = body.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

const file = `/**
 * Self-hosted CalmCarry privacy policy, served at GET /legal/privacy.
 *
 * DO NOT EDIT BY HAND. This file is generated from the canonical source
 * docs/legal/privacy-policy.public.html by scripts/gen-privacy-page.js, so the
 * app/API copy and the published web copy can never drift. To change the policy,
 * edit the .public.html and regenerate.
 */
const BODY = \`
${esc}
\`;

export const PRIVACY_POLICY_HTML = \`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="index,follow">
<title>CalmCarry Privacy Policy</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.6;
    color: #1d2a28;
    background: #f6f8f7;
    -webkit-text-size-adjust: 100%;
  }
  main { max-width: 720px; margin: 0 auto; padding: 40px 22px 72px; }
  h1 { font-size: 1.7rem; line-height: 1.25; margin: 0 0 .5rem; }
  h2 { font-size: 1.2rem; margin: 2rem 0 .5rem; padding-top: .4rem; border-top: 1px solid #dfe6e4; }
  h3 { font-size: 1.02rem; margin: 1.3rem 0 .4rem; }
  p, li { font-size: 1rem; }
  a { color: #2f6d6a; }
  ul { padding-left: 1.2rem; }
  table { width: 100%; border-collapse: collapse; margin: .6rem 0 1rem; font-size: .95rem; }
  th, td { text-align: left; vertical-align: top; padding: 8px 10px; border: 1px solid #dfe6e4; }
  th { background: #eef3f2; font-weight: 600; }
  .wrap { overflow-x: auto; }
  @media (prefers-color-scheme: dark) {
    body { color: #e7edeb; background: #0f1615; }
    h2 { border-top-color: #26302e; }
    a { color: #8fc9be; }
    th, td { border-color: #26302e; }
    th { background: #17201e; }
  }
</style>
</head>
<body>
<main>
\${BODY}
</main>
</body>
</html>\`;
`;

fs.writeFileSync(root + '/server/src/common/privacy-policy.page.ts', file);
// keep a copy of the generator in the repo for future regeneration
fs.mkdirSync(root + '/server/scripts', { recursive: true });
fs.copyFileSync(__filename, root + '/server/scripts/gen-privacy-page.js');
console.log('regenerated privacy-policy.page.ts (' + esc.length + ' body chars)');
