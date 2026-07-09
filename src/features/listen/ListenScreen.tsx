import { Feather } from '@expo/vector-icons';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Appear, AppText, Card, Crossfade, Dimmable, PressableScale, Reveal, Screen, SectionHeader, SelectionOverlay } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/ProfileProvider';
import { audioSources, type AudioKey } from '@/content/audio';
import { covers, type CoverKey } from '@/content/covers';
import { TRACKS } from '@/content/library';
import { api } from '@/lib/api';
import { lightTap } from '@/lib/haptics';
import { takePendingMix } from '@/lib/mixShare';
import { getJSON, remove, setJSON } from '@/lib/store';
import { dur, ease, spring, themes, useResponsive, useTheme } from '@/theme';

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
const GRID_GAP = 14; // uniform gap between sound tiles (both axes, via flex `gap`)

type SavedMix = { name: string; levels: Levels };
type TimerState = { endAt: number; mins: number };

// module scope (not component body): keeps the impure Date.now() out of render-path
// analysis while computing the timer's absolute end time.
const timerStateFor = (mins: number): TimerState => ({ endAt: Date.now() + mins * 60 * 1000, mins });


// A single volume-level bar. The accent fill EASES in/out (opacity over a c.line
// base) whenever this level is lit or dimmed — dragging the fader or tapping a bar
// no longer hard-swaps the color (the PIN-dot class of jolt).
function LevelBar({ lit }: { lit: boolean }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const p = useSharedValue(lit ? 1 : 0);
  useEffect(() => {
    p.value = reduced ? (lit ? 1 : 0) : withTiming(lit ? 1 : 0, { duration: dur.press, easing: ease.press });
  }, [lit, reduced, p]);
  const s = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <View style={{ height: 12, borderRadius: 6, backgroundColor: c.line, overflow: 'hidden' }}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.accent }, s]} />
    </View>
  );
}

