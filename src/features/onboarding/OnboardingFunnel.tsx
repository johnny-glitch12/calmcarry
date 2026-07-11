import { Feather } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BackHandler, Linking, ScrollView, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import {
  Appear,
  AppText,
  Crossfade,
  Logo,
  PressableScale,
  PrimaryButton,
  ProgressRing,
  Reveal,
  Screen,
  SelectionOverlay,
  SwapText,
} from '@/components';
import { audioSources, type AudioKey } from '@/content/audio';
import { covers, type CoverKey } from '@/content/covers';
import { GOAL_ICONS } from '@/content/onboardingArt';
import { PRICING, PRIVACY_URL, TERMS_URL, TRIAL_DAYS } from '@/content/store';
import { useProfile, type Intent } from '@/features/profile/ProfileProvider';
import { lightTap } from '@/lib/haptics';
import { fetchLocalizedPrices, iapSupported } from '@/lib/iap';
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
  hours?: number; // 4..8 in 0.25 (15-min) steps
  gender?: string;
  age?: string;
  source?: string;
  goalHours?: number; // desired nightly sleep, 4..12 in 0.25 steps
  wearable?: string; // 'apple' | 'whoop'
  moments?: string[]; // when they want help — day AND night use-cases, not just sleep
  wantsTrial?: boolean; // tapped "Start my free trial" on the pricing step
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
const STEPS = [
  'welcome',
  'transform',
  'satisfaction',
  'reassure',
  'help',
  'moments',
  'hours',
  'gender',
  'age',
  'source',
  'goal',
  'sync',
  'sounds',
  'trialFree',
  'trialReminder',
  'pricing',
] as const;
type StepId = (typeof STEPS)[number];

const WEARABLES: { key: string; label: string; hint: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'apple', label: 'Apple Watch', hint: 'Sleep & heart rate', icon: 'watch' },
  { key: 'whoop', label: 'Whoop', hint: 'Recovery & sleep', icon: 'activity' },
];

// Cover art cycled through the sleep-sounds "now playing" demo (existing library art).
const DEMO_SOUNDS: { cover: CoverKey; title: string; sub: string; audio: AudioKey }[] = [
  { cover: 'rainfall', title: 'Rainfall on Canvas', sub: 'Steady rain · distant thunder', audio: 'rain' },
  { cover: 'fireside', title: 'Fireside', sub: 'A slow, crackling campfire', audio: 'fire' },
  { cover: 'slowTide', title: 'Slow Tide', sub: 'Ocean swell · low drone', audio: 'waves' },
  { cover: 'deepRest', title: 'Deep Rest', sub: 'A soft, grounding hum', audio: 'brown' },
];

const GOALS: { key: string; label: string; hint: string; intent: Intent; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'fall-asleep', label: 'Fall asleep faster', hint: 'Drift off without the tossing and turning', intent: 'sleep', icon: 'moon' },
  { key: 'stay-asleep', label: 'Stay asleep through the night', hint: 'Fewer 3am wake-ups', intent: 'sleep', icon: 'shield' },
  { key: 'wake-refreshed', label: 'Wake up refreshed', hint: 'Mornings that feel rested', intent: 'suggest', icon: 'sunrise' },
  { key: 'quiet-mind', label: 'Quiet a racing mind', hint: 'Settle the mental chatter', intent: 'reset', icon: 'wind' },
  { key: 'calm-anxious', label: 'Ease a wound-up mind', hint: 'Settle tension, day or night', intent: 'reset', icon: 'heart' },
  { key: 'routine', label: 'Build a bedtime routine', hint: 'A rhythm you can keep', intent: 'sleep', icon: 'repeat' },
];

