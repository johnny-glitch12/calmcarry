// Load `server/.env` into process.env BEFORE config.ts reads it. Zero-dependency
// (uses Node's built-in env-file loader, Node >= 20.12). Must be the FIRST import
// in main.ts so values are present when ./config evaluates. Safe no-op when there
// is no .env — in that case env comes from the shell / host (e.g. Fly secrets).
type WithLoadEnv = { loadEnvFile?: (path?: string) => void };
try {
  (process as unknown as WithLoadEnv).loadEnvFile?.();
} catch {
  /* no .env present — rely on the shell / host environment */
}
