import { Feather } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { Appear, AppText, PressableScale, PrimaryButton, Reveal, Screen } from '@/components';
import { audioSources } from '@/content/audio';
import { PRIVACY_URL, TERMS_URL } from '@/content/store';
import { lightTap } from '@/lib/haptics';
import { markOnboarded } from '@/lib/onboarding';
import { dur, ease, fonts, useTheme } from '@/theme';

import { FlickerBackground } from './FlickerBackground';

// Poppins across the whole funnel (per the brief). Headlines use Poppins-Bold
// rather than the app's Montserrat headings so the onboarding reads as one voice.
const P = {
  hero: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 38, letterSpacing: -0.3 },
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.2 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 0.3 },
} as const;

// ---- the funnel's ordered steps. More get inserted between transform and the
// finish as later waves land (satisfaction, help, hours, gender, age, source,
// goal, sync, sounds, trial, pricing). ----
const STEPS = ['welcome', 'transform'] as const;
type StepId = (typeof STEPS)[number];

type StepProps = {
  onNext: () => void;
  onBack: () => void;
  onSignIn: () => void;
};

/** Small tappable inline legal link with a press dim (kept inline, not a button). */
function LegalLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <PressableScale onPress={onPress} accessibilityRole="link" dimTo={0.6} hitSlop={10}>
      <AppText style={[P.label, { color: c.muted, textTransform: 'none' }]}>{label}</AppText>
    </PressableScale>
  );
}

/** 1 — WELCOME: firelit, calming ambience, one gentle way forward. */
function WelcomeStep({ onNext, onSignIn }: StepProps) {
  const { c } = useTheme();

  // A low, warm hearth bed under the firelight — sets the mood the instant the
  // journey begins. Native autoplays; web stays silent until a gesture.
  const ambient = useAudioPlayer(audioSources.fire);
  const vol = useRef(0);
  useEffect(() => {
    let cancelled = false;
    try {
      ambient.loop = true;
      ambient.volume = 0;
      ambient.play();
    } catch {
      /* released / web */
    }
    const id = setInterval(() => {
      if (cancelled) return;
      vol.current = Math.min(0.22, vol.current + 0.02);
      try {
        ambient.volume = vol.current;
      } catch {
        /* released */
      }
      if (vol.current >= 0.22) clearInterval(id);
    }, 90);
    return () => {
      cancelled = true;
      clearInterval(id);
      try {
        ambient.pause();
      } catch {
        /* released */
      }
    };
  }, [ambient]);

  return (
    <Screen mode="night" backdrop={<FlickerBackground />} contentStyle={{ flex: 1, paddingBottom: 20 }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 }}>
        <Reveal>
          <AppText style={[P.label, { color: c.textAccent, textAlign: 'center', marginBottom: 6 }]}>CALMCARRY</AppText>
        </Reveal>
        <Reveal index={1}>
          <AppText style={[P.hero, { color: c.text, textAlign: 'center' }]}>Welcome</AppText>
        </Reveal>
        <Reveal index={2}>
          <AppText style={[P.body, { color: c.muted, textAlign: 'center', maxWidth: 300 }]}>
            Let’s begin your journey to calmer, deeper nights — one gentle wind-down at a time.
          </AppText>
        </Reveal>
      </View>

      {/* one clear way forward — a soft circular arrow */}
      <Reveal index={3} style={{ alignItems: 'center', gap: 18 }}>
        <PressableScale
          onPress={onNext}
          onPressIn={lightTap}
          accessibilityRole="button"
          accessibilityLabel="Begin"
          scaleTo={0.94}
          style={{
            width: 68,
            height: 68,
            borderRadius: 34,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.ctaBg,
            ...c.shadow,
          }}>
          <Feather name="arrow-right" size={26} color={c.ctaText} />
        </PressableScale>
        <PressableScale onPress={onSignIn} accessibilityRole="button" dimTo={0.6} hitSlop={10}>
          <AppText style={[P.body, { color: c.muted, fontSize: 15 }]}>
            I already have an account. <AppText style={{ fontFamily: fonts.semibold, color: c.textAccent }}>Sign in</AppText>
          </AppText>
        </PressableScale>
      </Reveal>

      {/* legal — small, quiet, always reachable */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 18, marginTop: 22 }}>
        <LegalLink label="Privacy Policy" onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})} />
        <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: c.line }} />
        <LegalLink label="Terms of Service" onPress={() => Linking.openURL(TERMS_URL).catch(() => {})} />
      </View>
    </Screen>
  );
}

