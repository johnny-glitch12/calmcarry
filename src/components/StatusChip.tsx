import { Feather } from '@expo/vector-icons';
import { useEffect } from 'react';
import { type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { brand, dur, ease, type, useTheme } from '@/theme';

import { AppText } from './AppText';

type Tone = 'sage' | 'neutral' | 'alert';

type Props = {
  label: string;
  icon?: keyof typeof Feather.glyphMap;
  tone?: Tone;
  /** settle in (scale 0.95→1 + opacity 0→1) - the authenticity confirm peak */
  confirm?: boolean;
  style?: ViewStyle;
};

/**
 * StatusChip - small pill (sage shield-check / sparkle). One outline icon
 * family (Feather), no emoji (§7). Reads in both themes.
 */
export function StatusChip({ label, icon = 'shield', tone = 'sage', confirm = false, style }: Props) {
  const { c, isNight } = useTheme();
  const reduced = useReducedMotion();

  const o = useSharedValue(confirm && !reduced ? 0 : 1);
  const s = useSharedValue(confirm && !reduced ? 0.95 : 1);

  useEffect(() => {
    if (confirm && !reduced) {
      o.value = withTiming(1, { duration: dur.sheet, easing: ease.out });
      s.value = withTiming(1, { duration: dur.sheet, easing: ease.out });
    }
  }, [confirm, reduced, o, s]);

  const animStyle = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: s.value }] }));

  const tones: Record<Tone, { bg: string; fg: string; border: string }> = {
    sage: {
      bg: isNight ? 'rgba(143,201,190,0.12)' : brand.mintSoft,
      fg: isNight ? c.accent : brand.teal,
      border: c.lineSage,
    },
    neutral: {
      bg: isNight ? c.surface : 'rgba(72,84,83,0.06)',
      fg: c.muted,
      border: c.line,
    },
    alert: {
      bg: 'rgba(239,98,108,0.12)',
      fg: c.danger, // AA-safe per theme (see colors.ts)
      border: 'rgba(239,98,108,0.30)',
    },
  };
  const t = tones[tone];

  return (
    <Animated.View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          minHeight: 30, // grow (not clip) if the label scales with Dynamic Type
          paddingVertical: 6,
          paddingHorizontal: 12,
          borderRadius: 15,
          backgroundColor: t.bg,
          borderWidth: 1,
          borderColor: t.border,
          gap: 6,
        },
        animStyle,
        style,
      ]}>
      {icon ? <Feather name={icon} size={13} color={t.fg} /> : null}
      <AppText numberOfLines={1} style={[type.label, { color: t.fg }]}>{label}</AppText>
    </Animated.View>
  );
}
