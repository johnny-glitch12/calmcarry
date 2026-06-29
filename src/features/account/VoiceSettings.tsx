import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { AppText, Reveal, Screen, VoicePicker } from '@/components';
import { useTheme } from '@/theme';

/** Settings → Guided voice. Change the narration voice any time; tap to preview. */
export function VoiceSettings() {
  const { c } = useTheme();
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/you'));

  return (
    <Screen scroll>
      <Reveal index={0}>
        <Pressable
          onPress={back}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [{ marginBottom: 16, alignSelf: 'flex-start' }, pressed ? { opacity: 0.6 } : null]}>
          <Feather name="chevron-left" size={26} color={c.text} />
        </Pressable>
        <AppText variant="caption" tone="muted">
          Settings
        </AppText>
        <AppText variant="h1" tone="title" style={{ marginTop: 6 }}>
          Guided voice
        </AppText>
        <AppText variant="body" tone="muted" style={{ marginTop: 10, marginBottom: 24 }}>
          The voice that guides your wind-downs. Tap any to hear it.
        </AppText>
      </Reveal>
      <Reveal index={1}>
        <VoicePicker />
      </Reveal>
    </Screen>
  );
}
