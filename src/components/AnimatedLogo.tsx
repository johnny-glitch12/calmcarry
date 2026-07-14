import { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';

import { brand, dur, fonts, night, useTheme } from '@/theme';
import { GlowOrb } from './GlowOrb';

type Size = 'md' | 'lg';

// Metrics mirror the static Logo lockup so the two are visually interchangeable.
const S: Record<
  Size,
  { calm: number; calmLH: number; calmLS: number; carry: number; carryLH: number; carryLS: number; reg: number; gap: number; orb: number }
> = {
  md: { calm: 36, calmLH: 38, calmLS: -0.6, carry: 12, carryLH: 14, carryLS: 4.0, reg: 11, gap: 2, orb: 86 },
  lg: { calm: 50, calmLH: 52, calmLS: -0.8, carry: 16, carryLH: 18, carryLS: 5.5, reg: 15, gap: 3, orb: 120 },
};

// Whole-reveal length. The wordmark lands by ~TOTAL; the orb keeps breathing after.
// Functional cadence for the signature reveal timeline - intentionally hardcoded,
// not a dur.* token (it is the master clock the glyph windows are cut from).
const TOTAL = 2200;
// Beat-hold on the settled lockup before handing off - a designed pause so the
// brand registers. Functional cadence, intentionally hardcoded (no dur.* token).
const HOLD = 650;

// smoothstep - a gentle, worklet-safe ease (3t²−2t³); calmer than linear, no mid snap.
function smoothstep(x: number): number {
  'worklet';
  const t = x < 0 ? 0 : x > 1 ? 1 : x;
  return t * t * (3 - 2 * t);
}
// local progress of one element over its [start,end] window of the master timeline
function win(p: number, start: number, end: number): number {
  'worklet';
  return smoothstep((p - start) / (end - start));
}

/** One revealing glyph: fades up while sliding from an offset, on the UI thread. */
function Glyph({
  p,
  start,
  end,
  fromY = 0,
  fromX = 0,
  scaleFrom = 1,
  style,
  text,
}: {
  p: SharedValue<number>;
  start: number;
  end: number;
  fromY?: number;
  fromX?: number;
  scaleFrom?: number;
  style: object;
  text: string;
}) {
  const aStyle = useAnimatedStyle(() => {
    const l = win(p.value, start, end);
    return {
      opacity: l,
      transform: [
        { translateX: (1 - l) * fromX },
        { translateY: (1 - l) * fromY },
        { scale: scaleFrom + (1 - scaleFrom) * l },
      ],
    };
  });
  return (
    <Animated.Text allowFontScaling={false} importantForAccessibility="no-hide-descendants" style={[style, aStyle]}>
      {text}
    </Animated.Text>
  );
}

/**
 * AnimatedLogo - the CalmCarry signature brand reveal. The GlowOrb blooms on and
 * settles into its breathing loop; "calm" rises in letter by letter; the ® pops;
 * and "CARRY" exhales - its letters start compressed toward the centre and spread
 * out to their airy track (pure translateX, so it stays buttery on the UI thread).
 * Transform + opacity only. Reduced motion shows the final lockup instantly.
 *
 * Reusable as an onboarding hero or, full-screen, as the launch BrandSplash.
 */
export function AnimatedLogo({
  size = 'lg',
  withOrb = true,
  tagline = false,
  onDone,
  style,
}: {
  size?: Size;
  withOrb?: boolean;
  tagline?: boolean;
  onDone?: () => void;
  style?: ViewStyle;
}) {
  const { isNight } = useTheme();
  const reduced = useReducedMotion();
  const s = S[size];
  const ink = isNight ? night.glow : brand.teal;

  const p = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      p.value = 1;
      // reduced motion: show the final lockup for one token beat, then hand off
      const t = setTimeout(() => onDone?.(), dur.modal);
      return () => clearTimeout(t);
    }
    // Master timeline driver: linear ON PURPOSE (sanctioned exception) - each
    // glyph eases inside its own smoothstep window via win(), so easing the
    // clock itself would compound curves and skew the cascade rhythm.
    p.value = withTiming(1, { duration: TOTAL, easing: Easing.linear });
    const t = setTimeout(() => onDone?.(), TOTAL + HOLD);
    return () => clearTimeout(t);
  }, [reduced, p, onDone]);

  // orb bloom over the first third of the timeline
  const orbStyle = useAnimatedStyle(() => {
    const l = win(p.value, 0, 0.32);
    return { opacity: l, transform: [{ scale: 0.86 + 0.14 * l }] };
  });

  const calmStyle = {
    fontFamily: fonts.logoMark,
    fontSize: s.calm,
    lineHeight: s.calmLH,
    letterSpacing: s.calmLS,
    color: ink,
  } as const;
  const carryStyle = {
    fontFamily: fonts.semibold,
    fontSize: s.carry,
    lineHeight: s.carryLH,
    color: ink,
  } as const;

  const CALM = ['c', 'a', 'l', 'm'];
  const CARRY = ['C', 'A', 'R', 'R', 'Y'];
  // start each CARRY letter pulled toward the row centre (index 2), then release to 0
  const SPREAD = s.carry * 0.9;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="CalmCarry"
      style={[{ alignItems: 'center' }, style]}>
      {withOrb ? (
        <Animated.View style={[{ marginBottom: s.calm * 0.42 }, orbStyle]}>
          <GlowOrb size={s.orb} breathing aura />
        </Animated.View>
      ) : null}

      {/* "calm" + superscript ® */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        {CALM.map((ch, i) => (
          <Glyph
            key={i}
            text={ch}
            p={p}
            start={0.2 + i * 0.06}
            end={0.5 + i * 0.06}
            fromY={s.calm * 0.28}
            style={calmStyle}
          />
        ))}
        <Glyph
          text="®"
          p={p}
          start={0.56}
          end={0.8}
          scaleFrom={0.5}
          style={{
            fontFamily: fonts.regular,
            fontSize: s.reg,
            lineHeight: s.reg,
            color: ink,
            opacity: isNight ? 0.6 : 0.55,
            marginLeft: 1,
            marginTop: Math.round(s.calm * 0.08),
          }}
        />
      </View>

      {/* "CARRY" kicker - letters exhale outward into their track */}
      <View style={{ flexDirection: 'row', marginTop: s.gap }}>
        {CARRY.map((ch, i) => (
          <Glyph
            key={i}
            text={ch}
            p={p}
            start={0.5 + i * 0.05}
            end={0.82 + i * 0.045}
            fromX={(2 - i) * SPREAD}
            style={[carryStyle, { marginRight: i < CARRY.length - 1 ? s.carryLS : 0 }]}
          />
        ))}
      </View>

      {tagline ? (
        <Glyph
          text="BY THE GLOW COMPANY"
          p={p}
          start={0.84}
          end={1}
          fromY={6}
          style={{
            fontFamily: fonts.semibold,
            fontSize: 11,
            lineHeight: 14,
            letterSpacing: 1.2,
            marginTop: 6,
            color: isNight ? brand.sage : brand.sageHover,
          }}
        />
      ) : null}
    </View>
  );
}
