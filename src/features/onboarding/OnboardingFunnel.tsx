import { Feather } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BackHandler, Linking, ScrollView, View, type ImageSourcePropType } from 'react-native';
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
  Reveal,
  Screen,
  SelectionOverlay,
  SwapText,
} from '@/components';
import { audioSources, type AudioKey } from '@/content/audio';
import { covers, type CoverKey } from '@/content/covers';
import { GOAL_ICONS } from '@/content/onboardingArt';
import { PRIVACY_URL, TERMS_URL } from '@/content/store';
import { useProfile, type Intent } from '@/features/profile/ProfileProvider';
import { lightTap } from '@/lib/haptics';
import { markOnboarded } from '@/lib/onboarding';
import { REMINDER_TIMES, remindersSupported, setBedtimeReminder } from '@/lib/reminders';
import { setSleepGoalHours } from '@/lib/sleepGoal';
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
  goals?: string[]; // help-with keys
  age?: string; // only ever CHILD_AGE now - the "for my child" card keeps the flag the old age step wrote
  goalHours?: number; // desired nightly sleep, 4..12 in 0.25 steps
  moments?: string[]; // when they want help - day AND night use-cases, not just sleep
  reminderIdx?: number; // REMINDER_TIMES index chosen on the reminder step
};

type StepProps = {
  onNext: () => void;
  onBack: () => void;
  onSignIn: () => void;
  /** end the funnel: 'home' lands on Tonight as a guest, 'save' offers the optional account */
  onFinish: (dest: 'home' | 'save') => void;
  answers: Answers;
  setAnswer: <K extends keyof Answers>(k: K, v: Answers[K]) => void;
  progress: number; // 0..1 position through the funnel
};

// ---- the funnel's ordered steps ----
// Deliberately short. The interrogation round (satisfaction, gender, age, source,
// wearable, trial-reminder) is gone, and so is the old "hours you usually sleep"
// step (it fed nothing downstream - the goal step carries the one number we use).
// Every remaining question feeds something the app actually uses, and every
// question step can be skipped (Continue relabels to Skip when nothing is picked).
// First-run ends on the plan step: the answers reflected back, then straight into
// the app - the account ask is an optional offer there, never a wall (5.1.1(v)).
// NO price/subscription pitch here. The paywall waits until after the first
// completed session (the post-session offer in app/_layout).
const STEPS = [
  'welcome',
  'transform',
  'help',
  'moments',
  'goal',
  'reminder',
  'sounds',
  'plan',
] as const;
type StepId = (typeof STEPS)[number];

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
  { key: 'quiet-mind', label: 'Quiet a racing mind', hint: 'Slow the mental chatter', intent: 'reset', icon: 'wind' },
  { key: 'calm-anxious', label: 'Ease a wound-up mind', hint: 'Settle tension, day or night', intent: 'reset', icon: 'heart' },
  { key: 'routine', label: 'Build a bedtime routine', hint: 'A rhythm you can keep', intent: 'sleep', icon: 'repeat' },
];

// When they reach for calm (Mason: the Glow Orb isn't only a sleep device -
// daytime resets and wound-up moments are first-class use cases). We help stressed/
// anxious users too, but we DON'T show that: sleep/calm-framed wording ONLY, never
// "anxious"/clinical terms or any treatment claim. (The internal keys stay so the
// recommender still routes these users to breathing - the help is invisible, not absent.)
const MOMENTS: { key: string; label: string; hint: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'falling-asleep', label: 'Falling asleep', hint: 'The nightly wind-down', icon: 'moon' },
  { key: 'night-wakes', label: 'Night wake-ups', hint: 'Getting back to sleep at 3am', icon: 'clock' },
  { key: 'anxious-moments', label: 'Wound-up moments', hint: 'When the day feels tense', icon: 'heart' },
  { key: 'daytime-reset', label: 'A daytime reset', hint: 'Short calm breaks with your Glow Orb in hand', icon: 'sun' },
  { key: 'wind-down', label: 'Evenings after a long day', hint: 'The bridge from busy to restful', icon: 'feather' },
];

// Mason: surface Kids Mode inside the goals question (the ages step it lived on is
// gone). The account holder is still the adult (18+ gate at signup); this records
// who the wind-downs are FOR and points at the built-in Kids Mode. The persisted
// flag (answers.age === 'child') is unchanged so nothing downstream shifts.
const CHILD_AGE = 'child';

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
  // No <Screen> here - the funnel renders ONE persistent Screen (stable dark
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

      {/* pinned footer - sits above the home indicator */}
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

