import { Feather } from '@expo/vector-icons';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, ScrollView, View } from 'react-native';

import { AppText, Card, PressableScale, Reveal, Screen, SectionHeader } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/ProfileProvider';
import { audioSources, type AudioKey } from '@/content/audio';
import { covers, type CoverKey } from '@/content/covers';
import { TRACKS } from '@/content/library';
import { api } from '@/lib/api';
import { takePendingMix } from '@/lib/mixShare';
import { getJSON, remove, setJSON } from '@/lib/store';
import { useTheme } from '@/theme';

// Lyric-free instrumental music (build plan §6/§7 — Listen = Music + Sound machine).
// CMS-extensible; the sound machine below handles ambient sounds.
// gymnopedie is the ONE free music track (§6.1); spa is premium and shows a lock for free adults
const MUSIC_IDS = ['gymnopedie', 'spa'];

// The mixer palette. CMS-shaped: each sound carries its own `premium` flag, so the
// set grows without code changes. The free tier keeps the original four (§6.1); the
// rest are part of the Calm Plan's "full sound machine" (kids are never paywalled).
type SoundKey = Extract<AudioKey, 'rain' | 'ocean' | 'brown' | 'drone' | 'pink' | 'white' | 'fire' | 'birdsong' | 'green'>;
type Levels = Record<SoundKey, number>; // 0 = off, 1 = low, 2 = med, 3 = full

const SOUNDS: { key: SoundKey; label: string; cover: CoverKey; premium?: boolean }[] = [
  { key: 'rain', label: 'Rain', cover: 'rainfall' },
  { key: 'ocean', label: 'Ocean', cover: 'slowTide' },
  { key: 'brown', label: 'Brown noise', cover: 'brownNoise' },
  { key: 'drone', label: 'Soft hum', cover: 'deepRest' },
  { key: 'pink', label: 'Pink noise', cover: 'pinkNoise', premium: true },
  { key: 'white', label: 'White noise', cover: 'whiteNoise', premium: true },
  { key: 'fire', label: 'Fireside', cover: 'fireside', premium: true },
  { key: 'birdsong', label: 'Dawn birds', cover: 'dawnWoods', premium: true },
  { key: 'green', label: 'Green noise', cover: 'forestStream', premium: true },
];
const ZERO: Levels = { rain: 0, ocean: 0, brown: 0, drone: 0, pink: 0, white: 0, fire: 0, birdsong: 0, green: 0 };
const TIMERS = [0, 15, 30, 60] as const;

type SavedMix = { name: string; levels: Levels };
type TimerState = { endAt: number; mins: number };

function haptic() {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

function Tile({ label, cover, level, locked, onToggle, onLevel }: {
  label: string;
  cover: CoverKey;
  level: number;
  locked?: boolean;
  onToggle: () => void;
  onLevel: (l: number) => void;
}) {
  const { c } = useTheme();
  const on = level > 0;
  return (
    <View style={{ width: '47%' }}>
      <PressableScale
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={`${label}${locked ? ', premium, locked' : on ? ', on' : ', off'}`}>
        <View
          style={{
            height: 116,
            borderRadius: 16,
            overflow: 'hidden',
            borderWidth: 2,
            borderColor: on ? c.accent : 'transparent',
            ...c.shadow,
          }}>
          <Image source={covers[cover]} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" accessibilityIgnoresInvertColors />
          <View style={{ flex: 1, backgroundColor: on ? 'rgba(20,30,28,0.5)' : 'rgba(20,30,28,0.58)', padding: 12, justifyContent: 'space-between' }}>
            <View style={{ alignSelf: 'flex-end', width: 26, height: 26, borderRadius: 13, backgroundColor: locked ? 'rgba(255,255,255,0.18)' : on ? c.accent : 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
              <Feather name={locked ? 'lock' : on ? 'volume-2' : 'plus'} size={14} color="#FFFFFF" />
            </View>
            <AppText style={{ fontFamily: 'Montserrat_600SemiBold', fontSize: 15, color: '#FFFFFF' }}>{label}</AppText>
          </View>
        </View>
      </PressableScale>
      {/* per-sound volume — 3 levels (a locked tile shows a matching spacer instead) */}
      {locked ? (
        <View style={{ height: 8, marginTop: 8 }} />
      ) : (
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, height: 8, opacity: on ? 1 : 0.3 }}>
        {[1, 2, 3].map((l) => (
          <PressableScale
            key={l}
            onPress={() => onLevel(l)}
            disabled={!on}
            hitSlop={{ top: 18, bottom: 18, left: 4, right: 4 }}
            style={{ flex: 1 }}
            accessibilityRole="button"
            accessibilityState={{ selected: on && level >= l, disabled: !on }}
            accessibilityLabel={`Volume level ${l}`}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: on && level >= l ? c.accent : c.line }} />
          </PressableScale>
        ))}
      </View>
      )}
    </View>
  );
}

