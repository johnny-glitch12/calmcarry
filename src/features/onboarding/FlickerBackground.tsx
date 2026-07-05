import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * FlickerBackground — a soft, living firelight wash for the onboarding welcome.
 * Two warm embers glow with a RADIAL fade (soft edges, real firelight — not hard
 * discs) and flicker at slightly different, gentle cadences so the screen feels
 * alive like candlelight without ever strobing. Warm amber over the
 * night-eucalyptus base stays on palette. Reduced motion → the glows sit still.
 * Opacity only.
 */
function useFlicker(base: number, span: number, up: number, down: number) {
  const reduced = useReducedMotion();
  const v = useSharedValue(base);
  useEffect(() => {
    if (reduced) {
      v.value = base;
      return;
    }
    v.value = withRepeat(
      withSequence(
        withTiming(base + span, { duration: up, easing: Easing.inOut(Easing.sin) }),
        withTiming(base, { duration: down, easing: Easing.inOut(Easing.sin) }),
        withTiming(base + span * 0.55, { duration: up * 1.4, easing: Easing.inOut(Easing.sin) }),
        withTiming(base, { duration: down * 0.8, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    return () => {
      v.value = base;
    };
  }, [reduced, v, base, span, up, down]);
  return v;
}

function Ember({
  id,
  size,
  color,
  peak,
  style,
  flicker,
}: {
  id: string;
  size: number;
  color: string;
  peak: number;
  style: ViewStyle;
  flicker: { base: number; span: number; up: number; down: number };
}) {
  const v = useFlicker(flicker.base, flicker.span, flicker.up, flicker.down);
  const anim = useAnimatedStyle(() => ({ opacity: v.value }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, style, anim]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={peak} />
            <Stop offset="0.6" stopColor={color} stopOpacity={peak * 0.4} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={size} height={size} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

export function FlickerBackground() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* main hearth glow, low and to the left */}
      <Ember
        id="emberA"
        size={520}
        color="#C9784A"
        peak={0.36}
        style={{ left: -150, bottom: -170 }}
        flicker={{ base: 0.55, span: 0.32, up: 1300, down: 1700 }}
      />
      {/* a second flame catching higher-right, on its own beat */}
      <Ember
        id="emberB"
        size={420}
        color="#B58A5E"
        peak={0.26}
        style={{ right: -150, top: -30 }}
        flicker={{ base: 0.45, span: 0.28, up: 2100, down: 1500 }}
      />
    </View>
  );
}
