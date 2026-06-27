import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AppText, FormField, Reveal, Screen, SectionHeader, StatusChip } from '@/components';
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
    <View style={{ padding: 16, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, ...c.shadow, opacity: win.pending ? 0.6 : 1 }}>
      {/* header — one shared moon glyph for everyone (a symbol, never a person), the
          fixed anonymous handle, and a quiet relative time */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.panel, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="moon" size={15} color={c.textAccent} />
        </View>
        <AppText variant="label" tone="muted" style={{ flex: 1, textTransform: 'none', letterSpacing: 0 }}>
          {win.handle}
        </AppText>
        <AppText variant="label" tone="dim" style={{ textTransform: 'none', letterSpacing: 0 }}>
          {win.when}
        </AppText>
      </View>

      <AppText variant="body" tone="text">
        {win.text}
      </AppText>

      {/* a shared mix renders a tappable card that loads it into the sound machine */}
      {win.mix ? (
        <Pressable
          onPress={onLoadMix}
          accessibilityRole="button"
          accessibilityLabel={`Load mix ${win.mix.name} into the sound machine`}
          style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: c.panel, borderWidth: 1, borderColor: c.lineSage }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="sliders" size={15} color={c.textAccent} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyMedium" tone="title" style={{ fontSize: 14 }}>
                {win.mix.name}
              </AppText>
              <AppText variant="label" tone="muted" style={{ textTransform: 'none', letterSpacing: 0 }}>
                {soundCount} {soundCount === 1 ? 'sound' : 'sounds'} · Load this mix
              </AppText>
            </View>
            <Feather name="play" size={16} color={c.accent} />
          </View>
        </Pressable>
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
        <Pressable
          onPress={carry}
          accessibilityRole="button"
          accessibilityState={{ selected: carried }}
          accessibilityLabel={carried ? 'You carried this win' : 'Acknowledge this win'}
          style={{ alignSelf: 'flex-start', marginTop: 12 }}>
          <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6 }, reactStyle]}>
            <Feather name="heart" size={14} color={carried ? c.textAccent : c.accent} />
            <AppText variant="label" style={{ color: carried ? c.textAccent : c.muted, textTransform: 'none', letterSpacing: 0 }}>
              {carried ? 'You carried this' : 'Carried this with you'}
            </AppText>
          </Animated.View>
        </Pressable>
      )}
    </View>
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
    <View style={{ padding: 16, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, ...c.shadow }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.panel }} />
        {bar(120)}
      </View>
      {bar('100%')}
      {bar('72%', 8)}
    </View>
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

  // gentle "live" pulse on the presence dot (opacity only, breathing cadence, reduced-gated)
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduced || !presence) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(withTiming(0.4, { duration: dur.breath, easing: ease.sine }), -1, true);
  }, [reduced, presence, pulse]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  // gentle cross-fade of the list when the filter changes (opacity only)
  const listFade = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    listFade.value = 0;
    listFade.value = withTiming(1, { duration: dur.press, easing: ease.out });
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
        <View style={{ padding: 16, borderRadius: 18, backgroundColor: c.panel, borderWidth: 1, borderColor: c.lineSage }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Animated.View style={[{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: c.accent }, dotStyle]} />
            <AppText variant="bodyMedium" tone="title" style={{ flex: 1, fontSize: 15 }}>
              {presence && presence > 0
                ? `${presence} quiet ${presence === 1 ? 'win' : 'wins'} shared tonight`
                : 'A quiet, anonymous space to wind down together'}
            </AppText>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <StatusChip label="Anonymous" icon="eye-off" />
            <StatusChip label="Adults only" icon="shield" />
          </View>
        </View>
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
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={{
                  height: 34,
                  paddingHorizontal: 14,
                  borderRadius: 17,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: on ? c.ctaBg : 'transparent',
                  borderWidth: 1,
                  borderColor: on ? c.ctaBg : c.line,
                }}>
                <AppText variant="label" style={{ color: on ? c.ctaText : c.muted, textTransform: 'none', letterSpacing: 0 }}>
                  {f.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </Reveal>

      {/* gentle composer */}
      <Reveal index={3} style={{ marginTop: 24 }}>
        <SectionHeader kicker="Your turn" title="Share a small win" />
        <FormField
          label="You’ll appear as “a CalmCarry parent”"
          value={draft}
          onChangeText={setDraft}
          placeholder="One calm thing that went right…"
          icon="feather"
        />
        <Pressable onPress={share} accessibilityRole="button" accessibilityState={{ disabled: !draft.trim() }} disabled={!draft.trim()} style={{ alignSelf: 'flex-start', marginTop: 12, opacity: draft.trim() ? 1 : 0.45 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: c.panelStrong, borderWidth: 1, borderColor: c.accent }}>
            <Feather name="send" size={15} color={c.textAccent} />
            <AppText variant="bodyMedium" style={{ color: c.textAccent }}>
              Share anonymously
            </AppText>
          </View>
        </Pressable>
        {note ? (
          <AppText variant="label" style={{ color: c.dim, marginTop: 10, textTransform: 'none', letterSpacing: 0 }}>
            {note}
          </AppText>
        ) : null}
      </Reveal>

      {/* wins wall */}
      <Reveal index={4} style={{ marginTop: 28 }}>
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
            <View style={{ padding: 16, borderRadius: 16, backgroundColor: c.panel, borderWidth: 1, borderColor: c.lineSage, alignItems: 'center', gap: 4 }}>
              <AppText variant="body" tone="muted" style={{ textAlign: 'center' }}>
                We couldn’t load the wall just now.
              </AppText>
              <AppText variant="label" tone="dim" style={{ textTransform: 'none', letterSpacing: 0 }}>
                Pull to refresh or come back in a moment.
              </AppText>
            </View>
          ) : (
            <View style={{ padding: 20, borderRadius: 16, backgroundColor: c.panel, borderWidth: 1, borderColor: c.lineSage, alignItems: 'center', gap: 6 }}>
              <Feather name="moon" size={22} color={c.textAccent} />
              <AppText variant="body" tone="muted" style={{ textAlign: 'center' }}>
                No wins shared yet tonight.
              </AppText>
              <AppText variant="label" tone="dim" style={{ textTransform: 'none', letterSpacing: 0, textAlign: 'center' }}>
                Be the first — a small calm thing that went right.
              </AppText>
            </View>
          )}
        </Animated.View>
      </Reveal>

      <Reveal index={5} style={{ marginTop: 20, marginBottom: 8 }}>
        <AppText variant="caption" tone="dim" style={{ textAlign: 'center', textTransform: 'none', letterSpacing: 0, lineHeight: 16 }}>
          Gently moderated. No followers, no chat, no pressure — just a sense that others are right here with you.
        </AppText>
      </Reveal>
    </Screen>
  );
}
