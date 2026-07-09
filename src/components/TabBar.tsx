import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useProfile } from '@/features/profile/ProfileProvider';
import { setTourTarget } from '@/lib/tourTargets';
import { HomeIcon, TAB_ICONS } from './TabIcons';
import { brand, dur, ease, fonts, night, spring, themes, useColorSchemePref } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
// Tab slot resize + add/remove all move under the same nav-speed layout tween.
const tabLayout = LinearTransition.duration(dur.nav).easing(ease.inOut).reduceMotion(ReduceMotion.System);

// In Kids mode only these tabs show — no Community (adults only) or Profile
// (settings/billing). Leaving Kids mode goes through the parent gate.
const KID_TABS = ['index', 'sounds', 'listen'];

/** Structural subset of @react-navigation's BottomTabBarProps that we use. */
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => {
      defaultPrevented: boolean;
    };
    navigate: (name: string) => void;
  };
};

/** Route name → label. Icons are CalmCarry's own vector set (TabIcons) — the
 *  brand's geometry, not a stock icon family. */
const TABS: Record<string, { label: string; night?: boolean }> = {
  index: { label: 'Home' },
  sounds: { label: 'Library' },
  // the Listen screen forces night mode (<Screen mode="night">); the bar must
  // match so the strip never sits bright against a dark sleep screen at 3am.
  listen: { label: 'Listen', night: true },
  community: { label: 'Community' },
  you: { label: 'Profile' },
};

/**
 * A single tab in the floating-pill bar. The ACTIVE tab is a solid sage-filled
 * pill with its icon + label inline; INACTIVE tabs are a muted icon only.
 * Selection is REACTIVE: the focus value springs IN (a little overshoot) so the
 * pill blooms and the icon "pops" + lifts, the white icon/label crossfade in, and
 * a tap presses the whole tab down (scale) then springs back — with a light haptic.
 * Everything animates IN PLACE (scale / opacity / tiny vertical lift); nothing
 * translates horizontally between tabs (§4: no sliding indicator). On blur it clears
 * instantly so the shrinking slot leaves no remnant. Honors reduced motion (instant,
 * no pop, no press-scale).
 */
function TabItem({
  focused,
  focusedRoute,
  route,
  label,
  onPress,
  inactive,
  pillBg,
  pillContent,
}: {
  focused: boolean;
  /** the currently focused route — ANY focus change shifts every slot */
  focusedRoute: string;
  route: string;
  label: string;
  onPress: () => void;
  inactive: string;
  pillBg: string;
  pillContent: string;
}) {
  const Icon = TAB_ICONS[route as keyof typeof TAB_ICONS] ?? HomeIcon;
  const reduced = useReducedMotion();
  const t = useSharedValue(focused ? 1 : 0); // focus progress (gentle spring settle)
  const press = useSharedValue(1); // tap press-scale

  // report this tab's window rect for the hands-on tour spotlight. Re-measured
  // when ANY tab's focus changes (the expanding pill shifts every sibling slot,
  // and web's onLayout only fires on SIZE changes, not position) — after the
  // layout tween has settled.
  const itemRef = useRef<View>(null);
  const measure = useCallback(() => {
    setTimeout(() => {
      itemRef.current?.measureInWindow?.((x, y, width, height) => {
        if (width > 0 && height > 0) setTourTarget(`tab-${route}`, { x, y, width, height });
      });
    }, 340);
  }, [route]);
  useEffect(measure, [focusedRoute, measure]);

  useEffect(() => {
    t.value = reduced
      ? focused
        ? 1
        : 0
      : focused
        ? withSpring(1, spring) // bloom in on select — gentle settle, no snappy pop
        : withTiming(0, { duration: dur.exit, easing: ease.press }); // fade the pill out (slot resize is layout-tweened) instead of snapping
  }, [focused, reduced, t]);

  const onPressIn = () => {
    if (!reduced) press.value = withTiming(0.92, { duration: dur.press, easing: ease.press });
  };
  const onPressOut = () => {
    press.value = reduced ? 1 : withSpring(1, spring);
  };

  // opacity is clamped defensively; the gentle spring settles toward 1 without
  // overshoot, so the bloom reads as a soft settle. Press scales the whole tab.
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  const fillStyle = useAnimatedStyle(() => ({ opacity: Math.min(t.value, 1), transform: [{ scale: 0.9 + t.value * 0.1 }] }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + t.value * 0.07 }, { translateY: -t.value }] }));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: Math.min(t.value, 1) }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: Math.min(t.value, 1),
    transform: [{ translateX: (1 - Math.min(t.value, 1)) * -4 }],
  }));

  return (
    <AnimatedPressable
      ref={itemRef as never}
      onLayout={measure}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      // slot widens/narrows on selection, and tabs enter/leave (kids mode) — all
      // layout-tweened so the strip re-flows smoothly instead of snapping.
      layout={tabLayout}
      entering={FadeIn.duration(dur.nav).reduceMotion(ReduceMotion.System)}
      exiting={FadeOut.duration(dur.exit).reduceMotion(ReduceMotion.System)}
      style={
        focused
          ? { flexGrow: 1, flexShrink: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 }
          : { width: 44, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 }
      }>
      <Animated.View
        layout={tabLayout}
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            height: 36,
            borderRadius: 18,
            paddingHorizontal: focused ? 12 : 0,
            gap: 6,
          },
          rowStyle,
        ]}>
        {/* sage pill fill — blooms in (opacity + subtle scale); no horizontal slide */}
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: 18, backgroundColor: pillBg }, fillStyle]}
        />
        {/* icon — muted base + white overlay crossfade; the box pops + lifts on select */}
        <Animated.View style={[{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }, iconStyle]}>
          <Icon size={22} color={inactive} />
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, overlayStyle]}>
            <Icon size={22} color={pillContent} />
          </Animated.View>
        </Animated.View>
        {focused ? (
          <Animated.Text
            numberOfLines={1}
            maxFontSizeMultiplier={1.35}
            style={[
              { fontFamily: fonts.medium, fontSize: 13, letterSpacing: 0.2, lineHeight: 16, color: pillContent },
              labelStyle,
            ]}>
            {label}
          </Animated.Text>
        ) : null}
      </Animated.View>
    </AnimatedPressable>
  );
}