// When they reach for calm (Mason: the Glow Orb isn't only a sleep device —
// daytime resets and wound-up moments are first-class use cases). We help stressed/
// anxious users too, but we DON'T show that: sleep/calm-framed wording ONLY, never
// "anxious"/clinical terms or any treatment claim. (The internal keys stay so the
// recommender still routes these users to breathing — the help is invisible, not absent.)
const MOMENTS: { key: string; label: string; hint: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'falling-asleep', label: 'Falling asleep', hint: 'The nightly wind-down', icon: 'moon' },
  { key: 'night-wakes', label: 'Night wake-ups', hint: 'Getting back to sleep at 3am', icon: 'clock' },
  { key: 'anxious-moments', label: 'Wound-up moments', hint: 'When the day feels tense', icon: 'heart' },
  { key: 'daytime-reset', label: 'A daytime reset', hint: 'Short calm breaks with your Glow Orb in hand', icon: 'sun' },
  { key: 'wind-down', label: 'Evenings after a long day', hint: 'The bridge from busy to restful', icon: 'feather' },
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
// Mason: surface Kids Mode right in the ages question. The account holder is
// still the adult (18+ gate at signup); this records who the wind-downs are FOR
// and points at the built-in Kids Mode.
const CHILD_AGE = 'child';
const SOURCES: { key: string; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'bought-device', label: 'I bought a CalmCarry device', icon: 'box' },
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
  const insets = useSafeAreaInsets();
  // lift the pinned button clear of the home indicator (Screen only reserves
  // left/right insets, so the content area runs to the physical bottom edge)
  const footerBottom = Math.max(insets.bottom, 24) + 30;
  // No <Screen> here — the funnel renders ONE persistent Screen (stable dark
  // background) and only this content cross-fades between steps, so page-to-page
  // fades the content, never the whole screen (no bright flash).
  return (
    <View style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: footerBottom + 96 }}>
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
      </ScrollView>

      {/* pinned footer — sits above the home indicator */}
      <View style={{ position: 'absolute', left: 24, right: 24, bottom: footerBottom }}>
        <PrimaryButton label={continueLabel} onPress={onContinue} disabled={!canContinue} />
      </View>
    </View>
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
        {leading ? <View style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}>{leading}</View> : null}
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

/** 1 — WELCOME: starlit, calming ambience, one gentle way forward.
 *  (The calming audio bed is owned by the funnel driver so it plays across every
 *  step, not just here.) */
function WelcomeStep({ onNext, onSignIn }: StepProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, paddingHorizontal: 24, paddingBottom: Math.max(insets.bottom, 24) + 30 }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 }}>
        <Reveal style={{ alignItems: 'center' }}>
          {/* the real brand lockup, not a plain-text kicker (Mason: logo above the headline) */}
          <Logo size="lg" style={{ marginBottom: 18 }} />
        </Reveal>
        <Reveal index={1}>
          <AppText style={[P.hero, { color: c.text, textAlign: 'center' }]}>Welcome</AppText>
        </Reveal>
        <Reveal index={2}>
          <AppText style={[P.body, { color: c.muted, textAlign: 'center', maxWidth: 300 }]}>
            Calmer, deeper nights. One gentle wind-down at a time.
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
    </View>
  );
}

/** 2 — TRANSFORM: you today vs. you in a week (the aspiration, honestly framed). */
function TransformStep({ onNext, onBack }: StepProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, paddingHorizontal: 24, paddingBottom: Math.max(insets.bottom, 24) + 30 }}>
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
    </View>
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
      subtitle="There are no wrong answers. This just helps us start in the right place."
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
      ? { title: 'You’re not alone, and you’re in the right place.', body: 'Rough nights wear on everything. We’ll help you build back toward rest, gently and at your pace.' }
      : s === 3
        ? { title: 'There’s room to feel more rested.', body: 'A few small, steady habits can move “okay” toward genuinely good. Let’s find yours.' }
        : { title: 'Let’s protect the good nights.', body: 'You’re already doing something right. We’ll help you keep it and deepen it.' };
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, paddingHorizontal: 24, paddingBottom: Math.max(insets.bottom, 24) + 30 }}>
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
    </View>
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
      subtitle="Pick everything that fits. You can change this later."
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
          leading={
            GOAL_ICONS[g.key] ? (
              // the emblems carry generous margin, so zoom in inside a clipped box
              // to crop the empty border and let the subject fill the slot
              <View style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <Image source={GOAL_ICONS[g.key]} style={{ width: 82, height: 82 }} contentFit="contain" />
              </View>
            ) : (
              <IconChip icon={g.icon} />
            )
          }
        />
      ))}
    </FunnelShell>
  );
}

