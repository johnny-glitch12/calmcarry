import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ease, useTheme } from '@/theme';

type Mote = { top: string; left: string; size: number; dur: number; delay: number; bob: number; max: number };

// A fixed, scattered field — deterministic (no random, so it's calm + SSR-safe).
// Each dot gently bobs and twinkles on its own slow sine, desynced by delay.
const MOTES: Mote[] = [
  { top: '10%', left: '16%', size: 6, dur: 5200, delay: 0, bob: 10, max: 0.20 },
  { top: '18%', left: '72%', size: 4, dur: 6400, delay: 700, bob: 8, max: 0.15 },
  { top: '26%', left: '40%', size: 3, dur: 7000, delay: 300, bob: 7, max: 0.12 },
  { top: '34%', left: '86%', size: 5, dur: 5800, delay: 1200, bob: 9, max: 0.18 },
  { top: '44%', left: '8%', size: 5, dur: 6800, delay: 500, bob: 10, max: 0.16 },
  { top: '52%', left: '60%', size: 3, dur: 7400, delay: 1500, bob: 6, max: 0.10 },
  { top: '61%', left: '30%', size: 6, dur: 5600, delay: 900, bob: 11, max: 0.19 },
  { top: '68%', left: '82%', size: 4, dur: 6600, delay: 200, bob: 8, max: 0.14 },
  { top: '76%', left: '50%', size: 3, dur: 7200, delay: 1800, bob: 7, max: 0.11 },
  { top: '83%', left: '20%', size: 5, dur: 6000, delay: 1100, bob: 9, max: 0.16 },
  { top: '88%', left: '70%', size: 4, dur: 6900, delay: 400, bob: 8, max: 0.13 },
  { top: '14%', left: '52%', size: 3, dur: 7600, delay: 2000, bob: 6, max: 0.10 },
];

const FLOOR = 0.08;
const PEAK_BOOST = 0.12; // a touch more presence than a whisper, still calm

function MoteDot({ m, color }: { m: Mote; color: string }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      t.value = 0.5;
      return;
    }
    t.value = withDelay(m.delay, withRepeat(withTiming(1, { duration: m.dur, easing: ease.sine }), -1, true));
  }, [reduced, t, m]);
  const style = useAnimatedStyle(() => ({
    opacity: FLOOR + t.value * (m.max + PEAK_BOOST - FLOOR),
    transform: [{ translateY: -m.bob * t.value }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', top: m.top as unknown as number, left: m.left as unknown as number, width: m.size, height: m.size, borderRadius: m.size / 2, backgroundColor: color },
        style,
      ]}
    />
  );
}

/**
 * AmbientMotes — a soft, slow field of glowing dots that bob and twinkle. Pure
 * ambience: pointer-events off, low opacity, low amplitude (calm, not tiring).
 * Sits behind content (absolute fill). Reduced motion freezes it mid-glow.
 */
export function AmbientMotes({ style }: { style?: ViewStyle }) {
  const { c } = useTheme();
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      {MOTES.map((m, i) => (
        <MoteDot key={i} m={m} color={c.accent} />
      ))}
    </View>
  );
}
