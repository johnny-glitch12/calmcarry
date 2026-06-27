import { Text, View, type ViewStyle } from 'react-native';

import { brand, fonts, useTheme } from '@/theme';

type Size = 'sm' | 'md' | 'lg';

// Per-size metrics for the stacked "calm / CARRY" lockup. "calm" is the dominant
// baseline (Montserrat ExtraBold, slightly tightened); "CARRY" is an airy
// letter-spaced kicker in Poppins SemiBold, echoing our type.caption DNA.
const S: Record<
  Size,
  { calm: number; calmLH: number; calmLS: number; carry: number; carryLH: number; carryLS: number; reg: number; gap: number; shiftX: number }
> = {
  sm: { calm: 26, calmLH: 28, calmLS: -0.4, carry: 9, carryLH: 11, carryLS: 3.0, reg: 8, gap: 1, shiftX: 1.5 },
  md: { calm: 36, calmLH: 38, calmLS: -0.6, carry: 12, carryLH: 14, carryLS: 4.0, reg: 11, gap: 2, shiftX: 2.0 },
  lg: { calm: 50, calmLH: 52, calmLS: -0.8, carry: 16, carryLH: 18, carryLS: 5.5, reg: 15, gap: 3, shiftX: 2.75 },
};

/**
 * The CalmCarry brand lockup — a crisp, theme-tinted TEXT wordmark we fully
 * control (razor-sharp at any size, tints per theme): bold rounded lowercase
 * "calm" with a small registered mark, stacked over a letter-spaced "CARRY"
 * kicker. Tinted deep-eucalyptus on light, luminous glow on night. The ® is a
 * flex-aligned superscript (no inline transform — that wouldn't lift on web).
 * Single accessibilityLabel "CalmCarry"; the mark is exempt from Dynamic Type.
 */
export function Logo({
  size = 'md',
  tagline = false,
  style,
}: {
  size?: Size;
  tagline?: boolean;
  style?: ViewStyle;
}) {
  const { isNight } = useTheme();
  const s = S[size];
  // text-safe accent (WCAG AA): deep teal by day, luminous glow by night
  const ink = isNight ? '#8FC9BE' : brand.teal;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel="CalmCarry" style={[{ alignItems: 'center' }, style]}>
      {/* "calm" + superscript ® — flex-start so the small ® hangs at the cap top */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Text
          allowFontScaling={false}
          importantForAccessibility="no-hide-descendants"
          style={{ fontFamily: fonts.logoMark, fontSize: s.calm, lineHeight: s.calmLH, letterSpacing: s.calmLS, color: ink }}>
          calm
        </Text>
        <Text
          allowFontScaling={false}
          importantForAccessibility="no-hide-descendants"
          style={{
            fontFamily: fonts.regular,
            fontSize: s.reg,
            lineHeight: s.reg,
            color: ink,
            opacity: isNight ? 0.6 : 0.55,
            marginLeft: 1,
            marginTop: Math.round(s.calm * 0.08),
          }}>
          ®
        </Text>
      </View>

      {/* "CARRY" kicker — letter-spaced caps, optically re-centered for the trailing track */}
      <Text
        allowFontScaling={false}
        importantForAccessibility="no-hide-descendants"
        style={{
          fontFamily: fonts.semibold,
          fontSize: s.carry,
          lineHeight: s.carryLH,
          letterSpacing: s.carryLS,
          color: ink,
          marginTop: s.gap,
          transform: [{ translateX: s.shiftX }],
        }}>
        CARRY
      </Text>

      {tagline ? (
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: fonts.semibold,
            fontSize: 11,
            lineHeight: 14,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            marginTop: 6,
            color: isNight ? brand.sage : brand.sageHover,
          }}>
          BY THE GLOW COMPANY
        </Text>
      ) : null}
    </View>
  );
}