/** 5b — MOMENTS (day & night use-cases — the Orb isn't only for bedtime) */
function MomentsStep({ onNext, onBack, answers, setAnswer, progress }: StepProps) {
  const moments = answers.moments ?? [];
  const toggle = (key: string) =>
    setAnswer('moments', moments.includes(key) ? moments.filter((m) => m !== key) : [...moments, key]);
  return (
    <FunnelShell
      onBack={onBack}
      progress={progress}
      kicker="DAY & NIGHT"
      title="When do you want CalmCarry’s help?"
      subtitle="Your Glow Orb isn’t only for bedtime. Pick every moment that fits."
      onContinue={onNext}
      canContinue={moments.length > 0}>
      {MOMENTS.map((m, i) => (
        <ChoiceRow
          key={m.key}
          index={i}
          label={m.label}
          hint={m.hint}
          selected={moments.includes(m.key)}
          onPress={() => toggle(m.key)}
          leading={<IconChip icon={m.icon} />}
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

  return (
    <FunnelShell
      onBack={onBack}
      progress={progress}
      kicker="YOUR NIGHTS NOW"
      title="How many hours do you usually sleep?"
      subtitle="A rough average is perfect. Drag to set it."
      onContinue={onNext}
      canContinue={touched}>
      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <View style={{ width: 200, height: 200, alignItems: 'center', justifyContent: 'center' }}>
          <ProgressRing progress={ring} size={200} strokeWidth={10} fill color={c.accent} trackColor={c.line} style={{ position: 'absolute' }} />
          {/* live value (tracks the finger) — no dip-swap here, that would flicker while dragging */}
          <AppText style={{ fontFamily: fonts.bold, fontSize: 40, lineHeight: 46, color: c.text, textAlign: 'center' }}>{value >= 8 ? '8h+' : formatHM(value)}</AppText>
          <AppText style={[P.label, { color: c.muted, textTransform: 'none', marginTop: 2 }]}>a night</AppText>
        </View>
      </View>
      <View style={{ marginTop: 32 }}>
        <Slider
          value={value}
          min={4}
          max={8}
          step={0.25}
          onChange={(v) => setAnswer('hours', v)}
          onTouch={() => { if (!touched) setAnswer('hours', value); }}
          minLabel="4h"
          maxLabel="8h+"
          valueText={value >= 8 ? '8 hours or more' : formatHM(value)}
        />
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
      subtitle="Optional, and stored only on your device. It helps us tailor guidance."
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

/** 8 — AGE (incl. "for my child" → points at the built-in Kids Mode) */
function AgeStep({ onNext, onBack, answers, setAnswer, progress }: StepProps) {
  const { c } = useTheme();
  return (
    <FunnelShell
      onBack={onBack}
      progress={progress}
      kicker="A GENTLE QUESTION"
      title="As we age, our sleep needs change."
      subtitle="Which range are you in? Or tell us if this is for a little one."
      onContinue={onNext}
      canContinue={!!answers.age}>
      {AGES.map((a, i) => (
        <ChoiceRow key={a} index={i} label={a} selected={answers.age === a} onPress={() => setAnswer('age', a)} />
      ))}
      <ChoiceRow
        index={AGES.length}
        label="I’m setting up for my child"
        hint="Kids Mode is built in: stories and gentle sounds behind a parent gate"
        selected={answers.age === CHILD_AGE}
        onPress={() => setAnswer('age', CHILD_AGE)}
        leading={<IconChip icon="smile" />}
      />
      {answers.age === CHILD_AGE ? (
        <Appear>
          <AppText style={[P.rowHint, { color: c.dim, textAlign: 'center', marginTop: 6 }]}>
            You stay the account holder. Switch to Kids Mode any time from the Profile tab.
          </AppText>
        </Appear>
      ) : null}
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

// =====================================================================
// Wave 3/4 widgets + steps
// =====================================================================

function formatHM(h: number) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm === 0 ? `${hh}h` : `${hh}h ${mm}m`;
}

/** Generic drag slider — snaps to `step`, haptic detent per notch. The caller owns
 *  the value display (the circle on hours, the big time on goal). Horizontal drag
 *  drives it; vertical gestures stay with the scroll view. */
function Slider({
  value,
  min,
  max,
  step,
  onChange,
  onTouch,
  minLabel,
  maxLabel,
  valueText,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  /** fired when the user first grabs the track — lets a screen record the current
   *  (possibly default) value so Continue enables even without a value change. */
  onTouch?: () => void;
  minLabel: string;
  maxLabel: string;
  /** spoken form of the current value for screen readers (defaults to the number) */
  valueText?: string;
}) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const width = useSharedValue(0);
  const pct = (value - min) / (max - min);
  const fill = useSharedValue(pct);
  useEffect(() => {
    fill.value = reduced ? pct : withTiming(pct, { duration: dur.nav, easing: ease.out });
  }, [pct, reduced, fill]);

  const commit = (px: number) => {
    const w = width.value;
    if (w <= 0) return;
    const raw = min + (Math.max(0, Math.min(w, px)) / w) * (max - min);
    const snapped = Math.max(min, Math.min(max, Math.round(raw / step) * step));
    if (snapped !== value) {
      lightTap();
      onChange(snapped);
    }
  };
  const begin = (px: number) => {
    onTouch?.();
    commit(px);
  };
  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-14, 14])
    .onBegin((e) => runOnJS(begin)(e.x))
    .onUpdate((e) => runOnJS(commit)(e.x));

  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  const thumbStyle = useAnimatedStyle(() => ({ left: `${fill.value * 100}%` }));

  // Screen readers can't pan: expose the slider as an adjustable so VoiceOver /
  // TalkBack swipe-up/down steps the value. This also counts as "touched", so the
  // step's Continue gate opens for assistive-tech users (they were hard-stuck).
  const adjust = (direction: 1 | -1) => {
    onTouch?.();
    const next = Math.max(min, Math.min(max, value + direction * step));
    if (next !== value) onChange(next);
  };

  return (
    <View>
      <GestureDetector gesture={pan}>
        <View
          onLayout={(e) => {
            width.value = e.nativeEvent.layout.width;
          }}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Hours"
          accessibilityValue={{ min, max, now: value, text: valueText }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => adjust(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
          style={{ height: 44, justifyContent: 'center' }}>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: c.line, overflow: 'hidden' }}>
            <Animated.View style={[{ height: 8, borderRadius: 4, backgroundColor: c.accent }, fillStyle]} />
          </View>
          <Animated.View
            pointerEvents="none"
            style={[{ position: 'absolute', width: 28, height: 28, borderRadius: 14, marginLeft: -14, backgroundColor: c.ctaBg, ...c.shadow }, thumbStyle]}
          />
        </View>
      </GestureDetector>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        <AppText style={[P.rowHint, { color: c.dim }]}>{minLabel}</AppText>
        <AppText style={[P.rowHint, { color: c.dim }]}>{maxLabel}</AppText>
      </View>
    </View>
  );
}

/** One equalizer bar — height oscillates on a gentle loop, staggered by index. */
function EqBar({ index }: { index: number }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const h = useSharedValue(0.35);
  useEffect(() => {
    if (reduced) {
      h.value = 0.6;
      return;
    }
    h.value = withDelay(
      index * 110,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 520 + index * 40, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.28, { duration: 460 + index * 30, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
    return () => {
      h.value = 0.35;
    };
  }, [reduced, h, index]);
  const s = useAnimatedStyle(() => ({ height: `${h.value * 100}%` }));
  return <Animated.View style={[{ width: 4, borderRadius: 2, backgroundColor: c.accent }, s]} />;
}

/** A "now playing" chip that cycles through library sounds with a live equalizer —
 *  a taste of the sound machine on the sleep-sounds screen. */
function SoundsDemo() {
  const { c } = useTheme();
  const [i, setI] = useState(0);
  useEffect(() => {
    // cycle the featured sound — 5s each so there's time to actually HEAR it
    const id = setInterval(() => setI((v) => (v + 1) % DEMO_SOUNDS.length), 5000);
    return () => clearInterval(id);
  }, []);
  const s = DEMO_SOUNDS[i];

  // Mason: don't just SHOW the demo — PLAY it. Each cycle swaps the real library
  // sound in at a soft volume (the funnel ambient is paused on this step). Native
  // autoplays; web stays silent until a gesture (same policy as the ambient).
  const demo = useAudioPlayer(audioSources[DEMO_SOUNDS[0].audio]);
  useEffect(() => {
    try {
      demo.replace(audioSources[s.audio]);
      demo.loop = true;
      demo.volume = 0.55;
      demo.play();
    } catch {
      /* released / web autoplay */
    }
  }, [demo, s.audio]);
  useEffect(() => {
    return () => {
      try {
        demo.pause();
      } catch {
        /* released */
      }
    };
  }, [demo]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.lineSage }}>
      <Appear key={s.cover} enter={dur.sheet} style={{ width: 52, height: 52, borderRadius: 12, overflow: 'hidden' }}>
        <Image source={covers[s.cover]} style={{ width: 52, height: 52 }} contentFit="cover" />
      </Appear>
      <View style={{ flex: 1 }}>
        <SwapText trigger={s.title}>
          <AppText style={[P.rowLabel, { color: c.text }]} numberOfLines={1}>
            {s.title}
          </AppText>
        </SwapText>
        <SwapText trigger={s.sub}>
          <AppText style={[P.rowHint, { color: c.muted }]} numberOfLines={1}>
            {s.sub}
          </AppText>
        </SwapText>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 24, width: 46 }}>
        {[0, 1, 2, 3, 4, 5].map((b) => (
          <EqBar key={b} index={b} />
        ))}
      </View>
    </View>
  );
}

/** small reusable back chevron for the full-bleed steps */
function BackChevron({ onBack }: { onBack: () => void }) {
  const { c } = useTheme();
  return (
    <PressableScale onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" dimTo={0.6} hitSlop={12} style={{ alignSelf: 'flex-start', paddingVertical: 6 }}>
      <Feather name="chevron-left" size={26} color={c.text} />
    </PressableScale>
  );
}

/** 10 — GOAL (sleep-target slider) */
function GoalStep({ onNext, onBack, answers, setAnswer, progress }: StepProps) {
  const { c } = useTheme();
  const goalHours = answers.goalHours ?? 8;
  return (
    <FunnelShell
      onBack={onBack}
      progress={progress}
      kicker="YOUR GOAL"
      title="How much sleep do you want?"
      subtitle="Set the nightly target we’ll gently help you build toward."
      onContinue={onNext}
      canContinue>
      <View style={{ alignItems: 'center', marginTop: 20 }}>
        {/* live value (tracks the finger) — no dip-swap, that would flicker while dragging */}
        <AppText style={[P.hero, { color: c.text, fontSize: 46, lineHeight: 54, textAlign: 'center' }]}>{formatHM(goalHours)}</AppText>
      </View>
      <View style={{ marginTop: 28 }}>
        <Slider value={goalHours} min={4} max={12} step={0.25} onChange={(v) => setAnswer('goalHours', v)} minLabel="4h" maxLabel="12h" valueText={formatHM(goalHours)} />
      </View>
    </FunnelShell>
  );
}

/** 11 — SYNC (wearable — honest "coming soon") */
function SyncStep({ onNext, onBack, answers, setAnswer, progress }: StepProps) {
  const { c } = useTheme();
  return (
    <FunnelShell
      onBack={onBack}
      progress={progress}
      kicker="SMARTER INSIGHTS"
      title="Connect a wearable?"
      subtitle="Wearable sync is on our roadmap. Tell us what you use and we’ll let you know the moment it’s ready."
      onContinue={onNext}
      canContinue
      continueLabel={answers.wearable ? 'Continue' : 'Skip'}>
      {WEARABLES.map((w, idx) => (
        <ChoiceRow key={w.key} index={idx} label={w.label} hint={w.hint} selected={answers.wearable === w.key} onPress={() => setAnswer('wearable', w.key)} leading={<IconChip icon={w.icon} />} />
      ))}
      <AppText style={[P.rowHint, { color: c.dim, textAlign: 'center', marginTop: 6 }]}>
        Coming soon. Nothing connects yet.
      </AppText>
    </FunnelShell>
  );
}

/** 12 — SOUNDS (framed watercolour fireside + live now-playing row) */
function SoundsStep({ onNext, onBack }: StepProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  // Contained (not full-bleed) so it reads like the rest of the funnel: the whole
  // hearth illustration is visible in a rounded frame, nothing overlaps/crops it,
  // and the button gets real breathing room instead of being pinned to the edge.
  return (
    <View style={{ flex: 1, paddingHorizontal: 24, paddingBottom: Math.max(insets.bottom, 24) + 30 }}>
      <BackChevron onBack={onBack} />
      <View style={{ marginTop: 6 }}>
        <Reveal>
          <AppText style={[P.title, { color: c.text }]}>Drift off to your favourite sounds</AppText>
        </Reveal>
        <Reveal index={1}>
          <AppText style={[P.body, { color: c.muted, marginTop: 10 }]}>
            A full sound machine, sleep stories, and lyric-free music. Layer them and fall asleep faster.
          </AppText>
        </Reveal>
      </View>
      <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
        <Reveal index={2}>
          <View style={{ borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: c.lineSage, ...c.shadow }}>
            <Image
              source={require('../../../assets/images/onboarding/fireplace.png')}
              style={{ width: '100%', aspectRatio: 1 }}
              contentFit="cover"
              contentPosition="bottom"
              transition={{ duration: dur.sheet, effect: 'cross-dissolve' }}
              accessibilityIgnoresInvertColors
            />
          </View>
        </Reveal>
        <Reveal index={3}>
          <SoundsDemo />
        </Reveal>
      </View>
      <Reveal index={4}>
        <PrimaryButton label="Continue" onPress={onNext} />
      </Reveal>
    </View>
  );
}

/** 13 — TRIAL FREE (informational) */
function TrialFreeStep({ onNext, onBack }: StepProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, paddingHorizontal: 24, paddingBottom: Math.max(insets.bottom, 24) + 30 }}>
      <BackChevron onBack={onBack} />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
        <Reveal>
          <Image source={require('../../../assets/images/onboarding/trial-sleep.png')} style={{ width: 200, height: 200 }} contentFit="contain" accessibilityIgnoresInvertColors />
        </Reveal>
        <Reveal index={1}>
          <AppText style={[P.title, { color: c.text, textAlign: 'center' }]}>Try it free for {TRIAL_DAYS} days</AppText>
        </Reveal>
        <Reveal index={2}>
          <AppText style={[P.body, { color: c.muted, textAlign: 'center', maxWidth: 320 }]}>
            Everyone gets {TRIAL_DAYS} days of CalmCarry Premium. The full library, programs, and sound machine. No commitment.
          </AppText>
        </Reveal>
      </View>
      <Reveal index={3}>
        <PrimaryButton label="Continue" onPress={onNext} />
      </Reveal>
    </View>
  );
}

