import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppText, GlowOrb, PressableScale, Reveal, Screen } from '@/components';
import { useProfile } from '@/features/profile/ProfileProvider';
import { track } from '@/lib/analytics';
import { lightTap } from '@/lib/haptics';
import { maybeRequestReview } from '@/lib/reviews';
import { getJSON, KEYS } from '@/lib/store';
import { useTheme } from '@/theme';

/**
 * The gentle close to a wind-down. Forward-looking, never a test — we do NOT ask
 * "how did you settle?" or log any rating (build plan: no symptom tracking, never
 * make the user feel like a patient).
 */
export function CheckIn() {
  const router = useRouter();
  const { c } = useTheme();
  const { mode } = useProfile();
  // same device-awareness as the rest of the nightly flow (cc.devices cache):
  // never tell someone without an orb to set one down
  const [hasOrb, setHasOrb] = useState(false);
  useEffect(() => {
    let alive = true;
    getJSON<unknown[]>(KEYS.devices, []).then((l) => {
      if (alive && Array.isArray(l) && l.length > 0) setHasOrb(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // peak-end is the fair moment to EARN a review, but never at lights-out: fire the
  // gated request (never kids, only after a few calm nights, once ever) behind the
  // Done tap, so a bright OS star-rating modal never lands on the "set the phone
  // down and sleep" screen while the user is still resting.
  const done = () => {
    maybeRequestReview({ kids: mode === 'kids' });
    router.replace('/');
  };

  // §15 funnel — the wind-down close was reached. No mood/Feeling is ever sent
  // (analytics no-ops in kids mode and scrubs any non-allow-listed prop).
  useEffect(() => {
    track('check_in_shown');
  }, []);

  return (
    <Screen mode="night">
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <Reveal index={0} style={{ alignItems: 'center' }}>
          <GlowOrb size={120} reserveGlow aura />
        </Reveal>
        <Reveal index={1} style={{ alignItems: 'center', marginTop: 8 }}>
          <AppText variant="h1" tone="title">
            That’s your wind-down
          </AppText>
        </Reveal>
        <Reveal index={2} style={{ alignItems: 'center' }}>
          <AppText variant="body" tone="muted" style={{ textAlign: 'center', maxWidth: 290 }}>
            {hasOrb
              ? 'Set your Glow Orb down whenever you’re ready. Rest well. There’s nothing else to do.'
              : 'Set the phone down whenever you’re ready. Rest well. There’s nothing else to do.'}
          </AppText>
        </Reveal>
      </View>
      <PressableScale
        onPress={done}
        onPressIn={lightTap}
        accessibilityRole="button"
        dimTo={0.9}
        scaleTo={0.98}
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 56,
          borderRadius: 16,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.line,
        }}>
        <AppText variant="bodyMedium" tone="accent">
          Done
        </AppText>
      </PressableScale>
    </Screen>
  );
}
