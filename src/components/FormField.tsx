import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
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

  const base = error ? brand.coral : c.line;
  const active = error ? brand.coral : c.accent;

  const ringStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(f.value, [0, 1], [base, active]),
  }));

  const iconColor = error ? brand.coral : focused ? c.accent : c.muted;

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
        {icon ? <Feather name={icon} size={18} color={iconColor} style={{ marginTop: multiline ? 16 : 0 }} /> : null}
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
        <AppText variant="caption" style={{ color: isNight ? brand.coral : '#B5303A', marginTop: 6, textTransform: 'none' }}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