/**
 * TabBar — frosted floating bar. The active tab is a solid sage pill (icon +
 * label), inactive tabs are muted icons. Crossfade only — no sliding indicator
 * (DESIGN_SYSTEM §4). Selecting a new tab fires a light haptic. Web gets a
 * near-opaque fallback fill since BlurView is a no-op on web.
 */
export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { effective } = useColorSchemePref();
  const { mode } = useProfile();
  const kids = mode === 'kids';
  // the focused route may force night (e.g. the Listen/sleep screen) regardless of
  // the user's appearance preference; match it so the bar stays dark on that screen.
  const dark = effective === 'night' || Boolean(TABS[state.routes[state.index]?.name]?.night);
  const t = themes[dark ? 'night' : effective];
  const inactive = t.muted;
  // active pill = brand SAGE in BOTH themes (matching the reference), with dark
  // eucalyptus content so the label clears WCAG AA — white-on-sage is only 2.75:1,
  // whereas #15302B on sage is ~5.5:1. (Night already shipped a light-sage pill.)
  const pillBg = dark ? t.ctaBg : brand.sage;
  const pillContent = dark ? t.ctaText : night.ctaText;
  // BlurView renders transparent on web → use a near-opaque fallback there so the
  // floating bar stays legible over scrolling content.
  const web = Platform.OS === 'web';
  const barBg = dark ? (web ? 'rgba(21,35,31,0.96)' : 'rgba(21,35,31,0.72)') : web ? 'rgba(244,243,237,0.96)' : 'rgba(244,243,237,0.72)';

  return (
    <View
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: Math.max(insets.bottom, 12),
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: t.lineSage,
        ...t.shadow,
      }}>
      <BlurView
        intensity={20}
        tint={dark ? 'dark' : 'light'}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 10,
          paddingHorizontal: 8,
          backgroundColor: barBg,
        }}>
        {state.routes
          .filter((route) => TABS[route.name] && (!kids || KID_TABS.includes(route.name)))
          .map((route) => {
            const meta = TABS[route.name];
            const routeIndex = state.routes.findIndex((r) => r.key === route.key);
            const focused = state.index === routeIndex;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
                if (Platform.OS !== 'web') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                }
              }
            };

            return (
              <TabItem
                key={route.key}
                focused={focused}
                focusedRoute={state.routes[state.index]?.name ?? ''}
                route={route.name}
                label={meta.label}
                inactive={inactive}
                pillBg={pillBg}
                pillContent={pillContent}
                onPress={onPress}
              />
            );
          })}
      </BlurView>
    </View>
  );
}
