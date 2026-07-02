import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

// light tap feedback, matching the app's press idiom (PrimaryButton / CoverCard)
const tapHaptic = () => {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AppText, Card, FormField, PressableScale, Reveal, Screen, SectionHeader, StatusChip } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { api } from '@/lib/api';
import { setPendingMix } from '@/lib/mixShare';
import { dur, ease, useTheme } from '@/theme';

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins || 1}m`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h` : `${Math.round(hrs / 24)}d`;
}

// Anonymous-by-default wins wall, presented as a calm FEED (build plan §6/§13):
// adults only, gently moderated, walled off from kids. Everyone appears as "A
// CalmCarry parent" behind one shared, non-human glyph — no real names, no faces,
// no followers, no like-counts, no chat. Just gentle, one-way wins (and the odd
// shared sound mix). The wall shows ONLY real backend posts (+ your optimistic share).
type SharedMix = { name: string; levels: Record<string, number> };
type Win = { key: string; handle: string; text: string; when: string; pending?: boolean; mix?: SharedMix | null };

/** A single feed card. Anonymous handle + soft moon glyph, the win, an optional
 *  "Load this mix" card, and a count-less, one-way "Carried this with you" tap that
 *  acknowledges without a leaderboard. No reply/DM/share-message — wins are one-way. */
function WinCard({ win, onLoadMix }: { win: Win; onLoadMix?: () => void }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const soundCount = win.mix ? Object.keys(win.mix.levels).length : 0;
  const [carried, setCarried] = useState(false);
  const scale = useSharedValue(1);
  const reactStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const carry = () => {
    if (carried) return; // one-way, idempotent — no toggle-off, no count
    setCarried(true);
    if (!reduced) {
      scale.value = withSequence(
        withTiming(0.95, { duration: dur.press, easing: ease.out }),
        withTiming(1, { duration: dur.press, easing: ease.out }),
      );
    }
  };

  return (
    <Card variant="surface" muted={win.pending}>
      {/* header — one shared moon glyph for everyone (a symbol, never a person), the
          fixed anonymous handle, and a quiet relative time */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.panel, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="moon" size={15} color={c.textAccent} />
        </View>
        <AppText variant="meta" tone="muted" style={{ flex: 1, minWidth: 0 }} numberOfLines={1}>
          {win.handle}
        </AppText>
        <AppText variant="meta" tone="dim">
          {win.when}
        </AppText>
      </View>

      <AppText variant="body" tone="text">
        {win.text}
      </AppText>

      {/* a shared mix renders a tappable card that loads it into the sound machine */}
      {win.mix ? (
        <PressableScale
          onPress={onLoadMix}
          onPressIn={tapHaptic}
          accessibilityRole="button"
          accessibilityLabel={`Load mix ${win.mix.name} into the sound machine`}
          scaleTo={0.98}
          dimTo={0.95}
          style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: c.panel, borderWidth: 1, borderColor: c.lineSage }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="sliders" size={15} color={c.textAccent} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="cardTitle" tone="title" numberOfLines={1}>
                {win.mix.name}
              </AppText>
              <AppText variant="meta" tone="muted" numberOfLines={1}>
                {soundCount} {soundCount === 1 ? 'sound' : 'sounds'} · Load this mix
              </AppText>
            </View>
            <Feather name="play" size={16} color={c.accent} />
          </View>
        </PressableScale>
      ) : null}

      {/* footer — pending notice, or a one-way, COUNT-LESS acknowledgment */}
      {win.pending ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
          <Feather name="clock" size={14} color={c.accent} />
          <AppText variant="label" tone="muted">
            Pending review
          </AppText>
        </View>
      ) : (
        <PressableScale
          onPress={carry}
          accessibilityRole="button"
          accessibilityState={{ selected: carried }}
          accessibilityLabel={carried ? 'You carried this win' : 'Acknowledge this win'}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 12 }}
          style={{ alignSelf: 'flex-start', marginTop: 12 }}>
          <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6 }, reactStyle]}>
            <Feather name="heart" size={14} color={carried ? c.textAccent : c.accent} />
            <AppText variant="meta" style={{ color: carried ? c.textAccent : c.muted }}>
              {carried ? 'You carried this' : 'Carried this with you'}
            </AppText>
          </Animated.View>
        </PressableScale>
      )}
    </Card>
  );
}

