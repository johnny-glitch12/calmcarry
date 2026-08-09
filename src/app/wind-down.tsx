import { Feather } from '@expo/vector-icons';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Image as RNImage, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText, DragDismiss, GlowOrb, PressableScale, ProgressRing, Screen } from '@/components';
import { markFirstAudio, track as logEvent } from '@/lib/analytics';
import { markCalmNightToday } from '@/lib/calmNights';
import { lightTap } from '@/lib/haptics';
import { markProgramStepDone } from '@/lib/programs';
import { pushRecent } from '@/lib/recents';
import { logSession } from '@/lib/sessions';
import { getJSON, KEYS } from '@/lib/store';
import { recordTrackWin } from '@/lib/trackWins';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/ProfileProvider';
import { audioSources } from '@/content/audio';
import { covers } from '@/content/covers';
import { TRACKS, trackLoops } from '@/content/library';
import { dur, ease, night, useTheme } from '@/theme';

/** Default wind-down session: 20 minutes (DESIGN_SYSTEM hero copy). */
const SESSION_MS = 20 * 60 * 1000;

/** Generic circular control with press feedback (scale 0.97 + haptic, ease-out). */
function ControlButton({
  icon,
  size = 64,
  iconRatio = 0.36,
  onPress,
  label,
}: {
  icon: keyof typeof Feather.glyphMap;
  size?: number;
  iconRatio?: number;
  onPress?: () => void;
  label: string;
}) {
  const { c } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      onPressIn={lightTap}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.panelStrong,
        borderWidth: 1,
        borderColor: c.lineSage,
      }}>
      <Feather name={icon} size={size * iconRatio} color={c.accent} />
    </PressableScale>
  );
}

/** Play/pause button - press feedback + a crossfade between the two glyphs. */
function PlayPauseButton({ paused, onPress }: { paused: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const size = 64;
  const p = useSharedValue(paused ? 1 : 0); // 0 = pause glyph, 1 = play glyph
  const reduced = useReducedMotion();

  useEffect(() => {
    p.value = reduced ? (paused ? 1 : 0) : withTiming(paused ? 1 : 0, { duration: dur.press, easing: ease.out });
  }, [paused, reduced, p]);

  const playStyle = useAnimatedStyle(() => ({ opacity: p.value }));
  const pauseStyle = useAnimatedStyle(() => ({ opacity: 1 - p.value }));

  return (
    <PressableScale
      onPress={onPress}
      onPressIn={lightTap}
      accessibilityRole="button"
      accessibilityLabel={paused ? 'Resume' : 'Pause'}
      hitSlop={8}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.panelStrong,
        borderWidth: 1,
        borderColor: c.lineSage,
      }}>
      <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, pauseStyle]}>
        <Feather name="pause" size={23} color={c.accent} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, playStyle]}>
        <Feather name="play" size={23} color={c.accent} style={{ marginLeft: 2 }} />
      </Animated.View>
    </PressableScale>
  );
}

