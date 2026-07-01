import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, CoverCard, FormField, Reveal, Screen } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { covers } from '@/content/covers';
import { PROGRAMS, TRACKS } from '@/content/library';
import { lightTap } from '@/lib/haptics';
import { useTheme } from '@/theme';

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
    meta: `Program · ${p.weeks}-week`,
    cover: p.cover,
    locked: p.locked,
    playHref: `/program?id=${p.id}`,
  })),
];

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

  return (
    <Screen mode="light" scroll>
      <Reveal index={0}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Pressable
            onPress={back}
            onPressIn={lightTap}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => (pressed ? { transform: [{ scale: 0.92 }], opacity: 0.7 } : null)}>
            <Feather name="chevron-left" size={26} color={c.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <FormField
              value={q}
              onChangeText={setQ}
              placeholder="Search sounds, tales, programs"
              icon="search"
              autoCapitalize="none"
            />
          </View>
        </View>
      </Reveal>

      {q.trim() === '' ? (
        <View style={{ alignItems: 'center', paddingTop: 48, gap: 8 }}>
          <Feather name="search" size={28} color={c.dim} />
          <AppText variant="body" tone="muted" style={{ textAlign: 'center', maxWidth: 260 }}>
            Find a soundscape, sleep tale, breathing session, or program.
          </AppText>
        </View>
      ) : results.length === 0 ? (
        <View style={{ alignItems: 'center', paddingTop: 48, gap: 8 }}>
          <AppText variant="h2" tone="title">
            Nothing found
          </AppText>
          <AppText variant="body" tone="muted" style={{ textAlign: 'center', maxWidth: 260 }}>
            No results for “{q.trim()}”. Try a calmer word.
          </AppText>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {results.map((r, i) => {
            const isLocked = !!r.locked && !isPremium;
            return (
              <Reveal key={r.id} index={Math.min(i, 6)}>
                <CoverCard
                  title={r.title}
                  subtitle={r.subtitle}
                  meta={isLocked ? `${r.meta} · Calm Plan` : r.meta}
                  image={covers[r.cover]}
                  locked={isLocked}
                  onPress={() => router.push((isLocked ? `/unlock?id=${r.id}` : r.playHref) as Href)}
                />
              </Reveal>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
