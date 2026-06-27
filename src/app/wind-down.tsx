import { Feather } from '@expo/vector-icons';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
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

import { AppText, GlowOrb, ProgressRing, Screen } from '@/components';
import { audioSources } from '@/content/audio';
import { TRACKS } from '@/content/library';
import { dur, ease, PRESS_SCALE, useTheme } from '@/theme';

/** Default wind-down session: 20 minutes (DESIGN_SYSTEM hero copy). */
const SESSION_MS = 20 * 60 * 1000;

function haptic() {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

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
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const press = (to: number) => {
    scale.value = withTiming(to, { duration: dur.press, easing: ease.out });
  };
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        press(PRESS_SCALE);
        haptic();
      }}
      onPressOut={() => press(1)}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}>
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(143,201,190,0.12)',
            borderWidth: 1,
            borderColor: c.lineSage,
          },
          animStyle,
        ]}>
        <Feather name={icon} size={size * iconRatio} color={c.accent} />
      </Animated.View>
    </Pressable>
  );
}

/** Play/pause button — press feedback + a crossfade between the two glyphs. */
function PlayPauseButton({ paused, onPress }: { paused: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const size = 64;
  const scale = useSharedValue(1);
  const p = useSharedValue(paused ? 1 : 0); // 0 = pause glyph, 1 = play glyph
  const reduced = useReducedMotion();

  useEffect(() => {
    p.value = reduced ? (paused ? 1 : 0) : withTiming(paused ? 1 : 0, { duration: dur.press, easing: ease.out });
  }, [paused, reduced, p]);

  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const playStyle = useAnimatedStyle(() => ({ opacity: p.value }));
  const pauseStyle = useAnimatedStyle(() => ({ opacity: 1 - p.value }));
  const press = (to: number) => {
    scale.value = withTiming(to, { duration: dur.press, easing: ease.out });
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        press(PRESS_SCALE);
        haptic();
      }}
      onPressOut={() => press(1)}
      accessibilityRole="button"
      accessibilityLabel={paused ? 'Resume' : 'Pause'}
      hitSlop={8}>
      <Animated.View
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(143,201,190,0.12)',
            borderWidth: 1,
            borderColor: c.lineSage,
          },
          btnStyle,
        ]}>
        <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, pauseStyle]}>
          <Feather name="pause" size={23} color={c.accent} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, playStyle]}>
          <Feather name="play" size={23} color={c.accent} style={{ marginLeft: 2 }} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

export default function WindDownScreen() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);

  // the wind-down plays the track the home screen recommended (falls back to Slow Tide)
  const { id } = useLocalSearchParams<{ id?: string }>();
  const track = TRACKS[id ?? ''] ?? TRACKS['slow-tide'];

  // ambient bed: the recommended track, looping, plays through the wind-down ritual
  const audio = useAudioPlayer(audioSources[track.audio]);
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true }).catch(() => {});
  }, []);
  useEffect(() => {
    audio.loop = true;
    audio.play();
    return () => {
      try {
        audio.pause();
      } catch {
        /* released */
      }
    };
  }, [audio]);
  useEffect(() => {
    if (paused) audio.pause();
    else audio.play();
  }, [paused, audio]);

  // session progress 0→1; the ring depletes and the scrim deepens off this value
  const progress = useSharedValue(reduced ? 0.12 : 0);
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
    if (endTimer.current) clearTimeout(endTimer.current);
    endTimer.current = setTimeout(endSession, Math.max(remainingRef.current, 0));
  }, [endSession]);

  const pauseCountdown = useCallback(() => {
    if (lastStartRef.current != null) {
      remainingRef.current = Math.max(remainingRef.current - (Date.now() - lastStartRef.current), 0);
      lastStartRef.current = null;
    }
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
      controls.value = withTiming(0, { duration: dur.sheet, easing: ease.out });
    }, 4000);
  }, [controls, reduced]);

  const wake = useCallback(() => {
    controls.value = withTiming(1, { duration: dur.press, easing: ease.out });
    if (!paused) scheduleIdleFade();
  }, [controls, paused, scheduleIdleFade]);

  // mount: spring the centerpiece in, start the session, arm the idle fade
  useEffect(() => {
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
    // ending the ritual → gentle "were you settled?" check-in (build plan peak-end)
    router.replace('/check-in');
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
    <Screen
      mode="night"
      overlay={
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: '#0E1817' }, scrimStyle]}
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
              <GlowOrb size={216} reserveGlow breathing={!paused} />
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

          {/* controls — pause persists; it's the one control that survives the idle fade */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingBottom: 24 }}>
            <PlayPauseButton paused={paused} onPress={togglePause} />
          </View>
        </View>
      </Pressable>
    </Screen>
  );
}
