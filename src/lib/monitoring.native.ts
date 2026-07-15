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
    Sentry.init({
      dsn: DSN,
      tracesSampleRate: 0.2,
      // Sessions bypass beforeSend, so release health would leak kid sessions;
      // off entirely rather than adult-only-sometimes.
      enableAutoSessionTracking: false,
      // The kids flag must gate EVERY event type, not just captureError below -
      // Sentry's own global handlers (unhandled JS errors, native crashes,
      // sampled traces) send without consulting our wrapper.
      beforeSend: (event) => (kids ? null : event),
      beforeSendTransaction: (event) => (kids ? null : event),
    });
  } catch {
    /* monitoring must never break the app */
  }
}

/** Gate reporting by active profile, exactly like analytics - zero third-party
 *  reporting while a kid profile is active. The beforeSend hooks above drop
 *  JS-side events immediately; close() also stops the native layer (crash
 *  handler, envelopes queued off the JS thread), and re-init on returning to
 *  an adult profile brings reporting back. */
export function setMonitoringMode(mode: 'adult' | 'kids'): void {
  kids = mode === 'kids';
  if (!DSN) return;
  if (kids && started) {
    started = false;
    Sentry.close().catch(() => {});
  } else if (!kids && !started) {
    initMonitoring();
  }
}

export function captureError(error: unknown): void {
  if (!started || kids) return;
  try {
    Sentry.captureException(error);
  } catch {
    /* ignore */
  }
}