function Tile({ label, cover, level, locked, width, onToggle, onLevel }: {
  label: string;
  cover: CoverKey;
  level: number;
  locked?: boolean;
  /** exact pixel width from the grid (uniform tiles → every row symmetrical) */
  width: number;
  onToggle: () => void;
  onLevel: (l: number) => void;
}) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const on = level > 0;

  // locked → unlocked (after a purchase) eases rather than snapping the scrim.
  const l = useSharedValue(locked ? 1 : 0);
  useEffect(() => {
    l.value = reduced ? (locked ? 1 : 0) : withTiming(locked ? 1 : 0, { duration: dur.sheet, easing: ease.out });
  }, [locked, reduced, l]);
  const scrimStyle = useAnimatedStyle(() => ({ opacity: 0.54 + 0.18 * l.value }));

  // Fader drag: slide across the volume strip to set the level continuously
  // (taps on the individual bars still work — the pan only activates after a
  // deliberate horizontal pull, and vertical motion stays with the ScrollView).
  const stripW = useSharedValue(0);
  const lastLvl = useSharedValue(0);
  const tickLevel = (l: number) => {
    if (!on) return; // sound turned off mid-drag (stopAll / timer) — don't resurrect it
    lightTap(); // one light tick per step, like a physical detent
    onLevel(l);
  };
  const levelPan = Gesture.Pan()
    .enabled(on && !locked)
    .activeOffsetX([-6, 6])
    .failOffsetY([-16, 16]) // generous vertical window so the mixer's scroll always wins
    .onBegin(() => {
      lastLvl.value = 0;
    })
    .onUpdate((e) => {
      const w = stripW.value;
      if (w <= 0) return;
      const lvl = Math.min(3, Math.max(1, 1 + Math.floor((e.x / w) * 3)));
      if (lvl !== lastLvl.value) {
        lastLvl.value = lvl;
        runOnJS(tickLevel)(lvl);
      }
    });

  // Turning a sound ON should feel alive, not a hard flip: the accent ring fades
  // in, the badge pops + swaps plus→volume, the tile lifts, the bars brighten.
  // transform + opacity only (we overlay the accent ring rather than animate a
  // borderColor), reduced-motion-safe, one-shot (no eye-tiring loop).
  const a = useSharedValue(on ? 1 : 0);
  const pop = useSharedValue(1);
  useEffect(() => {
    // ON gets the sheet-speed arrival; OFF is an exit and must be quicker (~2/3).
    a.value = reduced ? (on ? 1 : 0) : withTiming(on ? 1 : 0, { duration: on ? dur.sheet : dur.exit, easing: ease.out });
    if (on && !reduced) {
      pop.value = withSequence(
        withTiming(1.18, { duration: dur.press, easing: ease.out }),
        withSpring(1, spring),
      );
    } else if (!on && !reduced) {
      // settle the badge back to rest on toggle OFF (interrupts a mid-flight pop)
      pop.value = withTiming(1, { duration: dur.press, easing: ease.out });
    }
  }, [on, reduced, a, pop]);

  const ringStyle = useAnimatedStyle(() => ({ opacity: a.value }));
  const liftStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -2 * a.value }] }));
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const fillStyle = useAnimatedStyle(() => ({ opacity: a.value }));
  const plusStyle = useAnimatedStyle(() => ({ opacity: 1 - a.value }));
  const volStyle = useAnimatedStyle(() => ({ opacity: a.value }));
  const barsStyle = useAnimatedStyle(() => ({ opacity: 0.3 + 0.7 * a.value }));

  return (
    <View style={{ width }}>
      <PressableScale
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={`${label}${locked ? ', premium, locked' : on ? ', on' : ', off'}`}>
        <Animated.View
          style={[
            { height: 116, borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', ...c.shadow },
            liftStyle,
          ]}>
          <Image source={covers[cover]} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" accessibilityIgnoresInvertColors />
          {/* locked tiles carry a heavier scrim so tired eyes read them as dimmed/paywalled
              before committing a tap — the darkening EASES when a purchase unlocks it */}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgb(20,30,28)' }, scrimStyle]} />
          <View style={{ flex: 1, padding: 12, justifyContent: 'space-between' }}>
            <View style={{ alignSelf: 'flex-end', width: 26, height: 26, borderRadius: 13, overflow: 'hidden', backgroundColor: locked ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
              {/* accent fill fades in behind the icon when active (opacity-only) */}
              {!locked ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.accent }, fillStyle]} /> : null}
              <Animated.View style={badgeStyle}>
                <Crossfade
                  style={{ width: 14, height: 14 }}
                  active={!!locked}
                  front={<Feather name="lock" size={14} color="#FFFFFF" />}
                  back={
                    <View style={{ width: 14, height: 14 }}>
                      <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, plusStyle]}>
                        <Feather name="plus" size={14} color="#FFFFFF" />
                      </Animated.View>
                      <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, volStyle]}>
                        <Feather name="volume-2" size={14} color="#FFFFFF" />
                      </Animated.View>
                    </View>
                  }
                />
              </Animated.View>
            </View>
            <View>
              <AppText variant="cardTitle" style={{ color: '#FFFFFF' }} numberOfLines={2}>{label}</AppText>
              {locked ? (
                <Appear enter={dur.nav}>
                  <AppText variant="meta" style={{ color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                    Premium
                  </AppText>
                </Appear>
              ) : null}
            </View>
          </View>
          {/* accent activation ring — fades in over the tile edge (avoids animating borderColor) */}
          {!locked ? (
            <Animated.View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { borderRadius: 16, borderWidth: 2, borderColor: c.accent }, ringStyle]}
            />
          ) : null}
        </Animated.View>
      </PressableScale>
      {/* per-sound volume — 3 levels: tap a bar OR slide across the strip like a
          fader (the drag ticks a light haptic at each step). Locked tiles show a
          matching spacer instead. */}
      {locked ? (
        <View style={{ height: 12, marginTop: 8 }} />
      ) : (
        <GestureDetector gesture={levelPan}>
          <Animated.View
            onLayout={(e) => {
              stripW.value = e.nativeEvent.layout.width;
            }}
            style={[{ flexDirection: 'row', gap: 6, marginTop: 8, height: 12 }, barsStyle]}>
            {[1, 2, 3].map((l) => (
              <PressableScale
                key={l}
                onPress={() => onLevel(l)}
                disabled={!on}
                hitSlop={{ top: 18, bottom: 18, left: 6, right: 6 }}
                style={{ flex: 1 }}
                accessibilityRole="button"
                accessibilityState={{ selected: on && level >= l, disabled: !on }}
                accessibilityLabel={`${label} volume, level ${l}`}>
                <LevelBar lit={on && level >= l} />
              </PressableScale>
            ))}
          </Animated.View>
        </GestureDetector>
      )}
    </View>
  );
}

