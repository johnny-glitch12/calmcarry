import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Linking, View } from 'react-native';

import { AppText, Card, PressableScale, Reveal, Screen } from '@/components';
import { PRIVACY_URL } from '@/content/store';
import { useTheme } from '@/theme';

// Turns CalmCarry's already-true architecture (anonymous analytics, no ad SDK,
// NSPrivacyTracking=false, no sleep recording, kids never tracked) into a visible,
// plain-English trust surface - the thing BetterSleep buries in an external policy.
const POINTS: { icon: keyof typeof Feather.glyphMap; title: string; body: string }[] = [
  {
    icon: 'eye-off',
    title: 'Anonymous by default',
    body: 'App-usage measurements are keyed to a random per-install id, never your name or email. If you are signed in we also record which sessions you played, so your progress and recents follow your account. You can switch all of that off in Settings, and it is never used for ads or sold.',
  },
  {
    icon: 'slash',
    title: 'No trackers, no ads',
    body: 'There are no third-party advertising or tracking SDKs in CalmCarry. We never sell or share your data. And there’s no “ask app not to track” prompt, because we don’t track you across other apps.',
  },
  {
    icon: 'moon',
    title: 'We don’t record your sleep',
    body: 'No microphone listening, no snore recording, no nightly score you can fail. The only thing worth noticing is whether your evenings feel a little calmer.',
  },
  {
    icon: 'shield',
    title: 'Kids are never tracked',
    body: 'A child profile records zero analytics, sends zero crash reports, shows zero ads, and has nothing social. The first name you type for your child stays on this phone: we never upload it, so we cannot see it. A parent gate guards every adult area.',
  },
  {
    // 16 CFR 312.10 requires the retention policy to be PUBLISHED, stating the
    // purpose, the business need and the deletion timeframe. The screen previously
    // disclosed no retention period at all.
    icon: 'clock',
    title: 'How long we keep things',
    body: 'Records of which sessions you played, and anonymous app-usage events, are deleted automatically after 400 days. We keep them that long so month-to-month and seasonal patterns stay meaningful, and no longer. Your account details are kept while your account exists and are erased when you delete it, apart from billing records that tax law requires us to retain.',
  },
  {
    icon: 'download',
    title: 'Your data, on request',
    body: 'Export everything tied to your account as a file, or delete your account and data permanently. Both live in Settings, anytime, in a tap.',
  },
];

export default function PrivacyPanel() {
  const { c } = useTheme();
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/you'));

  return (
    <Screen mode="light" scroll contentStyle={{ paddingTop: 8 }}>
      <Reveal index={0}>
        <PressableScale onPress={back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" dimTo={0.85} style={{ marginBottom: 8 }}>
          <Feather name="chevron-left" size={26} color={c.text} />
        </PressableScale>
      </Reveal>

      <Reveal index={1} style={{ marginTop: 4 }}>
        <AppText variant="caption" tone="muted">
          Privacy
        </AppText>
        <AppText variant="h1" tone="title" style={{ marginTop: 6 }}>
          Your data stays yours
        </AppText>
        <AppText variant="body" tone="muted" style={{ marginTop: 10 }}>
          CalmCarry is built privacy-first. Here’s exactly what that means, in plain English.
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
        <PressableScale
          onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}
          accessibilityRole="button"
          accessibilityHint="Opens in your browser"
          dimTo={0.85}
          style={{ alignItems: 'center', paddingVertical: 12 }}>
          <AppText variant="label" tone="accent">
            Read the full privacy policy
          </AppText>
        </PressableScale>
      </Reveal>
    </Screen>
  );
}