export function ListenScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const { isPremium, token } = useAuth();
  const { mode } = useProfile();
  const kids = mode === 'kids';
  const [levels, setLevels] = useState<Levels>(ZERO);
  const [timer, setTimer] = useState<number>(0);
  const [mixes, setMixes] = useState<SavedMix[]>([]);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // latest levels in a ref so the fade closure reads current values without re-arming
  const levelsRef = useRef(levels);
  useEffect(() => {
    levelsRef.current = levels;
  });

  // one looping player per sound (fixed set → hooks stay at top level)
  const rain = useAudioPlayer(audioSources.rain);
  const ocean = useAudioPlayer(audioSources.ocean);
  const brown = useAudioPlayer(audioSources.brown);
  const drone = useAudioPlayer(audioSources.drone);
  const pink = useAudioPlayer(audioSources.pink);
  const white = useAudioPlayer(audioSources.white);
  const fire = useAudioPlayer(audioSources.fire);
  const birdsong = useAudioPlayer(audioSources.birdsong);
  const green = useAudioPlayer(audioSources.green);
  const players: Record<SoundKey, ReturnType<typeof useAudioPlayer>> = { rain, ocean, brown, drone, pink, white, fire, birdsong, green };

  useEffect(() => {
    // all-night background playback with the screen off (build plan §12)
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true }).catch(() => {});
    (Object.values(players) as ReturnType<typeof useAudioPlayer>[]).forEach((p) => (p.loop = true));
    getJSON<SavedMix[]>('cc.mixes', []).then(setMixes);
    // restore a still-running sleep timer (survives a tab freeze / remount)
    getJSON<TimerState | null>('cc.sleepTimer', null).then((saved) => {
      if (!saved || typeof saved.endAt !== 'number') return;
      const remaining = saved.endAt - Date.now();
      if (remaining > 0) {
        setTimer(saved.mins);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(fadeAndStop, remaining);
      } else {
        remove('cc.sleepTimer');
      }
    });
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (fadeRef.current) clearInterval(fadeRef.current);
      (Object.values(players) as ReturnType<typeof useAudioPlayer>[]).forEach((p) => {
        try {
          p.pause();
        } catch {
          /* released */
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reflect levels → playback
  useEffect(() => {
    (Object.keys(players) as SoundKey[]).forEach((k) => {
      const p = players[k];
      const lvl = levels[k];
      try {
        p.volume = lvl / 3;
        if (lvl > 0) p.play();
        else p.pause();
      } catch {
        /* released */
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levels]);

  const anyOn = (Object.values(levels) as number[]).some((v) => v > 0);

  const toggle = (k: SoundKey) => {
    haptic();
    // premium sounds open the Calm Plan for free adults (kids are never paywalled)
    const s = SOUNDS.find((x) => x.key === k);
    if (s?.premium && !isPremium && !kids) {
      router.push('/unlock' as Href);
      return;
    }
    setLevels((prev) => ({ ...prev, [k]: prev[k] > 0 ? 0 : 3 }));
  };
  const setLevel = (k: SoundKey, l: number) => setLevels((prev) => ({ ...prev, [k]: l }));

  const stopAll = () => {
    if (fadeRef.current) clearInterval(fadeRef.current);
    setLevels(ZERO);
    setTimer(0);
    if (timerRef.current) clearTimeout(timerRef.current);
    remove('cc.sleepTimer');
  };

  // At the timer boundary, ramp every active sound to silence over ~3.5s and THEN
  // stop — a hard cut is jarring for someone already drifting off.
  const fadeAndStop = () => {
    if (fadeRef.current) clearInterval(fadeRef.current);
    let f = 1;
    fadeRef.current = setInterval(() => {
      f -= 0.08;
      (Object.keys(players) as SoundKey[]).forEach((k) => {
        try {
          players[k].volume = (levelsRef.current[k] / 3) * Math.max(f, 0);
        } catch {
          /* released */
        }
      });
      if (f <= 0) stopAll();
    }, 300);
  };

  const cycleTimer = () => {
    haptic();
    const next = TIMERS[(TIMERS.indexOf(timer as (typeof TIMERS)[number]) + 1) % TIMERS.length];
    setTimer(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (next > 0) {
      const ms = next * 60 * 1000;
      setJSON('cc.sleepTimer', { endAt: Date.now() + ms, mins: next });
      timerRef.current = setTimeout(fadeAndStop, ms);
    } else {
      remove('cc.sleepTimer');
    }
  };

  // The setTimeout above is SUSPENDED while the app is backgrounded (but audio keeps
  // playing). On return to foreground, re-check the saved end time: fade now if it
  // already elapsed, else re-arm the remainder. (A true stop-while-asleep needs a
  // native/background timer — tracked for Glowco.)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      getJSON<TimerState | null>('cc.sleepTimer', null).then((saved) => {
        if (!saved || typeof saved.endAt !== 'number') return;
        if (timerRef.current) clearTimeout(timerRef.current);
        const remaining = saved.endAt - Date.now();
        if (remaining <= 0) fadeAndStop();
        else timerRef.current = setTimeout(fadeAndStop, remaining);
      });
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveMix = () => {
    if (!anyOn) return;
    haptic();
    const next = [...mixes, { name: `Mix ${mixes.length + 1}`, levels }].slice(-12);
    setMixes(next);
    setJSON('cc.mixes', next);
  };
  const loadMix = (m: SavedMix) => {
    haptic();
    // re-gate through the same helper as community mixes so a saved mix can never
    // resurrect a premium sound for a now-free user
    applyExternalLevels(m.levels);
  };

  // Apply a mix arriving from a shared community card — once, on focus. Only known
  // keys are honoured, levels are clamped, and any premium sound a free user can't
  // access is zeroed (a shared mix can never unlock paid sounds).
  const applyExternalLevels = useCallback(
    (incoming: Record<string, number>) => {
      const next: Levels = { ...ZERO };
      for (const s of SOUNDS) {
        const v = incoming[s.key];
        if (typeof v !== 'number' || v <= 0) continue;
        const lockedSound = !!s.premium && !isPremium && !kids;
        next[s.key] = lockedSound ? 0 : Math.max(1, Math.min(3, Math.round(v)));
      }
      setLevels(next);
    },
    [isPremium, kids]
  );
  useFocusEffect(
    useCallback(() => {
      const pending = takePendingMix();
      if (pending) {
        applyExternalLevels(pending);
        haptic();
      } else {
        // resume the current mix (it was paused on the last blur)
        (Object.keys(players) as SoundKey[]).forEach((k) => {
          const lvl = levelsRef.current[k];
          try {
            players[k].volume = lvl / 3;
            if (lvl > 0) players[k].play();
          } catch {
            /* released */
          }
        });
      }
      // pause everything on blur so the mixer never plays UNDER the Player / wind-down
      return () => {
        (Object.values(players) as ReturnType<typeof useAudioPlayer>[]).forEach((p) => {
          try {
            p.pause();
          } catch {
            /* released */
          }
        });
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [applyExternalLevels])
  );

  // Share the CURRENT live mix to the community wall — anonymous, adults + signed-in
  // only (kids never post). The name is built from the active sound labels.
  const shareMix = async () => {
    if (!anyOn || kids || !token || token === 'local') return;
    haptic();
    setShareNote(null);
    const active = SOUNDS.filter((s) => levels[s.key] > 0);
    const name = active.slice(0, 3).map((s) => s.label).join(' · ') || 'A shared mix';
    const levelsOut: Record<string, number> = {};
    active.forEach((s) => (levelsOut[s.key] = levels[s.key]));
    try {
      await api.createPost(token, 'Shared a mix to drift to.', { name, levels: levelsOut });
      setShareNote('Shared anonymously to the community.');
    } catch {
      setShareNote('Couldn’t share that just now. Please try again.');
    }
  };

  return (
    <Screen mode="night" scroll tabBarSpacing contentStyle={{ paddingHorizontal: 0 }}>
      <Reveal index={0} style={{ paddingHorizontal: 24 }}>
        <AppText variant="caption" tone="muted">
          Listen
        </AppText>
        <AppText variant="h1" tone="title" style={{ marginTop: 6 }}>
          Sound machine
        </AppText>
        <AppText variant="body" tone="muted" style={{ marginTop: 8 }}>
          Layer sounds, set their volume, and let them play all night.
        </AppText>
      </Reveal>

      {/* Music — lyric-free instrumental tracks (plan §7: Listen = Music + Sound machine) */}
      <Reveal index={1} style={{ marginTop: 24, paddingHorizontal: 24 }}>
        <SectionHeader kicker="Music" title="Lyric-free, to drift to" />
        <View style={{ gap: 12 }}>
          {MUSIC_IDS.map((id) => {
            const t = TRACKS[id];
            if (!t) return null;
            const locked = !kids && !!t.locked && !isPremium;
            return (
              <PressableScale
                key={id}
                onPress={() => router.push((locked ? `/unlock?id=${id}` : `/player?id=${id}`) as Href)}
                onPressIn={haptic}
                accessibilityRole="button"
                accessibilityLabel={`Play ${t.title}`}
                scaleTo={0.98}
                dimTo={0.95}>
                <Card variant="surface" padding={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <Image source={covers[t.cover]} style={{ width: 56, height: 56, borderRadius: 12 }} contentFit="cover" accessibilityIgnoresInvertColors />
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyMedium" tone="title">
                      {t.title}
                    </AppText>
                    <AppText variant="label" tone="muted" style={{ marginTop: 2 }}>
                      Lyric-free · {t.duration}
                    </AppText>
                  </View>
                  <Feather name={locked ? 'lock' : 'play'} size={18} color={c.textAccent} />
                </Card>
              </PressableScale>
            );
          })}
        </View>
      </Reveal>

      {/* saved mixes */}
      {mixes.length > 0 ? (
        <Reveal index={1} style={{ marginTop: 20 }}>
          <View style={{ paddingHorizontal: 24 }}>
            <SectionHeader kicker="Saved" title="Your mixes" />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 10 }}>
            {mixes.map((m, i) => (
              <PressableScale
                key={i}
                onPress={() => loadMix(m)}
                accessibilityRole="button"
                dimTo={0.95}>
                <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.lineSage, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name="disc" size={15} color={c.textAccent} />
                  <AppText variant="cardTitle" tone="title">
                    {m.name}
                  </AppText>
                </View>
              </PressableScale>
            ))}
          </ScrollView>
        </Reveal>
      ) : null}

      {/* sound grid */}
      <Reveal index={2} style={{ marginTop: 24, paddingHorizontal: 24 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 18 }}>
          {SOUNDS.map((s) => (
            <Tile
              key={s.key}
              label={s.label}
              cover={s.cover}
              level={levels[s.key]}
              locked={!!s.premium && !isPremium && !kids}
              onToggle={() => toggle(s.key)}
              onLevel={(l) => setLevel(s.key, l)}
            />
          ))}
        </View>
      </Reveal>

      {/* master controls */}
      <Reveal index={3} style={{ marginTop: 28, paddingHorizontal: 24 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <PressableScale
            onPress={cycleTimer}
            accessibilityRole="button"
            style={{ flex: 1 }}
            scaleTo={0.98}
            dimTo={0.95}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: timer > 0 ? c.panelStrong : c.surface, borderWidth: 1, borderColor: timer > 0 ? c.accent : c.line }}>
              <Feather name="moon" size={16} color={c.textAccent} />
              <AppText variant="cardTitle" tone="title">
                {timer > 0 ? `${timer} min` : 'Sleep timer'}
              </AppText>
            </View>
          </PressableScale>
          <PressableScale
            onPress={saveMix}
            disabled={!anyOn}
            accessibilityRole="button"
            style={{ flex: 1, opacity: anyOn ? 1 : 0.45 }}
            scaleTo={0.98}
            dimTo={0.95}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }}>
              <Feather name="bookmark" size={16} color={c.textAccent} />
              <AppText variant="cardTitle" tone="title">
                Save mix
              </AppText>
            </View>
          </PressableScale>
        </View>
        {anyOn && !kids && !!token && token !== 'local' ? (
          <PressableScale
            onPress={shareMix}
            accessibilityRole="button"
            accessibilityLabel="Share this mix anonymously to the community"
            dimTo={0.9}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: c.line }}>
            <Feather name="share-2" size={15} color={c.textAccent} />
            <AppText variant="cardTitle" tone="title">
              Share this mix anonymously
            </AppText>
          </PressableScale>
        ) : null}
        {shareNote ? (
          <AppText variant="meta" tone="muted" style={{ textAlign: 'center', marginTop: 8 }}>
            {shareNote}
          </AppText>
        ) : null}
        {anyOn ? (
          <PressableScale onPress={stopAll} accessibilityRole="button" dimTo={0.85} style={{ alignItems: 'center', paddingVertical: 16 }}>
            <AppText variant="label" tone="muted">
              Stop all
            </AppText>
          </PressableScale>
        ) : null}
      </Reveal>
    </Screen>
  );
}
