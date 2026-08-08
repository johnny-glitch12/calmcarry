import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeOut, ReduceMotion } from 'react-native-reanimated';

import { AppText, CoverCard, FlowTransition, FormField, PressableScale, Reveal, Screen } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { covers } from '@/content/covers';
import { PROGRAMS, programLength, TRACKS } from '@/content/library';
import { lightTap } from '@/lib/haptics';
import { dur, useTheme } from '@/theme';

type Result = {
  id: string; // the content slug (for /unlock)
  title: string;
  subtitle: string;
  meta: string;
  cover: keyof typeof covers;
  locked?: boolean;
  playHref: string; // natural destination (player or program)
};

const ALL: Result[] = [
  ...Object.values(TRACKS).map((t) => ({
    id: t.id,
    title: t.title,
    subtitle: t.subtitle,
    meta: `${t.category[0].toUpperCase()}${t.category.slice(1)} · ${t.duration}`,
    cover: t.cover,
    locked: t.locked,
    playHref: `/player?id=${t.id}`,
  })),
  ...Object.values(PROGRAMS).map((p) => ({
    id: p.id,
    title: p.title,
    subtitle: p.subtitle,
    meta: `Program · ${programLength(p)}`,
    cover: p.cover,
    locked: p.locked,
    playHref: `/program?id=${p.id}`,
  })),
];

// Starter taps for the empty state - each maps to real content so a groggy user
// gets instant results with zero typing.
const SUGGESTIONS = ['Rain', 'Ocean', 'Noise', 'Breathing', 'Piano'];

export function Search() {
  const router = useRouter();
  const { c } = useTheme();
  const { isPremium } = useAuth();
  const [q, setQ] = useState('');

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return ALL.filter((r) =>
      `${r.title} ${r.subtitle} ${r.meta}`.toLowerCase().includes(term)
    );
  }, [q]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/sounds'));

  // Exit fade for branches/rows that leave as the query changes - pairs with the
  // Reveal entrance so a swap or reflow eases both ways instead of hard-cutting.
  const exit = () => FadeOut.duration(dur.exit).reduceMotion(ReduceMotion.System);

  return (
    <Screen mode="light" scroll>
      <Reveal index={0}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <PressableScale
            onPress={back}
            onPressIn={lightTap}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Back"
            dimTo={0.85}>
            <Feather name="chevron-left" size={26} color={c.text} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <FormField
              value={q}
              onChangeText={setQ}
              placeholder="Search sounds, sessions, programs"
              icon="search"
              autoCapitalize="none"
            />
          </View>
        </View>
      </Reveal>

      {q.trim() === '' ? (
        <Animated.View exiting={exit()}>
          <Reveal index={1} style={{ alignItems: 'center', paddingTop: 48, gap: 16 }}>
            <Feather name="search" size={28} color={c.dim} />
            <AppText variant="body" tone="muted" style={{ textAlign: 'center', maxWidth: 260 }}>
              Find a soundscape, breathing session, or program.
            </AppText>
            {/* one-tap suggestions - typing in bed is the highest-effort thing we can ask */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
              {SUGGESTIONS.map((term) => (
                <PressableScale
                  key={term}
                  onPress={() => setQ(term)}
                  onPressIn={lightTap}
                  accessibilityRole="button"
                  accessibilityLabel={`Search ${term}`}
                  dimTo={0.95}>
                  <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.lineSage }}>
                    <AppText variant="cardTitle" tone="title">
                      {term}
                    </AppText>
                  </View>
                </PressableScale>
              ))}
            </View>
          </Reveal>
        </Animated.View>
      ) : results.length === 0 ? (
        <Animated.View exiting={exit()}>
          <Reveal index={1} style={{ alignItems: 'center', paddingTop: 48, gap: 8 }}>
            <AppText variant="h2" tone="title">
              Nothing found
            </AppText>
            <AppText variant="body" tone="muted" style={{ textAlign: 'center', maxWidth: 260 }}>
              No results for “{q.trim()}”. Try “rain”, “ocean”, or “sleep”.
            </AppText>
          </Reveal>
        </Animated.View>
      ) : (
        <FlowTransition style={{ gap: 12 }}>
          {results.map((r, i) => {
            const isLocked = !!r.locked && !isPremium;
            return (
              <Animated.View key={r.id} exiting={exit()}>
                <Reveal index={Math.min(i, 6)}>
                  <CoverCard
                    title={r.title}
                    subtitle={r.subtitle}
                    meta={isLocked ? `${r.meta} · Premium` : r.meta}
                    image={covers[r.cover]}
                    locked={isLocked}
                    onPress={() => router.push((isLocked ? `/unlock?id=${r.id}` : r.playHref) as Href)}
                  />
                </Reveal>
              </Animated.View>
            );
          })}
        </FlowTransition>
      )}
    </Screen>
  );
}
