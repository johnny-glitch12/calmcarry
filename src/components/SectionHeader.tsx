import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { dur, ease, type, useTheme } from '@/theme';

import { AppText } from './AppText';

type Props = {
  title: string;
  /** small uppercase kicker above the title */
  kicker?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * SectionHeader — left-aligned (F-pattern, §7) section title with an optional
 * uppercase kicker and a trailing text action. The action dips to 0.6 opacity
 * on press (ease-out, dur.press) so it feels alive, not dead (§4).
 */
export function SectionHeader({ title, kicker, actionLabel, onAction }: Props) {
  const { c } = useTheme();
  const o = useSharedValue(1);
  const actionStyle = useAnimatedStyle(() => ({ opacity: o.value }));

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}>
      <View style={{ flex: 1 }}>
        {kicker ? (
          <AppText variant="caption" tone="accent" style={{ marginBottom: 4 }}>
            {kicker}
          </AppText>
        ) : null}
        <AppText variant="h2" tone="title">
          {title}
        </AppText>
      </View>
      {actionLabel ? (
        <Pressable
          onPress={onAction}
          onPressIn={() => {
            o.value = withTiming(0.6, { duration: dur.press, easing: ease.out });
          }}
          onPressOut={() => {
            o.value = withTiming(1, { duration: dur.press, easing: ease.out });
          }}
          hitSlop={{ top: 13, bottom: 13, left: 12, right: 12 }}
          accessibilityRole="button">
          <Animated.View style={actionStyle}>
            <AppText style={[type.label, { color: c.textAccent }]}>{actionLabel}</AppText>
          </Animated.View>
        </Pressable>
      ) : null}
    </View>
  );
}
