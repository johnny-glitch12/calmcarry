import { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { lightTap } from '@/lib/haptics';
import { dur, ease, fonts, useTheme } from '@/theme';

import { PressableScale } from './PressableScale';

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
    <PressableScale
      onPress={onPress}
      onPressIn={lightTap}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      {/* the two stacked label layers are decorative (crossfade only) — the Pressable's
          accessibilityLabel is the single authoritative name, so hide them from AT to
          avoid a double-announce ("Adult Adult") */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Animated.Text numberOfLines={1} maxFontSizeMultiplier={1.35} style={[LABEL, { color: mutedColor }, mutedStyle]}>{label}</Animated.Text>
        <Animated.Text numberOfLines={1} maxFontSizeMultiplier={1.35} style={[LABEL, { color: activeColor, position: 'absolute' }, activeStyle]}>{label}</Animated.Text>
      </View>
    </PressableScale>
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
  const first = useRef(true);
  const n = options.length;
  const pad = 4;
  const thumbW = w > 0 ? (w - pad * 2) / n : 0;

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  // The thumb tracks the controlled `value` — so it also glides back if a parent
  // rejects/reverts the change (e.g. a cancelled parent gate), never desyncing
  // from the labels. First placement (and reduced motion) snaps; later moves slide.
  useEffect(() => {
    if (thumbW <= 0) return;
    const to = pad + value * thumbW;
    if (first.current || reduced) {
      x.value = to;
      first.current = false;
    } else {
      x.value = withTiming(to, { duration: dur.sheet, easing: ease.out });
    }
  }, [value, thumbW, reduced, x]);

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
          onPress={() => onChange(i)}
        />
      ))}
    </View>
  );
}
