import { Feather } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
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

  // No video on file → land on the ARTICLE that exists instead of a placeholder
  // "not yet available" panel (only reachable via deep link today; in-app entry points gate on videoUrl,
  // and that unavailable-clip copy is exactly the promised-feature wording the app bans). This must
  // be a render-time <Redirect>, not a useEffect: the effect version painted the
  // banned unavailable-clip panel for one frame before the replace fired, and a
  // reviewer probing deep links could catch that frame. All hooks above have
  // already run, so the early return is hook-safe.
  if (!src) return <Redirect href={`/learn-article?id=${article.id}` as Href} />;

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
        {/* src is guaranteed non-null here (render-time Redirect above), so the old
            the unavailable-clip fallback is gone from the binary entirely. */}
        <VideoView
          player={player}
          style={{ width: '100%', height: 220, borderRadius: 16, backgroundColor: c.bg }}
          contentFit="contain"
          nativeControls
        />
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
