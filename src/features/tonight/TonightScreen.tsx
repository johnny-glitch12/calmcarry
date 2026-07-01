import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import {
  AppText,
  Card,
  CoverCard,
  GlowOrb,
  LibraryCard,
  Logo,
  PrimaryButton,
  Reveal,
  Screen,
  SectionHeader,
  StatusChip,
} from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { KidsHome } from '@/features/kids/KidsHome';
import { FEELING_MAP, useProfile, type Feeling, type Intent } from '@/features/profile/ProfileProvider';
import { ProfileSwitcher } from '@/features/profile/ProfileSwitcher';
import { covers } from '@/content/covers';
import { TRACKS } from '@/content/library';
import { api } from '@/lib/api';
import { CALM_NIGHTS_GOAL, getCalmNights } from '@/lib/calmNights';
import { lightTap } from '@/lib/haptics';
import { getJSON, setJSON } from '@/lib/store';
import { brand, dur, ease, STAGGER, useTheme } from '@/theme';

const NEW_THIS_MONTH = ['gymnopedie', 'shoreline', 'spa'];

// The always-free one-tap rescue track (never locked) — the honest 3 a.m. answer:
// no sign-in, no paywall, no quiz, just a gentle drift back to sleep.
const FREE_RESCUE = 'slow-tide';

// A short, warm "how you're arriving" label for the hero — reflects ONLY this
// session's check-in answer (never persisted, never a stored mood log; §3/§14).
const ARRIVAL_PERSONA: Record<Feeling, string> = {
  racing: 'Busy mind',
  'cant-switch-off': 'Still switched on',
  'wired-tired': 'Wired but tired',
  'wound-up': 'Wound up',
  'heavy-day': 'Heavy day',
  quiet: 'Seeking quiet',
};

function greeting(hour: number) {
  if (hour < 5) return 'Rest easy';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const INTENT_REASON: Record<Intent, string> = {
  sleep: 'To wind down for sleep',
  reset: 'A quick reset',
  sounds: 'Calm sounds for right now',
  suggest: "Tonight's pick for you",
};

/** A single calm-nights star. Earned stars gently scale + fade in one after
 *  another (a soft "count-in"); un-earned stars just appear. Reduced motion →
 *  everything resting. transform + opacity only. */
function CalmNightStar({ earned, index, color }: { earned: boolean; index: number; color: string }) {
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
    opacity: 0.4 + p.value * 0.6,
    transform: [{ scale: 0.85 + p.value * 0.15 }],
  }));
  return (
    <Animated.View style={animStyle}>
      <Feather name="star" size={16} color={color} />
    </Animated.View>
  );
}

/** The hero ritual panel — personalised to the recommended track (the one
 *  "notice-first" element, §7). The orb is the Glow Orb device twin. */
function RitualHero({ trackId, kicker, onPress }: { trackId: string; kicker: string; onPress: () => void }) {
  const { c, isNight } = useTheme();
  const track = TRACKS[trackId] ?? TRACKS['slow-tide'];
  return (
    <Pressable
      onPress={onPress}
      onPressIn={lightTap}
      accessibilityRole="button"
      accessibilityLabel={`Play ${track.title}`}
      style={({ pressed }) => (pressed ? { transform: [{ scale: 0.98 }], opacity: 0.96 } : null)}>
      <View
        style={{
          borderRadius: 20,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: c.lineSage,
          ...c.shadow,
        }}>
        <LinearGradient
          colors={isNight ? ['#1E302D', '#16302B'] : [brand.mint, brand.mintSoft]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 22, gap: 12 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="caption" tone="accent" numberOfLines={2}>
                {kicker}
              </AppText>
              <AppText
                variant="display"
                tone="title"
                numberOfLines={2}
                style={{ color: c.textAccent, marginTop: 6, fontSize: 24, lineHeight: 29 }}>
                {track.title}
              </AppText>
              <AppText variant="body" tone="text" numberOfLines={2} style={{ marginTop: 2 }}>
                {track.subtitle}
              </AppText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
                <Feather name="clock" size={13} color={c.textAccent} />
                <AppText variant="label" numberOfLines={1} style={{ flex: 1, minWidth: 0, color: c.textAccent }}>
                  {track.duration} · rest it in your palm
                </AppText>
              </View>
            </View>
            {/* orb + a clear, premium play affordance so the hero reads as "tap to begin" */}
            <View style={{ width: 88, height: 88, alignItems: 'center', justifyContent: 'center' }}>
              <GlowOrb size={88} aura />
              <View
                style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: c.ctaBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: isNight ? '#16302B' : brand.mint,
                  ...c.shadow,
                }}>
                <Feather name="play" size={16} color="#FFFFFF" style={{ marginLeft: 2 }} />
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>
    </Pressable>
  );
}