/** The two skeleton placeholder cards shown while the wall loads — gives the feed
 *  shape instead of a bare spinner. Bars use the calm panel tone. */
function SkeletonCard() {
  const { c } = useTheme();
  const bar = (w: number | `${number}%`, mt = 0) => (
    <View style={{ width: w, height: 12, borderRadius: 6, backgroundColor: c.panel, marginTop: mt }} />
  );
  return (
    <Card variant="surface">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.panel }} />
        {bar(120)}
      </View>
      {bar('100%')}
      {bar('72%', 8)}
    </Card>
  );
}

export function CommunityScreen() {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const router = useRouter();
  const { token } = useAuth();
  const [wins, setWins] = useState<Win[]>([]);
  const [presence, setPresence] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [filter, setFilter] = useState<'latest' | 'mix'>('latest');

  // gentle cross-fade of the list when the filter changes (opacity only)
  const listFade = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    listFade.value = 0;
    // sheet (not screen): a filter tap should re-fade the list smoothly but stay
    // responsive — a full screen-length fade here would feel laggy on each tap.
    listFade.value = withTiming(1, { duration: dur.sheet, easing: ease.out });
  }, [filter, reduced, listFade]);
  const listStyle = useAnimatedStyle(() => ({ opacity: reduced ? 1 : listFade.value }));

  // fetch the live wall — only real, backend-approved posts populate it. Refetched
  // on focus so presence + new wins refresh when the tab regains focus.
  useFocusEffect(
    useCallback(() => {
      if (!token) {
        setLoading(false);
        return;
      }
      let alive = true;
      setError(false);
      api
        .communityPosts(token)
        .then((d) => {
          if (!alive) return;
          setWins((d.posts ?? []).map((p) => ({ key: p.id, handle: p.handle, text: p.text, when: ago(p.createdAt), mix: p.mix ?? null })));
          setPresence(typeof d.presence === 'number' ? d.presence : null);
        })
        .catch(() => {
          if (alive) setError(true);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
      return () => {
        alive = false;
      };
    }, [token])
  );

  // Load a shared mix into the sound machine: hand it off in-memory, then jump to
  // the Listen tab, which consumes it once on focus.
  const loadSharedMix = (levels: Record<string, number>) => {
    setPendingMix(levels);
    router.push('/listen' as Href);
  };

  // Optimistic share, reconciled with the server: show the card immediately, then
  // adopt the saved post (and its moderation status) on success, or roll it back
  // and tell the user on failure — never leave a fake "live" card that didn't save.
  const share = async () => {
    const text = draft.trim();
    if (!text || !token) return;
    const tempKey = `temp-${Date.now()}`;
    setWins((w) => [{ key: tempKey, handle: 'A CalmCarry parent', text, when: 'now', pending: true }, ...w]);
    setDraft('');
    setNote(null);
    try {
      const saved = await api.createPost(token, text);
      setWins((w) =>
        w.map((win) =>
          win.key === tempKey
            ? { key: saved.id, handle: saved.handle, text: saved.text, when: 'now', pending: saved.status !== 'approved' }
            : win,
        ),
      );
    } catch {
      setWins((w) => w.filter((win) => win.key !== tempKey));
      setNote('Couldn’t share that just now. Please try again.');
    }
  };

  // derived view per the pressure-free filter (Latest = chronological; With a mix =
  // posts carrying a shareable sound mix first, then the rest by time — never ranked
  // by popularity/engagement)
  const visibleWins = filter === 'mix' ? [...wins].sort((a, b) => Number(!!b.mix) - Number(!!a.mix)) : wins;

  return (
    <Screen mode="light" scroll tabBarSpacing>
      <Reveal index={0}>
        <AppText variant="caption" tone="muted">
          Community
        </AppText>
        <AppText variant="h1" tone="title" style={{ marginTop: 6 }}>
          Winding down together
        </AppText>
        <AppText variant="body" tone="muted" style={{ marginTop: 8 }}>
          Small calm wins from parents, shared anonymously.
        </AppText>
      </Reveal>

      {/* presence + trust */}
      <Reveal index={1} style={{ marginTop: 18 }}>
        <Card variant="panel" radius={18}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: c.accent }} />
            <AppText variant="cardTitle" tone="title" style={{ flex: 1 }}>
              {presence && presence > 0
                ? `${presence} quiet ${presence === 1 ? 'win' : 'wins'} shared by parents`
                : 'A quiet, anonymous space to wind down together'}
            </AppText>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <StatusChip label="Anonymous" icon="eye-off" />
            <StatusChip label="Adults only" icon="shield" />
          </View>
        </Card>
      </Reveal>

      {/* pressure-free filter — Latest / With a mix (never Following or Popular) */}
      <Reveal index={2} style={{ marginTop: 20 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {([
            { id: 'latest' as const, label: 'Latest' },
            { id: 'mix' as const, label: 'With a mix' },
          ]).map((f) => {
            const on = filter === f.id;
            return (
              <PressableScale
                key={f.id}
                onPress={() => setFilter(f.id)}
                onPressIn={tapHaptic}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                scaleTo={0.96}
                dimTo={0.9}
                style={{
                  height: 44,
                  paddingHorizontal: 16,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: on ? c.ctaBg : 'transparent',
                  borderWidth: 1,
                  borderColor: on ? c.ctaBg : c.line,
                }}>
                <AppText variant="meta" style={{ color: on ? c.ctaText : c.muted }}>
                  {f.label}
                </AppText>
              </PressableScale>
            );
          })}
        </View>
      </Reveal>

      {/* wins wall — reading comes before writing, so the calm content is what a
          tired user meets first (the composer follows below) */}
      <Reveal index={3} style={{ marginTop: 28 }}>
        <SectionHeader kicker="Wins wall" title="Tonight’s quiet victories" />
        <Animated.View style={[{ gap: 12 }, listStyle]}>
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : visibleWins.length > 0 ? (
            visibleWins.map((w) => (
              <WinCard key={w.key} win={w} onLoadMix={w.mix ? () => loadSharedMix(w.mix!.levels) : undefined} />
            ))
          ) : error ? (
            <Card variant="panel" style={{ alignItems: 'center', gap: 4 }}>
              <AppText variant="body" tone="muted" style={{ textAlign: 'center' }}>
                We couldn’t load the wall just now.
              </AppText>
              <AppText variant="meta" tone="dim">
                It will retry when you come back.
              </AppText>
            </Card>
          ) : (
            <Card variant="panel" padding={20} style={{ alignItems: 'center', gap: 6 }}>
              <Feather name="moon" size={22} color={c.textAccent} />
              <AppText variant="body" tone="muted" style={{ textAlign: 'center' }}>
                No wins shared yet tonight.
              </AppText>
              <AppText variant="meta" tone="dim" style={{ textAlign: 'center' }}>
                Be the first: a small calm thing that went right.
              </AppText>
            </Card>
          )}
        </Animated.View>
      </Reveal>

      {/* gentle composer — placed after the wins so reading precedes writing and no
          keyboard is summoned ahead of the calm content */}
      <Reveal index={4} style={{ marginTop: 28 }}>
        <SectionHeader kicker="Share" title="Add a small win" />
        <FormField
          label="You’ll appear as “a CalmCarry parent”"
          value={draft}
          onChangeText={setDraft}
          placeholder="One calm thing that went right…"
          icon="feather"
        />
        <PressableScale
          onPress={share}
          onPressIn={() => draft.trim() && tapHaptic()}
          accessibilityRole="button"
          accessibilityState={{ disabled: !draft.trim() }}
          disabled={!draft.trim()}
          dimTo={0.9}
          style={{ alignSelf: 'flex-start', marginTop: 12, opacity: draft.trim() ? 1 : 0.45 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 13, borderRadius: 12, backgroundColor: c.panelStrong, borderWidth: 1, borderColor: c.accent }}>
            <Feather name="send" size={15} color={c.textAccent} />
            <AppText variant="bodyMedium" style={{ color: c.textAccent }}>
              Share anonymously
            </AppText>
          </View>
        </PressableScale>
        {note ? (
          <AppText variant="meta" style={{ color: c.dim, marginTop: 10 }}>
            {note}
          </AppText>
        ) : null}
      </Reveal>

      <Reveal index={5} style={{ marginTop: 20, marginBottom: 8 }}>
        <AppText variant="caption" tone="dim" style={{ textAlign: 'center', textTransform: 'none', letterSpacing: 0, lineHeight: 16 }}>
          Gently moderated. No followers, no chat, no pressure. Just a sense that others are right here with you.
        </AppText>
      </Reveal>
    </Screen>
  );
}
