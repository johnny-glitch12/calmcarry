import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, Pressable, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { dur, ease, PRESS_SCALE, spring, type, useTheme } from '@/theme';

import { AppText } from './AppText';

type Variant = 'primary' | 'secondary' | 'ghost';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
};

/**
 * PrimaryButton - brand-sage pill. Press feedback: scale 0.97 + Haptics Impact
 * Light, ease.press dur.press, no ripple (DESIGN_SYSTEM §4). Renders in both themes.
 */
export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = true,
  style,
}: Props) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  // Disabled dim and the label↔spinner swap are animated so entering/leaving the
  // disabled or busy state fades instead of snapping.
  const dim = useSharedValue(disabled ? 0.45 : 1);
  const l = useSharedValue(loading ? 1 : 0);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: dim.value }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: 1 - l.value }));
  const spinnerStyle = useAnimatedStyle(() => ({ opacity: l.value }));

  useEffect(() => {
    dim.value = reduced ? (disabled ? 0.45 : 1) : withTiming(disabled ? 0.45 : 1, { duration: dur.press, easing: ease.press });
  }, [disabled, reduced, dim]);

  useEffect(() => {
    l.value = reduced ? (loading ? 1 : 0) : withTiming(loading ? 1 : 0, { duration: dur.exit, easing: ease.press });
  }, [loading, reduced, l]);

  // Press IN dips quickly (eased); release SETTLES on a soft spring so the button
  // breathes back rather than snapping - a calmer, more soothing tap.
  const press = (to: number) => {
    if (reduced) {
      scale.value = to;
      return;
    }
    scale.value =
      to < 1
        ? withTiming(to, { duration: dur.press, easing: ease.press })
        : withSpring(1, spring);
  };

  const onIn = () => {
    press(PRESS_SCALE);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const palette: Record<Variant, { bg: string; border: string; fg: string }> = {
    primary: { bg: c.ctaBg, border: 'transparent', fg: c.ctaText },
    secondary: { bg: c.surface, border: c.lineSage, fg: c.textAccent },
    ghost: { bg: 'transparent', border: 'transparent', fg: c.textAccent },
  };
  const p = palette[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={inactive ? undefined : onPress}
      onPressIn={inactive ? undefined : onIn}
      onPressOut={() => press(1)}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[fullWidth && { alignSelf: 'stretch' }, style]}>
      <Animated.View
        style={[
          animStyle,
          {
            // minHeight, not height: at large accessibility text sizes the label
            // grows and a fixed box would clip it (Android clips by default)
            minHeight: 56,
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 8, // build plan §16: buttons are full-width, 8px corners
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: p.bg,
            borderWidth: variant === 'secondary' ? 1 : 0,
            borderColor: p.border,
          },
          variant === 'primary' ? c.shadow : null,
        ]}>
        <Animated.View style={[{ flexDirection: 'row', alignItems: 'center' }, labelStyle]}>
          <AppText style={[type.button, { color: p.fg }]}>{label}</AppText>
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }, spinnerStyle]}>
          <ActivityIndicator color={p.fg} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}
