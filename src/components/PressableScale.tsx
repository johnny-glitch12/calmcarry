import * as Haptics from 'expo-haptics';
import { type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { dur, ease, PRESS_SCALE } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style' | 'children'> & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** pressed scale — defaults to the app press token (0.97). */
  scaleTo?: number;
  /** pressed opacity — 1 = scale only (default). Set e.g. 0.9 for a subtle dim on icons/links. */
  dimTo?: number;
  /** fire a light haptic on press-in (native only). */
  haptic?: boolean;
};

/**
 * PressableScale — the canonical animated tap target. Every discrete ACTION
 * (button, icon, chip, list row, link, option, keypad key) should use this so
 * nothing feels static when touched: a gentle scale (+ optional opacity dim)
 * driven on the UI thread via the shared press tokens, reduced-motion-safe, and
 * kept quick (dur.press) so taps stay responsive. Drop-in for a Pressable —
 * pass a STATIC style; the pressed feedback is handled here (don't pass a
 * `({ pressed }) => …` style function).
 */
export function PressableScale({
  children,
  style,
  scaleTo = PRESS_SCALE,
  dimTo = 1,
  haptic = false,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: Props) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));

  const drive = (pressed: boolean) => {
    if (reduced) return; // reduced motion: no scale/opacity animation, just the press itself
    // ease.press (strong out): the scale moves the instant the finger lands —
    // feedback with zero perceived latency, settling softly.
    scale.value = withTiming(pressed ? scaleTo : 1, { duration: dur.press, easing: ease.press });
    if (dimTo < 1) opacity.value = withTiming(pressed ? dimTo : 1, { duration: dur.press, easing: ease.press });
  };

  return (
    <AnimatedPressable
      disabled={disabled}
      style={[style, anim]}
      onPressIn={(e: GestureResponderEvent) => {
        drive(true);
        if (haptic && Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        drive(false);
        onPressOut?.(e);
      }}
      {...rest}>
      {children}
    </AnimatedPressable>
  );
}
