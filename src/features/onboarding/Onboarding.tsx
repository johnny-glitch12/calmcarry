import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AppText, GlowOrb, Logo, PrimaryButton, Screen } from '@/components';
import { covers, type CoverKey } from '@/content/covers';
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

export function Onboarding() {
  const router = useRouter();
  const { c } = useTheme();
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;
  const slide = SLIDES[i];

  const finish = () => {
    markOnboarded();
    router.replace('/auth');
  };

  return (
    <Screen contentStyle={{ flex: 1, paddingTop: 8, paddingBottom: 28 }}>
      {/* brand + skip */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 28 }}>
        <Logo size="sm" />
        {!last ? (
          <Pressable onPress={finish} hitSlop={{ top: 13, bottom: 13, left: 12, right: 12 }} accessibilityRole="button">
            <AppText variant="label" tone="muted">
              Skip
            </AppText>
          </Pressable>
        ) : null}
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
            <GlowOrb size={150} reserveGlow aura />
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
        onPress={() => (last ? finish() : setI((v) => v + 1))}
      />
      {/* Back — let people revisit a slide (ui-ux-pro-max: provide Skip AND Back) */}
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
