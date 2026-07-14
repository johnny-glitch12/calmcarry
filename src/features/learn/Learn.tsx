import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { View } from 'react-native';

import { AppText, Card, PressableScale, Reveal, Screen } from '@/components';
import { CrisisSupport } from '@/features/about/CrisisSupport';
import { covers } from '@/content/covers';
import { LEARN, WELLNESS_DISCLAIMER } from '@/content/library';
import { lightTap } from '@/lib/haptics';
import { useTheme } from '@/theme';

export function LearnList() {
  const { c } = useTheme();
  const router = useRouter();
  const items = Object.values(LEARN);
  // pushed stack screen: standard back chevron (edge-swipe alone isn't discoverable),
  // and no tabBarSpacing - the tab bar never renders on stack routes
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <Screen mode="light" scroll>
      <Reveal index={0}>
        <PressableScale onPress={back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" dimTo={0.85} style={{ marginBottom: 8 }}>
          <Feather name="chevron-left" size={26} color={c.text} />
        </PressableScale>
        <AppText variant="caption" tone="muted">
          Learn
        </AppText>
        <AppText variant="h1" tone="title" style={{ marginTop: 6 }}>
          Getting the most from it
        </AppText>
      </Reveal>

      <Reveal index={1} style={{ marginTop: 24, gap: 12 }}>
        {items.map((a) => (
          <PressableScale
            key={a.id}
            onPress={() => router.push((a.videoUrl ? `/watch?id=${a.id}` : `/learn-article?id=${a.id}`) as Href)}
            onPressIn={lightTap}
            accessibilityRole="button"
            dimTo={0.95}
            scaleTo={0.98}>
            <Card variant="surface" padding={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              {a.cover ? (
                <Image source={covers[a.cover]} style={{ width: 60, height: 60, borderRadius: 16 }} contentFit="cover" accessibilityIgnoresInvertColors />
              ) : null}
              <View style={{ flex: 1 }}>
                <AppText variant="caption" tone="accent" numberOfLines={1}>
                  {a.kicker}
                </AppText>
                <AppText variant="bodyMedium" tone="title" style={{ fontSize: 16, marginTop: 3 }} numberOfLines={2}>
                  {a.title}
                </AppText>
                <AppText variant="label" tone="muted" style={{ marginTop: 3 }}>
                  {a.readMins} min read
                </AppText>
              </View>
              <Feather name="chevron-right" size={20} color={c.accent} />
            </Card>
          </PressableScale>
        ))}
      </Reveal>

      {/* Learn is where people go when sleep isn't working - a quiet support block
          at the foot reads as care, not alarm (pre-mortem: the signpost was buried
          in About only). */}
      <Reveal index={2} style={{ marginTop: 28 }}>
        <CrisisSupport />
      </Reveal>
    </Screen>
  );
}

export function LearnArticle() {
  const { c } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const article = (id && LEARN[id]) || LEARN['first-20'];
  const back = () => (router.canGoBack() ? router.back() : router.replace('/learn'));

  return (
    <Screen mode="light" scroll>
      <Reveal index={0}>
        <PressableScale onPress={back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" dimTo={0.85} style={{ marginBottom: 16 }}>
          <Feather name="chevron-left" size={26} color={c.text} />
        </PressableScale>
        {article.cover ? (
          <Image source={covers[article.cover]} style={{ width: '100%', height: 160, borderRadius: 20 }} contentFit="cover" accessibilityIgnoresInvertColors />
        ) : null}
        <AppText variant="meta" tone="accent" style={{ marginTop: 18 }}>
          {article.kicker} · {article.readMins} min
        </AppText>
        <AppText variant="display" tone="title" style={{ marginTop: 6 }}>
          {article.title}
        </AppText>
      </Reveal>

      <Reveal index={1} style={{ marginTop: 18, gap: 16 }}>
        {article.body.map((p, i) => (
          <AppText key={i} variant="body" tone="text" style={{ lineHeight: 26 }}>
            {p}
          </AppText>
        ))}
      </Reveal>

      {/* compliance disclaimer (build plan §10) */}
      <Reveal index={2} style={{ marginTop: 28 }}>
        <View
          style={{
            borderRadius: 14,
            backgroundColor: 'rgba(72,84,83,0.05)',
            borderWidth: 1,
            borderColor: c.line,
            padding: 14,
          }}>
          <AppText variant="meta" tone="dim">
            {WELLNESS_DISCLAIMER}
          </AppText>
        </View>
      </Reveal>
    </Screen>
  );
}
