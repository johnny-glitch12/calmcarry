/**
 * Home-screen quick actions - WEB no-op half of the platform split. Metro resolves
 * quickActions.native.tsx on iOS/Android (the real expo-quick-actions wiring); web
 * (preview-only) gets these inert stand-ins so the native module never enters the
 * web bundle.
 */

export function QuickActionsBridge() {
  return null;
}

/** True when the app was cold-started from a home-screen quick action. */
export function hasInitialQuickAction(): boolean {
  return false;
}
