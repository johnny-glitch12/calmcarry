import * as QuickActions from 'expo-quick-actions';
import { useQuickActionRouting } from 'expo-quick-actions/router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Home-screen quick actions (pre-mortem: the two-second-tonight goal). Long-press
 * the app icon -> "Begin wind-down" -> the Night Door (which resolves tonight's
 * track and is one tap from audio). NATIVE half of the platform split; web gets
 * the no-op in quickActions.tsx.
 *
 * Rendered from the (tabs) layout, NOT the root layout: useQuickActionRouting
 * navigates, and expo-quick-actions documents it must live in a sub-layout so the
 * navigator it targets is mounted. Kids safety needs no extra handling here:
 * /night-door is not in KID_ALLOWED, so KidsGuard redirects a kid profile to Home.
 */
export function QuickActionsBridge() {
  useQuickActionRouting();
  useEffect(() => {
    QuickActions.setItems([
      {
        id: 'wind-down',
        title: 'Begin wind-down',
        subtitle: 'One tap to tonight’s session',
        // SF Symbol on iOS; Android shows the app badge default (a bundled drawable
        // needs the config plugin + a design asset — fine to add later)
        icon: Platform.OS === 'ios' ? 'symbol:moon.stars' : undefined,
        params: { href: '/night-door' },
      },
    ]).catch(() => {
      /* unsupported launcher — quietly no shortcuts */
    });
  }, []);
  return null;
}

/** True when the app was cold-started from a home-screen quick action — the launch
 *  routing skips its own Night Door push then, or the two would stack. */
export function hasInitialQuickAction(): boolean {
  return QuickActions.initial != null;
}
