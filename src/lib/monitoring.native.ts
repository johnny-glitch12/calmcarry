import * as Sentry from '@sentry/react-native';

/**
 * Native crash/error monitoring (Sentry). Initialises ONLY when a real DSN is
 * provided via EXPO_PUBLIC_SENTRY_DSN - no DSN → no-op (never pretends to report).
 * PLACEHOLDER: set EXPO_PUBLIC_SENTRY_DSN to your Sentry project's DSN.
 */
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';
let started = false;
let kids = false; // COPPA: never send a child's crashes/errors to a third party

export function initMonitoring(): void {
  if (started || !DSN) return;
  started = true;
  try {
    Sentry.init({ dsn: DSN, tracesSampleRate: 0.2 });
  } catch {
    /* monitoring must never break the app */
  }
}

/** Gate reporting by active profile, exactly like analytics - zero third-party
 *  reporting while a kid profile is active. */
export function setMonitoringMode(mode: 'adult' | 'kids'): void {
  kids = mode === 'kids';
}

export function captureError(error: unknown): void {
  if (!started || kids) return;
  try {
    Sentry.captureException(error);
  } catch {
    /* ignore */
  }
}
