import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { dur, ease } from '@/theme';

/**
 * Shared motion primitives — the app's rule is that NOTHING a user triggers may
 * change instantly (an abrupt onset is a jolt to a sleepy brain). These four
 * helpers cover the recurring cases so every screen animates the same way:
 *
 *  - Appear          conditionally-rendered content fades in/out (mount/unmount)
 *  - SwapText        a changing value (text/number) dips-and-swaps in place
 *  - SelectionOverlay a selected/active tint that eases in over the resting look
 *  - Crossfade       two states (icons, labels) dissolve between each other
 *
 * All are reduced-motion safe (snap to the end state) and use only opacity so
 * they stay cheap on the UI thread.
 */

/** Fade a conditionally-rendered block in on mount and out on unmount. */
export function Appear({
  children,
  style,
  enter = dur.sheet,
  exit = dur.exit,
  delay = 0,
  layout = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** enter duration (default dur.sheet). */
  enter?: number;
  /** exit duration (default dur.exit — quicker than the enter, per the motion doctrine). */
  exit?: number;
  /** delay the entrance (ms). */
  delay?: number;
  /** also tween this view's own layout changes (e.g. height) instead of snapping. */
  layout?: boolean;
}) {
  return (
    <Animated.View
      style={style}
      entering={FadeIn.duration(enter).delay(delay).reduceMotion(ReduceMotion.System)}
      exiting={FadeOut.duration(exit).reduceMotion(ReduceMotion.System)}
      layout={layout ? LinearTransition.duration(dur.nav).easing(ease.inOut) : undefined}>
      {children}
    </Animated.View>
  );
}

/** Smoothly re-flow siblings when one appears/disappears/resizes between them. */
export function FlowTransition({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View style={style} layout={LinearTransition.duration(dur.nav).easing(ease.inOut)}>
      {children}
    </Animated.View>
  );
}

/**
 * Dimmable — eases opacity between full and a dimmed value when an enabled/busy
 * state flips, so a control never snaps from active to disabled. Wrap the content
 * INSIDE a PressableScale (whose own animated opacity would otherwise override a
 * static dim on its style).
 */
export function Dimmable({
  active,
  dim = 0.45,
  children,
  style,
}: {
  active: boolean;
  dim?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const o = useSharedValue(active ? 1 : dim);
  useEffect(() => {
    o.value = reduced ? (active ? 1 : dim) : withTiming(active ? 1 : dim, { duration: dur.press, easing: ease.press });
  }, [active, dim, reduced, o]);
  const s = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[style, s]}>{children}</Animated.View>;
}

/**
 * SwapText — when a displayed value changes, dip the current text to 0, swap it,
 * then ease the new text back in. No layout overlap (single node), so numbers,
 * prices, labels and status strings morph instead of teleporting. Pass `trigger`
 * as the value that signals a change (usually the string/number itself).
 */
export function SwapText({
  trigger,
  children,
  style,
}: {
  trigger: string | number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const o = useSharedValue(1);
  const [shown, setShown] = useState<ReactNode>(children);
  const latest = useRef<ReactNode>(children);
  latest.current = children;
  const first = useRef(true);
  const commit = () => setShown(latest.current);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) {
      commit();
      return;
    }
    o.value = withTiming(0, { duration: dur.exit, easing: ease.press }, (finished) => {
      'worklet';
      if (finished) {
        runOnJS(commit)();
        o.value = withTiming(1, { duration: dur.nav, easing: ease.out });
      }
    });
    // Intentionally keyed only on `trigger`: `children` is read live via the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, reduced]);

  const s = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[style, s]}>{shown}</Animated.View>;
}

/**
 * SelectionOverlay — an absolutely-positioned layer carrying the ACTIVE look
 * (fill / border / tint) that fades in over a parent styled with the resting
 * look. Drop it in as the first child of a relatively-positioned container so a
 * selection change eases instead of snapping. Pointer events pass through to the
 * parent's own press handler.
 */
export function SelectionOverlay({
  active,
  style,
  duration = dur.press,
}: {
  active: boolean;
  style?: StyleProp<ViewStyle>;
  duration?: number;
}) {
  const reduced = useReducedMotion();
  const p = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    p.value = reduced ? (active ? 1 : 0) : withTiming(active ? 1 : 0, { duration, easing: ease.press });
  }, [active, reduced, duration, p]);
  const s = useAnimatedStyle(() => ({ opacity: p.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style, s]} />;
}

/**
 * Crossfade — dissolve between two states (e.g. lock ↔ play glyph, day-number ↔
 * check, muted ↔ accent label) instead of hard-swapping. Both children are
 * stacked and centered in a FIXED-SIZE container (the caller sets width/height on
 * `style`); `front` shows when `active`, `back` otherwise.
 */
export function Crossfade({
  active,
  front,
  back,
  style,
  duration = dur.press,
}: {
  active: boolean;
  front: ReactNode;
  back: ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
}) {
  const reduced = useReducedMotion();
  const p = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    p.value = reduced ? (active ? 1 : 0) : withTiming(active ? 1 : 0, { duration, easing: ease.press });
  }, [active, reduced, duration, p]);
  const fs = useAnimatedStyle(() => ({ opacity: p.value }));
  const bs = useAnimatedStyle(() => ({ opacity: 1 - p.value }));
  const fill: ViewStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  };
  return (
    <View style={style}>
      <Animated.View pointerEvents="none" style={[fill, bs]}>
        {back}
      </Animated.View>
      <Animated.View pointerEvents="none" style={[fill, fs]}>
        {front}
      </Animated.View>
    </View>
  );
}