/** Icon chip used as the leading art on a choice row (fallback + moments/child rows). */
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

/** 1 - WELCOME: starlit, calming ambience, one gentle way forward.
 *  (The calming audio bed is owned by the funnel driver so it plays across every
 *  step, not just here.) */
function WelcomeStep({ onNext, onSignIn }: StepProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: Math.max(insets.bottom, 24) + 30 }}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, minHeight: 240 }}>
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
        {/* labelled, not an anonymous arrow circle: the first button a stranger ever
            sees should say what it does (user audit). Same CTA colours + press feel. */}
        <PressableScale
          onPress={onNext}
          onPressIn={lightTap}
          accessibilityRole="button"
          accessibilityLabel="Begin"
          scaleTo={0.96}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 60, paddingHorizontal: 34, borderRadius: 30, backgroundColor: c.ctaBg, ...c.shadow }}>
          <AppText style={{ fontFamily: fonts.semibold, fontSize: 17, color: c.ctaText }}>Begin</AppText>
          <Feather name="arrow-right" size={20} color={c.ctaText} />
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
    </ScrollView>
  );
}

/** 2 - TRANSFORM: you today vs. you in a week (the aspiration, honestly framed). */
function TransformStep({ onNext, onBack }: StepProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: Math.max(insets.bottom, 24) + 30 }}>
      <PressableScale onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" dimTo={0.6} hitSlop={12} style={{ alignSelf: 'flex-start', paddingVertical: 6 }}>
        <Feather name="chevron-left" size={26} color={c.text} />
      </PressableScale>

      <View style={{ flex: 1, justifyContent: 'center', minHeight: 360 }}>
        <Reveal>
          <AppText style={[P.title, { color: c.text, textAlign: 'center' }]}>The power of a nightly ritual</AppText>
        </Reveal>
        <Reveal index={1}>
          <AppText style={[P.body, { color: c.muted, textAlign: 'center', maxWidth: 320, alignSelf: 'center', marginTop: 10 }]}>
            A steady wind-down can change how your nights feel. Here’s the shift we’re after.
          </AppText>
        </Reveal>

        <View style={{ flexDirection: 'row', gap: 14, marginTop: 28 }}>
          <TransformCard label="You today" image={require('../../../assets/images/onboarding/you-today.jpg')} tone={c.muted} index={2} />
          {/* "With a ritual", not "In a week": no visible-transformation-in-7-days promise */}
          <TransformCard label="With a ritual" image={require('../../../assets/images/onboarding/you-week.jpg')} tone={c.textAccent} index={3} highlight />
        </View>
      </View>

      <Reveal index={4}>
        <PrimaryButton label="Continue" onPress={onNext} />
      </Reveal>
    </ScrollView>
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

/** 3 - HELP WITH (multi-select, AI icons; also carries the "for my child" card
 *  the cut ages step used to hold) */
function HelpStep({ onNext, onBack, answers, setAnswer, progress }: StepProps) {
  const { c } = useTheme();
  const goals = answers.goals ?? [];
  const toggle = (key: string) => setAnswer('goals', goals.includes(key) ? goals.filter((g) => g !== key) : [...goals, key]);
  const forChild = answers.age === CHILD_AGE;
  return (
    <FunnelShell
      onBack={onBack}
      progress={progress}
      kicker="WHERE WE’LL FOCUS"
      title="What can we help you with?"
      subtitle="Pick everything that fits. You can change this later."
      onContinue={onNext}
      // never a hard gate (design system: onboarding always skippable) - with
      // nothing picked the button honestly reads Skip and the funnel moves on
      canContinue
      continueLabel={goals.length > 0 || forChild ? 'Continue' : 'Skip'}>
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
      <ChoiceRow
        index={GOALS.length}
        label="I’m setting up for my child"
        hint="Kids Mode is built in: gentle sounds behind a parent gate"
        selected={forChild}
        onPress={() => setAnswer('age', forChild ? undefined : CHILD_AGE)}
        leading={<IconChip icon="smile" />}
      />
      {forChild ? (
        <Appear>
          <AppText style={[P.rowHint, { color: c.dim, textAlign: 'center', marginTop: 6 }]}>
            You stay the account holder. Switch to Kids Mode any time from the Profile tab.
          </AppText>
        </Appear>
      ) : null}
    </FunnelShell>
  );
}

/** 4 - MOMENTS (day & night use-cases - the Orb isn't only for bedtime) */
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
      canContinue
      continueLabel={moments.length > 0 ? 'Continue' : 'Skip'}>
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

