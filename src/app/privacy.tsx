import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Linking, Pressable, View } from 'react-native';

import { AppText, Card, Reveal, Screen } from '@/components';
import { PRIVACY_URL } from '@/content/store';
import { useTheme } from '@/theme';

// Turns CalmCarry's already-true architecture (anonymous analytics, no ad SDK,
// NSPrivacyTracking=false, no sleep recording, kids never tracked) into a visible,
// plain-English trust surface — the thing BetterSleep buries in an external policy.
const POINTS: { icon: keyof typeof Feather.glyphMap; title: string; body: string }[] = [
  {
    icon: 'eye-off',
    title: 'Anonymous by default',
    body: 'We key the little we measure to a random per-install id — never your name, email, or account. No profile is built about you.',
  },
  {
    icon: 'slash',
    title: 'No trackers, no ads',
    body: 'There are no third-party advertising or tracking SDKs in CalmCarry. We never sell or share your data — and there’s no “ask app not to track” prompt, because we don’t track you across other apps.',
  },
  {
    icon: 'moon',
    title: 'We don’t record your sleep',
    body: 'No microphone listening, no snore recording, no nightly score you can fail. The only thing worth noticing is whether your evenings feel a little calmer.',
  },
  {
    icon: 'shield',
    title: 'Kids are never tracked',
    body: 'In a child profile there is zero analytics, zero ads, and zero social. A parent gate guards every adult area, and consent comes first.',
  },
  {
    icon: 'download',
    title: 'Your data, on request',
    body: 'Export everything tied to your account as a file, or delete your account and data permanently — both from Settings, anytime, in a tap.',
  },
];

export default function PrivacyPanel() {
  const { c } = useTheme();
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/you'));

  return (
    <Screen mode="light" scroll contentStyle={{ paddingTop: 8 }}>
      <Reveal index={0}>
        <Pressable onPress={back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={{ marginBottom: 8 }}>
          <Feather name="chevron-left" size={26} color={c.text} />
        </Pressable>
      </Reveal>

      <Reveal index={1} style={{ marginTop: 4 }}>
        <AppText variant="caption" tone="muted">
          Privacy
        </AppText>
        <AppText variant="h1" tone="title" style={{ marginTop: 6 }}>
          Your data stays yours
        </AppText>
        <AppText variant="body" tone="muted" style={{ marginTop: 10 }}>
          CalmCarry is built privacy-first — here’s exactly what that means, in plain English.
        </AppText>
      </Reveal>

      <Reveal index={2} style={{ marginTop: 24, gap: 14 }}>
        {POINTS.map((p) => (
          <Card key={p.title} style={{ flexDirection: 'row', gap: 14 }}>
            <Feather name={p.icon} size={18} color={c.accent} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <AppText variant="cardTitle" tone="title">
                {p.title}
              </AppText>
              <AppText variant="body" tone="muted" style={{ marginTop: 4 }}>
                {p.body}
              </AppText>
            </View>
          </Card>
        ))}
      </Reveal>

      <Reveal index={3} style={{ marginTop: 18, marginBottom: 8 }}>
        <Pressable
          onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}
          accessibilityRole="button"
          accessibilityHint="Opens in your browser"
          style={{ alignItems: 'center', paddingVertical: 12 }}>
          <AppText variant="label" tone="accent">
            Read the full privacy policy
          </AppText>
        </Pressable>
      </Reveal>
    </Screen>
  );
}
