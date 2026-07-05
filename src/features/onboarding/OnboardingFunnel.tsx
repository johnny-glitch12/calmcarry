import { Feather } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Linking, View } from 'react-native';
import Animated, {
  FadeIn,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  Appear,
  AppText,
  Crossfade,
  PressableScale,
  PrimaryButton,
  ProgressRing,
  Reveal,
  Screen,
  SelectionOverlay,
} from '@/components';
import { audioSources } from '@/content/audio';
import { GOAL_ICONS } from '@/content/onboardingArt';
import { PRIVACY_URL, TERMS_URL } from '@/content/store';
import { useProfile, type Intent } from '@/features/profile/ProfileProvider';
import { lightTap } from '@/lib/haptics';
import { markOnboarded } from '@/lib/onboarding';
import { setJSON } from '@/lib/store';
import { dur, ease, fonts, useTheme } from '@/theme';

import { Starfield } from './Starfield';

// Poppins across the whole funnel (per the brief). Headlines use Poppins-Bold
// rather than the app's Montserrat headings so the onboarding reads as one voice.
const P = {
  hero: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 38, letterSpacing: -0.3 },
  title: { fontFamily: fonts.bold, fontSize: 25, lineHeight: 31, letterSpacing: -0.2 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  rowLabel: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 21 },
  rowHint: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 17 },
  label: { fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 0.3 },
} as const;

// ---- answers accumulated across the funnel ----
type Answers = {
  satisfaction?: number; // 1..5
  goals?: string[]; // help-with keys
  hours?: number; // 4..8
  gender?: string;
  age?: string;
  source?: string;
};

type StepProps = {
  onNext: () => void;
  onBack: () => void;
  onSignIn: () => void;
  answers: Answers;
  setAnswer: <K extends keyof Answers>(k: K, v: Answers[K]) => void;
  progress: number; // 0..1 position through the funnel
};

// ---- the funnel's ordered steps (Wave 3/4 append slider, sync, sounds, trial, pricing) ----
const STEPS = ['welcome', 'transform', 'satisfaction', 'reassure', 'help', 'hours', 'gender', 'age', 'source'] as const;
type StepId = (typeof STEPS)[number];

const GOALS: { key: string; label: string; hint: string; intent: Intent; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'fall-asleep', label: 'Fall asleep faster', hint: 'Drift off without the tossing and turning', intent: 'sleep', icon: 'moon' },
  { key: 'stay-asleep', label: 'Stay asleep through the night', hint: 'Fewer 3am wake-ups', intent: 'sleep', icon: 'shield' },
  { key: 'wake-refreshed', label: 'Wake up refreshed', hint: 'Mornings that feel rested', intent: 'suggest', icon: 'sunrise' },
  { key: 'quiet-mind', label: 'Quiet a racing mind', hint: 'Settle the mental chatter', intent: 'reset', icon: 'wind' },
  { key: 'routine', label: 'Build a bedtime routine', hint: 'A rhythm you can keep', intent: 'sleep', icon: 'repeat' },
];

const SATISFACTION = [
  { v: 1, label: 'Very dissatisfied' },
  { v: 2, label: 'Dissatisfied' },
  { v: 3, label: 'It’s okay' },
  { v: 4, label: 'Satisfied' },
  { v: 5, label: 'Very satisfied' },
];

const GENDERS = ['Female', 'Male', 'Non-binary', 'Other', 'Prefer not to say'];
const AGES = ['18–24', '25–34', '35–44', '45–54', '55–64', '65+'];
const SOURCES: { key: string; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'tiktok', label: 'TikTok', icon: 'music' },
  { key: 'instagram', label: 'Instagram', icon: 'instagram' },
  { key: 'youtube', label: 'YouTube', icon: 'youtube' },
  { key: 'facebook', label: 'Facebook', icon: 'facebook' },
  { key: 'appstore', label: 'App Store', icon: 'smartphone' },
  { key: 'friend', label: 'A friend', icon: 'users' },
  { key: 'search', label: 'Search', icon: 'search' },
  { key: 'other', label: 'Somewhere else', icon: 'more-horizontal' },
];

// =====================================================================
// shared chrome
// =====================================================================