export function ListenScreen() {
  const { c: ambientC } = useTheme();
  const router = useRouter();
  const { isPremium, token } = useAuth();
  const { mode } = useProfile();
  const kids = mode === 'kids';
  // kids mode forces "cozy dusk" (<Screen mode="kids">); read that palette DIRECTLY
  // — this body runs above its own Screen's provider, so an ambient useTheme() would
  // return the app's light/night appearance and mis-paint the content. Adult mode
  // keeps its ambient (night-forced) theme.
  const c = kids ? themes.kids : ambientC;
  // responsive sound grid: measure the grid width, fit exactly `gridCols` uniform
  // tiles with a fixed gap (2 phone / 3 tablet / 4 wide) — every row symmetrical
  const { gridColumns: gridCols } = useResponsive();
  const [gridW, setGridW] = useState(0);
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
    // all-night background playback with the screen off (build plan §12).
    // doNotMix is also what makes lock-screen controls work (expo-audio v56).
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' }).catch(() => {});
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

  // Lock-screen session for the mixer. ONE anchor player (the first active sound)
  // carries the OS session: on Android that's what keeps background audio alive
  // past ~3 minutes (expo-audio v56), and it gives the lock screen a real pause.
  // isLiveStream hides the seek bar — these are endless loops, not tracks.
  const anchorRef = useRef<SoundKey | null>(null);
  useEffect(() => {
    const first = (Object.keys(players) as SoundKey[]).find((k) => levels[k] > 0) ?? null;
    const prev = anchorRef.current;
    if (prev && prev !== first) {
      try {
        players[prev].clearLockScreenControls();
      } catch {
        /* released */
      }
    }
    anchorRef.current = first;
    if (first && first !== prev) {
      try {
        players[first].setActiveForLockScreen(
          true,
          { title: 'Sound machine', artist: 'CalmCarry' },
          { showSeekBackward: false, showSeekForward: false, isLiveStream: true },
        );
      } catch {
        /* platform without lock-screen support */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levels]);

  // release the lock-screen session when the mixer unmounts
  useEffect(
    () => () => {
      const a = anchorRef.current;
      if (!a) return;
      try {
        players[a].clearLockScreenControls();
      } catch {
        /* released */
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // A lock-screen pause only reaches the anchor player — notice it and let the
  // whole mix follow with the usual gentle fade, so the UI and the ear agree.
  useEffect(() => {
    if (!anyOn) return;
    const id = setInterval(() => {
      const a = anchorRef.current;
      if (!a) return;
      try {
        if (levelsRef.current[a] > 0 && !players[a].playing) fadeAndStop();
      } catch {
        /* released */
      }
    }, 2000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyOn]);

  const toggle = (k: SoundKey) => {
    lightTap();
    // premium sounds open the Calm Plan for free adults (kids are never paywalled)
    const s = SOUNDS.find((x) => x.key === k);
    if (s?.premium && !isPremium && !kids) {
      router.push('/unlock' as Href);
      return;
    }
    // start at medium, never full — a face-full of max-volume rain at 3am jolts a
    // drowsy user (and a sleeping partner) awake; the level bars still allow one tap up.
    setLevels((prev) => ({ ...prev, [k]: prev[k] > 0 ? 0 : 2 }));
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

  // Set the sleep timer to an exact duration — one direct tap, no cycle-and-read loop.
  const setTimerTo = (mins: number) => {
    lightTap();
    setTimer(mins);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (mins > 0) {
      const ms = mins * 60 * 1000;
      setJSON('cc.sleepTimer', timerStateFor(mins));
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
    lightTap();
    // name the mix from its active sounds so chips are self-describing ("Rain · Ocean"),
    // not indistinguishable "Mix 1 / Mix 2" — same naming shareMix already uses
    const active = SOUNDS.filter((s) => levels[s.key] > 0);
    const name = active.slice(0, 3).map((s) => s.label).join(' · ') || `Mix ${mixes.length + 1}`;
    const next = [...mixes, { name, levels }].slice(-12);
    setMixes(next);
    setJSON('cc.mixes', next);
  };
  const loadMix = (m: SavedMix) => {
    lightTap();
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
        lightTap();
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
    lightTap();
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
    <Screen mode={kids ? 'kids' : 'night'} scroll tabBarSpacing wide contentStyle={{ paddingHorizontal: 0 }}>
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

      {/* saved mixes — the fastest path back to last night's blend, so it sits first */}
      {mixes.length > 0 ? (
        <Reveal index={1} style={{ marginTop: 24 }}>
          <View style={{ paddingHorizontal: 24 }}>
            <SectionHeader kicker="Saved" title="Your mixes" />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 10 }}>
            {mixes.map((m, i) => (
              <Appear key={i} enter={dur.sheet}>
                <PressableScale onPress={() => loadMix(m)} accessibilityRole="button" dimTo={0.95}>
                  <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.lineSage, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Feather name="disc" size={15} color={c.textAccent} />
                    <AppText variant="cardTitle" tone="title" numberOfLines={1}>
                      {m.name}
                    </AppText>
                  </View>
                </PressableScale>
              </Appear>
            ))}
          </ScrollView>
        </Reveal>
      ) : null}

      {/* sound grid — UNIFORM tiles + fixed gap + flex-start, so every row (full
          or partial) is evenly sized and evenly spaced. Tile width is computed
          from the measured grid width so N columns always fit exactly. justify
          CENTER means full rows fill edge-to-edge (no free space to distribute)
          while a partial last row centers — so a lone trailing tile sits balanced
          in the middle instead of stranded on the left. */}
      <Reveal index={2} style={{ marginTop: 24, paddingHorizontal: 24 }}>
        <View
          onLayout={(e) => setGridW(e.nativeEvent.layout.width)}
          style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: GRID_GAP }}>
          {gridW > 0
            ? SOUNDS.map((s) => (
                <Tile
                  key={s.key}
                  label={s.label}
                  cover={s.cover}
                  level={levels[s.key]}
                  locked={!!s.premium && !isPremium && !kids}
                  width={(gridW - (gridCols - 1) * GRID_GAP) / gridCols}
                  onToggle={() => toggle(s.key)}
                  onLevel={(l) => setLevel(s.key, l)}
                />
              ))
            : null}
        </View>
      </Reveal>

      {/* master controls */}
      <Reveal index={3} style={{ marginTop: 28, paddingHorizontal: 24 }}>
        {/* sleep timer — one direct tap to any duration, no blind cycle-and-read loop */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Feather name="moon" size={16} color={c.textAccent} />
          <AppText variant="cardTitle" tone="title">
            Sleep timer
          </AppText>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {TIMERS.map((m) => {
            const active = timer === m;
            return (
              <PressableScale
                key={m}
                onPress={() => setTimerTo(m)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={m === 0 ? 'Timer off' : `Sleep timer ${m} minutes`}
                style={{ flex: 1 }}
                scaleTo={0.98}
                dimTo={0.95}>
                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, overflow: 'hidden', backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }}>
                  <SelectionOverlay active={active} style={{ borderRadius: 14, borderWidth: 1, borderColor: c.accent, backgroundColor: c.panelStrong }} />
                  <AppText variant="cardTitle" tone="title">
                    {m === 0 ? 'Off' : `${m}`}
                  </AppText>
                </View>
              </PressableScale>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
          <PressableScale
            onPress={saveMix}
            disabled={!anyOn}
            accessibilityRole="button"
            style={{ flex: 1 }}
            scaleTo={0.98}
            dimTo={0.95}>
            <Dimmable active={anyOn}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }}>
                <Feather name="bookmark" size={16} color={c.textAccent} />
                <AppText variant="cardTitle" tone="title">
                  Save mix
                </AppText>
              </View>
            </Dimmable>
          </PressableScale>
        </View>

        {/* Stop all — THE in-bed action: a full-width chip, above share, so silencing
            everything reads before the lesser share/save affordances */}
        {anyOn ? (
          <Appear enter={dur.sheet}>
            <PressableScale
              onPress={stopAll}
              accessibilityRole="button"
              accessibilityLabel="Stop all sounds"
              scaleTo={0.98}
              dimTo={0.95}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, paddingVertical: 14, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }}>
              <Feather name="square" size={16} color={c.textAccent} />
              <AppText variant="cardTitle" tone="title">
                Stop all
              </AppText>
            </PressableScale>
          </Appear>
        ) : null}

        {anyOn && !kids && !!token && token !== 'local' ? (
          <Appear enter={dur.sheet}>
            <PressableScale
              onPress={shareMix}
              accessibilityRole="button"
              accessibilityLabel="Share this mix anonymously to the community"
              dimTo={0.9}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: c.line }}>
              <Feather name="share-2" size={16} color={c.textAccent} />
              <AppText variant="cardTitle" tone="title">
                Share this mix anonymously
              </AppText>
            </PressableScale>
          </Appear>
        ) : null}
        {shareNote ? (
          <Appear enter={dur.nav}>
            <AppText variant="meta" tone="muted" style={{ textAlign: 'center', marginTop: 8 }} numberOfLines={2}>
              {shareNote}
            </AppText>
          </Appear>
        ) : null}
      </Reveal>

      {/* Music — lyric-free instrumental tracks. Last, because the one-tap sound grid
          above is the fastest path to something calming; music is a deliberate choice. */}
      <Reveal index={4} style={{ marginTop: 28, paddingHorizontal: 24 }}>
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
                onPressIn={lightTap}
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
                  <Crossfade
                    style={{ width: 18, height: 18 }}
                    active={locked}
                    front={<Feather name="lock" size={18} color={c.textAccent} />}
                    back={<Feather name="play" size={18} color={c.textAccent} />}
                  />
                </Card>
              </PressableScale>
            );
          })}
        </View>
      </Reveal>
    </Screen>
  );
}
