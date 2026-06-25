import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
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
 * A single tab. Active/inactive is a COLOR/OPACITY crossfade (no position
 * animation — §4 forbids a sliding indicator). The active (teal) icon fades in
 * over the muted base; the label color interpolates. ease.out over dur.press.
 */
function TabItem({
  focused,
  icon,
  label,
  onPress,
  active,
  inactive,
  pill,
}: {
  focused: boolean;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  active: string;
  inactive: string;
  pill: string;
}) {
  const reduced = useReducedMotion();
  const t = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    t.value = reduced
      ? focused
        ? 1
        : 0
      : withTiming(focused ? 1 : 0, { duration: dur.press, easing: ease.out });
  }, [focused, reduced, t]);

  const activeIconStyle = useAnimatedStyle(() => ({ opacity: t.value }));
  const pillStyle = useAnimatedStyle(() => ({ opacity: t.value }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(t.value, [0, 1], [inactive, active]),
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 }}>
      {/* teal pill behind the active tab (opacity-only fade — no sliding) */}
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', top: 0, bottom: 0, left: 8, right: 8, borderRadius: 16, backgroundColor: pill }, pillStyle]}
      />
      <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={icon} size={22} color={inactive} />
        <Animated.View
          style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, activeIconStyle]}>
          <Feather name={icon} size={22} color={active} />
        </Animated.View>
      </View>
      <Animated.Text
        style={[{ fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.2, marginTop: 4 }, labelStyle]}>
        {label}
      </Animated.Text>
    </Pressable>
  );
}

/**
 * TabBar — frosted (BlurView intensity 20) floating bar, 4 tabs. Tab switches
 * crossfade color/opacity only — no position animation (DESIGN_SYSTEM §4).
 * Selecting a new tab fires a light haptic. Light app chrome.
 */
export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { effective } = useColorSchemePref();
  const { mode } = useProfile();
  const kids = mode === 'kids';
  const dark = effective === 'night';
  const t = themes[effective];
  const active = t.textAccent;
  const inactive = t.muted;
  const pill = dark ? 'rgba(143,201,190,0.22)' : t.panelStrong;

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
          paddingVertical: 10,
          paddingHorizontal: 8,
          backgroundColor: dark ? 'rgba(21,35,31,0.72)' : 'rgba(244,243,237,0.72)',
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
                active={active}
                inactive={inactive}
                pill={pill}
                onPress={onPress}
              />
            );
          })}
      </BlurView>
    </View>
  );
}