// =====================================================================
// Wave 3/4 widgets + steps
// =====================================================================

function formatHM(h: number) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm === 0 ? `${hh}h` : `${hh}h ${mm}m`;
}

/** Generic drag slider - snaps to `step`, haptic detent per notch. The caller owns
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
  /** fired when the user first grabs the track - lets a screen record the current
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

/** One equalizer bar - height oscillates on a gentle loop, staggered by index. */
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

/** A "now playing" chip that cycles through library sounds with a live equalizer -
 *  a taste of the sound machine on the sleep-sounds screen. */
function SoundsDemo() {
  const { c } = useTheme();
  const [i, setI] = useState(0);
  useEffect(() => {
    // cycle the featured sound - 5s each so there's time to actually HEAR it
    const id = setInterval(() => setI((v) => (v + 1) % DEMO_SOUNDS.length), 5000);
    return () => clearInterval(id);
  }, []);
  const s = DEMO_SOUNDS[i];

  // Mason: don't just SHOW the demo - PLAY it. Each cycle swaps the real library
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

/** 5 - GOAL (sleep-target slider) */
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
        {/* live value (tracks the finger) - no dip-swap, that would flicker while dragging */}
        <AppText style={[P.hero, { color: c.text, fontSize: 46, lineHeight: 54, textAlign: 'center' }]}>{formatHM(goalHours)}</AppText>
      </View>
      <View style={{ marginTop: 28 }}>
        <Slider value={goalHours} min={4} max={12} step={0.25} onChange={(v) => setAnswer('goalHours', v)} minLabel="4h" maxLabel="12h" valueText={formatHM(goalHours)} />
      </View>
    </FunnelShell>
  );
}

/** 6 - REMINDER (opt-in wind-down nudge). The OS notification prompt fires only
 *  when a time is actually chosen - Skip asks the system for nothing. Mirrors the
 *  Account toggle's keys, and only after a reminder truly scheduled (permission
 *  granted), so Settings never shows a phantom "on". Web: setBedtimeReminder is a
 *  guarded no-op there, so the step renders fine and simply schedules nothing. */
function ReminderStep({ onNext, onBack, answers, setAnswer, progress }: StepProps) {
  const idx = answers.reminderIdx;
  const chosen = idx !== undefined;
  const onContinue = () => {
    if (chosen && remindersSupported) {
      const t = REMINDER_TIMES[idx];
      // best-effort, off the navigation path - the funnel moves on either way
      setBedtimeReminder(true, t.hour, t.minute).then((scheduled) => {
        if (scheduled) {
          setJSON('cc.reminder', true);
          setJSON('cc.reminderTimeIdx', idx);
        }
      });
    }
    onNext();
  };
  return (
    <FunnelShell
      onBack={onBack}
      progress={progress}
      kicker="A GENTLE NUDGE"
      title="When should we nudge your wind-down?"
      subtitle="One quiet note a night, never an alarm. You can change or turn it off any time."
      onContinue={onContinue}
      canContinue
      continueLabel={chosen ? 'Continue' : 'Skip'}>
      {REMINDER_TIMES.map((t, i) => (
        <ChoiceRow
          key={t.label}
          index={i}
          label={t.label}
          selected={idx === i}
          onPress={() => setAnswer('reminderIdx', idx === i ? undefined : i)}
        />
      ))}
    </FunnelShell>
  );
}

/** 7 - SOUNDS (framed watercolour fireside + live now-playing row) */
function SoundsStep({ onNext, onBack }: StepProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  // Contained (not full-bleed) so it reads like the rest of the funnel: the whole
  // hearth illustration is visible in a rounded frame, nothing overlaps/crops it,
  // and the button gets real breathing room instead of being pinned to the edge.
  return (
    // Scrolls when it can't fit: on the smallest phones (iPhone SE / small Android) and
    // at large Dynamic Type, the image + demo + title + Continue exceeded the viewport
    // and the pinned Continue was pushed off-screen with no way to reach it. flexGrow:1
    // keeps it centered and full-height when it DOES fit.
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: Math.max(insets.bottom, 24) + 30 }}>
      <BackChevron onBack={onBack} />
      <View style={{ marginTop: 6 }}>
        <Reveal>
          <AppText style={[P.title, { color: c.text }]}>Drift off to your favourite sounds</AppText>
        </Reveal>
        <Reveal index={1}>
          <AppText style={[P.body, { color: c.muted, marginTop: 10 }]}>
            A full sound machine and lyric-free music. Layer them into the mix that settles you.
          </AppText>
        </Reveal>
      </View>
      <View style={{ flex: 1, justifyContent: 'center', gap: 16, minHeight: 320 }}>
        <Reveal index={2}>
          <View style={{ borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: c.lineSage, ...c.shadow }}>
            <Image
              source={require('../../../assets/images/onboarding/fireplace.jpg')}
              style={{ width: '100%', aspectRatio: 4 / 3 }}
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
    </ScrollView>
  );
}

