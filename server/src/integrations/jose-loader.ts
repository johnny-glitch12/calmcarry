/**
 * jose v6 is ESM-only. Plain Node >= 22.12 can require() it (and jest maps it to
 * the test stub), but Vercel's serverless module loader cannot (ERR_REQUIRE_ESM
 * on every invocation), so there it must be loaded with a REAL dynamic import.
 * TypeScript compiling to CommonJS rewrites `import('jose')` back into require(),
 * which re-breaks it - the Function constructor hides the import from the
 * transpiler. Try require first, fall back to dynamic import; cache either way.
 */
type Jose = typeof import('jose');

let cached: Promise<Jose> | null = null;

export function loadJose(): Promise<Jose> {
  cached ??= (async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('jose') as Jose;
    } catch {
      return (new Function('return import("jose")')() as Promise<Jose>);
    }
  })();
  return cached;
}
