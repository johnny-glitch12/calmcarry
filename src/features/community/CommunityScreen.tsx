import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppText, FormField, Reveal, Screen, SectionHeader, StatusChip } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { api } from '@/lib/api';
import { setPendingMix } from '@/lib/mixShare';
import { useTheme } from '@/theme';

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins || 1}m`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h` : `${Math.round(hrs / 24)}d`;
}

// Anonymous-by-default wins wall (build plan §6/§13): adults only, gently
// moderated, walled off from kids. You appear as "a CalmCarry parent". No open
// chat (that comes later) — just gentle, one-way wins. The wall shows ONLY real
// posts from the backend (plus your own optimistic share) — no fabricated seed.
type SharedMix = { name: string; levels: Record<string, number> };
type Win = { key: string; handle: string; text: string; when: string; pending?: boolean; mix?: SharedMix | null };

function WinCard({ win, onLoadMix }: { win: Win; onLoadMix?: () => void }) {
  const { c } = useTheme();
  const soundCount = win.mix ? Object.keys(win.mix.levels).length : 0;
  return (
    <View style={{ padding: 16, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, ...c.shadow, opacity: win.pending ? 0.6 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.panel, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="user" size={13} color={c.textAccent} />
        </View>
        <AppText variant="label" tone="muted" style={{ flex: 1, textTransform: 'none', letterSpacing: 0 }}>
          {win.handle}
        </AppText>
        <AppText variant="label" tone="muted">
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
                {soundCount} {soundCount === 1 ? 'sound' : 'sounds'} · tap to play
              </AppText>
            </View>
            <Feather name="play" size={16} color={c.accent} />
          </View>
        </Pressable>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
          <Feather name={win.pending ? 'clock' : 'heart'} size={14} color={c.accent} />
          <AppText variant="label" tone="muted">
            {win.pending ? 'Pending review' : 'You’re not the only one'}
          </AppText>
        </View>
      )}
    </View>
  );
}

export function CommunityScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const { token } = useAuth();
  const [wins, setWins] = useState<Win[]>([]);
  const [presence, setPresence] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [note, setNote] = useState<string | null>(null);

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
          // distinguish a failed load from a genuinely empty wall
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

  return (
    <Screen mode="light" scroll tabBarSpacing>
      <Reveal index={0}>
        <AppText variant="caption" tone="muted">
          Community
        </AppText>
        <AppText variant="h1" tone="title" style={{ marginTop: 6 }}>
          Winding down together
        </AppText>
      </Reveal>

      {/* presence + trust */}
      <Reveal index={1} style={{ marginTop: 18 }}>
        <View style={{ padding: 16, borderRadius: 18, backgroundColor: c.panel, borderWidth: 1, borderColor: c.lineSage }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Feather name="moon" size={16} color={c.textAccent} />
            <AppText variant="bodyMedium" tone="title" style={{ flex: 1, fontSize: 15 }}>
              {presence && presence > 0
                ? `${presence} quiet ${presence === 1 ? 'win' : 'wins'} shared by CalmCarry parents`
                : 'A quiet, anonymous space to wind down together'}
            </AppText>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <StatusChip label="Anonymous" icon="eye-off" />
            <StatusChip label="Adults only" icon="shield" />
          </View>
        </View>
      </Reveal>

      {/* gentle composer */}
      <Reveal index={2} style={{ marginTop: 24 }}>
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
      <Reveal index={3} style={{ marginTop: 28 }}>
        <SectionHeader kicker="Wins wall" title="Tonight’s quiet victories" />
        <View style={{ gap: 12 }}>
          {loading ? (
            <View style={{ paddingVertical: 28, alignItems: 'center' }}>
              <ActivityIndicator color={c.accent} />
            </View>
          ) : wins.length > 0 ? (
            wins.map((w) => (
              <WinCard key={w.key} win={w} onLoadMix={w.mix ? () => loadSharedMix(w.mix!.levels) : undefined} />
            ))
          ) : error ? (
            <View style={{ padding: 16, borderRadius: 16, backgroundColor: c.panel, borderWidth: 1, borderColor: c.lineSage, alignItems: 'center', gap: 4 }}>
              <AppText variant="body" tone="muted" style={{ textAlign: 'center' }}>
                We couldn’t load the wall just now.
              </AppText>
              <AppText variant="label" tone="dim" style={{ textTransform: 'none', letterSpacing: 0 }}>
                Swipe down or come back in a moment.
              </AppText>
            </View>
          ) : (
            <View style={{ padding: 16, borderRadius: 16, backgroundColor: c.panel, borderWidth: 1, borderColor: c.lineSage }}>
              <AppText variant="body" tone="muted" style={{ textAlign: 'center' }}>
                No wins shared yet tonight. Be the first — a small calm thing that went right.
              </AppText>
            </View>
          )}
        </View>
      </Reveal>

      <Reveal index={4} style={{ marginTop: 20, marginBottom: 8 }}>
        <AppText variant="caption" tone="dim" style={{ textAlign: 'center', textTransform: 'none', letterSpacing: 0, lineHeight: 16 }}>
          Gently moderated. No followers, no chat, no pressure — just a sense that others are right here with you.
        </AppText>
      </Reveal>
    </Screen>
  );
}