/** 8 - PLAN: the payoff. The funnel's answers reflected back as a plan, then
 *  straight into the app. The account ask is a quiet OFFER here, never a wall -
 *  registration stays optional (App Store 5.1.1(v)), and a tired first-run user
 *  gets value before any form. */
function PlanStep({ onBack, onFinish, answers }: StepProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const chosenGoals = GOALS.filter((g) => (answers.goals ?? []).includes(g.key));
  const forChild = answers.age === CHILD_AGE;
  const reminderOn = answers.reminderIdx !== undefined && remindersSupported;
  const rows: { key: string; label: string; hint?: string; icon: keyof typeof Feather.glyphMap; art?: ImageSourcePropType }[] = [
    ...chosenGoals.map((g) => ({ key: g.key, label: g.label, hint: g.hint, icon: g.icon, art: GOAL_ICONS[g.key] })),
    ...(forChild
      ? [{ key: 'child', label: 'Kids Mode, ready when they are', hint: 'Gentle sounds behind the parent gate', icon: 'smile' as const }]
      : []),
    ...(reminderOn && answers.reminderIdx !== undefined
      ? [{ key: 'reminder', label: `A quiet nudge at ${REMINDER_TIMES[answers.reminderIdx].label}`, hint: 'One soft note a night, never an alarm', icon: 'bell' as const }]
      : []),
  ];
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: Math.max(insets.bottom, 24) + 30 }}>
      <BackChevron onBack={onBack} />
      <View style={{ marginTop: 6 }}>
        <Reveal>
          <AppText style={[P.label, { color: c.textAccent, marginBottom: 8 }]}>ALL SET</AppText>
          <AppText style={[P.title, { color: c.text }]}>Your calm plan is ready</AppText>
        </Reveal>
        <Reveal index={1}>
          <AppText style={[P.body, { color: c.muted, marginTop: 10 }]}>
            Shaped around what you told us. You can change any of it later from your profile.
          </AppText>
        </Reveal>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', gap: 12, minHeight: 260, marginTop: 20 }}>
        {rows.length > 0 ? (
          rows.map((r, i) => (
            <Reveal key={r.key} index={2 + i}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  padding: 14,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: c.lineSage,
                  backgroundColor: c.surface,
                }}>
                {r.art ? (
                  <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <Image source={r.art} style={{ width: 62, height: 62 }} contentFit="contain" />
                  </View>
                ) : (
                  <IconChip icon={r.icon} />
                )}
                <View style={{ flex: 1 }}>
                  <AppText style={[P.rowLabel, { color: c.text }]}>{r.label}</AppText>
                  {r.hint ? <AppText style={[P.rowHint, { color: c.muted, marginTop: 2 }]}>{r.hint}</AppText> : null}
                </View>
                <Feather name="check" size={18} color={c.textAccent} />
              </View>
            </Reveal>
          ))
        ) : (
          <Reveal index={2}>
            <View style={{ padding: 16, borderRadius: 16, borderWidth: 1, borderColor: c.lineSage, backgroundColor: c.surface }}>
              <AppText style={[P.rowLabel, { color: c.text }]}>A gentle start</AppText>
              <AppText style={[P.rowHint, { color: c.muted, marginTop: 4 }]}>
                We’ll keep the first nights soft and simple, and let your evenings shape the rest.
              </AppText>
            </View>
          </Reveal>
        )}
        <Reveal index={2 + Math.max(rows.length, 1)}>
          <AppText style={[P.rowHint, { color: c.dim, textAlign: 'center', marginTop: 6 }]}>
            First up: a gentle wind-down with your Glow Orb resting in your palm.
          </AppText>
        </Reveal>
      </View>

      <Reveal index={3 + Math.max(rows.length, 1)} style={{ gap: 16 }}>
        <PrimaryButton label="Take me to CalmCarry" onPress={() => onFinish('home')} />
        {/* the OPTIONAL account offer - a quiet line, not a second button, so the
            one obvious way forward stays the app itself (5.1.1(v)) */}
        <PressableScale
          onPress={() => onFinish('save')}
          accessibilityRole="button"
          accessibilityLabel="Save my plan across devices. Sign in or create a free account."
          dimTo={0.6}
          hitSlop={10}
          style={{ alignSelf: 'center', paddingVertical: 4 }}>
          <AppText style={[P.body, { color: c.muted, fontSize: 15, textAlign: 'center' }]}>
            Using more than one device?{' '}
            <AppText style={{ fontFamily: fonts.semibold, color: c.textAccent }}>Save my plan</AppText>
          </AppText>
        </PressableScale>
      </Reveal>
    </ScrollView>
  );
}

