import { useAudioPlayer } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { audioSources } from '@/content/audio';
import { dur, ease, useTheme } from '@/theme';
import { AnimatedLogo } from './AnimatedLogo';

/**
 * BrandSplash — the full-screen CalmCarry launch moment. A soft themed gradient
 * cradles the AnimatedLogo reveal, then the whole layer fades out and hands off
 * to the app. Rendered as an overlay (absolute fill) by the root layout. Reduced
 * motion still shows the lockup briefly so the brand registers, then dismisses.
 */
export function BrandSplash({ onDone }: { onDone: () => void }) {
  const { c, isNight } = useTheme();
  const reduced = useReducedMotion();
  const fade = useSharedValue(1);
  const done = useRef(false);

  // A low, soothing nature bed (birdsong + soft stream) sets the vibe the moment
  // the app opens: fades in under the reveal, fades out as we hand off. Native
  // autoplays on launch; web blocks autoplay until a gesture (it just stays silent).
  // The 60ms interval below is intentional AUDIO-volume cadence (expo-audio volume
  // isn't animatable by Reanimated), not UI motion — hence no dur.* token.
  const ambient = useAudioPlayer(audioSources.forest);
  const vol = useRef(0);
  const AMBIENT_TARGET = 0.25;
  useEffect(() => {
    let cancelled = false;
    try {
      ambient.loop = true;
      ambient.volume = 0;
      ambient.play();
    } catch {}
    const fadeIn = setInterval(() => {
      if (cancelled) return;
      vol.current = Math.min(AMBIENT_TARGET, vol.current + 0.02);
      try {
        ambient.volume = vol.current;
      } catch {}
      if (vol.current >= AMBIENT_TARGET) clearInterval(fadeIn);
    }, 60);
    return () => {
      cancelled = true;
      clearInterval(fadeIn);
      try {
        ambient.pause();
      } catch {}
    };
  }, [ambient]);

  const fadeOutAmbient = () => {
    const out = setInterval(() => {
      vol.current = Math.max(0, vol.current - 0.03);
      try {
        ambient.volume = vol.current;
      } catch {}
      if (vol.current <= 0) {
        clearInterval(out);
        try {
          ambient.pause();
        } catch {}
      }
    }, 60);
  };

  // fire-once: a tap-to-skip and the reveal's own auto-handoff can both call this.
  const finish = () => {
    if (done.current) return;
    done.current = true;
    fadeOutAmbient();
    if (reduced) {
      onDone();
      return;
    }
    fade.value = withTiming(0, { duration: dur.screen, easing: ease.inOut }, (fin) => {
      'worklet';
      if (fin) runOnJS(onDone)();
    });
  };

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  // a barely-there vertical gradient for depth (calm, not flashy)
  const bg: [string, string] = isNight ? [c.bg, c.surface] : [c.surface, c.bg];

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 100 }, fadeStyle]}>
      <LinearGradient colors={bg} style={StyleSheet.absoluteFill} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />
      <Pressable
        onPress={finish}
        accessibilityRole="button"
        accessibilityLabel="CalmCarry. Skip intro"
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <AnimatedLogo size="lg" withOrb tagline onDone={finish} />
      </Pressable>
    </Animated.View>
  );
}
