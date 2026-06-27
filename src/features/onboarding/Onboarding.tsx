import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AppText, GlowOrb, Logo, PrimaryButton, Screen } from '@/components';
import { FEELING_MAP, useProfile, type Feeling } from '@/features/profile/ProfileProvider';
import { covers, type CoverKey } from '@/content/covers';
import { TRACKS } from '@/content/library';
import { markOnboarded } from '@/lib/onboarding';
import { useTheme } from '@/theme';

type Slide = { cover?: CoverKey; title: string; body: string };

const SLIDES: Slide[] = [
  {
    title: 'Welcome to CalmCarry',
    body: 'Your companion for calmer evenings and deeper, more restful nights.',
  },
  {
    cover: 'slowTide',
    title: 'Works the moment you hold it',
    body: 'No app is needed to use your Glow Orb. This is simply the calm way to get more from it.',
  },
  {
    cover: 'deepRest',
    title: 'A library made for sleep',
    body: 'Soundscapes, sleep tales, and guided wind-downs — held in your hand, fading you to silence.',
  },
  {
    cover: 'forestStream',
    title: 'Yours, protected',
    body: "Register your device, confirm it's genuine, and keep your warranty close.",
  },
];

// The personalization step — same warm, forward-looking feelings as the nightly
// check-in (safe words only; no clinical terms). Picks the first session so the
// recommendation feels earned before the paywall ever appears.
const FEELINGS: { id: Feeling; label: string }[] = [
  { id: 'racing', label: 'My mind’s racing' },
  { id: 'cant-switch-off', label: 'I can’t switch off' },
  { id: 'wired-tired', label: 'Wired but tired' },
  { id: 'wound-up', label: 'I’m wound up' },
  { id: 'heavy-day', label: 'It’s been a heavy day' },
  { id: 'quiet', label: 'I just want quiet' },
];

export function Onboarding() {
  const router = useRouter();
  const { c } = useTheme();
  const { setFeeling } = useProfile();
  const [stage, setStage] = useState<'intro' | 'quiz' | 'result'>('intro');
  const [i, setI] = useState(0);
  const [chosen, setChosen] = useState<Feeling | null>(null);
  const last = i === SLIDES.length - 1;
  const slide = SLIDES[i];

  const finish = () => {
    markOnboarded();
    router.replace('/auth');
  };

  const pick = (f: Feeling) => {
    setChosen(f);
    setFeeling(f); // seeds the recommendation for this session (best-effort)
    setStage('result');
  };

  // ---- personalization quiz ----
  if (stage === 'quiz') {
    return (
      <Screen contentStyle={{ flex: 1, paddingTop: 8, paddingBottom: 28 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 28 }}>
          <Logo size="sm" />
          <Pressable onPress={finish} hitSlop={{ top: 13, bottom: 13, left: 12, right: 12 }} accessibilityRole="button">
            <AppText variant="label" tone="muted">
              Skip
            </AppText>
          </Pressable>
        </View>
        <Animated.View entering={FadeIn.duration(320)} style={{ flex: 1, justifyContent: 'center' }}>
          <AppText variant="display" tone="title" style={{ textAlign: 'center' }}>
            How are you arriving tonight?
          </AppText>
          <AppText variant="body" tone="muted" style={{ textAlign: 'center', maxWidth: 320, marginTop: 12, alignSelf: 'center' }}>
            Just so we can start you somewhere that fits. There’s no wrong answer.
          </AppText>
          <View style={{ gap: 10, marginTop: 28 }}>
            {FEELINGS.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => pick(f.id)}
                accessibilityRole="button"
                accessibilityLabel={f.label}>
                <View
                  style={{
                    paddingVertical: 16,
                    paddingHorizontal: 18,
                    borderRadius: 14,
                    backgroundColor: c.surface,
                    borderWidth: 1,
                    borderColor: c.line,
                    ...c.shadow,
                  }}>
                  <AppText variant="bodyMedium" tone="title">
                    {f.label}
                  </AppText>
                </View>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </Screen>
    );
  }

  // ---- earned first recommendation (primes the soft paywall) ----
  if (stage === 'result' && chosen) {
    const map = FEELING_MAP[chosen];
    const track = TRACKS[map.track] ?? TRACKS['slow-tide'];
    return (
      <Screen contentStyle={{ flex: 1, paddingTop: 8, paddingBottom: 28 }}>
        <View style={{ minHeight: 28 }}>
          <Logo size="sm" />
        </View>
        <Animated.View entering={FadeIn.duration(360)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Image
            source={covers[track.cover]}
            style={{ width: 200, height: 200, borderRadius: 28 }}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
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
      {/* brand + skip */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 28 }}>
        <Logo size="sm" />
        <Pressable onPress={finish} hitSlop={{ top: 13, bottom: 13, left: 12, right: 12 }} accessibilityRole="button">
          <AppText variant="label" tone="muted">
            Skip
          </AppText>
        </Pressable>
      </View>

      {/* slide */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Animated.View key={`art-${i}`} entering={FadeIn.duration(320)} style={{ marginBottom: 24 }}>
          {slide.cover ? (
            <Image
              source={covers[slide.cover]}
              style={{ width: 220, height: 220, borderRadius: 32 }}
              contentFit="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <GlowOrb size={150} reserveGlow />
          )}
        </Animated.View>
        <Animated.View key={`txt-${i}`} entering={FadeIn.duration(320)} style={{ alignItems: 'center' }}>
          <AppText variant="display" tone="title" style={{ textAlign: 'center' }}>
            {slide.title}
          </AppText>
          <AppText variant="body" tone="muted" style={{ textAlign: 'center', maxWidth: 320, marginTop: 12 }}>
            {slide.body}
          </AppText>
        </Animated.View>
      </View>

      {/* dots */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
        {SLIDES.map((_, idx) => (
          <View
            key={idx}
            style={{
              width: idx === i ? 22 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: idx === i ? c.accent : c.line,
            }}
          />
        ))}
      </View>

      <PrimaryButton
        label={last ? 'Get started' : 'Next'}
        onPress={() => (last ? setStage('quiz') : setI((v) => v + 1))}
      />
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
