import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Linking, Pressable, View } from 'react-native';

import { AppText, Logo, Reveal, Screen } from '@/components';
import { WELLNESS_DISCLAIMER } from '@/content/library';
import { PRIVACY_URL, STORE_URL, SUPPORT_URL, TERMS_URL } from '@/content/store';
import { useTheme } from '@/theme';

const APP_VERSION = '1.0.0';

const LINKS: { label: string; icon: keyof typeof Feather.glyphMap; url: string }[] = [
  { label: 'Privacy & data', icon: 'lock', url: PRIVACY_URL },
  { label: 'Terms of service', icon: 'file-text', url: TERMS_URL },
  { label: 'Help & support', icon: 'help-circle', url: SUPPORT_URL },
  { label: 'Visit The Glow Company', icon: 'shopping-bag', url: STORE_URL },
];

function LinkRow({
  icon,
  label,
  url,
  last,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  url: string;
  last?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => Linking.openURL(url).catch(() => {})}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens in your browser"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.line,
      }}>
      <Feather name={icon} size={18} color={c.accent} />
      <AppText variant="bodyMedium" tone="title" style={{ flex: 1, fontSize: 15 }}>
        {label}
      </AppText>
      <Feather name="external-link" size={17} color={c.accent} />
    </Pressable>
  );
}

export function About() {
  const router = useRouter();
  const { c } = useTheme();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/you'));

  return (
    <Screen mode="light" scroll contentStyle={{ paddingTop: 8 }}>
      <Reveal index={0}>
        <Pressable onPress={back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={{ marginBottom: 8 }}>
          <Feather name="chevron-left" size={26} color={c.text} />
        </Pressable>
      </Reveal>

      <Reveal index={1} style={{ alignItems: 'center', marginTop: 12 }}>
        <Logo size="lg" tagline />
        <AppText variant="label" tone="muted" style={{ marginTop: 16 }}>
          Version {APP_VERSION}
        </AppText>
        <AppText variant="body" tone="muted" style={{ marginTop: 12, textAlign: 'center', maxWidth: 320 }}>
          The companion app for your Glow Orb — soundscapes, sleep tales and guided wind-downs to help you settle into calmer nights.
        </AppText>
      </Reveal>

      <Reveal index={2} style={{ marginTop: 28 }}>
        <View
          style={{
            borderRadius: 18,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.line,
            ...c.shadow,
          }}>
          {LINKS.map((l, i) => (
            <LinkRow key={l.label} icon={l.icon} label={l.label} url={l.url} last={i === LINKS.length - 1} />
          ))}
        </View>
      </Reveal>

      <Reveal index={3} style={{ marginTop: 24 }}>
        <AppText
          variant="caption"
          tone="dim"
          style={{ textAlign: 'center', textTransform: 'none', letterSpacing: 0, lineHeight: 16 }}>
          {WELLNESS_DISCLAIMER}
        </AppText>
      </Reveal>

      <Reveal index={4} style={{ marginTop: 18, marginBottom: 8 }}>
        <AppText
          variant="caption"
          tone="dim"
          style={{ textAlign: 'center', textTransform: 'none', letterSpacing: 0 }}>
          © 2026 The Glow Company. All rights reserved.
        </AppText>
      </Reveal>
    </Screen>
  );
}
