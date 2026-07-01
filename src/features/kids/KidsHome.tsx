import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { AppText, BearMascot, Reveal, Screen } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { covers } from '@/content/covers';
import { TRACKS } from '@/content/library';
import { CALM_NIGHTS_GOAL, getCalmNights } from '@/lib/calmNights';
import { dur, ease, fonts, STAGGER, useTheme } from '@/theme';

// light tap feedback on the big kid affordances (paired with the Pressable `pressed`
// scale below) — a child should feel every tap respond
const tapHaptic = () => {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};
// Big, friendly, calm sounds a child can pick on their own.
const KID_SOUNDS = ['forest', 'rainfall', 'slow-tide'];

/** Parent-gate lock — discreet so a child won't wander out, findable for a grown-up. */
function ParentLock({ onPress }: { onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="For grown-ups"
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.line,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Feather name="lock" size={17} color={c.accent} />
    </Pressable>
  );
}

/** One earned star gently pops + fades in on a short stagger — a small, playful
 *  "count-in" a child feels rewarded by. Un-earned stars rest. Reduced motion →
 *  static. transform + opacity only. */
function KidStar({ earned, index, color }: { earned: boolean; index: number; color: string }) {
  const reduced = useReducedMotion();
  const shouldAnimate = earned && !reduced;
  const p = useSharedValue(shouldAnimate ? 0 : 1);
  useEffect(() => {
    if (!shouldAnimate) {
      p.value = 1;
      return;
    }
    p.value = withDelay(index * STAGGER, withTiming(1, { duration: dur.sheet, easing: ease.out }));
  }, [shouldAnimate, index, p]);
  const animStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + p.value * 0.65,
    transform: [{ scale: 0.7 + p.value * 0.3 }],
  }));
  return (
    <Animated.View style={animStyle}>
      <Feather name="star" size={20} color={color} />
    </Animated.View>
  );
}

function Stars({ count }: { count: number }) {
  const { c } = useTheme();
  return (
    <View
      style={{ flexDirection: 'row', gap: 6 }}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${count} of ${CALM_NIGHTS_GOAL} calm nights`}>
      {Array.from({ length: CALM_NIGHTS_GOAL }).map((_, i) => (
        <KidStar key={i} earned={i < count} index={i} color={i < count ? c.accent : c.line} />
      ))}
    </View>
  );
}

export function KidsHome() {
  const router = useRouter();
  const { c } = useTheme();
  const { user } = useAuth();
  const [nights, setNights] = useState(0);
  const firstName = (user?.name ?? '').split(' ')[0] || 'friend';

  // real count — earned by actually doing calm sessions (see markCalmNightToday).
  // Refetch on focus so a star appears right after a session, not only on first mount.
  useFocusEffect(
    useCallback(() => {
      getCalmNights().then(setNights);
    }, [])
  );

  const story = TRACKS['penguin'] ?? TRACKS['slow-tide'];

  return (
    <Screen mode="light" scroll tabBarSpacing>
      {/* greeting + grown-up lock */}
      <Reveal index={0}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <AppText variant="caption" tone="accent">
              Bedtime
            </AppText>
            <AppText style={{ fontFamily: fonts.display, fontSize: 34, color: c.textAccent, marginTop: 4 }}>
              Hi {firstName}!
            </AppText>
          </View>
          <ParentLock onPress={() => router.push('/parent-gate?intent=exitKids' as Href)} />
        </View>
      </Reveal>

      {/* bear companion */}
      <Reveal index={1} style={{ alignItems: 'center', marginTop: 8 }}>
        <BearMascot size={150} />
        <AppText variant="body" tone="muted" style={{ marginTop: 8, textAlign: 'center' }}>
          Bramble’s getting sleepy too. Ready to wind down?
        </AppText>
      </Reveal>

      {/* gentle, non-failable stars */}
      <Reveal index={2} style={{ marginTop: 22 }}>
        <View
          style={{
            padding: 18,
            borderRadius: 22,
            backgroundColor: c.panel,
            borderWidth: 1,
            borderColor: c.lineSage,
            alignItems: 'center',
            gap: 10,
          }}>
          <AppText variant="bodyMedium" tone="title">
            Your calm nights
          </AppText>
          <Stars count={nights} />
          <AppText variant="label" tone="muted" style={{ textTransform: 'none', letterSpacing: 0 }}>
            Every calm night earns a star. No wrong nights ✨
          </AppText>
        </View>
      </Reveal>

      {/* BIG story hero */}
      <Reveal index={3} style={{ marginTop: 22 }}>
        <Pressable
          onPress={() => router.push(`/player?id=${story.id}`)}
          onPressIn={tapHaptic}
          accessibilityRole="button"
          accessibilityLabel={`Play ${story.title}`}
          style={({ pressed }) => (pressed ? { transform: [{ scale: 0.98 }], opacity: 0.96 } : null)}>
          <View style={{ borderRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: c.lineSage, ...c.shadow }}>
            <Image source={covers[story.cover]} style={{ width: '100%', height: 200 }} contentFit="cover" accessibilityIgnoresInvertColors />
            <View style={{ padding: 20, backgroundColor: c.surface }}>
              <AppText variant="caption" tone="accent">
                Tonight’s calm
              </AppText>
              <AppText style={{ fontFamily: fonts.display, fontSize: 26, color: c.textAccent, marginTop: 4 }}>
                {story.title}
              </AppText>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  marginTop: 16,
                  height: 60,
                  borderRadius: 18,
                  backgroundColor: c.ctaBg,
                }}>
                <Feather name="play" size={22} color={c.ctaText} />
                <AppText style={{ fontFamily: fonts.display, fontSize: 18, color: c.ctaText }}>
                  Start
                </AppText>
              </View>
            </View>
          </View>
        </Pressable>
      </Reveal>

      {/* big calm-sound buttons */}
      <Reveal index={4} style={{ marginTop: 28 }}>
        <AppText style={{ fontFamily: fonts.display, fontSize: 22, color: c.textAccent, marginBottom: 14 }}>
          Pick a calm sound
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 }}>
          {KID_SOUNDS.map((id) => {
            const t = TRACKS[id];
            if (!t) return null;
            return (
              <Pressable
                key={id}
                onPress={() => router.push(`/player?id=${id}`)}
                onPressIn={tapHaptic}
                accessibilityRole="button"
                accessibilityLabel={t.title}
                style={({ pressed }) => [{ width: '31%' }, pressed ? { transform: [{ scale: 0.97 }], opacity: 0.96 } : null]}>
                <View style={{ aspectRatio: 1, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: c.lineSage, ...c.shadow }}>
                  <Image source={covers[t.cover]} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" accessibilityIgnoresInvertColors />
                  <View style={{ flex: 1, backgroundColor: 'rgba(20,30,28,0.55)', justifyContent: 'flex-end', padding: 10 }}>
                    <AppText numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 13, color: '#FFFFFF' }}>
                      {t.title}
                    </AppText>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Reveal>
    </Screen>
  );
}
