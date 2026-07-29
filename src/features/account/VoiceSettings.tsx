import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { AppText, PressableScale, Reveal, Screen, VoicePicker } from '@/components';
import { useTheme } from '@/theme';

/** Settings → Guided voice. Preview the bedtime voices and save a preference; tap to
 *  hear each. (Guided sessions play a fixed narration today - the pick applies once
 *  per-voice sets are produced. See lib/voice.ts.) */
export function VoiceSettings() {
  const { c } = useTheme();
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/you'));

  return (
    <Screen scroll>
      <Reveal index={0}>
        <PressableScale
          onPress={back}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
          dimTo={0.6}
          style={{ marginBottom: 16, alignSelf: 'flex-start' }}>
          <Feather name="chevron-left" size={26} color={c.text} />
        </PressableScale>
        <AppText variant="caption" tone="muted">
          Settings
        </AppText>
        <AppText variant="h1" tone="title" style={{ marginTop: 6 }}>
          Guided voice
        </AppText>
        <AppText variant="body" tone="muted" style={{ marginTop: 10, marginBottom: 24 }}>
          A preview of the bedtime voices we’re producing for guided sessions. Tap any to hear one, and we’ll remember your pick.
        </AppText>
      </Reveal>
      <Reveal index={1}>
        <VoicePicker />
      </Reveal>
    </Screen>
  );
}