/** 14 — TRIAL REMINDER. Honest framing: the reassurance rests on clear disclosure
 *  + cancel-anytime (both real/store-guaranteed), NOT on a promised reminder — the
 *  trial-ending notification is best-effort (needs OS permission) and is scheduled
 *  on the real purchase later, so we never promise it here (ROSCA). */
function TrialReminderStep({ onNext, onBack }: StepProps) {
  const { c } = useTheme();
  const row = (icon: keyof typeof Feather.glyphMap, title: string, body: string, i: number) => (
    <Reveal index={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: i === 0 ? 0 : 14 }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.panel, alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={icon} size={18} color={c.textAccent} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText style={[P.rowLabel, { color: c.text }]}>{title}</AppText>
        <AppText style={[P.rowHint, { color: c.muted, marginTop: 2 }]}>{body}</AppText>
      </View>
    </Reveal>
  );
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, paddingHorizontal: 24, paddingBottom: Math.max(insets.bottom, 24) + 30 }}>
      <BackChevron onBack={onBack} />
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Reveal>
          <AppText style={[P.title, { color: c.text }]}>No surprise charges</AppText>
        </Reveal>
        <Reveal index={1}>
          <AppText style={[P.body, { color: c.muted, marginTop: 10, marginBottom: 28 }]}>
            Your {TRIAL_DAYS}-day trial is completely free. It only becomes a paid plan if you keep it. Cancel anytime in your Apple or Google account before it ends.
          </AppText>
        </Reveal>
        {row('unlock', 'Today', 'Full access to everything, free.', 2)}
        {row('bell', `Day ${Math.max(1, TRIAL_DAYS - 1)}`, 'If you allow notifications, we’ll try to remind you before it ends.', 3)}
        {row('calendar', `Day ${TRIAL_DAYS}`, 'Renews only if you keep it. Cancel anytime.', 4)}
      </View>
      <Reveal index={5}>
        <PrimaryButton label="Try it free" onPress={onNext} />
      </Reveal>
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 18, marginTop: 16 }}>
        <LegalLink label="Privacy Policy" onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})} />
        <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: c.line }} />
        <LegalLink label="Terms of Service" onPress={() => Linking.openURL(TERMS_URL).catch(() => {})} />
      </View>
    </View>
  );
}

