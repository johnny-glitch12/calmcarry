import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Platform, Pressable, View, type ViewStyle } from 'react-native';
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
 * PrimaryButton — brand-sage pill. Press feedback: scale 0.97 + Haptics Impact
 * Light, ease-out 140ms, no ripple (DESIGN_SYSTEM §4). Renders in both themes.
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
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  // Press IN dips quickly (eased); release SETTLES on a soft spring so the button
  // breathes back rather than snapping — a calmer, more soothing tap.
  const press = (to: number) => {
    if (reduced) {
      scale.value = to;
      return;
    }
    scale.value =
      to < 1
        ? withTiming(to, { duration: dur.press, easing: ease.out })
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
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[fullWidth && { alignSelf: 'stretch' }, style]}>
      <Animated.View
        style={[
          animStyle,
          {
            height: 56,
            borderRadius: 8, // build plan §16: buttons are full-width, 8px corners
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: p.bg,
            borderWidth: variant === 'secondary' ? 1 : 0,
            borderColor: p.border,
            opacity: disabled ? 0.45 : 1,
          },
          variant === 'primary' ? c.shadow : null,
        ]}>
        {loading ? (
          <ActivityIndicator color={p.fg} />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <AppText style={[type.button, { color: p.fg }]}>{label}</AppText>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}
