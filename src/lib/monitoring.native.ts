import * as Sentry from '@sentry/react-native';

/**
 * Native crash/error monitoring (Sentry). Initialises ONLY when a real DSN is
 * provided via EXPO_PUBLIC_SENTRY_DSN — no DSN → no-op (never pretends to report).
 * PLACEHOLDER: set EXPO_PUBLIC_SENTRY_DSN to your Sentry project's DSN.
 */
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
let started = false;

export function initMonitoring(): void {
  if (started || !DSN) return;
  started = true;
  try {
    Sentry.init({ dsn: DSN, tracesSampleRate: 0.2 });
  } catch {
    /* monitoring must never break the app */
  }
}

export function captureError(error: unknown): void {
  if (!started) return;
  try {
    Sentry.captureException(error);
  } catch {
    /* ignore */
  }
}
