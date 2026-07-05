import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { brand, dur, ease, type as typeScale, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Appear, Crossfade } from './anim';

type Props = {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  icon?: keyof typeof Feather.glyphMap;
  error?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  secureTextEntry?: boolean;
};

/**
 * FormField (DESIGN_SYSTEM §6) — labelled text input with an animated sage
 * focus ring (line→accent over dur.press), error state in coral, optional
 * leading icon, multiline. Renders in both light + night themes.
 */
export function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  error,
  multiline = false,
  keyboardType,
  autoCapitalize = 'sentences',
  autoComplete,
  secureTextEntry,
}: Props) {
  const { c, isNight } = useTheme();
  const reduced = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const f = useSharedValue(0);
  // Error is its own animated axis so flipping into/out of the error state blends
  // (line/accent ↔ coral) instead of the ring color snapping in one frame.
  const err = useSharedValue(error ? 1 : 0);

  useEffect(() => {
    err.value = reduced ? (error ? 1 : 0) : withTiming(error ? 1 : 0, { duration: dur.press, easing: ease.press });
  }, [error, reduced, err]);

  const ringStyle = useAnimatedStyle(() => {
    const focusColor = interpolateColor(f.value, [0, 1], [c.line, c.accent]);
    return { borderColor: interpolateColor(err.value, [0, 1], [focusColor, brand.coral]) };
  });

  const iconActive = !!error || focused;
  const iconActiveColor = error ? brand.coral : c.accent;

  return (
    <View>
      {label ? (
        <AppText variant="label" tone="muted" style={{ marginBottom: 8 }}>
          {label}
        </AppText>
      ) : null}
      <Animated.View
        style={[
          {
            flexDirection: 'row',
            alignItems: multiline ? 'flex-start' : 'center',
            minHeight: multiline ? 100 : 54,
            borderRadius: 14,
            borderWidth: 1.5,
            paddingHorizontal: 14,
            backgroundColor: c.surface,
            gap: 10,
          },
          ringStyle,
        ]}>
        {icon ? (
          <Crossfade
            style={{ width: 18, height: 18, marginTop: multiline ? 16 : 0 }}
            active={iconActive}
            front={<Feather name={icon} size={18} color={iconActiveColor} />}
            back={<Feather name={icon} size={18} color={c.muted} />}
          />
        ) : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.dim}
          multiline={multiline}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          secureTextEntry={secureTextEntry}
          accessibilityLabel={error ? `${label ?? placeholder ?? 'Field'}, error: ${error}` : (label ?? placeholder)}
          onFocus={() => {
            setFocused(true);
            f.value = reduced ? 1 : withTiming(1, { duration: dur.press, easing: ease.press });
          }}
          onBlur={() => {
            setFocused(false);
            f.value = reduced ? 0 : withTiming(0, { duration: dur.press, easing: ease.press });
          }}
          style={[
            typeScale.body,
            {
              flex: 1,
              color: c.text,
              paddingVertical: multiline ? 14 : 0,
              textAlignVertical: multiline ? 'top' : 'center',
              // RN web needs an explicit outline reset
              outlineWidth: 0,
            } as object,
          ]}
        />
      </Animated.View>
      {error ? (
        // coral (#EF626C) is only ~2.77:1 on the cream surface (fails AA) — use a
        // darker red by day, the brighter coral by night where it clears contrast.
        <Appear enter={dur.nav}>
          <AppText variant="caption" style={{ color: isNight ? brand.coral : '#B5303A', marginTop: 6, textTransform: 'none' }}>
            {error}
          </AppText>
        </Appear>
      ) : null}
    </View>
  );
}
