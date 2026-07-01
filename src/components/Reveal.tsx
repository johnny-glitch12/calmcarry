import { useIsFocused } from 'expo-router';
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
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
// static-export target) render the FIRST paint visible immediately so the
// prerendered HTML isn't blank-until-hydration. (Focus REPLAYS still animate on
// web — by then the content has already hydrated, so there's no blank concern.)
const ANIMATE_ENTRANCE = Platform.OS !== 'web';

/**
 * When a screen is wrapped in <RevealReplayProvider> (the bottom tabs are), every
 * Reveal inside it replays its staggered entrance each time that screen gains
 * focus. That's what makes switching tabs slide the WIDGETS in one-by-one instead
 * of sliding the whole screen as one block. Drill-down (stack) screens are NOT
 * wrapped, so they keep their one-time mount entrance and their stack slide.
 */
const RevealReplayCtx = createContext(false);
export function RevealReplayProvider({ children }: { children: ReactNode }) {
  return <RevealReplayCtx.Provider value>{children}</RevealReplayCtx.Provider>;
}

type Props = {
  /** position in a group; entrance is delayed index * STAGGER */
  index?: number;
  /** extra delay on top of the index stagger */
  delay?: number;
  children: ReactNode;
  style?: ViewStyle;
};

/**
 * Reveal — the shared staggered-entrance idiom (DESIGN_SYSTEM §4): translateY +
 * opacity 0→1 over dur.sheet, staggered by index. Driven by a self-contained
 * shared value (not a layout `entering` animation) so it can't be interrupted by
 * children that resize after mount. Starts VISIBLE so SSR / reduced motion render
 * the resting state. Inside a RevealReplayProvider it re-runs on every focus.
 */
export function Reveal({ index = 0, delay = 0, children, style }: Props) {
  const reduced = useReducedMotion();
  const replayOnFocus = useContext(RevealReplayCtx);
  const focused = useIsFocused();
  const p = useSharedValue(ANIMATE_ENTRANCE && !reduced ? 0 : 1);
  const didMount = useRef(false);

  useEffect(() => {
    if (reduced) {
      p.value = 1;
      return;
    }
    // reset to hidden, then glide in after this widget's stagger delay
    const animateIn = () => {
      p.value = 0;
      p.value = withDelay(index * STAGGER + delay, withTiming(1, { duration: dur.sheet, easing: ease.out }));
    };

    if (!didMount.current) {
      didMount.current = true;
      if (ANIMATE_ENTRANCE) animateIn();
      else p.value = 1; // web first paint: visible immediately (no blank prerender)
      return;
    }

    // after mount: only the tab screens (wrapped in the provider) replay on focus
    if (!replayOnFocus) return;
    if (focused) animateIn(); // re-entering this tab → stagger the widgets back in (web + native)
    else p.value = 0; // hidden while blurred so the next focus starts clean (tabs don't slide, so nothing shows)
  }, [focused, reduced, replayOnFocus, p, index, delay]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * 18 }],
  }));

  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>;
}
