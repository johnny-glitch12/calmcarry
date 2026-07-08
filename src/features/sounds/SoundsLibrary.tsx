import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated';

import { AppText, CoverCard, LibraryCard, PressableScale, Reveal, Screen, SectionHeader } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/ProfileProvider';
import { covers } from '@/content/covers';
import { LEARN, PROGRAMS, TRACKS, type Track } from '@/content/library';
import { getFavorites } from '@/lib/favorites';
import { lightTap } from '@/lib/haptics';
import { getRecents } from '@/lib/recents';
import { dur, ease, useTheme } from '@/theme';

type Rail = { kicker: string; title: string; ids: string[] };

// Library organised by the MOMENT, not by feature (build plan §7):
// Quick calm / Wind down & sleep / Music & sounds (+ Watch & learn + Programs below).
// Kickers are kept ONLY where they add information the title doesn't already carry
// ("Tonight"). Redundant restatements ("For right now" over "Quick calm") are dropped —
// tired eyes shouldn't double-read tiny all-caps text before reaching the cards.
const ADULT_RAILS: Rail[] = [
  { kicker: '', title: 'Quick calm', ids: ['box-breathing'] },
  { kicker: 'Tonight', title: 'Wind down & sleep', ids: ['deep-rest', 'letting-go', 'penguin', 'slow-tide'] },
  { kicker: '', title: 'Soundscapes', ids: ['dawn-chorus', 'shoreline', 'fireside', 'rainfall', 'forest', 'rain-fire', 'rain-ocean', 'rain-forest', 'beach-fire'] },
  { kicker: '', title: 'Music', ids: ['gymnopedie', 'spa', 'rain-piano'] },
  { kicker: '', title: 'Noise & masking', ids: ['brown-noise', 'pink-noise', 'white-noise', 'green-noise', 'fan'] },
];

const KIDS_RAILS: Rail[] = [
  { kicker: 'Bedtime', title: 'Calm for little ones', ids: ['penguin'] },
  { kicker: 'Calm sounds', title: 'Drift off', ids: ['forest', 'rainfall', 'slow-tide'] },
  { kicker: 'Wind down', title: 'Calm breathing', ids: ['box-breathing'] },
];