export function TonightScreen() {
  const router = useRouter();
  const { user, isPremium, token } = useAuth();
  const { mode, intent, feeling, recommendedTrackId, recommendedTrackIds, needsCheckIn, dismissCheckIn, profiles } = useProfile();
  const { c } = useTheme();

  // real ownership badge — only shown if the purchase email matches a Glow order.
  // Refetched on focus so a device just claimed/registered surfaces the chip here.
  const [verifiedOwner, setVerifiedOwner] = useState(false);
  useFocusEffect(
    useCallback(() => {
      if (!token || token === 'local') return;
      let alive = true;
      api
        .ownershipMatch(token)
        .then((r) => alive && setVerifiedOwner(r.verifiedOwner))
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, [token])
  );
  const hour = useMemo(() => new Date().getHours(), []);
  const kids = mode === 'kids';
  const firstName = (user?.name ?? '').split(' ')[0] || 'there';

  // offer the forward-looking check-in after >12h away (once per open, not a forced loop).
  // Dismiss the moment it's shown so a Home remount can't re-push the survey onto the stack.
  const checkInShown = useRef(false);
  useEffect(() => {
    if (needsCheckIn && !kids && !checkInShown.current) {
      checkInShown.current = true;
      dismissCheckIn();
      router.push('/survey' as Href);
    }
  }, [needsCheckIn, kids, router, dismissCheckIn]);

  // gentle, non-failable "calm nights" progress — earned by real sessions, shown
  // to adults too (kids get the playful stars on KidsHome). Refreshed on focus.
  const [nights, setNights] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getCalmNights().then((n) => alive && setNights(n));
      return () => {
        alive = false;
      };
    }, [])
  );

  // "New this month" — driven by the CMS catalog flag so the shelf rotates without
  // an app release. Falls back to the bundled default; only shows tracks we ship.
  const [newIds, setNewIds] = useState<string[]>(NEW_THIS_MONTH);
  useEffect(() => {
    let alive = true;
    api
      .content()
      .then((cat) => {
        if (!alive) return;
        const ids = (cat?.newThisMonth ?? []).filter((id) => TRACKS[id]);
        if (ids.length) setNewIds(ids.slice(0, 8));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // "how CalmCarry works" intro for newcomers (dismissible, persisted)
  const [hiwDismissed, setHiwDismissed] = useState(false);
  useEffect(() => {
    getJSON('cc.hiwDismissed', false).then(setHiwDismissed);
  }, []);
  const dismissHiw = () => {
    setHiwDismissed(true);
    setJSON('cc.hiwDismissed', true);
  };

  // kids get their own big, playful, picture-led home a child can run alone
  if (kids) return <KidsHome />;

  // Warmer kicker when we know how they're arriving (this session only), else the
  // intent reason, else a neutral default.
  const heroKicker = feeling ? FEELING_MAP[feeling].line : intent ? INTENT_REASON[intent] : "Tonight's ritual";
  // the next-best matches after the hero pick — ranked to the check-in answer
  const moreIds = recommendedTrackIds.filter((id) => id !== recommendedTrackId).slice(0, 4);
  // free 3 a.m. rescue — copy adapts to the hour but always lands on a free track
  // only claim "3 a.m." in the actual small hours — otherwise it reads as a lie at 11pm
  const deepNight = hour >= 1 && hour < 5;
  const lateNight = hour < 5 || hour >= 23;
  const rescueLabel = deepNight ? 'Awake at 3 a.m.?' : lateNight ? 'Can’t sleep?' : 'Can’t switch off right now?';

  return (
    <Screen mode="light" scroll tabBarSpacing>
      {/* brand header */}
      <Reveal index={0}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Logo size="sm" />
          <GlowOrb size={40} breathing={false} />
        </View>
        <AppText variant="h1" tone="title" style={{ marginTop: 18 }}>
          {kids ? `Bedtime, ${firstName}` : `${greeting(hour)}, ${firstName}`}
        </AppText>
      </Reveal>

      {/* status — device congruency + entitlement */}
      <Reveal index={1}>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {feeling ? <StatusChip label={ARRIVAL_PERSONA[feeling]} icon="user" /> : null}
          {verifiedOwner ? <StatusChip label="Verified owner" icon="shield" /> : null}
          <StatusChip label={isPremium ? 'Library unlocked' : 'Free tier'} icon={isPremium ? 'unlock' : 'lock'} />
        </View>
      </Reveal>

      {/* household switcher */}
      {profiles.length > 1 ? (
        <Reveal index={2}>
          <View style={{ marginTop: 18 }}>
            <ProfileSwitcher />
          </View>
        </Reveal>
      ) : null}

      {/* how CalmCarry works — newcomer intro */}
      {!hiwDismissed ? (
        <Reveal index={2}>
          <Card variant="panel" radius={18} style={{ marginTop: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <AppText variant="caption" tone="accent">
                New here?
              </AppText>
              <Pressable onPress={dismissHiw} hitSlop={16} accessibilityRole="button" accessibilityLabel="Dismiss how CalmCarry works">
                <Feather name="x" size={16} color={c.muted} />
              </Pressable>
            </View>
            <AppText variant="bodyMedium" tone="title" style={{ marginTop: 6 }}>
              How CalmCarry works
            </AppText>
            <AppText variant="body" tone="muted" style={{ marginTop: 6 }}>
              Rest your Glow Orb in your palm, set it to a level that feels good, and press play. The app guides the breath and the wind-down. The device does the rest.
            </AppText>
          </Card>
        </Reveal>
      ) : null}

      {/* personalised hero */}
      <Reveal index={3}>
        <View style={{ marginTop: 20 }}>
          <RitualHero
            trackId={recommendedTrackId}
            kicker={heroKicker}
            onPress={() => router.push(`/player?id=${recommendedTrackId}`)}
          />
        </View>
      </Reveal>

      {/* primary CTA */}
      <Reveal index={4}>
        <View style={{ marginTop: 16 }}>
          <PrimaryButton
            label={kids ? 'Start bedtime' : 'Begin wind-down'}
            onPress={() => router.push(`/wind-down?id=${recommendedTrackId}` as Href)}
          />
        </View>
      </Reveal>

      {/* Always-free rescue — the honest answer to a 3 a.m. wake-up: one tap into a
          free drift, no sign-in, no paywall, no quiz. Hidden in kids mode. */}
      {!kids ? (
        <Reveal index={5}>
          <Pressable
            onPress={() => router.push(`/player?id=${FREE_RESCUE}` as Href)}
            onPressIn={lightTap}
            accessibilityRole="button"
            accessibilityLabel={`${rescueLabel} Play a free calming session now.`}
            style={({ pressed }) => [
              {
                marginTop: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                padding: 16,
                borderRadius: 18,
                backgroundColor: c.panel,
                borderWidth: 1,
                borderColor: c.lineSage,
              },
              pressed ? { transform: [{ scale: 0.98 }], opacity: 0.96 } : null,
            ]}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="moon" size={18} color={c.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyMedium" tone="title">
                {rescueLabel}
              </AppText>
              <AppText variant="meta" tone="muted" style={{ marginTop: 2 }}>
                Tap once for a free drift back to sleep, no sign-in needed.
              </AppText>
            </View>
            <Feather name="play" size={16} color={c.accent} />
          </Pressable>
        </Reveal>
      ) : null}

      {/* First-7-nights free starter arc — only for newcomers (0 calm nights), so it's
          an invitation, not clutter once the ritual is established. */}
      {nights === 0 ? (
        <Reveal index={6}>
          <Pressable
            onPress={() => router.push('/program?id=first-week' as Href)}
            onPressIn={lightTap}
            accessibilityRole="button"
            accessibilityLabel="Your first 7 nights, a free starter program"
            style={({ pressed }) => [
              { marginTop: 16, padding: 16, borderRadius: 18, backgroundColor: c.panel, borderWidth: 1, borderColor: c.lineSage },
              pressed ? { transform: [{ scale: 0.98 }], opacity: 0.96 } : null,
            ]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <AppText variant="caption" tone="accent">
                Free starter
              </AppText>
              <Feather name="arrow-right" size={16} color={c.accent} />
            </View>
            <AppText variant="bodyMedium" tone="title" style={{ marginTop: 6 }}>
              Your first 7 nights
            </AppText>
            <AppText variant="body" tone="muted" style={{ marginTop: 4 }}>
              A gentle, free week to find your wind-down, one short session a night.
            </AppText>
          </Pressable>
        </Reveal>
      ) : null}

      {/* gentle calm-nights progress — only once at least one night is earned, so
          it's an encouragement, never an empty "0/7" guilt-meter */}
      {nights > 0 ? (
        <Reveal index={5}>
          <Card
            variant="panel"
            radius={18}
            style={{ marginTop: 28, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ flex: 1 }}>
              <AppText variant="caption" tone="accent">
                Your calm nights
              </AppText>
              <AppText variant="bodyMedium" tone="title" style={{ marginTop: 4 }}>
                {nights} calm {nights === 1 ? 'night' : 'nights'} this week
              </AppText>
              <View style={{ flexDirection: 'row', gap: 5, marginTop: 10 }}>
                {Array.from({ length: CALM_NIGHTS_GOAL }).map((_, i) => (
                  <CalmNightStar key={i} earned={i < nights} index={i} color={i < nights ? c.accent : c.line} />
                ))}
              </View>
            </View>
          </Card>
        </Reveal>
      ) : null}

      {/* new this month — fresh content (CMS-driven in production) */}
      <Reveal index={5}>
        <View style={{ marginTop: 32 }}>
          <SectionHeader kicker="Fresh" title="New this month" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
            {newIds.map((id) => {
              const t = TRACKS[id];
              if (!t) return null;
              const locked = t.locked && !isPremium;
              return (
                <LibraryCard
                  key={id}
                  title={t.title}
                  subtitle={`${t.category[0].toUpperCase()}${t.category.slice(1)} · ${t.duration}`}
                  image={covers[t.cover]}
                  locked={locked}
                  onPress={() => router.push(locked ? (`/unlock?id=${id}` as Href) : (`/player?id=${id}` as Href))}
                />
              );
            })}
          </ScrollView>
        </View>
      </Reveal>

      {/* more for tonight (mode-aware) */}
      <Reveal index={6}>
        <View style={{ marginTop: 32 }}>
          <SectionHeader
            kicker={kids ? 'More for bedtime' : intent ? 'Picked for how you’re arriving' : 'More for tonight'}
            title={kids ? 'Stories & calm sounds' : 'Sounds & sessions'}
            actionLabel="See all"
            onAction={() => router.push('/sounds')}
          />
          <View style={{ gap: 12 }}>
            {moreIds.map((id) => {
              const t = TRACKS[id];
              if (!t) return null;
              return (
                <CoverCard
                  key={id}
                  title={t.title}
                  subtitle={t.subtitle}
                  meta={t.duration}
                  image={covers[t.cover]}
                  onPress={() => router.push(`/player?id=${id}`)}
                />
              );
            })}
          </View>
        </View>
      </Reveal>
    </Screen>
  );
}