/** 2 — TRANSFORM: you today vs. you in a week (the aspiration, honestly framed). */
function TransformStep({ onNext, onBack }: StepProps) {
  const { c } = useTheme();
  return (
    <Screen mode="night" contentStyle={{ flex: 1, paddingBottom: 20 }}>
      <PressableScale onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" dimTo={0.6} hitSlop={12} style={{ alignSelf: 'flex-start', paddingVertical: 6 }}>
        <Feather name="chevron-left" size={26} color={c.text} />
      </PressableScale>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Reveal>
          <AppText style={[P.title, { color: c.text, textAlign: 'center' }]}>The power of a nightly ritual</AppText>
        </Reveal>
        <Reveal index={1}>
          <AppText style={[P.body, { color: c.muted, textAlign: 'center', maxWidth: 320, alignSelf: 'center', marginTop: 10 }]}>
            A steady wind-down can change how your nights feel. Here’s the shift we’re after.
          </AppText>
        </Reveal>

        <View style={{ flexDirection: 'row', gap: 14, marginTop: 28 }}>
          <TransformCard label="You today" image={require('../../../assets/images/onboarding/you-today.png')} tone={c.muted} index={2} />
          <TransformCard label="In a week" image={require('../../../assets/images/onboarding/you-week.png')} tone={c.textAccent} index={3} highlight />
        </View>
      </View>

      <Reveal index={4}>
        <PrimaryButton label="Continue" onPress={onNext} />
      </Reveal>
    </Screen>
  );
}

function TransformCard({
  label,
  image,
  tone,
  index,
  highlight,
}: {
  label: string;
  image: number;
  tone: string;
  index: number;
  highlight?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Animated.View
      entering={FadeIn.duration(dur.screen).delay(index * 90).easing(ease.out).reduceMotion(ReduceMotion.System)}
      style={{ flex: 1 }}>
      <View
        style={{
          borderRadius: 20,
          overflow: 'hidden',
          borderWidth: highlight ? 1.5 : 1,
          borderColor: highlight ? c.textAccent : c.line,
          ...c.shadow,
        }}>
        <Image source={image} style={{ width: '100%', aspectRatio: 3 / 4 }} contentFit="cover" transition={{ duration: dur.nav, effect: 'cross-dissolve' }} accessibilityIgnoresInvertColors />
      </View>
      <AppText style={[P.label, { color: tone, textAlign: 'center', marginTop: 12, textTransform: 'none' }]}>{label}</AppText>
    </Animated.View>
  );
}

const STEP_COMPONENTS: Record<StepId, (p: StepProps) => React.ReactElement> = {
  welcome: WelcomeStep,
  transform: TransformStep,
};

export function OnboardingFunnel() {
  const router = useRouter();
  const [index, setIndex] = useState(0);

  const finish = useCallback(() => {
    markOnboarded();
    router.replace('/auth');
  }, [router]);

  const onNext = useCallback(() => {
    lightTap();
    setIndex((i) => {
      if (i >= STEPS.length - 1) {
        finish();
        return i;
      }
      return i + 1;
    });
  }, [finish]);

  const onBack = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const onSignIn = useCallback(() => {
    markOnboarded();
    router.replace('/auth');
  }, [router]);

  const stepId = STEPS[index];
  const StepComponent = STEP_COMPONENTS[stepId];

  // keyed so each step cross-fades in as the funnel advances (never a hard cut)
  return (
    <Appear key={stepId} enter={dur.nav} style={{ flex: 1 }}>
      <StepComponent onNext={onNext} onBack={onBack} onSignIn={onSignIn} />
    </Appear>
  );
}
