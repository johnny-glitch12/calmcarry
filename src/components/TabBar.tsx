import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
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
import { brand, dur, ease, fonts, night, themes, useColorSchemePref } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
// Tab selection POPS (Mason). The slot widths still snap in one frame — no
// stretching/morphing — but the pill itself lands with a fast, punchy scale-in
// and ONE small overshoot bounce, like a button that's happy you picked it.
// Duration-capped spring: bounce peaks early, everything is DONE at 380ms
// (a physics spring's micro-oscillation tail rang on past 600ms). Tuned live
// with Mason: 300 read as too quick, 380 keeps the pop but lets it breathe.
const POP_SPRING = { duration: 380, dampingRatio: 0.55 } as const;

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
 * Slot widths swap in ONE frame (no stretching) in step with the instant scene
 * switch — then the pill POPS in: fast scale-up with a single overshoot bounce.
 * Plus the press dip under the finger and a light haptic. Reduced motion: all
 * instant, no pop.
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
  const t = useSharedValue(focused ? 1 : 0); // pop progress (springs past 1 on select)
  const press = useSharedValue(1); // tap press-scale

  // report this tab's window rect for the hands-on tour spotlight. Re-measured
  // when ANY tab's focus changes (the pill shifts every sibling slot, and web's
  // onLayout only fires on SIZE changes, not position). Selection reflow is
  // instant now — a frame or two of settle is all the measurement needs.
  const itemRef = useRef<View>(null);
  const measure = useCallback(() => {
    setTimeout(() => {
      itemRef.current?.measureInWindow?.((x, y, width, height) => {
        if (width > 0 && height > 0) setTourTarget(`tab-${route}`, { x, y, width, height });
      });
    }, 80);
  }, [route]);
  useEffect(measure, [focusedRoute, measure]);

  useEffect(() => {
    if (reduced) {
      t.value = focused ? 1 : 0;
      return;
    }
    if (focused) {
      // POP: restart from small and spring in with one overshoot bounce
      t.value = 0;
      t.value = withSpring(1, POP_SPRING);
    } else {
      t.value = 0; // the old pill clears instantly — the new one is the star
    }
  }, [focused, reduced, t]);

  const onPressIn = () => {
    if (!reduced) press.value = withTiming(0.94, { duration: dur.press, easing: ease.press });
  };
  const onPressOut = () => {
    press.value = reduced ? 1 : withTiming(1, { duration: dur.press, easing: ease.press });
  };

  // the pill scales through the spring's overshoot (t peaks ~1.1 → a visible
  // pop past full size, then settles); opacity fills fast so nothing ghosts
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  const fillStyle = useAnimatedStyle(() => ({
    opacity: Math.min(t.value * 2.5, 1),
    transform: [{ scale: 0.7 + t.value * 0.3 }],
  }));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: Math.min(t.value * 2.5, 1) }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: Math.min(Math.max(t.value * 1.6 - 0.3, 0), 1) }));

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
      // tabs entering/leaving (kids mode) still fade so the strip doesn't pop
      entering={FadeIn.duration(dur.nav).reduceMotion(ReduceMotion.System)}
      exiting={FadeOut.duration(dur.exit).reduceMotion(ReduceMotion.System)}
      style={
        focused
          ? { flexGrow: 1, flexShrink: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 }
          : { width: 44, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 }
      }>
      <Animated.View
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
        {/* sage pill fill — appears in one frame with the selection */}
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: 18, backgroundColor: pillBg }, fillStyle]}
        />
        {/* icon — muted base + pill-content overlay, swapped instantly via opacity */}
        <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={22} color={inactive} />
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, overlayStyle]}>
            <Icon size={22} color={pillContent} />
          </Animated.View>
        </View>
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
 * TabBar — SOLID floating bar (was frosted glass; the translucent blur read as
 * mush over busy content and all but vanished under the tour scrim — Mason: "we
 * can't see it and neither would the consumer"). The active tab is a solid sage
 * pill (icon + label), inactive tabs are muted icons. Crossfade only — no
 * sliding indicator (DESIGN_SYSTEM §4). Selecting a new tab fires a light haptic.
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
  // solid, card-grade surface: elevated tone on night, white by day — the bar
  // must read clearly over any content (and under the tour scrim)
  const barBg = dark ? night.elevated : '#FFFFFF';

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
      <View
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
      </View>
    </View>
  );
}
