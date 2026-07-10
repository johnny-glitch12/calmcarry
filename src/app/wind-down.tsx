import { Feather } from '@expo/vector-icons';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Image as RNImage, Pressable, StyleSheet, View } from 'react-native';
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
import { lightTap } from '@/lib/haptics';
import { useAuth } from '@/features/auth/AuthProvider';
import { audioSources } from '@/content/audio';
import { covers } from '@/content/covers';
import { TRACKS } from '@/content/library';
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

/** Play/pause button — press feedback + a crossfade between the two glyphs. */
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
  const [paused, setPaused] = useState(false);

  const { isPremium } = useAuth();
  // the wind-down plays the track the home screen recommended (falls back to Slow Tide)
  const { id } = useLocalSearchParams<{ id?: string }>();
  const track = TRACKS[id ?? ''] ?? TRACKS['slow-tide'];
  // Entitlement gate: a locked premium track must NOT stream in the wind-down for a
  // free user — that bundled asset plays with no server signed-url check, so it would
  // bypass the paywall. Gate on entitlement ONLY (kids mode is NOT an exemption — a
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
    if (lockedForUser) return; // redirecting to the paywall — never announce paid audio
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
    if (lockedForUser) return; // gated — redirecting to the paywall, never play paid audio
    audio.loop = true;
    audio.play();
    return () => {
      try {
        audio.pause();
      } catch {
        /* released */
      }
    };
  }, [audio, lockedForUser]);
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
  // audio to silence at 20:00 — the on-screen "fades to silence" promise was cosmetic
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
    if (endTimer.current) clearTimeout(endTimer.current);
    let v = 1;
    const step = () => {
      v -= 0.07; // ~5s gentle fade — long enough not to startle someone drifting off
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
  }, [audio, router]);

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
      // melt away unnoticed — deliberately slower than any user-facing exit.
      controls.value = withTiming(0, { duration: dur.modal, easing: ease.inOut });
    }, 4000);
  }, [controls, reduced]);

  const wake = useCallback(() => {
    // wake is user feedback — answers the tap instantly
    controls.value = withTiming(1, { duration: dur.press, easing: ease.press });
    if (!paused) scheduleIdleFade();
  }, [controls, paused, scheduleIdleFade]);

  // mount: spring the centerpiece in, start the session, arm the idle fade
  useEffect(() => {
    if (lockedForUser) return; // gated — don't arm timers/progress while redirecting to paywall
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

  // Reduced motion: no continuous ring animation — advance the ring + scrim in calm
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
    // Manually bailing out of the ritual should just make the screen GONE — not spawn a
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
        // player's — the wind-down should feel like the room lights going down)
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
          {/* top bar: close chevron — always visible (never fades; it's the one close affordance) */}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-start', paddingTop: 4 }}>
            <ControlButton icon="chevron-down" size={40} iconRatio={0.5} onPress={close} label="Close wind-down" />
          </View>

          {/* centerpiece — springs in on mount */}
          <Animated.View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }, centerStyle]}>
            <Animated.View style={controlsStyle}>
              <AppText variant="caption" tone="dim" style={{ marginBottom: 28, textAlign: 'center' }}>
                Wind down
              </AppText>
            </Animated.View>

            {/* breathing glow orb framed by the depleting timer ring */}
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <ProgressRing
                progress={progress}
                size={284}
                strokeWidth={3}
                style={{ position: 'absolute' }}
              />
              {/* burst: one soft arrival bloom as the wind-down begins — the room exhales */}
              <GlowOrb size={216} reserveGlow breathing={!paused} burst />
            </View>

            <AppText variant="display" tone="title" style={{ marginTop: 40 }}>
              {track.title}
            </AppText>
            <AppText variant="body" tone="muted">
              {track.subtitle}
            </AppText>
            <Animated.View style={controlsStyle}>
              <AppText variant="label" tone="dim" style={{ marginTop: 6, textAlign: 'center' }}>
                20:00 · fades to silence
              </AppText>
            </Animated.View>
          </Animated.View>

          {/* controls — pause persists; it's the one control that survives the idle fade.
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
