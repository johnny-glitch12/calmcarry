import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Platform, Pressable, View, type ImageSourcePropType } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { dur, ease, useTheme } from '@/theme';

import { AppText } from './AppText';

type Props = {
  title: string;
  subtitle?: string;
  /** e.g. "20 min" — shown as a meta line with a dot separator */
  meta?: string;
  onPress?: () => void;
  /** two tonal colors for the layered cover motif (defaults to a sage motif) */
  art?: [string, string];
  /** illustrated cover image; replaces the tonal motif when provided */
  image?: ImageSourcePropType;
  /** large hero variant uses the serif display title */
  featured?: boolean;
  /** show a lock affordance instead of play (premium/locked content) */
  locked?: boolean;
  /** subtle breathing on the cover ripple. Disable for long lists (perf). */
  animateArt?: boolean;
};

/**
 * CoverCard — horizontal track/program card. Cover art is a layered tonal motif
 * (gradient + orb), never a flat rectangle (§7). The ripple breathes very
 * subtly so art feels alive; press = scale 0.97 + haptic, and the play glyph
 * dims with the press. Renders in both themes from theme tokens.
 */
export function CoverCard({
  title,
  subtitle,
  meta,
  onPress,
  art,
  image,
  featured = false,
  animateArt = true,
  locked = false,
}: Props) {
  const { c, isNight } = useTheme();
  const reduced = useReducedMotion();

  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const press = (to: number) => {
    scale.value = withTiming(to, { duration: dur.press, easing: ease.out });
  };

  // play glyph dims with the card press
  const playStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scale.value, [0.97, 1], [0.7, 1]),
  }));

  // very subtle ripple breathing (amplitude 1.0→1.04), gated by reduced motion
  const ripple = useSharedValue(1);
  useEffect(() => {
    // only the gradient-motif fallback breathes; with a cover image there's nothing to animate
    if (animateArt && !reduced && !image) {
      ripple.value = withRepeat(
        withTiming(1.04, { duration: dur.breath, easing: ease.sine }),
        -1,
        true
      );
    } else {
      ripple.value = 1;
    }
    return () => cancelAnimation(ripple);
  }, [animateArt, reduced, image, ripple]);
  // transform-only breath — the endless opacity throb (0.9↔0.6) on every card in a
  // scrollable list was the eye-tiring part; the gentle scale alone reads as "alive"
  const rippleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ripple.value }],
  }));

  const motif: [string, string] = art ?? (isNight ? ['#2C4742', '#16302B'] : ['#A9D3CC', '#74A5A2']);
  const artSize = featured ? 88 : 64;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        press(0.97);
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }}
      onPressOut={() => press(1)}
      accessibilityRole="button">
      <Animated.View
        style={[
          animStyle,
          {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 12,
            borderRadius: 16,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.line,
            gap: 14,
          },
          c.shadow,
        ]}>
        {/* illustrated cover image, or the layered tonal motif fallback */}
        {image ? (
          <Image
            source={image}
            style={{ width: artSize, height: artSize, borderRadius: 14 }}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <LinearGradient
            colors={motif}
            start={{ x: 0.1, y: 0.1 }}
            end={{ x: 0.9, y: 0.95 }}
            style={{
              width: artSize,
              height: artSize,
              borderRadius: 14,
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            {/* concentric calm-ripple motif — outer ring breathes subtly */}
            <Animated.View
              style={[
                {
                  width: artSize * 0.62,
                  height: artSize * 0.62,
                  borderRadius: artSize,
                  borderWidth: 1.5,
                  borderColor: 'rgba(255,255,255,0.45)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.8, // constant depth cue (replaces the old animated throb)
                },
                rippleStyle,
              ]}>
              <View
                style={{
                  width: artSize * 0.3,
                  height: artSize * 0.3,
                  borderRadius: artSize,
                  backgroundColor: 'rgba(255,255,255,0.85)',
                }}
              />
            </Animated.View>
          </LinearGradient>
        )}

        {/* text block */}
        <View style={{ flex: 1, minWidth: 0 }}>
          {featured ? (
            <AppText variant="display" tone="title" numberOfLines={1}>
              {title}
            </AppText>
          ) : (
            <AppText variant="cardTitleLg" tone="title" numberOfLines={2}>
              {title}
            </AppText>
          )}
          {subtitle ? (
            <AppText variant="label" tone="muted" numberOfLines={1} style={{ marginTop: 3 }}>
              {subtitle}
            </AppText>
          ) : null}
          {meta ? (
            <AppText variant="label" tone="dim" numberOfLines={1} style={{ marginTop: 6 }}>
              {meta}
            </AppText>
          ) : null}
        </View>

        {/* play affordance — dims with the card press */}
        <Animated.View
          style={[
            {
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: isNight ? 'rgba(143,201,190,0.14)' : 'rgba(116,165,162,0.12)',
              alignItems: 'center',
              justifyContent: 'center',
            },
            playStyle,
          ]}>
          <Feather name={locked ? 'lock' : 'play'} size={18} color={c.accent} style={{ marginLeft: locked ? 0 : 2 }} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}
