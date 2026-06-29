import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { AmbientMotes, AppText, GlowOrb, Logo, PrimaryButton, Screen, VoicePicker } from '@/components';
import { covers, type CoverKey } from '@/content/covers';
import { TRACKS } from '@/content/library';
import { FEELING_MAP, useProfile, type Feeling } from '@/features/profile/ProfileProvider';
import { lightTap } from '@/lib/haptics';
import { markOnboarded } from '@/lib/onboarding';
import { dur, ease, useTheme } from '@/theme';

type Art = 'orb' | 'cluster' | 'shield';
type Slide = { art: Art; title: string; body: string };

const SLIDES: Slide[] = [
  {
    art: 'orb',
    title: 'Welcome to CalmCarry',
    body: 'Your companion for calmer evenings and deeper, more restful nights.',
  },
  {
    art: 'orb',
    title: 'Works the moment you hold it',
    body: 'No app is needed to use your Glow Orb. This is simply the calm way to get more from it.',
  },
  {
    art: 'cluster',
    title: 'A library made for sleep',
    body: 'Soundscapes, sleep tales, and guided wind-downs, held in your hand, fading you to silence.',
  },
  {
    art: 'shield',
    title: 'Yours, protected',
    body: "Register your device, confirm it's genuine, and keep your warranty close.",
  },
];

const FEELINGS: { id: Feeling; emoji: string; label: string }[] = [
  { id: 'racing', emoji: '💭', label: 'My mind’s racing' },
  { id: 'cant-switch-off', emoji: '💡', label: 'I can’t switch off' },
  { id: 'wired-tired', emoji: '⚡', label: 'Wired but tired' },
  { id: 'wound-up', emoji: '🌀', label: 'I’m wound up' },
  { id: 'heavy-day', emoji: '🌧️', label: 'It’s been a heavy day' },
  { id: 'quiet', emoji: '🌙', label: 'I just want quiet' },
];

/** A cover that drifts up-and-down forever on the UI thread (transform only),
 *  desynced by its delay so a cluster never moves in lockstep. */
function FloatingCover({
  cover,
  size,
  rotate,
  dx,
  dy,
  delay,
  z,
}: {
  cover: CoverKey;
  size: number;
  rotate: number;
  dx: number;
  dy: number;
  delay: number;
  z: number;
}) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 3400 + delay, easing: ease.sine }), -1, true));
  }, [reduced, t, delay]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: dx }, { translateY: dy - t.value * 7 }, { rotate: `${rotate}deg` }],
  }));
  return (
    <Animated.View
      entering={FadeIn.duration(dur.screen).delay(delay)}
      style={[{ position: 'absolute', zIndex: z, borderRadius: 24, overflow: 'hidden' }, style]}>
      <Image source={covers[cover]} style={{ width: size, height: size }} contentFit="cover" accessibilityIgnoresInvertColors />
    </Animated.View>
  );
}

/** A small fanned, gently-floating stack of covers (the "library" hero). */
function CoverCluster() {
  return (
    <View style={{ width: 240, height: 220, alignItems: 'center', justifyContent: 'center' }}>
      <FloatingCover cover="forestStream" size={140} rotate={-9} dx={-66} dy={14} delay={120} z={1} />
      <FloatingCover cover="deepRest" size={150} rotate={8} dx={64} dy={20} delay={240} z={2} />
      <FloatingCover cover="slowTide" size={168} rotate={0} dx={0} dy={-8} delay={0} z={3} />
    </View>
  );
}

function SlideArt({ art }: { art: Art }) {
  const { c } = useTheme();
  if (art === 'cluster') return <CoverCluster />;
  return (
    <GlowOrb size={158} breathing aura reserveGlow>
      {art === 'shield' ? <Feather name="shield" size={42} color={c.ctaText} /> : null}
    </GlowOrb>
  );
}

