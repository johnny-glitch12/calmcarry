import { useMemo } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  /** 0 → 1 progress; the lit arc DEPLETES full→empty as this advances (a countdown) */
  progress: SharedValue<number>;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  /** fill: arc grows 0→full as progress advances (a track). default depletes (a countdown). */
  fill?: boolean;
  style?: ViewStyle;
};

/**
 * ProgressRing — SVG ring whose lit arc sweeps full→empty off a progress shared
 * value. Animated on the UI thread via strokeDashoffset (stroke, not layout),
 * so it stays smooth on native and renders to a real <svg> on web for
 * verification. Used by the wind-down timer (DESIGN_SYSTEM §4 dim-arc).
 */
export function ProgressRing({
  progress,
  size = 280,
  strokeWidth = 3,
  color = '#8FC9BE',
  trackColor = 'rgba(143,201,190,0.14)',
  fill = false,
  style,
}: Props) {
  const r = (size - strokeWidth) / 2;
  const c = useMemo(() => 2 * Math.PI * r, [r]);

  const animatedProps = useAnimatedProps(() => ({
    // deplete: full→empty as progress advances. fill: empty→full.
    strokeDashoffset: fill ? c * (1 - progress.value) : c * progress.value,
  }));

  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="none">
      <Svg width={size} height={size}>
        {/* faint full track */}
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        {/* depleting lit arc — rotated so it starts at 12 o'clock */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
    </View>
  );
}
