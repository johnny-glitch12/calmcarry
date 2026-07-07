import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { AppText, BearMascot, PressableScale, Reveal, Screen } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { covers } from '@/content/covers';
import { TRACKS } from '@/content/library';
import { CALM_NIGHTS_GOAL, getCalmNights } from '@/lib/calmNights';
import { lightTap } from '@/lib/haptics';
import { dur, ease, fonts, STAGGER, useTheme } from '@/theme';

// Big, friendly, calm sounds a child can pick on their own.
const KID_SOUNDS = ['forest', 'rainfall', 'slow-tide'];

/** Parent-gate lock — discreet so a child won't wander out, findable for a grown-up. */
function ParentLock({ onPress }: { onPress: () => void }) {
  const { c } = useTheme();
  return (
    <PressableScale
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
    </PressableScale>
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
    // reset to 0 first so a star that becomes earned AFTER mount (a night earned
    // on this session) replays the scale+fade count-in — which also softens the
    // line→accent color prop swap landing at the same moment.
    p.value = 0;
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

  // This is the bedtime screen — from evening on, a child (or parent) reopens it in a
  // dark room, so dim to the night palette instead of a full light-mode blast. Kept
  // light through the day so early-evening play keeps its bright, friendly identity.
  // Same time-of-day mechanism the adult flow uses (TonightScreen), bedtime-earlier cutoff.
  const evening = useMemo(() => new Date().getHours() >= 19, []);

  // real count — earned by actually doing calm sessions (see markCalmNightToday).
  // Refetch on focus so a star appears right after a session, not only on first mount.
  useFocusEffect(
    useCallback(() => {
      getCalmNights().then(setNights);
    }, [])
  );

  const story = TRACKS['penguin'] ?? TRACKS['slow-tide'];

  return (
    <Screen mode={evening ? 'night' : 'day'} scroll tabBarSpacing>
      {/* greeting + grown-up lock */}
      <Reveal index={0}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <AppText variant="caption" tone="accent">
              Bedtime
            </AppText>
            <AppText style={{ fontFamily: fonts.display, fontSize: 34, lineHeight: 40, color: c.textAccent, marginTop: 4 }}>
              Hi {firstName}!
            </AppText>
          </View>
          <ParentLock onPress={() => router.push('/parent-gate?intent=exitKids' as Href)} />
        </View>
      </Reveal>

      {/* BIG story hero — the one thing they came for: above the fold, one tap to play */}
      <Reveal index={1} style={{ marginTop: 22 }}>
        <PressableScale
          onPress={() => router.push(`/player?id=${story.id}`)}
          onPressIn={lightTap}
          accessibilityRole="button"
          accessibilityLabel={`Play ${story.title}`}
          scaleTo={0.98}
          dimTo={0.96}>
          <View style={{ borderRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: c.lineSage, ...c.shadow }}>
            <Image source={covers[story.cover]} style={{ width: '100%', height: 200 }} contentFit="cover" accessibilityIgnoresInvertColors />
            <View style={{ padding: 20, backgroundColor: c.surface }}>
              <AppText variant="caption" tone="accent">
                Tonight’s calm
              </AppText>
              <AppText style={{ fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: c.textAccent, marginTop: 4 }}>
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
                <AppText style={{ fontFamily: fonts.display, fontSize: 18, lineHeight: 24, color: c.ctaText }}>
                  Start
                </AppText>
              </View>
            </View>
          </View>
        </PressableScale>
      </Reveal>

      {/* bear companion */}
      <Reveal index={2} style={{ alignItems: 'center', marginTop: 22 }}>
        <BearMascot size={150} />
        <AppText variant="body" tone="muted" style={{ marginTop: 8, textAlign: 'center' }}>
          Bramble’s getting sleepy too. Ready to wind down?
        </AppText>
      </Reveal>

      {/* gentle, non-failable stars */}
      <Reveal index={3} style={{ marginTop: 22 }}>
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
          <AppText variant="meta" tone="muted">
            Every calm night earns a star. No wrong nights ✨
          </AppText>
        </View>
      </Reveal>

      {/* big calm-sound buttons */}
      <Reveal index={4} style={{ marginTop: 28 }}>
        <AppText style={{ fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: c.textAccent, marginBottom: 14 }}>
          Pick a calm sound
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 }}>
          {KID_SOUNDS.map((id) => {
            const t = TRACKS[id];
            if (!t) return null;
            return (
              <PressableScale
                key={id}
                onPress={() => router.push(`/player?id=${id}`)}
                onPressIn={lightTap}
                accessibilityRole="button"
                accessibilityLabel={t.title}
                dimTo={0.96}
                style={{ width: '31%' }}>
                <View style={{ aspectRatio: 1, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: c.lineSage, ...c.shadow }}>
                  <Image source={covers[t.cover]} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" accessibilityIgnoresInvertColors />
                  <View style={{ flex: 1, backgroundColor: 'rgba(20,30,28,0.55)', justifyContent: 'flex-end', padding: 10 }}>
                    {/* fixed light on the always-dark photo scrim (matches ListenScreen tiles);
                        a theme token would flip dark in night mode and lose contrast */}
                    <AppText numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 16, color: '#FFFFFF' }}>
                      {t.title}
                    </AppText>
                  </View>
                </View>
              </PressableScale>
            );
          })}
        </View>
      </Reveal>
    </Screen>
  );
}
