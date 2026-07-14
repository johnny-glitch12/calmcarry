import { useEffect } from 'react';
import { type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { dur, ease } from '@/theme';

/**
 * Bramble - the sleepy CalmCarry bear. The kid-facing companion (and a nod to the
 * "kids mini bear" device). Soft sage + cream, closed sleepy eyes, rosy cheeks.
 * Breathes gently (reduced-motion gated). Pure SVG so it scales crisply.
 */
export function BearMascot({ size = 140, style, breathing = true }: { size?: number; style?: ViewStyle; breathing?: boolean }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced || !breathing) {
      // rest at scale 1 - a legible resting state even if reduced-motion (or the
      // breathing prop) flips mid-loop, instead of freezing mid-breath
      t.value = 0;
      return;
    }
    // sine in/out so the breath decelerates smoothly into each turn-around (no snap)
    t.value = withRepeat(withTiming(1, { duration: dur.breath, easing: ease.sine }), -1, true);
    return () => cancelAnimation(t);
  }, [reduced, breathing, t]);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + t.value * 0.035 }] }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: size, height: size }, aStyle, style]}>
      <Svg viewBox="0 0 100 100" width={size} height={size}>
        {/* ears */}
        <Circle cx="26" cy="26" r="15" fill="#74A5A2" />
        <Circle cx="74" cy="26" r="15" fill="#74A5A2" />
        <Circle cx="26" cy="26" r="8" fill="#E7F3F0" />
        <Circle cx="74" cy="26" r="8" fill="#E7F3F0" />
        {/* head */}
        <Circle cx="50" cy="55" r="34" fill="#8FBFB7" />
        {/* snout */}
        <Ellipse cx="50" cy="64" rx="18" ry="14" fill="#E7F3F0" />
        {/* cheeks */}
        <Circle cx="28" cy="60" r="6" fill="#EF626C" opacity="0.35" />
        <Circle cx="72" cy="60" r="6" fill="#EF626C" opacity="0.35" />
        {/* sleepy closed eyes */}
        <Path d="M33 49 q5 5 10 0" stroke="#426768" strokeWidth="2" strokeLinecap="round" fill="none" />
        <Path d="M57 49 q5 5 10 0" stroke="#426768" strokeWidth="2" strokeLinecap="round" fill="none" />
        {/* nose */}
        <Ellipse cx="50" cy="58" rx="4.5" ry="3.2" fill="#426768" />
        {/* mouth */}
        <Path d="M50 61 v4 M50 65 q-5 4 -9 1 M50 65 q5 4 9 1" stroke="#426768" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      </Svg>
    </Animated.View>
  );
}
