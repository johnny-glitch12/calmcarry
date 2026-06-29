import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { lightTap } from '@/lib/haptics';
import { dur, ease, fonts, useTheme } from '@/theme';

type Props = {
  options: string[];
  value: number;
  onChange: (index: number) => void;
};

const LABEL = { fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 0.2 } as const;

/**
 * One segment. The active label color CROSSFADES (two stacked Text layers, opacity)
 * over the same dur.sheet as the thumb slide — no single-frame color hard-cut, no
 * font-weight swap (which would re-measure and jitter the label under the moving
 * thumb). Reduced motion jumps instantly. Transform/opacity only.
 */
function Segment({
  label,
  active,
  onPress,
  activeColor,
  mutedColor,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  activeColor: string;
  mutedColor: string;
}) {
  const reduced = useReducedMotion();
  const p = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    p.value = reduced ? (active ? 1 : 0) : withTiming(active ? 1 : 0, { duration: dur.sheet, easing: ease.out });
  }, [active, reduced, p]);
  const activeStyle = useAnimatedStyle(() => ({ opacity: p.value }));
  const mutedStyle = useAnimatedStyle(() => ({ opacity: 1 - p.value }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={lightTap}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [{ flex: 1, alignItems: 'center', justifyContent: 'center' }, pressed && !active ? { opacity: 0.6 } : null]}>
      {/* the two stacked label layers are decorative (crossfade only) — the Pressable's
          accessibilityLabel is the single authoritative name, so hide them from AT to
          avoid a double-announce ("Adult Adult") */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Animated.Text style={[LABEL, { color: mutedColor }, mutedStyle]}>{label}</Animated.Text>
        <Animated.Text style={[LABEL, { color: activeColor, position: 'absolute' }, activeStyle]}>{label}</Animated.Text>
      </View>
    </Pressable>
  );
}

/**
 * Segmented — pill segmented control. The active thumb slides under dur.sheet
 * ease.out; labels crossfade color (not a hard swap). Theme-aware. (Local
 * control, not the bottom tab bar, so a contained thumb slide is on-spec.)
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
      {options.map((opt, i) => (
        <Segment
          key={opt}
          label={opt}
          active={i === value}
          activeColor={c.ctaText}
          mutedColor={c.muted}
          onPress={() => {
            onChange(i);
            moveTo(i);
          }}
        />
      ))}
    </View>
  );
}