/** Brand + optional Skip. Top-level (not defined during render) so it never remounts. */
function OnboardingHeader({ onSkip }: { onSkip?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 28 }}>
      <Logo size="sm" />
      {onSkip ? (
        <Pressable onPress={onSkip} hitSlop={{ top: 13, bottom: 13, left: 12, right: 12 }} accessibilityRole="button">
          <AppText variant="label" tone="muted">
            Skip
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Progress dot that eases its width when it becomes active (transform-safe width tween). */
function Dot({ active }: { active: boolean }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const w = useSharedValue(active ? 22 : 8);
  useEffect(() => {
    w.value = reduced ? (active ? 22 : 8) : withTiming(active ? 22 : 8, { duration: dur.sheet, easing: ease.out });
  }, [active, reduced, w]);
  const style = useAnimatedStyle(() => ({ width: w.value }));
  return <Animated.View style={[{ height: 8, borderRadius: 4, backgroundColor: active ? c.accent : c.line }, style]} />;
}

export function Onboarding() {
  const router = useRouter();
  const { c } = useTheme();
  const { setFeeling } = useProfile();
  const [stage, setStage] = useState<'intro' | 'quiz' | 'voice' | 'result'>('intro');
  const [i, setI] = useState(0);
  const [chosen, setChosen] = useState<Feeling | null>(null);
  const last = i === SLIDES.length - 1;
  const slide = SLIDES[i];

  const finish = () => {
    markOnboarded();
    router.replace('/auth');
  };
  const pick = (f: Feeling) => {
    lightTap();
    setChosen(f);
    setFeeling(f);
    setStage('voice');
  };

  // ---- personalization quiz ----
  if (stage === 'quiz') {
    return (
      <Screen contentStyle={{ flex: 1, paddingTop: 8, paddingBottom: 28 }}>
        <AmbientMotes />
        <OnboardingHeader onSkip={finish} />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Animated.View entering={FadeInDown.duration(dur.screen)}>
            <AppText variant="display" tone="title" style={{ textAlign: 'center' }}>
              How are you arriving tonight?
            </AppText>
          </Animated.View>
          <Animated.View entering={FadeInDown.duration(dur.screen).delay(90)}>
            <AppText variant="body" tone="muted" style={{ textAlign: 'center', maxWidth: 320, marginTop: 12, alignSelf: 'center' }}>
              Just so we can start you somewhere that fits. There’s no wrong answer.
            </AppText>
          </Animated.View>
          <View style={{ gap: 10, marginTop: 28 }}>
            {FEELINGS.map((f, idx) => (
              <Animated.View key={f.id} entering={FadeInDown.duration(dur.screen).delay(160 + idx * 60)}>
                <Pressable
                  onPress={() => pick(f.id)}
                  onPressIn={lightTap}
                  accessibilityRole="button"
                  accessibilityLabel={f.label}
                  style={({ pressed }) => [
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 14,
                      paddingVertical: 16,
                      paddingHorizontal: 18,
                      borderRadius: 14,
                      backgroundColor: c.surface,
                      borderWidth: 1,
                      borderColor: c.line,
                      ...c.shadow,
                    },
                    pressed ? { transform: [{ scale: 0.98 }], opacity: 0.92 } : null,
                  ]}>
                  <AppText style={{ fontSize: 22, lineHeight: 26 }}>{f.emoji}</AppText>
                  <AppText variant="bodyMedium" tone="title">
                    {f.label}
                  </AppText>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </View>
      </Screen>
    );
  }

  // ---- choose the guided voice ----
  if (stage === 'voice') {
    return (
      <Screen contentStyle={{ flex: 1, paddingTop: 8, paddingBottom: 28 }}>
        <AmbientMotes />
        <OnboardingHeader onSkip={finish} />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Animated.View entering={FadeInDown.duration(dur.screen)}>
            <AppText variant="display" tone="title" style={{ textAlign: 'center' }}>
              Choose your voice
            </AppText>
          </Animated.View>
          <Animated.View entering={FadeInDown.duration(dur.screen).delay(90)}>
            <AppText variant="body" tone="muted" style={{ textAlign: 'center', maxWidth: 330, marginTop: 12, alignSelf: 'center' }}>
              The voice that guides your wind-downs. Tap to hear each, then pick the one that settles you. You can change it any time in Settings.
            </AppText>
          </Animated.View>
          <Animated.View entering={FadeInDown.duration(dur.screen).delay(180)} style={{ marginTop: 28 }}>
            <VoicePicker />
          </Animated.View>
        </View>
        <PrimaryButton label="Continue" onPress={() => setStage('result')} />
      </Screen>
    );
  }

  // ---- earned first recommendation (primes the soft paywall) ----
  if (stage === 'result' && chosen) {
    const map = FEELING_MAP[chosen];
    const picked = TRACKS[map.track];
    const track = picked && !picked.locked ? picked : TRACKS['slow-tide'];
    return (
      <Screen contentStyle={{ flex: 1, paddingTop: 8, paddingBottom: 28 }}>
        <AmbientMotes />
        <View style={{ minHeight: 28 }}>
          <Logo size="sm" />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Animated.View entering={FadeIn.duration(dur.reveal)}>
            <Image
              source={covers[track.cover]}
              style={{ width: 200, height: 200, borderRadius: 28 }}
              contentFit="cover"
              accessibilityIgnoresInvertColors
            />
          </Animated.View>
          <Animated.View entering={FadeInDown.duration(dur.screen).delay(220)} style={{ alignItems: 'center' }}>
            <AppText variant="caption" tone="accent" style={{ marginTop: 20 }}>
              {map.line}
            </AppText>
            <AppText variant="display" tone="title" style={{ textAlign: 'center', marginTop: 6 }}>
              We’ll start you with {track.title}
            </AppText>
            <AppText variant="body" tone="muted" style={{ textAlign: 'center', maxWidth: 300, marginTop: 10 }}>
              It’s yours free tonight. Create your account to keep your picks across the household.
            </AppText>
          </Animated.View>
        </View>
        <PrimaryButton label="Create your account" onPress={finish} />
        <Pressable onPress={() => setStage('quiz')} accessibilityRole="button" style={{ alignItems: 'center', paddingVertical: 12, marginTop: 4 }}>
          <AppText variant="label" tone="muted">
            Choose again
          </AppText>
        </Pressable>
      </Screen>
    );
  }

  // ---- intro slides ----
  return (
    <Screen contentStyle={{ flex: 1, paddingTop: 8, paddingBottom: 28 }}>
      <OnboardingHeader onSkip={finish} />

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {/* art re-mounts per slide so its entrance + float replay */}
        <Animated.View
          key={`art-${i}`}
          entering={FadeIn.duration(dur.screen)}
          exiting={FadeOut.duration(dur.press)}
          style={{ marginBottom: 28, height: 220, alignItems: 'center', justifyContent: 'center' }}>
          <SlideArt art={slide.art} />
        </Animated.View>
        <Animated.View key={`title-${i}`} entering={FadeInDown.duration(dur.screen)} style={{ alignItems: 'center' }}>
          <AppText variant="display" tone="title" style={{ textAlign: 'center' }}>
            {slide.title}
          </AppText>
        </Animated.View>
        <Animated.View key={`body-${i}`} entering={FadeInDown.duration(dur.screen).delay(90)} style={{ alignItems: 'center' }}>
          <AppText variant="body" tone="muted" style={{ textAlign: 'center', maxWidth: 320, marginTop: 12 }}>
            {slide.body}
          </AppText>
        </Animated.View>
      </View>

      {/* progress dots */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
        {SLIDES.map((_, idx) => (
          <Dot key={idx} active={idx === i} />
        ))}
      </View>

      <PrimaryButton label={last ? 'Get started' : 'Next'} onPress={() => (last ? setStage('quiz') : setI((v) => v + 1))} />
      {i > 0 ? (
        <Pressable
          onPress={() => setI((v) => Math.max(0, v - 1))}
          accessibilityRole="button"
          style={{ alignItems: 'center', paddingVertical: 12, marginTop: 4 }}>
          <AppText variant="label" tone="muted">
            Back
          </AppText>
        </Pressable>
      ) : null}
    </Screen>
  );
}
