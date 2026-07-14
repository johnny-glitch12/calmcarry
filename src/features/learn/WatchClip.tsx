import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import { View } from 'react-native';

import { AppText, PressableScale, Reveal, Screen } from '@/components';
import { LEARN } from '@/content/library';
import { useTheme } from '@/theme';

/** Watch & learn - a real short-clip player (expo-video). The source comes from
 *  the article's videoUrl (CMS-driven; placeholder today, Glowco supplies finals). */
export function WatchClip() {
  const { c } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const article = (id && LEARN[id]) || LEARN['first-20'];
  const src = article.videoUrl ?? null;

  const player = useVideoPlayer(src, (p) => {
    p.loop = false;
    if (src) p.play();
  });

  const back = () => (router.canGoBack() ? router.back() : router.replace('/learn'));

  // No video on file → land on the ARTICLE that exists instead of a "coming soon"
  // panel (only reachable via deep link today; in-app entry points gate on videoUrl,
  // and "coming soon" is exactly the promised-feature copy the app bans).
  useEffect(() => {
    if (!src) router.replace(`/learn-article?id=${article.id}` as Href);
  }, [src, article.id, router]);

  return (
    <Screen mode="night" scroll>
      <Reveal index={0}>
        <PressableScale onPress={back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" dimTo={0.85} style={{ marginBottom: 16 }}>
          <Feather name="chevron-left" size={26} color={c.text} />
        </PressableScale>
        <AppText variant="caption" tone="accent">
          {article.kicker}
        </AppText>
        <AppText variant="h1" tone="title" style={{ marginTop: 6 }}>
          {article.title}
        </AppText>
      </Reveal>

      <Reveal index={1} style={{ marginTop: 18 }}>
        {src ? (
          <VideoView
            player={player}
            style={{ width: '100%', height: 220, borderRadius: 16, backgroundColor: c.bg }}
            contentFit="contain"
            nativeControls
          />
        ) : (
          <View style={{ height: 220, borderRadius: 16, backgroundColor: c.panel, alignItems: 'center', justifyContent: 'center' }}>
            <AppText variant="body" tone="muted">
              This clip is coming soon.
            </AppText>
          </View>
        )}
      </Reveal>

      <Reveal index={2} style={{ marginTop: 18 }}>
        {article.body.map((p, i) => (
          <AppText key={i} variant="body" tone="text" style={{ marginBottom: 14, lineHeight: 24 }}>
            {p}
          </AppText>
        ))}
      </Reveal>
    </Screen>
  );
}
