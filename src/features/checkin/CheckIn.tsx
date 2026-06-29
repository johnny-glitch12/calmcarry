import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, GlowOrb, Reveal, Screen } from '@/components';
import { useProfile } from '@/features/profile/ProfileProvider';
import { track } from '@/lib/analytics';
import { maybeRequestReview } from '@/lib/reviews';

/**
 * The gentle close to a wind-down. Forward-looking, never a test — we do NOT ask
 * "how did you settle?" or log any rating (build plan: no symptom tracking, never
 * make the user feel like a patient).
 */
export function CheckIn() {
  const router = useRouter();
  const { mode } = useProfile();
  const done = () => router.replace('/');

  // peak-end is the only fair moment to ask for a review — gated (never kids, only
  // after a few earned calm nights, once ever) inside maybeRequestReview.
  useEffect(() => {
    maybeRequestReview({ kids: mode === 'kids' });
  }, [mode]);

  // §15 funnel — the wind-down close was reached. No mood/Feeling is ever sent
  // (analytics no-ops in kids mode and scrubs any non-allow-listed prop).
  useEffect(() => {
    track('check_in_shown');
  }, []);

  return (
    <Screen mode="night">
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <GlowOrb size={120} reserveGlow aura />
        <Reveal index={0} style={{ alignItems: 'center', marginTop: 8 }}>
          <AppText variant="h1" tone="title">
            That’s your wind-down
          </AppText>
        </Reveal>
        <Reveal index={1} style={{ alignItems: 'center' }}>
          <AppText variant="body" tone="muted" style={{ textAlign: 'center', maxWidth: 290 }}>
            Set your Glow Orb down whenever you’re ready. Rest well. There’s nothing else to do.
          </AppText>
        </Reveal>
      </View>
      <Pressable onPress={done} accessibilityRole="button" style={{ alignItems: 'center', paddingVertical: 18 }}>
        <AppText variant="bodyMedium" tone="accent">
          Done
        </AppText>
      </Pressable>
    </Screen>
  );
}
