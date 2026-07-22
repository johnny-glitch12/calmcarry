import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { AppText, GlowOrb, PressableScale, Reveal, Screen } from '@/components';
import { useProfile } from '@/features/profile/ProfileProvider';
import { track } from '@/lib/analytics';
import { lightTap } from '@/lib/haptics';
import { recordNight, type NightOutcome } from '@/lib/nightsLog';
import { maybeRequestReview } from '@/lib/reviews';
import { getJSON, KEYS } from '@/lib/store';
import { useTheme } from '@/theme';

/** A soft, optional post-session chip. No scale, no history - just "calmer" or
 *  "about the same". Adult-only; the plain "Done" path below always records nothing. */
function OutcomeChip({ label, onPress }: { label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      onPressIn={lightTap}
      accessibilityRole="button"
      accessibilityLabel={label}
      scaleTo={0.97}
      dimTo={0.9}
      style={{
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 999,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.line,
      }}>
      <AppText variant="bodyMedium" tone="title">
        {label}
      </AppText>
    </PressableScale>
  );
}

/**
 * The gentle close to a wind-down. Forward-looking, never a test - we do NOT ask
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

  // OPTIONAL, adult-only: log tonight's outcome for the honest home receipt, then
  // leave exactly like Done. Nothing here blocks or delays lights-out, and the log
  // is LOCAL ONLY - never synced, never sent to analytics (build plan §3/§14).
  const record = (outcome: NightOutcome) => {
    recordNight(outcome).catch(() => {});
    done();
  };

  // The chip is feather-light and fully skippable. Never for kids, and never in the
  // deep-night window (1-5am) - a 3am wake-up shouldn't be asked to reflect; the
  // wordless "Done" path is all that shows then.
  const hour = useMemo(() => new Date().getHours(), []);
  const showOutcome = mode !== 'kids' && !(hour >= 1 && hour < 5);

  // §15 funnel - the wind-down close was reached. No mood/Feeling is ever sent
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
        {/* one optional, wordless-friendly note. Tapping records tonight and leaves;
            not tapping records nothing. No scale, no follow-up. */}
        {showOutcome ? (
          <Reveal index={3} style={{ alignItems: 'center', marginTop: 20 }}>
            <AppText variant="caption" tone="dim" style={{ textAlign: 'center', marginBottom: 14 }}>
              If you’d like, note how tonight landed
            </AppText>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <OutcomeChip label="Calmer" onPress={() => record('calmer')} />
              <OutcomeChip label="About the same" onPress={() => record('same')} />
            </View>
          </Reveal>
        ) : null}
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
