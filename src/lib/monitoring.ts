/**
 * Crash / error monitoring — DEFAULT / WEB build (no-op). Metro uses
 * `monitoring.native.ts` (Sentry) on iOS/Android; web never imports Sentry.
 */
export function initMonitoring(): void {}
export function setMonitoringMode(_mode: 'adult' | 'kids'): void {}
export function captureError(_error: unknown): void {}