/** 15 — PRICING (real store price, honest trial framing) */
function PricingStep({ onNext, onBack, setAnswer }: StepProps) {
  const { c } = useTheme();
  const [annual, setAnnual] = useState<string>(PRICING.annual.price);
  useEffect(() => {
    if (iapSupported) fetchLocalizedPrices().then((p) => p.annual && setAnnual(p.annual)).catch(() => {});
  }, []);
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, paddingHorizontal: 24, paddingBottom: Math.max(insets.bottom, 24) + 30 }}>
      <BackChevron onBack={onBack} />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
        <Reveal>
          <Image source={require('../../../assets/images/onboarding/pricing-orb.png')} style={{ width: 172, height: 172 }} contentFit="contain" accessibilityIgnoresInvertColors />
        </Reveal>
        <Reveal index={1}>
          <AppText style={[P.hero, { color: c.text, textAlign: 'center' }]}>$0.00 today</AppText>
        </Reveal>
        <Reveal index={2}>
          <AppText style={[P.body, { color: c.muted, textAlign: 'center', maxWidth: 320 }]}>
            Free for {TRIAL_DAYS} days, then {annual}
            {PRICING.annual.per}. Cancel anytime in your Apple or Google account settings.
          </AppText>
        </Reveal>
      </View>
      <Reveal index={3}>
        {/* the tap is a real promise — remember it so Home can actually OFFER the
            trial after sign-in (before this, both buttons were silently identical) */}
        <PrimaryButton
          label="Start my free trial"
          onPress={() => {
            setAnswer('wantsTrial', true);
            onNext();
          }}
        />
      </Reveal>
      <Reveal index={4} style={{ alignItems: 'center', marginTop: 12 }}>
        <PressableScale onPress={onNext} accessibilityRole="button" dimTo={0.6} hitSlop={10}>
          <AppText style={[P.body, { color: c.muted, fontSize: 15 }]}>Maybe later</AppText>
        </PressableScale>
      </Reveal>
    </View>
  );
}

