import { useEffect, type ReactNode } from 'react';
import { Platform, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { dur, ease, STAGGER } from '@/theme';

// Animate the entrance on native (the shipped product). On web (our preview /
// static-export target) render visible immediately so the prerendered HTML isn't
// blank-until-hydration.
const ANIMATE_ENTRANCE = Platform.OS !== 'web';

type Props = {
  /** position in a group; entrance is delayed index * STAGGER */
  index?: number;
  /** extra delay on top of the index stagger */
  delay?: number;
  children: ReactNode;
  style?: ViewStyle;
};

/**
 * Reveal — a subtle ONE-TIME entrance when content first mounts (translateY 12 +
 * opacity, staggered by index). Intentionally does NOT re-fire on every tab focus
 * — re-staggering the whole screen on each tab tap reads as "look at my animation"
 * slop; content should just be there when you return to a tab. Starts visible so
 * SSR / reduced motion render the resting state.
 */
export function Reveal({ index = 0, delay = 0, children, style }: Props) {
  const reduced = useReducedMotion();
  const shouldAnimate = ANIMATE_ENTRANCE && !reduced;
  const p = useSharedValue(shouldAnimate ? 0 : 1);

  useEffect(() => {
    if (!shouldAnimate) {
      p.value = 1;
      return;
    }
    p.value = withDelay(index * STAGGER + delay, withTiming(1, { duration: dur.sheet, easing: ease.out }));
  }, [shouldAnimate, p, index, delay]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * 12 }],
  }));

  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>;
}
