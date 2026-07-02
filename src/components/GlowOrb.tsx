import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { dur, ease, useTheme } from '@/theme';

type Props = {
  size?: number;
  /** breathing loop (scale 1→1.06 + glow 0.85→1.0); static under reduced motion */
  breathing?: boolean;
  /** one-shot bloom (scale 1→1.08→1 + glow bloom) — the authenticity "burst" peak */
  burst?: boolean;
  /** reserve the full glow footprint (1.6× size) in layout so the halo never
   *  bleeds over adjacent text. Use in centered column layouts. */
  reserveGlow?: boolean;
  /** slow sonar-like ripples that emanate from the orb — quietly "alive" */
  aura?: boolean;
  children?: ReactNode;
  style?: ViewStyle;
};

/**
 * GlowOrb — the signature element (device avatar / player art / timer center /
 * auth burst). Soft mint sphere by day, luminous sage glow by night.
 * Breathing: scale 1.0→1.06 + glow opacity 0.85→1.0, withRepeat 4000ms sine.
 * burst: a single 1.0→1.08→1.0 bloom for the authenticity peak.
 * DESIGN_SYSTEM §4. Animates transform + opacity only, on the UI thread.
 */
export function GlowOrb({
  size = 160,
  breathing = true,
  burst = false,
  reserveGlow = false,
  aura = false,
  children,
  style,
}: Props) {
  const { c, isNight } = useTheme();
  const reduced = useReducedMotion();

  const scale = useSharedValue(1);
  const glow = useSharedValue(0.85);
  const auraV = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      scale.value = 1;
      glow.value = 1;
      return;
    }
    if (burst) {
      // one-shot bloom (enter), then settle faster (exit) — never repeats
      scale.value = withSequence(
        withTiming(1.08, { duration: dur.modal, easing: ease.out }),
        withTiming(1, { duration: dur.sheet, easing: ease.inOut })
      );
      glow.value = withSequence(
        withTiming(1, { duration: dur.modal, easing: ease.out }),
        withTiming(0.9, { duration: dur.sheet, easing: ease.inOut })
      );
    } else if (breathing) {
      // re-anchor the floor so the loop always bounces 0.85↔1.0 (e.g. after a burst)
      glow.value = 0.85;
      scale.value = withRepeat(
        withTiming(1.06, { duration: dur.breath, easing: ease.sine }),
        -1,
        true
      );
      glow.value = withRepeat(
        withTiming(1, { duration: dur.breath, easing: ease.sine }),
        -1,
        true
      );
    } else {
      scale.value = withTiming(1, { duration: dur.sheet, easing: ease.out });
      glow.value = withTiming(1, { duration: dur.sheet, easing: ease.out });
    }
    return () => {
      cancelAnimation(scale);
      cancelAnimation(glow);
    };
  }, [breathing, burst, reduced, scale, glow]);

  // emanating aura ripples (two staggered rings expanding + fading out)
  useEffect(() => {
    if (aura && !reduced) {
      // reverse (true) so it breathes in-and-out rather than snapping back each cycle
      auraV.value = withRepeat(withTiming(1, { duration: dur.aura, easing: ease.out }), -1, true);
    } else {
      auraV.value = 0;
    }
    return () => cancelAnimation(auraV);
  }, [aura, reduced, auraV]);

  const sphereStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  // low-amplitude (≤0.35 scale travel, ≤0.18 opacity) so it reads as a faint settling
  // halo, not an attention-grabbing sonar pulse
  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: 0.92 + auraV.value * 0.35 }],
    opacity: (1 - auraV.value) * 0.18,
  }));
  const ring2Style = useAnimatedStyle(() => {
    const p = (auraV.value + 0.5) % 1;
    return { transform: [{ scale: 0.92 + p * 0.35 }], opacity: (1 - p) * 0.18 };
  });

  // Sphere sheen: lighter top-left → accent bottom-right gives a lit-from-above sphere.
  // Night dims to the orb/glow token (#8FC9BE) → deeper sage so the sphere is no
  // longer the brightest object in the app when stared at while falling asleep.
  const sphereColors: [string, string] = isNight
    ? ['#8FC9BE', '#4E837A']
    : ['#EAF5F2', c.accent];
  const haloColor = c.accent;
  const haloSize = size * 1.6;
  // reserve the full glow footprint so the halo can't overlap adjacent text
  const box = reserveGlow ? haloSize : size;

  return (
    <View style={[{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }, style]}>
      {/* glow halo behind the sphere */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            alignItems: 'center',
            justifyContent: 'center',
          },
          haloStyle,
        ]}>
        <View
          style={{
            width: haloSize,
            height: haloSize,
            borderRadius: haloSize / 2,
            backgroundColor: haloColor,
            opacity: isNight ? 0.2 : 0.16,
          }}
        />
      </Animated.View>

      {/* emanating aura ripples */}
      {aura
        ? [ring1Style, ring2Style].map((rStyle, idx) => (
            <Animated.View
              key={idx}
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { alignItems: 'center', justifyContent: 'center' },
                rStyle,
              ]}>
              <View
                style={{
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  borderWidth: 1.5,
                  borderColor: c.accent,
                }}
              />
            </Animated.View>
          ))
        : null}

      {/* the sphere */}
      <Animated.View style={sphereStyle}>
        <LinearGradient
          colors={sphereColors}
          start={{ x: 0.2, y: 0.15 }}
          end={{ x: 0.85, y: 0.95 }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {/* top-left specular highlight */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: size * 0.16,
              left: size * 0.18,
              width: size * 0.3,
              height: size * 0.3,
              borderRadius: size * 0.15,
              backgroundColor: '#FFFFFF',
              opacity: isNight ? 0.1 : 0.35,
            }}
          />
          {children}
        </LinearGradient>
      </Animated.View>
    </View>
  );
}