const STEP_COMPONENTS: Record<StepId, (p: StepProps) => React.ReactElement> = {
  welcome: WelcomeStep,
  transform: TransformStep,
  satisfaction: SatisfactionStep,
  reassure: ReassureStep,
  help: HelpStep,
  moments: MomentsStep,
  hours: HoursStep,
  gender: GenderStep,
  age: AgeStep,
  source: SourceStep,
  goal: GoalStep,
  sync: SyncStep,
  sounds: SoundsStep,
  trialFree: TrialFreeStep,
  trialReminder: TrialReminderStep,
  pricing: PricingStep,
};

export function OnboardingFunnel() {
  const router = useRouter();
  const { setIntent } = useProfile();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});

  // A soft NATURE bed under the WHOLE funnel — birdsong + a distant stream, not a
  // synth hum (a tonal drone reads as "frequency"/machine, wrong for a calm app).
  // Sets and holds the mood from the first screen to the last, not just on Welcome.
  // Native autoplays; web stays silent until a gesture. Fades in gently, pauses
  // when the funnel unmounts (i.e. on the way to /auth).
  const ambient = useAudioPlayer(audioSources.forest);
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
      vol.current = Math.min(0.22, vol.current + 0.015);
      try {
        ambient.volume = vol.current;
      } catch {
        /* released */
      }
      if (vol.current >= 0.22) clearInterval(id);
    }, 120);
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

  // The sounds step plays REAL demo audio (SoundsDemo) — step the forest bed out
  // of its way so the preview is clean, and bring it back on any other step.
  useEffect(() => {
    try {
      if (STEPS[index] === 'sounds') ambient.pause();
      else ambient.play();
    } catch {
      /* released / web autoplay */
    }
  }, [index, ambient]);

  const setAnswer = useCallback(<K extends keyof Answers>(k: K, v: Answers[K]) => {
    setAnswers((a) => ({ ...a, [k]: v }));
  }, []);

  const finish = useCallback(
    (final: Answers) => {
      // persist the survey (on-device) + map the first chosen goal to a personalization intent
      setJSON('cc.onboarding', final);
      // "Start my free trial" must lead to the trial: Home consumes this flag once
      // (after sign-in) and opens the Calm Plan sheet where the store trial starts.
      if (final.wantsTrial) setJSON('cc.pendingTrial', true);
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
    // finish() flips ProfileProvider state (setIntent) + navigates — run it in the
    // event handler, NOT inside a setState updater. The updater executes during
    // React's render phase, so calling another component's setState there triggers
    // the "Cannot update a component while rendering a different component" warning.
    if (index >= STEPS.length - 1) {
      finish(answers);
    } else {
      setIndex((i) => i + 1);
    }
  }, [index, finish, answers]);

  const onBack = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const onSignIn = useCallback(() => {
    markOnboarded();
    router.replace('/auth');
  }, [router]);

  // Android hardware/gesture back steps BACK through the funnel (same as the
  // on-screen chevrons) instead of dropping the user out of first-run entirely.
  // On the welcome step the default (leave/minimize) is the right behaviour.
  const indexRef = useRef(index);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (indexRef.current > 0) {
        setIndex((i) => Math.max(0, i - 1));
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  const stepId = STEPS[index];
  const StepComponent = STEP_COMPONENTS[stepId];
  const progress = index / (STEPS.length - 1);

  // ONE persistent Screen — the dark background + starfield stay put across steps.
  // Only the keyed content cross-fades, so page-to-page fades the CONTENT (text,
  // buttons), never the whole screen. No bright flash between pages. The fade is
  // deliberately unhurried (a slow, soft dissolve) so nothing snaps at a sleepy
  // brain — calmer than the app's standard nav transition.
  return (
    <Screen mode="night" backdrop={stepId === 'welcome' ? <Starfield /> : undefined} contentStyle={{ flex: 1, paddingHorizontal: 0 }}>
      <Appear key={stepId} enter={560} exit={340} style={{ flex: 1 }}>
        <StepComponent onNext={onNext} onBack={onBack} onSignIn={onSignIn} answers={answers} setAnswer={setAnswer} progress={progress} />
      </Appear>
    </Screen>
  );
}
