import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, View, type ImageSourcePropType } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { dur, ease, useTheme } from '@/theme';

import { AppText } from './AppText';
import { Appear } from './anim';

type Props = {
  title: string;
  subtitle?: string;
  image: ImageSourcePropType;
  /** paid-tier item - shows a lock badge (bundle unlocks it, no IAP) */
  locked?: boolean;
  size?: number;
  onPress?: () => void;
};

/**
 * LibraryCard - vertical cover card for the Sounds rails (illustrated cover on
 * top, title + meta below). Press: scale 0.97 + haptic + a soft cover dim, all
 * ease.press dur.press (§4). Image fades in via expo-image transition.
 */
export function LibraryCard({ title, subtitle, image, locked = false, size = 152, onPress }: Props) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const press = (to: number) => {
    if (reduced) return;
    scale.value = withTiming(to, { duration: dur.press, easing: ease.press });
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        press(0.97);
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }}
      onPressOut={() => press(1)}
      accessibilityRole="button"
      accessibilityLabel={`${title}${subtitle ? `, ${subtitle}` : ''}${locked ? ', locked' : ''}`}>
      <Animated.View style={[{ width: size }, cardStyle]}>
        <View
          style={{
            width: size,
            height: size,
            borderRadius: 18,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: c.line,
            ...c.shadow,
          }}>
          <Image
            source={image}
            style={{ width: size, height: size }}
            contentFit="cover"
            transition={{ duration: dur.nav, effect: 'cross-dissolve' }}
            accessibilityIgnoresInvertColors
          />
          {locked ? (
            <Appear
              enter={dur.nav}
              style={{
                position: 'absolute',
                top: 10,
                left: 10,
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(14,24,23,0.55)',
              }}>
              <Feather name="lock" size={14} color="#FFFFFF" />
            </Appear>
          ) : null}
        </View>
        <AppText variant="cardTitle" tone="title" numberOfLines={2} style={{ marginTop: 10 }}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="label" tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>
            {subtitle}
          </AppText>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}