const STEP_COMPONENTS: Record<StepId, (p: StepProps) => React.ReactElement> = {
  welcome: WelcomeStep,
  transform: TransformStep,
  help: HelpStep,
  moments: MomentsStep,
  goal: GoalStep,
  reminder: ReminderStep,
  sounds: SoundsStep,
  plan: PlanStep,
};

export function OnboardingFunnel() {
  const router = useRouter();
  const { setIntent, dismissCheckIn } = useProfile();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});

  // A soft NATURE bed under the WHOLE funnel - birdsong + a distant stream, not a
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

  // The sounds step plays REAL demo audio (SoundsDemo) - step the forest bed out
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
    (final: Answers, dest: 'home' | 'save') => {
      // persist the survey (on-device) + the personalization it feeds
      setJSON('cc.onboarding', final);
      // the sleep target lands where Settings + the evening rhythm actually read
      // it (cc.sleepGoalHours), not only inside the survey blob
      if (typeof final.goalHours === 'number') setSleepGoalHours(final.goalHours);
      // majority intent across EVERY chosen goal (earlier picks break ties) - one
      // goal out of several must not decide the whole personalization
      const tally = new Map<Intent, number>();
      for (const key of final.goals ?? []) {
        const goalIntent = GOALS.find((g) => g.key === key)?.intent;
        if (goalIntent) tally.set(goalIntent, (tally.get(goalIntent) ?? 0) + 1);
      }
      let intent: Intent | undefined;
      let votes = 0;
      for (const [i, n] of tally) {
        if (n > votes) {
          intent = i;
          votes = n;
        }
      }
      if (intent) setIntent(intent);
      // the funnel just seeded the recommender - a mood check-in pushed onto the
      // very first landing would be a second interrogation, so consume it here
      dismissCheckIn();
      markOnboarded();
      // 'save' opens the OPTIONAL account offer in create mode (a first-run user
      // has no account to sign in to); 'home' lands on Tonight as a guest. The
      // funnel never dead-ends at a sign-in wall (App Store 5.1.1(v)).
      router.replace(dest === 'save' ? '/auth?mode=signup' : '/');
    },
    [router, setIntent, dismissCheckIn],
  );

  const onNext = useCallback(() => {
    lightTap();
    // finish() flips ProfileProvider state (setIntent) + navigates - run it in the
    // event handler, NOT inside a setState updater. The updater executes during
    // React's render phase, so calling another component's setState there triggers
    // the "Cannot update a component while rendering a different component" warning.
    // The plan step owns its own exits (onFinish); this guard is only a fallback.
    if (index >= STEPS.length - 1) {
      finish(answers, 'home');
    } else {
      setIndex((i) => i + 1);
    }
  }, [index, finish, answers]);

  const onFinish = useCallback((dest: 'home' | 'save') => finish(answers, dest), [finish, answers]);

  const onBack = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const onSignIn = useCallback(() => {
    // deliberately NOT markOnboarded(): tapping "Sign in" is an escape, not a
    // completed first-run. The root layout marks the device onboarded once a real
    // session exists (an existing account IS onboarded); if they bail out of auth
    // instead, the funnel is still offered on the next open.
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

  // ONE persistent Screen - the dark background + starfield stay put across steps.
  // Only the keyed content cross-fades, so page-to-page fades the CONTENT (text,
  // buttons), never the whole screen. No bright flash between pages. The fade is
  // deliberately unhurried (a slow, soft dissolve) so nothing snaps at a sleepy
  // brain - calmer than the app's standard nav transition.
  return (
    <Screen mode="night" backdrop={stepId === 'welcome' ? <Starfield /> : undefined} contentStyle={{ flex: 1, paddingHorizontal: 0 }}>
      <Appear key={stepId} enter={560} exit={340} style={{ flex: 1 }}>
        <StepComponent onNext={onNext} onBack={onBack} onSignIn={onSignIn} onFinish={onFinish} answers={answers} setAnswer={setAnswer} progress={progress} />
      </Appear>
    </Screen>
  );
}