/** Small tappable inline legal link with a press dim. */
function LegalLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <PressableScale onPress={onPress} accessibilityRole="link" dimTo={0.6} hitSlop={10}>
      <AppText style={[P.label, { color: c.muted, textTransform: 'none' }]}>{label}</AppText>
    </PressableScale>
  );
}

/** A thin progress bar that eases toward the funnel position. */
function ProgressBar({ progress }: { progress: number }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const p = useSharedValue(progress);
  useEffect(() => {
    p.value = reduced ? progress : withTiming(progress, { duration: dur.sheet, easing: ease.out });
  }, [progress, reduced, p]);
  const fill = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, p.value)) * 100}%` }));
  return (
    <View style={{ height: 4, borderRadius: 2, backgroundColor: c.line, overflow: 'hidden' }}>
      <Animated.View style={[{ height: 4, borderRadius: 2, backgroundColor: c.accent }, fill]} />
    </View>
  );
}

/** Shared question chrome: back + progress, title/subtitle, scrollable body, pinned Continue. */
function FunnelShell({
  onBack,
  progress,
  kicker,
  title,
  subtitle,
  children,
  onContinue,
  continueLabel = 'Continue',
  canContinue = true,
}: {
  onBack: () => void;
  progress: number;
  kicker?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onContinue: () => void;
  continueLabel?: string;
  canContinue?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Screen mode="night" scroll contentStyle={{ paddingBottom: 120 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 2, paddingBottom: 18 }}>
        <PressableScale onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" dimTo={0.6} hitSlop={12}>
          <Feather name="chevron-left" size={26} color={c.text} />
        </PressableScale>
        <View style={{ flex: 1 }}>
          <ProgressBar progress={progress} />
        </View>
      </View>

      <Reveal>
        {kicker ? <AppText style={[P.label, { color: c.textAccent, marginBottom: 8 }]}>{kicker}</AppText> : null}
        <AppText style={[P.title, { color: c.text }]}>{title}</AppText>
        {subtitle ? <AppText style={[P.body, { color: c.muted, marginTop: 10 }]}>{subtitle}</AppText> : null}
      </Reveal>

      <View style={{ marginTop: 24, gap: 12 }}>{children}</View>

      {/* pinned footer */}
      <View style={{ position: 'absolute', left: 24, right: 24, bottom: 24 }}>
        <PrimaryButton label={continueLabel} onPress={onContinue} disabled={!canContinue} />
      </View>
    </Screen>
  );
}

/** A selectable option row: optional leading art, label + hint, eased tint + check. */
function ChoiceRow({
  label,
  hint,
  selected,
  onPress,
  leading,
  index = 0,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
  leading?: ReactNode;
  index?: number;
}) {
  const { c } = useTheme();
  return (
    <Reveal index={index}>
      <PressableScale
        onPress={onPress}
        onPressIn={lightTap}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={label}
        scaleTo={0.985}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          padding: 14,
          borderRadius: 16,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: c.line,
          backgroundColor: c.surface,
        }}>
        <SelectionOverlay active={selected} style={{ borderRadius: 16, borderWidth: 1.5, borderColor: c.accent, backgroundColor: c.panelStrong }} />
        {leading ? <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>{leading}</View> : null}
        <View style={{ flex: 1 }}>
          <AppText style={[P.rowLabel, { color: c.text }]}>{label}</AppText>
          {hint ? <AppText style={[P.rowHint, { color: c.muted, marginTop: 2 }]}>{hint}</AppText> : null}
        </View>
        <View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
          <Crossfade
            style={{ width: 22, height: 22 }}
            active={selected}
            front={
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="check" size={14} color={c.ctaText} />
              </View>
            }
            back={<View style={{ width: 21, height: 21, borderRadius: 11, borderWidth: 1.5, borderColor: c.line }} />}
          />
        </View>
      </PressableScale>
    </Reveal>
  );
}

/** Icon chip used as the leading art on a choice row (fallback + brand-source rows). */
function IconChip({ icon }: { icon: keyof typeof Feather.glyphMap }) {
  const { c } = useTheme();
  return (
    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.panel, alignItems: 'center', justifyContent: 'center' }}>
      <Feather name={icon} size={20} color={c.textAccent} />
    </View>
  );
}

// =====================================================================
// steps
// =====================================================================

/** 1 — WELCOME: starlit, calming ambience, one gentle way forward. */
function WelcomeStep({ onNext, onSignIn }: StepProps) {
  const { c } = useTheme();

  // A soft, low night hum under the stars — sets the mood the instant the journey
  // begins. Native autoplays; web stays silent until a gesture.
  const ambient = useAudioPlayer(audioSources.drone);
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
      vol.current = Math.min(0.2, vol.current + 0.02);
      try {
        ambient.volume = vol.current;
      } catch {
        /* released */
      }
      if (vol.current >= 0.2) clearInterval(id);
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
    <Screen mode="night" backdrop={<Starfield />} contentStyle={{ flex: 1, paddingBottom: 20 }}>
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

      <Reveal index={3} style={{ alignItems: 'center', gap: 18 }}>
        <PressableScale
          onPress={onNext}
          onPressIn={lightTap}
          accessibilityRole="button"
          accessibilityLabel="Begin"
          scaleTo={0.94}
          style={{ width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: c.ctaBg, ...c.shadow }}>
          <Feather name="arrow-right" size={26} color={c.ctaText} />
        </PressableScale>
        <PressableScale onPress={onSignIn} accessibilityRole="button" dimTo={0.6} hitSlop={10}>
          <AppText style={[P.body, { color: c.muted, fontSize: 15 }]}>
            I already have an account. <AppText style={{ fontFamily: fonts.semibold, color: c.textAccent }}>Sign in</AppText>
          </AppText>
        </PressableScale>
      </Reveal>

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

function TransformCard({ label, image, tone, index, highlight }: { label: string; image: number; tone: string; index: number; highlight?: boolean }) {
  const { c } = useTheme();
  return (
    <Animated.View entering={FadeIn.duration(dur.screen).delay(index * 90).easing(ease.out).reduceMotion(ReduceMotion.System)} style={{ flex: 1 }}>
      <View style={{ borderRadius: 20, overflow: 'hidden', borderWidth: highlight ? 1.5 : 1, borderColor: highlight ? c.textAccent : c.line, ...c.shadow }}>
        <Image source={image} style={{ width: '100%', aspectRatio: 3 / 4 }} contentFit="cover" transition={{ duration: dur.nav, effect: 'cross-dissolve' }} accessibilityIgnoresInvertColors />
      </View>
      <AppText style={[P.label, { color: tone, textAlign: 'center', marginTop: 12, textTransform: 'none' }]}>{label}</AppText>
    </Animated.View>
  );
}

/** 3 — SATISFACTION */
function SatisfactionStep({ onNext, onBack, answers, setAnswer, progress }: StepProps) {
  return (
    <FunnelShell
      onBack={onBack}
      progress={progress}
      kicker="ABOUT YOUR SLEEP"
      title="How satisfied are you with your sleep?"
      subtitle="There are no wrong answers — this just helps us start in the right place."
      onContinue={onNext}
      canContinue={!!answers.satisfaction}>
      {SATISFACTION.map((s, i) => (
        <ChoiceRow key={s.v} index={i} label={s.label} selected={answers.satisfaction === s.v} onPress={() => setAnswer('satisfaction', s.v)} />
      ))}
    </FunnelShell>
  );
}

/** 4 — REASSURANCE (keyed to the satisfaction answer) */
function ReassureStep({ onNext, onBack, answers }: StepProps) {
  const { c } = useTheme();
  const s = answers.satisfaction ?? 3;
  const msg =
    s <= 2
      ? { title: 'You’re not alone — and you’re in the right place.', body: 'Rough nights wear on everything. We’ll help you build back toward rest, gently and at your pace.' }
      : s === 3
        ? { title: 'There’s room to feel more rested.', body: 'A few small, steady habits can move “okay” toward genuinely good. Let’s find yours.' }
        : { title: 'Let’s protect the good nights.', body: 'You’re already doing something right. We’ll help you keep it — and deepen it.' };
  return (
    <Screen mode="night" contentStyle={{ flex: 1, paddingBottom: 24 }}>
      <PressableScale onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" dimTo={0.6} hitSlop={12} style={{ alignSelf: 'flex-start', paddingVertical: 6 }}>
        <Feather name="chevron-left" size={26} color={c.text} />
      </PressableScale>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
        <Reveal style={{ alignItems: 'center' }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.panel, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <Feather name="heart" size={26} color={c.textAccent} />
          </View>
        </Reveal>
        <Reveal index={1}>
          <AppText style={[P.title, { color: c.text, textAlign: 'center' }]}>{msg.title}</AppText>
        </Reveal>
        <Reveal index={2}>
          <AppText style={[P.body, { color: c.muted, textAlign: 'center', maxWidth: 320 }]}>{msg.body}</AppText>
        </Reveal>
      </View>
      <Reveal index={3}>
        <PrimaryButton label="Continue" onPress={onNext} />
      </Reveal>
    </Screen>
  );
}

/** 5 — HELP WITH (multi-select, AI icons) */
function HelpStep({ onNext, onBack, answers, setAnswer, progress }: StepProps) {
  const goals = answers.goals ?? [];
  const toggle = (key: string) => setAnswer('goals', goals.includes(key) ? goals.filter((g) => g !== key) : [...goals, key]);
  return (
    <FunnelShell
      onBack={onBack}
      progress={progress}
      kicker="WHERE WE’LL FOCUS"
      title="What can we help you with?"
      subtitle="Pick everything that fits — you can change this later."
      onContinue={onNext}
      canContinue={goals.length > 0}>
      {GOALS.map((g, i) => (
        <ChoiceRow
          key={g.key}
          index={i}
          label={g.label}
          hint={g.hint}
          selected={goals.includes(g.key)}
          onPress={() => toggle(g.key)}
          leading={GOAL_ICONS[g.key] ? <Image source={GOAL_ICONS[g.key]} style={{ width: 44, height: 44 }} contentFit="contain" /> : <IconChip icon={g.icon} />}
        />
      ))}
    </FunnelShell>
  );
}

/** 6 — HOURS (fill-circle stepper) */
function HoursStep({ onNext, onBack, answers, setAnswer, progress }: StepProps) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const value = answers.hours ?? 6;
  const touched = answers.hours !== undefined;
  // 40% under 5 → full at 8 (per the brief); the ring eases as the number changes
  const fillFor = (v: number) => Math.max(0.12, Math.min(1, 0.4 + (v - 4) * 0.15));
  const ring = useSharedValue(fillFor(value));
  useEffect(() => {
    ring.value = reduced ? fillFor(value) : withTiming(fillFor(value), { duration: dur.sheet, easing: ease.out });
  }, [value, reduced, ring]);

  const set = (v: number) => {
    const clamped = Math.max(4, Math.min(8, v));
    lightTap();
    setAnswer('hours', clamped);
  };

  return (
    <FunnelShell
      onBack={onBack}
      progress={progress}
      kicker="YOUR NIGHTS NOW"
      title="How many hours do you usually sleep?"
      subtitle="A rough average is perfect."
      onContinue={onNext}
      canContinue={touched}>
      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <View style={{ width: 220, height: 220, alignItems: 'center', justifyContent: 'center' }}>
          <ProgressRing progress={ring} size={220} strokeWidth={10} fill color={c.accent} trackColor={c.line} style={{ position: 'absolute' }} />
          <AppText style={{ fontFamily: fonts.bold, fontSize: 56, lineHeight: 62, color: c.text }}>{value === 8 ? '8+' : value}</AppText>
          <AppText style={[P.label, { color: c.muted, textTransform: 'none', marginTop: 2 }]}>hours a night</AppText>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 28, marginTop: 24 }}>
          <PressableScale onPress={() => set(value - 1)} disabled={value <= 4} accessibilityRole="button" accessibilityLabel="Fewer hours" scaleTo={0.9}
            style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', opacity: value <= 4 ? 0.4 : 1 }}>
            <Feather name="minus" size={24} color={c.text} />
          </PressableScale>
          <PressableScale onPress={() => set(value + 1)} disabled={value >= 8} accessibilityRole="button" accessibilityLabel="More hours" scaleTo={0.9}
            style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', opacity: value >= 8 ? 0.4 : 1 }}>
            <Feather name="plus" size={24} color={c.text} />
          </PressableScale>
        </View>
      </View>
    </FunnelShell>
  );
}

/** 7 — GENDER (optional, on-device) */
function GenderStep({ onNext, onBack, answers, setAnswer, progress }: StepProps) {
  const { c } = useTheme();
  return (
    <FunnelShell
      onBack={onBack}
      progress={progress}
      kicker="A GENTLE QUESTION"
      title="Hormone levels can influence sleep patterns."
      subtitle="Optional, and stored only on your device — it helps us tailor guidance."
      onContinue={onNext}
      canContinue
      continueLabel={answers.gender ? 'Continue' : 'Skip'}>
      {GENDERS.map((g, i) => (
        <ChoiceRow key={g} index={i} label={g} selected={answers.gender === g} onPress={() => setAnswer('gender', g)} />
      ))}
      <AppText style={[P.rowHint, { color: c.dim, textAlign: 'center', marginTop: 6 }]}>
        We never sell your data. This stays on this device.
      </AppText>
    </FunnelShell>
  );
}

/** 8 — AGE */
function AgeStep({ onNext, onBack, answers, setAnswer, progress }: StepProps) {
  return (
    <FunnelShell
      onBack={onBack}
      progress={progress}
      kicker="A GENTLE QUESTION"
      title="As we age, our sleep needs change."
      subtitle="Which range are you in?"
      onContinue={onNext}
      canContinue={!!answers.age}>
      {AGES.map((a, i) => (
        <ChoiceRow key={a} index={i} label={a} selected={answers.age === a} onPress={() => setAnswer('age', a)} />
      ))}
    </FunnelShell>
  );
}

/** 9 — SOURCE */
function SourceStep({ onNext, onBack, answers, setAnswer, progress }: StepProps) {
  return (
    <FunnelShell
      onBack={onBack}
      progress={progress}
      kicker="ONE LAST THING"
      title="Where did you hear about us?"
      onContinue={onNext}
      canContinue
      continueLabel={answers.source ? 'Continue' : 'Skip'}>
      {SOURCES.map((s, i) => (
        <ChoiceRow key={s.key} index={i} label={s.label} selected={answers.source === s.key} onPress={() => setAnswer('source', s.key)} leading={<IconChip icon={s.icon} />} />
      ))}
    </FunnelShell>
  );
}

const STEP_COMPONENTS: Record<StepId, (p: StepProps) => React.ReactElement> = {
  welcome: WelcomeStep,
  transform: TransformStep,
  satisfaction: SatisfactionStep,
  reassure: ReassureStep,
  help: HelpStep,
  hours: HoursStep,
  gender: GenderStep,
  age: AgeStep,
  source: SourceStep,
};

export function OnboardingFunnel() {
  const router = useRouter();
  const { setIntent } = useProfile();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});

  const setAnswer = useCallback(<K extends keyof Answers>(k: K, v: Answers[K]) => {
    setAnswers((a) => ({ ...a, [k]: v }));
  }, []);

  const finish = useCallback(
    (final: Answers) => {
      // persist the survey (on-device) + map the first chosen goal to a personalization intent
      setJSON('cc.onboarding', final);
      const firstGoal = final.goals?.[0];
      const intent = GOALS.find((g) => g.key === firstGoal)?.intent;
      if (intent) setIntent(intent);
      markOnboarded();
      router.replace('/auth');
    },
    [router, setIntent],
  );

  const onNext = useCallback(() => {
    lightTap();
    setIndex((i) => {
      if (i >= STEPS.length - 1) {
        finish(answers);
        return i;
      }
      return i + 1;
    });
  }, [finish, answers]);

  const onBack = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const onSignIn = useCallback(() => {
    markOnboarded();
    router.replace('/auth');
  }, [router]);

  const stepId = STEPS[index];
  const StepComponent = STEP_COMPONENTS[stepId];
  const progress = index / (STEPS.length - 1);

  return (
    <Appear key={stepId} enter={dur.nav} style={{ flex: 1 }}>
      <StepComponent onNext={onNext} onBack={onBack} onSignIn={onSignIn} answers={answers} setAnswer={setAnswer} progress={progress} />
    </Appear>
  );
}
