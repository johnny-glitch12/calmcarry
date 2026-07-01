import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { brand, ease, night, ThemeProvider, themes, useColorSchemePref, type ThemeMode } from '@/theme';

type Props = {
  mode?: ThemeMode;
  scroll?: boolean;
  children: ReactNode;
  contentStyle?: ViewStyle;
  /** full-screen layer rendered ABOVE the body (e.g. the wind-down dim scrim) */
  overlay?: ReactNode;
  /** bottom inset so content clears the floating tab bar */
  tabBarSpacing?: boolean;
};

/** A slow-oscillating soft "blob" for atmosphere (§3) — sage at night, a barely
 *  perceptible mint by day. Translate-only, reduced-motion gated. */
function DriftBlob({
  size,
  color,
  top,
  left,
  delay = 0,
  range = 26,
  duration = 20000,
  opacity = 0.1,
}: {
  size: number;
  color: string;
  top: number;
  left: number;
  delay?: number;
  range?: number;
  duration?: number;
  opacity?: number;
}) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    // phase-offset the start via withDelay (not by inflating the loop duration)
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: ease.inOut }), -1, true));
    return () => cancelAnimation(t);
  }, [reduced, t, delay, duration]);
  const style = useAnimatedStyle(() => ({
    // drift + a slow opacity "breathe" so the ambient field feels alive, not static
    opacity: opacity * (0.62 + 0.38 * t.value),
    transform: [
      { translateX: (t.value - 0.5) * range },
      { translateY: (t.value - 0.5) * range * 0.7 },
    ],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', top, left }, style]}>
      <View
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }}
      />
    </Animated.View>
  );
}

/** A single floating "mote" — a tiny dot that drifts slowly upward and fades
 *  in/out, like dust in still light. Night-screen depth, transform/opacity only. */
function Mote({ leftPct, top, size, dur, delay }: { leftPct: number; top: number; size: number; dur: number; delay: number }) {
  const reduced = useReducedMotion();
  const m = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    m.value = withDelay(delay, withRepeat(withTiming(1, { duration: dur, easing: ease.sine }), -1, false));
    return () => cancelAnimation(m);
  }, [reduced, m, dur, delay]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -m.value * 60 }],
    // triangle fade: in over first half, out over second — kept low so the brightest
    // mote stays sub-perceptual on the night base (no high-contrast moving dot)
    opacity: (m.value < 0.5 ? m.value * 2 : (1 - m.value) * 2) * 0.32,
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', top, left: `${leftPct}%`, width: size, height: size, borderRadius: size / 2, backgroundColor: night.glow },
        style,
      ]}
    />
  );
}

// Four slow motes (was six) — thins the always-moving field on the sleep screen by a
// third with no loss of the "living atmosphere"; the slowest durations dominate.
const MOTES = [
  { leftPct: 28, top: 420, size: 2, dur: 18000, delay: 4000 },
  { leftPct: 63, top: 540, size: 2, dur: 19000, delay: 2000 },
  { leftPct: 78, top: 240, size: 3, dur: 17000, delay: 6000 },
  { leftPct: 88, top: 460, size: 2, dur: 20000, delay: 10000 },
];

function Motes() {
  return (
    <>
      {MOTES.map((mo, i) => (
        <Mote key={i} {...mo} />
      ))}
    </>
  );
}

/**
 * Screen — the foundation. Sets the per-screen theme and paints the
 * atmospheric background: a soft mint wash on light, a deep-eucalyptus gradient
 * with drifting sage blobs on night (DESIGN_SYSTEM §3). Gradients are
 * background-only, never on every card (§7).
 */
export function Screen({ mode = 'light', scroll, children, contentStyle, overlay, tabBarSpacing }: Props) {
  // Sleep screens force 'night'; everything else is ADAPTIVE — follows the
  // user's appearance preference (light by day, or dark when dark mode is on).
  const { effective } = useColorSchemePref();
  const resolved: ThemeMode = mode === 'night' ? 'night' : effective;
  const c = themes[resolved];
  const isNight = resolved === 'night';
  const padBottom = tabBarSpacing ? 108 : 24;

  // Top clearance: the real device inset (notch / Dynamic Island / camera) plus a
  // calm floor so no-notch devices and in-browser views still breathe. We own the
  // top padding here (not via a SafeAreaView 'top' edge) so a screen's own
  // contentStyle.paddingTop can't accidentally erase the camera clearance.
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, 12) + 8;

  const body = (
    <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
      {/* lift content above the on-screen keyboard so inputs + submit buttons stay visible */}
      <KeyboardAvoidingView
        style={{ flex: 1, paddingTop: topInset }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerStyle={[
              { paddingHorizontal: 24, paddingTop: 0, paddingBottom: padBottom },
              contentStyle,
            ]}>
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1, paddingHorizontal: 24, paddingTop: 0 }, contentStyle]}>
            {children}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  return (
    <ThemeProvider mode={resolved}>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <StatusBar style={isNight ? 'light' : 'dark'} />
        {/* atmospheric background */}
        <LinearGradient
          colors={isNight ? ['#162422', '#0E1817'] : [c.wash, c.bg]}
          locations={isNight ? [0, 1] : [0, 0.38]}
          style={StyleSheet.absoluteFill}
        />
        {isNight ? (
          <>
            <DriftBlob size={260} color="#8FC9BE" top={-40} left={-60} range={28} />
            <DriftBlob size={200} color="#6FB4A8" top={320} left={220} delay={3000} range={22} />
            <DriftBlob size={160} color="#5E9C92" top={560} left={-40} delay={6000} range={18} />
            <Motes />
          </>
        ) : (
          // barely-perceptible daytime drift so light mode isn't motion-dead (§7: atmosphere only)
          <>
            <DriftBlob
              size={300}
              color={brand.mint}
              top={-80}
              left={-90}
              range={22}
              duration={26000}
              opacity={0.05}
            />
            <DriftBlob
              size={220}
              color={brand.mintSoft}
              top={120}
              left={210}
              delay={4000}
              range={18}
              duration={28000}
              opacity={0.045}
            />
          </>
        )}
        {body}
        {overlay}
      </View>
    </ThemeProvider>
  );
}
