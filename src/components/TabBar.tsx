import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useProfile } from '@/features/profile/ProfileProvider';
import { dur, ease, fonts, themes, useColorSchemePref } from '@/theme';

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

/** Route name → label + Feather icon. One outline icon family, no emoji (§7). */
const TABS: Record<string, { label: string; icon: keyof typeof Feather.glyphMap }> = {
  index: { label: 'Home', icon: 'home' },
  sounds: { label: 'Library', icon: 'compass' },
  listen: { label: 'Listen', icon: 'music' },
  community: { label: 'Community', icon: 'users' },
  you: { label: 'Profile', icon: 'user' },
};

/**
 * A single tab in the floating-pill bar. The ACTIVE tab is a solid sage-filled
 * pill with its icon + label inline (white); INACTIVE tabs are a muted icon
 * only. Focus is an OPACITY crossfade IN PLACE — the fill, the white icon
 * overlay and the label all fade in over dur.press; nothing translates (§4: no
 * sliding indicator). The active slot grows (flexGrow) and inactive slots are a
 * compact fixed width, so the wide active pill never overflows or reflows mid
 * fade. Soft fade-in on focus; instant clear on blur (avoids a shrinking-slot
 * remnant). Honors reduced motion (instant state, no fade).
 */
function TabItem({
  focused,
  icon,
  label,
  onPress,
  inactive,
  pillBg,
  pillContent,
}: {
  focused: boolean;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  inactive: string;
  pillBg: string;
  pillContent: string;
}) {
  const reduced = useReducedMotion();
  const t = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    t.value = reduced
      ? focused
        ? 1
        : 0
      : focused
        ? withTiming(1, { duration: dur.press, easing: ease.out })
        : 0; // instant clear on blur — no fade-out remnant in the shrunk slot
  }, [focused, reduced, t]);

  const fillStyle = useAnimatedStyle(() => ({ opacity: t.value }));
  const activeIconStyle = useAnimatedStyle(() => ({ opacity: t.value }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: t.value }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      style={
        focused
          ? { flexGrow: 1, flexShrink: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 }
          : { width: 48, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 }
      }>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          height: 36,
          borderRadius: 18,
          paddingHorizontal: focused ? 14 : 0,
          gap: 8,
        }}>
        {/* sage pill fill — opacity crossfade only (no position/size animation) */}
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: 18, backgroundColor: pillBg }, fillStyle]}
        />
        {/* icon — muted base with a white overlay that fades in on focus */}
        <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name={icon} size={22} color={inactive} />
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, activeIconStyle]}>
            <Feather name={icon} size={22} color={pillContent} />
          </Animated.View>
        </View>
        {focused ? (
          <Animated.Text
            numberOfLines={1}
            style={[
              { fontFamily: fonts.medium, fontSize: 13, letterSpacing: 0.2, lineHeight: 16, color: pillContent },
              labelStyle,
            ]}>
            {label}
          </Animated.Text>
        ) : null}
      </View>
    </Pressable>
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
  const dark = effective === 'night';
  const t = themes[effective];
  const inactive = t.muted;
  const pillBg = t.ctaBg;
  const pillContent = t.ctaText;
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
                icon={meta.icon}
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
