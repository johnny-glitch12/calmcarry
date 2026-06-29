import { LinearGradient } from 'expo-linear-gradient';
import { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

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

  // fire-once: a tap-to-skip and the reveal's own auto-handoff can both call this.
  const finish = () => {
    if (done.current) return;
    done.current = true;
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