export function SoundsLibrary() {
  const router = useRouter();
  const { c } = useTheme();
  const { isPremium } = useAuth();
  const { mode } = useProfile();
  const kids = mode === 'kids';
  const rails = kids ? KIDS_RAILS : ADULT_RAILS;

  // saved + recently-played (local), refreshed on focus so a just-saved/played
  // track shows up immediately on return to the Library
  const [saved, setSaved] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getFavorites().then((ids) => alive && setSaved(ids));
      getRecents().then((ids) => alive && setRecent(ids));
      return () => {
        alive = false;
      };
    }, [])
  );

  // kids never see the paywall — their tiles always open the player
  const openTrack = (t: Track) =>
    router.push(!kids && t.locked && !isPremium ? `/unlock?id=${t.id}` : `/player?id=${t.id}`);

  // SPARSITY DISCIPLINE (thin library, designed-for): a track never appears twice
  // on this screen — anything already shown in the personal rails (saved / recent)
  // is dropped from the moment rails below. A rail left with ONE item doesn't
  // render as a lonely one-card "rail"; it becomes a full-width editorial card.
  const seen = new Set<string>([...(!kids ? saved : []), ...(!kids ? recent : [])]);

  // rails snap card-by-card, like flipping through a deck (card 152 + gap 14)
  const SNAP = 152 + 14;
  const railProps = {
    horizontal: true as const,
    showsHorizontalScrollIndicator: false,
    snapToInterval: SNAP,
    decelerationRate: 'fast' as const,
    disableIntervalMomentum: true,
    contentContainerStyle: { paddingHorizontal: 24, gap: 14 },
  };

  // Focus-refresh reshuffle motion (build plan §7): on return to the Library the
  // seen-set filter can pull a rail (or a single track) out of the moment sections
  // and float saved/recent rails in — nothing may snap out of existence. Removals
  // fade (exiting) and everything left glides to its new place (layout) instead of
  // jumping. Kept off `entering` so Reveal still owns the one-time mount entrance.
  const railExit = FadeOut.duration(dur.exit).reduceMotion(ReduceMotion.System);
  const railFlow = LinearTransition.duration(dur.nav).easing(ease.inOut).reduceMotion(ReduceMotion.System);

  // a horizontal rail built from a list of track ids (used for Saved / Recently played);
  // renders nothing when the list is empty so the section only appears once there's content
  const dynamicRail = (key: string, kicker: string, title: string, ids: string[]) => {
    const items = ids.map((id) => TRACKS[id]).filter((t): t is Track => !!t);
    if (!items.length) return null;
    return (
      <Animated.View key={key} exiting={railExit} layout={railFlow}>
        <Reveal index={1} style={{ marginBottom: 28 }}>
          <View style={{ paddingHorizontal: 24 }}>
            <SectionHeader kicker={kicker} title={title} />
          </View>
          <ScrollView {...railProps}>
            {items.map((t) => (
              <Animated.View key={t.id} exiting={railExit} layout={railFlow}>
                <LibraryCard
                  title={t.title}
                  subtitle={`${t.category[0].toUpperCase()}${t.category.slice(1)} · ${t.duration}`}
                  image={covers[t.cover]}
                  locked={!kids && t.locked && !isPremium}
                  onPress={() => openTrack(t)}
                />
              </Animated.View>
            ))}
          </ScrollView>
        </Reveal>
      </Animated.View>
    );
  };

  return (
    <Screen mode={kids ? 'night' : 'light'} scroll tabBarSpacing contentStyle={{ paddingHorizontal: 0 }}>
      <Reveal index={0} style={{ paddingHorizontal: 24, marginBottom: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <AppText variant="caption" tone="muted">
              {kids ? 'Kids' : 'Sounds & sessions'}
            </AppText>
            <AppText variant="h1" tone="title" style={{ marginTop: 6 }}>
              {kids ? 'Bedtime library' : 'Library'}
            </AppText>
          </View>
          {/* search + learn are adult affordances (route to programs/paywall) — hidden in kids */}
          {!kids ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 24 }}>
              <PressableScale
                onPress={() => router.push('/search')}
                onPressIn={lightTap}
                hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                accessibilityRole="button"
                accessibilityLabel="Search"
                dimTo={0.85}>
                <Feather name="search" size={20} color={c.textAccent} />
              </PressableScale>
              <PressableScale
                onPress={() => router.push('/learn')}
                onPressIn={lightTap}
                hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                accessibilityRole="button"
                dimTo={0.85}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Feather name="book-open" size={15} color={c.textAccent} />
                <AppText variant="label" style={{ color: c.textAccent }}>
                  Learn
                </AppText>
              </PressableScale>
            </View>
          ) : null}
        </View>
      </Reveal>

      {/* personal rails first — your saved sessions + where you left off (adults) */}
      {!kids ? dynamicRail('saved', 'Saved', 'Your saved sessions', saved) : null}
      {!kids ? dynamicRail('recent', 'Recently played', 'Pick up where you left off', recent) : null}

      {/* track rails — the moment-based sections (Quick calm / Wind down & sleep / Music & sounds) */}
      {rails.map((rail, i) => {
        const items = rail.ids
          .map((id) => TRACKS[id])
          .filter((t): t is Track => !!t && !seen.has(t.id));
        if (!items.length) return null; // everything here already lives in a personal rail above
        return (
          <Animated.View key={rail.title} exiting={railExit} layout={railFlow}>
            <Reveal index={i + 1} style={{ marginBottom: 28 }}>
              <View style={{ paddingHorizontal: 24 }}>
                <SectionHeader kicker={rail.kicker} title={rail.title} />
              </View>
              {items.length === 1 ? (
                // one item = a full-width editorial card, never a lonely one-card rail.
                // Keyed on the swap (rail↔card) so the crossfade fires when the last
                // sibling drops out and the section collapses to this editorial card.
                <Animated.View
                  key="cover"
                  style={{ paddingHorizontal: 24 }}
                  exiting={railExit}
                  layout={railFlow}>
                  <CoverCard
                    featured
                    title={items[0].title}
                    subtitle={items[0].subtitle}
                    meta={items[0].duration}
                    image={covers[items[0].cover]}
                    locked={!kids && items[0].locked && !isPremium}
                    onPress={() => openTrack(items[0])}
                  />
                </Animated.View>
              ) : (
                <ScrollView {...railProps}>
                  {items.map((t) => (
                    <Animated.View key={t.id} exiting={railExit} layout={railFlow}>
                      <LibraryCard
                        title={t.title}
                        subtitle={`${t.category[0].toUpperCase()}${t.category.slice(1)} · ${t.duration}`}
                        image={covers[t.cover]}
                        locked={!kids && t.locked && !isPremium}
                        onPress={() => openTrack(t)}
                      />
                    </Animated.View>
                  ))}
                </ScrollView>
              )}
            </Reveal>
          </Animated.View>
        );
      })}

      {/* Learn — short daytime reads (text today; the plan's "watch & learn" video
          comes when Glowco produces clips, §6 "don't over-invest"). Labelled as
          reads, not clips, so we never imply video that isn't there. */}
      {!kids ? (
        <Animated.View layout={railFlow}>
          <Reveal index={rails.length + 1} style={{ marginBottom: 28 }}>
            <View style={{ paddingHorizontal: 24 }}>
              <SectionHeader kicker="Learn" title="Short reads" />
            </View>
            <ScrollView {...railProps}>
              {Object.values(LEARN).map((a) => (
                <LibraryCard
                  key={a.id}
                  title={a.title}
                  subtitle={a.videoUrl ? `Watch · ${a.kicker}` : `${a.kicker} · ${a.readMins} min read`}
                  image={covers[a.cover ?? 'boxBreathing']}
                  onPress={() => router.push((a.videoUrl ? `/watch?id=${a.id}` : `/learn-article?id=${a.id}`) as Href)}
                />
              ))}
            </ScrollView>
          </Reveal>
        </Animated.View>
      ) : null}

      {/* Programs — gentle multi-week journeys (premium). Last per plan §7 order. */}
      {!kids ? (
        <Animated.View layout={railFlow}>
          <Reveal index={rails.length + 2} style={{ marginBottom: 28 }}>
            <View style={{ paddingHorizontal: 24 }}>
              <SectionHeader kicker="Guided" title="Programs" />
            </View>
            <ScrollView {...railProps}>
              {Object.values(PROGRAMS).map((p) => (
                <LibraryCard
                  key={p.id}
                  title={p.title}
                  subtitle={`${p.weeks}-week reset`}
                  image={covers[p.cover]}
                  locked={p.locked && !isPremium}
                  onPress={() => router.push(`/program?id=${p.id}`)}
                />
              ))}
            </ScrollView>
          </Reveal>
        </Animated.View>
      ) : null}
    </Screen>
  );
}
