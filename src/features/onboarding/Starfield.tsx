import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

/**
 * Starfield — literal white star lights that twinkle over the night sky. Each
 * star fades between a dim and a bright opacity on its own gentle cadence (with a
 * randomised delay) so they flicker independently, like a real sky — never a
 * synchronised strobe. Reduced motion → the stars hold at a steady glow. Layout is
 * computed ONCE at module load (deterministic pseudo-random), never during render.
 */
type Star = { x: number; y: number; size: number; base: number; peak: number; dur: number; delay: number; halo: boolean };

function makeStars(n: number): Star[] {
  // deterministic LCG so the sky is identical every mount and there's no impure
  // Math.random() in the render path
  let seed = 20260706;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const stars: Star[] = [];
  for (let i = 0; i < n; i++) {
    const big = rnd() > 0.86;
    stars.push({
      x: rnd() * 100,
      y: rnd() * 100,
      size: big ? 2.6 + rnd() * 1.6 : 1 + rnd() * 1.4,
      base: 0.1 + rnd() * 0.18,
      peak: 0.65 + rnd() * 0.33,
      dur: 900 + rnd() * 1700,
      delay: rnd() * 2400,
      halo: big,
    });
  }
  return stars;
}

const STARS = makeStars(52);

function StarDot({ s }: { s: Star }) {
  const reduced = useReducedMotion();
  const rest = (s.base + s.peak) / 2;
  const o = useSharedValue(reduced ? rest : s.base);
  useEffect(() => {
    if (reduced) {
      o.value = rest;
      return;
    }
    o.value = withDelay(
      s.delay,
      withRepeat(
        withSequence(
          withTiming(s.peak, { duration: s.dur, easing: Easing.inOut(Easing.sin) }),
          withTiming(s.base, { duration: s.dur * 1.25, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
    return () => {
      o.value = s.base;
    };
  }, [reduced, o, rest, s]);

  const anim = useAnimatedStyle(() => ({ opacity: o.value }));
  const haloAnim = useAnimatedStyle(() => ({ opacity: o.value * 0.28 }));

  return (
    <>
      {s.halo ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size * 4,
              height: s.size * 4,
              marginLeft: -s.size * 1.5,
              marginTop: -s.size * 1.5,
              borderRadius: s.size * 2,
              backgroundColor: '#FFFFFF',
            },
            haloAnim,
          ]}
        />
      ) : null}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            borderRadius: s.size / 2,
            backgroundColor: '#FFFFFF',
          },
          anim,
        ]}
      />
    </>
  );
}

export function Starfield() {
  const reduced = useReducedMotion();
  // the whole sky drifts gently — a slow, low-amplitude sway (X and Y on different
  // long periods so it never looks like a straight slide). Twinkle rides on top.
  const sx = useSharedValue(-6);
  const sy = useSharedValue(-4);
  useEffect(() => {
    if (reduced) {
      sx.value = 0;
      sy.value = 0;
      return;
    }
    sx.value = withRepeat(withTiming(6, { duration: 9000, easing: Easing.inOut(Easing.sin) }), -1, true);
    sy.value = withRepeat(withTiming(4, { duration: 13000, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => {
      sx.value = 0;
      sy.value = 0;
    };
  }, [reduced, sx, sy]);
  const sway = useAnimatedStyle(() => ({ transform: [{ translateX: sx.value }, { translateY: sy.value }] }));

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, sway]}>
      {STARS.map((s, i) => (
        <StarDot key={i} s={s} />
      ))}
    </Animated.View>
  );
}