export default function WindDownScreen() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  // Scale the centerpiece (timer ring + orb) down on short screens so the caption,
  // title, subtitle and label below it don't overflow on an iPhone SE/8 or small
  // Android; unchanged at 812pt+ (iPhone 13 mini and taller).
  const { height: winH } = useWindowDimensions();
  const orbScale = Math.min(1, Math.max(0.8, winH / 812));
  const [paused, setPaused] = useState(false);
  // After dark the depleting ring + "20:00" label are hidden: a ticking countdown
  // is the exact clock-watching this ritual is meant to quiet. Outside the wind-down
  // window (a daytime reset) the ring stays as a gentle frame. Fixed at open; the
  // wall-clock session timer + crediting are untouched - this only governs the
  // VISUAL countdown. 20:00-05:00 local; getHours is web-safe.
  const [isNightHours] = useState(() => {
    const h = new Date().getHours();
    return h >= 20 || h < 5;
  });
  // device-aware ritual line: invite the orb into the ritual ONLY when one is
  // registered on this account (cc.devices cache) - never instruct a non-owner
  // to hold hardware they don't have
  const [hasOrb, setHasOrb] = useState(false);
  useEffect(() => {
    let alive = true;
    getJSON<unknown[]>(KEYS.devices, []).then((l) => {
      if (alive && Array.isArray(l) && l.length > 0) setHasOrb(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const { isPremium, token } = useAuth();
  const { mode } = useProfile();
  // the wind-down plays the track the home screen recommended (falls back to Slow Tide)
  const { id, program, day } = useLocalSearchParams<{ id?: string; program?: string; day?: string }>();
  const track = TRACKS[id ?? ''] ?? TRACKS['slow-tide'];
  // Entitlement gate: a locked premium track must NOT stream in the wind-down for a
  // free user - that bundled asset plays with no server signed-url check, so it would
  // bypass the paywall. Gate on entitlement ONLY (kids mode is NOT an exemption - a
  // free profile switched to kids used to unlock everything). We send free users to
  // the paywall UP FRONT rather than starting a 20-minute ritual and yanking it away.
  const lockedForUser = !!track.locked && !isPremium;

  // ambient bed: the recommended track, looping, plays through the wind-down ritual
  const audio = useAudioPlayer(audioSources[track.audio]);
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' }).catch(() => {});
  }, []);
  // Lock-screen presence for the ritual: the phone is face-down/locked during a
  // wind-down, and on Android an active lock-screen session is what keeps
  // background audio alive past ~3 minutes (expo-audio v56 docs).
  useEffect(() => {
    if (lockedForUser) return; // redirecting to the paywall - never announce paid audio
    try {
      const art = RNImage.resolveAssetSource(covers[track.cover])?.uri;
      audio.setActiveForLockScreen(
        true,
        { title: track.title, artist: 'CalmCarry', ...(art ? { artworkUrl: art } : {}) },
        { showSeekBackward: false, showSeekForward: false },
      );
    } catch {
      /* platform without lock-screen support */
    }
    return () => {
      try {
        audio.clearLockScreenControls();
      } catch {
        /* released */
      }
    };
  }, [audio, track.title, track.cover, lockedForUser]);
  // locked premium track + free user → straight to the paywall (no audio plays)
  useEffect(() => {
    if (lockedForUser) router.replace(`/unlock?id=${track.id}` as Href);
  }, [lockedForUser, track.id, router]);
  useEffect(() => {
    if (lockedForUser) return; // gated - redirecting to the paywall, never play paid audio
    // Honour the library's looping contract instead of forcing loop on everything.
    // The recommender can hand this screen a FINITE track (a guided meditation, a
    // breathing pacer), and looping those replayed a 4-minute narration five times
    // through a 20-minute ritual - the exact "plays once and ends gently" promise
    // trackLoops() exists to keep, which Player and PlaybackProvider both honour.
    audio.loop = trackLoops(track);
    audio.play();
    markFirstAudio(); // time-to-first-audio: fires once per cold start
    return () => {
      try {
        audio.pause();
      } catch {
        /* released */
      }
    };
  }, [audio, lockedForUser]);

  // Credit the ritual exactly like a Player session (the flagship CTA used to earn
  // NOTHING: no calm night, no recent, no program progress - a week of faithful
  // nightly wind-downs left the home at 0 stars). Gated on audio ACTUALLY playing,
  // same as Player.tsx - a 2-second open-and-close or a failed load earns nothing.
  const audioStatus = useAudioPlayerStatus(audio);
  const loggedRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  useEffect(() => {
    if (lockedForUser || loggedRef.current || !audioStatus.playing) return;
    loggedRef.current = true;
    startedAtRef.current = Date.now();
    // COPPA: never send a child's listening to the backend, and keep their plays
    // out of the (adult) recents/recommender - same rule as the Player
    if (mode !== 'kids') {
      logSession(token, { contentId: track.id });
      pushRecent(track.id).catch(() => {});
    }
    logEvent('session_start', { contentId: track.id, category: track.category });
    markCalmNightToday().catch(() => {});
    if (program && day) markProgramStepDone(program, Number(day)).catch(() => {});
  }, [lockedForUser, audioStatus.playing, mode, token, track.id, track.category, program, day]);

  // Completion fires once, on the FIRST exit path taken (natural 20:00 end or an
  // early close). A ≥60s listen counts as a real wind-down - same rule as the Player.
  const fireComplete = useCallback(
    (reachedEnd: boolean) => {
      if (completedRef.current || !loggedRef.current) return;
      completedRef.current = true;
      const durationSec = startedAtRef.current ? Math.round((Date.now() - startedAtRef.current) / 1000) : undefined;
      const completed = reachedEnd || (durationSec ?? 0) >= 60;
      if (completed) void recordTrackWin(track.id);
      logEvent('session_complete', { contentId: track.id, category: track.category, completed, durationSec });
    },
    [track.id, track.category],
  );
  // Count completion on any other exit (nav away / unmount). Latest fireComplete in
  // a ref + [] deps so a mid-session param change can't fire a stale completion.
  const fireCompleteRef = useRef(fireComplete);
  useEffect(() => {
    fireCompleteRef.current = fireComplete;
  });
  useEffect(() => () => fireCompleteRef.current(false), []);
  useEffect(() => {
    if (lockedForUser) return;
    if (paused) audio.pause();
    else audio.play();
  }, [paused, audio, lockedForUser]);

  // session progress 0→1; the ring depletes and the scrim deepens off this value
  const progress = useSharedValue(0);
  // controls auto-fade to "just the orb + pause" when the player is left idle
  const controls = useSharedValue(1);
  // centerpiece spring-in on mount
  const enter = useSharedValue(reduced ? 1 : 0);

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Real session-end: a wall-clock countdown (pause-aware) that actually fades the
  // audio to silence at 20:00 - the on-screen "fades to silence" promise was cosmetic
  // (the loop would otherwise play all night). Independent of reduced-motion.
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingRef = useRef(SESSION_MS);
  const lastStartRef = useRef<number | null>(null);
  const endAtRef = useRef<number | null>(null); // absolute end time while running (for bg recompute)
  const endingRef = useRef(false);

  const endSession = useCallback(() => {
    if (endingRef.current) return;
    endingRef.current = true;
    fireComplete(true); // the ritual reached its natural end
    if (endTimer.current) clearTimeout(endTimer.current);
    let v = 1;
    const step = () => {
      v -= 0.07; // ~5s gentle fade - long enough not to startle someone drifting off
      try {
        audio.volume = Math.max(v, 0);
      } catch {
        /* released */
      }
      if (v > 0) fadeRef.current = setTimeout(step, 220);
      else {
        try {
          audio.pause();
        } catch {
          /* ignore */
        }
        router.replace('/check-in');
      }
    };
    step();
  }, [audio, router, fireComplete]);

  const beginCountdown = useCallback(() => {
    lastStartRef.current = Date.now();
    endAtRef.current = Date.now() + Math.max(remainingRef.current, 0);
    if (endTimer.current) clearTimeout(endTimer.current);
    endTimer.current = setTimeout(endSession, Math.max(remainingRef.current, 0));
  }, [endSession]);

  const pauseCountdown = useCallback(() => {
    if (lastStartRef.current != null) {
      remainingRef.current = Math.max(remainingRef.current - (Date.now() - lastStartRef.current), 0);
      lastStartRef.current = null;
    }
    endAtRef.current = null;
    if (endTimer.current) clearTimeout(endTimer.current);
  }, []);

  const startProgress = useCallback(() => {
    if (reduced) return;
    const remaining = (1 - progress.value) * SESSION_MS;
    progress.value = withTiming(1, { duration: remaining, easing: Easing.linear });
  }, [progress, reduced]);

  const scheduleIdleFade = useCallback(() => {
    if (reduced) return; // reduced motion: controls stay put, never auto-fade
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      // idle auto-dim is AMBIENT (system-initiated, video-player pattern): it should
      // melt away unnoticed - deliberately slower than any user-facing exit.
      controls.value = withTiming(0, { duration: dur.modal, easing: ease.inOut });
    }, 4000);
  }, [controls, reduced]);

  const wake = useCallback(() => {
    // wake is user feedback - answers the tap instantly
    controls.value = withTiming(1, { duration: dur.press, easing: ease.press });
    if (!paused) scheduleIdleFade();
  }, [controls, paused, scheduleIdleFade]);

  // mount: spring the centerpiece in, start the session, arm the idle fade
  useEffect(() => {
    if (lockedForUser) return; // gated - don't arm timers/progress while redirecting to paywall
    if (!reduced) {
      enter.value = withTiming(1, { duration: dur.modal, easing: ease.out });
    }
    startProgress();
    scheduleIdleFade();
    beginCountdown();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (endTimer.current) clearTimeout(endTimer.current);
      if (fadeRef.current) clearTimeout(fadeRef.current);
      cancelAnimation(progress);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The end-timer setTimeout is suspended while backgrounded (audio keeps looping),
  // so on return to foreground recompute against the absolute end time: fade NOW if
  // 20:00 already passed, else re-arm the remainder and resync the ring. Guarded on
  // !paused so a paused session never force-ends.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active' || paused || endingRef.current || endAtRef.current == null) return;
      const remaining = endAtRef.current - Date.now();
      if (endTimer.current) clearTimeout(endTimer.current);
      if (remaining <= 0) {
        endSession();
        return;
      }
      remainingRef.current = remaining;
      lastStartRef.current = Date.now();
      endTimer.current = setTimeout(endSession, remaining);
      if (!reduced) {
        cancelAnimation(progress);
        progress.value = Math.min(1, 1 - remaining / SESSION_MS);
        progress.value = withTiming(1, { duration: remaining, easing: Easing.linear });
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, endSession, reduced]);

  // Reduced motion: no continuous ring animation - advance the ring + scrim in calm
  // 1s discrete steps off the real countdown, so time-left is still reflected.
  useEffect(() => {
    if (!reduced) return;
    const tick = setInterval(() => {
      if (paused) return;
      const remaining = endAtRef.current != null ? endAtRef.current - Date.now() : remainingRef.current;
      progress.value = Math.min(1, Math.max(0, 1 - remaining / SESSION_MS));
    }, 1000);
    return () => clearInterval(tick);
  }, [reduced, paused, progress]);

  const togglePause = () => {
    const next = !paused;
    setPaused(next); // pure updater; side effects run here in the handler body
    if (next) {
      cancelAnimation(progress); // freeze
      pauseCountdown(); // freeze the wall-clock session timer too
      controls.value = withTiming(1, { duration: dur.press, easing: ease.out }); // keep controls up while paused
      if (idleTimer.current) clearTimeout(idleTimer.current);
    } else {
      startProgress(); // resume from remaining
      beginCountdown(); // re-arm the session-end from the remaining time
      scheduleIdleFade();
    }
  };

  const close = () => {
    cancelAnimation(progress);
    if (endTimer.current) clearTimeout(endTimer.current);
    if (fadeRef.current) clearTimeout(fadeRef.current);
    fireComplete(false); // early leave still counts if ≥60s was actually listened
    // Manually bailing out of the ritual should just make the screen GONE - not spawn a
    // "were you settled?" question with more light and another aimed tap. The peak-end
    // check-in stays for the natural 20:00 end in endSession, where reflection fits.
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  // ---- animated styles ----
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.85, 1], [0, 0.32, 0.4], Extrapolation.CLAMP),
  }));
  const controlsStyle = useAnimatedStyle(() => ({ opacity: controls.value }));
  const centerStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: interpolate(enter.value, [0, 1], [0.96, 1]) }],
  }));

  return (
    <DragDismiss onDismiss={close}>
      <Screen
      mode="night"
      backdrop={
        // immersive scene: tonight's artwork under a deep scrim (heavier than the
        // player's - the wind-down should feel like the room lights going down)
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Image source={covers[track.cover]} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
          <LinearGradient
            colors={['rgba(14,24,23,0.9)', 'rgba(14,24,23,0.72)', 'rgba(14,24,23,0.96)']}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      }
      overlay={
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: night.deep }, scrimStyle]}
        />
      }>
      {/* tap anywhere to wake the controls back up */}
      <Pressable style={{ flex: 1 }} onPress={wake} accessibilityRole="none">
        <View style={{ flex: 1 }}>
          {/* top bar: close chevron - always visible (never fades; it's the one close affordance) */}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-start', paddingTop: 4 }}>
            <ControlButton icon="chevron-down" size={40} iconRatio={0.5} onPress={close} label="Close wind-down" />
          </View>

          {/* centerpiece - springs in on mount */}
          <Animated.View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }, centerStyle]}>
            <Animated.View style={controlsStyle}>
              <AppText variant="caption" tone="dim" style={{ marginBottom: 16, textAlign: 'center' }}>
                {hasOrb ? 'Hold your orb. Wind down' : 'Wind down'}
              </AppText>
            </Animated.View>

            {/* breathing glow orb; after dark it stands alone - the depleting timer
                ring is a countdown to watch, so it's shown only for a daytime reset */}
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              {!isNightHours && (
                <ProgressRing
                  progress={progress}
                  size={Math.round(284 * orbScale)}
                  strokeWidth={3}
                  style={{ position: 'absolute' }}
                />
              )}
              {/* burst: one soft arrival bloom as the wind-down begins - the room exhales.
                  paced: the orb breathes the TAUGHT 4s-in/6s-out rhythm, not the ambient
                  symmetric loop, so following it with your own breath actually works */}
              <GlowOrb size={Math.round(216 * orbScale)} reserveGlow breathing={!paused} paced burst />
            </View>

            <AppText variant="display" tone="title" style={{ marginTop: 24 }}>
              {track.title}
            </AppText>
            <AppText variant="body" tone="muted">
              {track.subtitle}
            </AppText>
            {!isNightHours && (
              <Animated.View style={controlsStyle}>
                <AppText variant="label" tone="dim" style={{ marginTop: 6, textAlign: 'center' }}>
                  20:00 · fades to silence
                </AppText>
              </Animated.View>
            )}
          </Animated.View>

          {/* controls - pause persists; it's the one control that survives the idle fade.
              bottom inset folded in: Screen only reserves left/right edges */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingBottom: Math.max(insets.bottom, 12) + 12 }}>
            <PlayPauseButton paused={paused} onPress={togglePause} />
          </View>
        </View>
      </Pressable>
      </Screen>
    </DragDismiss>
  );
}
