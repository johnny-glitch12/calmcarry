import { useState } from 'react';
import { LayoutChangeEvent, Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { dur, ease, fonts, useTheme } from '@/theme';

import { AppText } from './AppText';

type Props = {
  options: string[];
  value: number;
  onChange: (index: number) => void;
};

/**
 * Segmented — pill segmented control (Summary / Sleep Phases / Recordings).
 * The active thumb slides under dur.sheet ease.out; labels crossfade color.
 * Theme-aware. (This is a local control, not the bottom tab bar, so a contained
 * thumb slide is on-spec.)
 */
export function Segmented({ options, value, onChange }: Props) {
  const { c, isNight } = useTheme();
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  const n = options.length;
  const pad = 4;
  const thumbW = w > 0 ? (w - pad * 2) / n : 0;

  const onLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    setW(width);
    // place the thumb under the active segment immediately (no slide on first layout)
    x.value = pad + value * ((width - pad * 2) / n);
  };

  const moveTo = (i: number) => {
    const to = pad + i * thumbW;
    x.value = reduced ? to : withTiming(to, { duration: dur.sheet, easing: ease.out });
  };

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      onLayout={onLayout}
      style={{
        flexDirection: 'row',
        height: 44,
        borderRadius: 22,
        padding: pad,
        backgroundColor: isNight ? 'rgba(255,255,255,0.06)' : 'rgba(72,84,83,0.06)',
        borderWidth: 1,
        borderColor: c.line,
      }}>
      {thumbW > 0 ? (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: pad,
              left: 0,
              width: thumbW,
              height: 44 - pad * 2,
              borderRadius: 18,
              backgroundColor: c.ctaBg,
            },
            thumbStyle,
          ]}
        />
      ) : null}
      {options.map((opt, i) => {
        const active = i === value;
        return (
          <Pressable
            key={opt}
            onPress={() => {
              onChange(i);
              moveTo(i);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <AppText
              style={{
                fontFamily: active ? fonts.semibold : fonts.medium,
                fontSize: 13,
                color: active ? c.ctaText : c.muted,
              }}>
              {opt}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
