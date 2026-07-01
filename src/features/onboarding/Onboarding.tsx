import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent, type ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { AmbientMotes, AppText, GlowOrb, Logo, PrimaryButton, Screen, VoicePicker } from '@/components';
import { covers, type CoverKey } from '@/content/covers';
import { TRACKS } from '@/content/library';
import { FEELING_MAP, useProfile, type Feeling } from '@/features/profile/ProfileProvider';
import { lightTap } from '@/lib/haptics';
import { markOnboarded } from '@/lib/onboarding';
import { setSleepGoalHours, SLEEP_GOAL_DEFAULT, SLEEP_GOAL_MAX, SLEEP_GOAL_MIN } from '@/lib/sleepGoal';
import { brand, dur, ease, fonts, useTheme } from '@/theme';

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

const TICK_W = 34;

/** A SLIDING sleep-goal picker: drag the ruler and the hour under the centre line
 *  is your goal (snaps per hour). The big badge springs as the value changes.
 *  Transform/opacity only; reduced motion just skips the badge spring. */
function SleepGoalDial({ value, onChange }: { value: number; onChange: (h: number) => void }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const pop = useSharedValue(1);
  const scroller = useRef<ScrollView>(null);
  const [vw, setVw] = useState(0);
  const hours = Array.from({ length: SLEEP_GOAL_MAX - SLEEP_GOAL_MIN + 1 }, (_, i) => SLEEP_GOAL_MIN + i);

  // centre the current value under the pointer once the viewport width is known
  useEffect(() => {
    if (vw > 0) scroller.current?.scrollTo({ x: (value - SLEEP_GOAL_MIN) * TICK_W, animated: false });
  }, [vw]); // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / TICK_W);
    const h = Math.min(SLEEP_GOAL_MAX, Math.max(SLEEP_GOAL_MIN, SLEEP_GOAL_MIN + idx));
    if (h !== value) {
      onChange(h);
      lightTap();
      if (!reduced) {
        pop.value = withSequence(
          withTiming(1.06, { duration: 100, easing: ease.out }),
          withSpring(1, { damping: 12, stiffness: 200, mass: 0.6 })
        );
      }
    }
  };

  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const pad = vw > 0 ? vw / 2 - TICK_W / 2 : 0;

  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View
        style={[
          { width: 132, height: 132, borderRadius: 66, borderWidth: 2, borderColor: c.accent, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', ...c.shadow },
          badgeStyle,
        ]}>
        <AppText style={{ fontFamily: fonts.display, fontSize: 40, lineHeight: 46, color: c.textAccent }}>{value}h</AppText>
      </Animated.View>

      <View
        onLayout={(e) => setVw(e.nativeEvent.layout.width)}
        style={{ width: '100%', height: 66, marginTop: 30 }}
        accessibilityRole="adjustable"
        accessibilityLabel="Nightly sleep goal in hours"
        accessibilityValue={{ text: `${value} hours` }}>
        {/* fixed centre indicator that the ruler slides under */}
        <View pointerEvents="none" style={{ position: 'absolute', left: '50%', top: 0, marginLeft: -1.5, width: 3, height: 40, borderRadius: 2, backgroundColor: c.accent, zIndex: 2 }} />
        <ScrollView
          ref={scroller}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={TICK_W}
          decelerationRate="fast"
          scrollEventThrottle={16}
          onScroll={onScroll}
          contentContainerStyle={{ paddingHorizontal: pad, alignItems: 'flex-end' }}>
          {hours.map((h) => (
            <View key={h} style={{ width: TICK_W, alignItems: 'center' }}>
              <View style={{ width: h % 2 === 0 ? 2 : 1, height: h % 2 === 0 ? 24 : 14, borderRadius: 1, backgroundColor: c.line }} />
              {h % 2 === 0 ? (
                <AppText variant="label" tone="muted" style={{ marginTop: 6 }}>
                  {h}
                </AppText>
              ) : (
                <View style={{ height: 17 }} />
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

/** A twinkling star for the transformation scene (opacity + scale pulse). */
function TwinkleStar({ top, left, size = 16, delay = 0 }: { top: number; left: string; size?: number; delay?: number }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0.4);
  useEffect(() => {
    if (reduced) {
      t.value = 0.7;
      return;
    }
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 1900, easing: ease.inOut }), -1, true));
  }, [reduced, t, delay]);
  const style = useAnimatedStyle(() => ({ opacity: 0.3 + t.value * 0.6, transform: [{ scale: 0.8 + t.value * 0.3 }] }));
  return (
    <Animated.Text pointerEvents="none" style={[{ position: 'absolute', top, left: left as unknown as number, fontSize: size, color: brand.sageHover }, style]}>
      ✦
    </Animated.Text>
  );
}

/** One before/after card. A real scene carries the mood: a stormy night for
 *  "today" (heavy, cool scrim) → a bright dawn for "in a week" (light scrim). */
function TransformCard({ cover, label, dim, style }: { cover: CoverKey; label: string; dim?: boolean; style?: ViewStyle }) {
  const { c } = useTheme();
  return (
    <View style={[{ width: 166, height: 188, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: c.lineSage, ...c.shadow }, style]}>
      <Image source={covers[cover]} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" accessibilityIgnoresInvertColors />
      <LinearGradient
        colors={dim ? ['rgba(16,22,30,0.32)', 'rgba(16,22,30,0.8)'] : ['rgba(20,30,28,0.04)', 'rgba(20,30,28,0.4)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ flex: 1, padding: 14 }}>
        <AppText variant="caption" style={{ color: '#FFFFFF' }}>{label}</AppText>
      </LinearGradient>
    </View>
  );
}

/** The amber-ish "growth" arrow that springs in between the two cards. */
function ArrowBadge({ style }: { style?: ViewStyle }) {
  const reduced = useReducedMotion();
  const s = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) s.value = withDelay(450, withSpring(1, { damping: 12, stiffness: 170, mass: 0.6 }));
  }, [reduced, s]);
  const st = useAnimatedStyle(() => ({ opacity: Math.min(1, s.value * 1.4), transform: [{ scale: 0.5 + s.value * 0.5 }] }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { width: 46, height: 46, borderRadius: 23, backgroundColor: brand.sage, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#10211E' },
        st,
        style,
      ]}>
      <Feather name="arrow-up-right" size={22} color="#10211E" />
    </Animated.View>
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** An animated "first 7 nights" rhythm line — our real calm-nights mechanic (a
 *  star per calm night, 7 to a week). Aspirational on a fresh start, not a
 *  measured sleep stat. The line draws itself on via strokeDashoffset. */
function WeekChart() {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const W = 300;
  const H = 150;
  const x0 = 16;
  const x1 = 284;
  const yTop = 14;
  const yBot = 118;
  const vals = [0.18, 0.34, 0.3, 0.52, 0.62, 0.58, 0.92]; // gentle, overall-rising rhythm
  const pts = vals.map((v, i) => ({ x: x0 + (i / (vals.length - 1)) * (x1 - x0), y: yBot - v * (yBot - yTop) }));
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const len = pts.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);
  const draw = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) draw.value = withDelay(250, withTiming(1, { duration: 1500, easing: ease.out }));
  }, [reduced, draw]);
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - draw.value) }));
  const start = pts[0];
  const end = pts[pts.length - 1];
  return (
    <Svg width={W} height={H}>
      {[0.25, 0.5, 0.75].map((g) => (
        <Line key={g} x1={x0} y1={yTop + g * (yBot - yTop)} x2={x1} y2={yTop + g * (yBot - yTop)} stroke={c.line} strokeWidth={1} />
      ))}
      <AnimatedPath d={d} stroke={c.accent} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={len} animatedProps={lineProps} />
      <Circle cx={start.x} cy={start.y} r={5} fill={c.bg} stroke={c.accent} strokeWidth={3} />
      <Circle cx={end.x} cy={end.y} r={6} fill={c.accent} />
    </Svg>
  );
}

export function Onboarding() {
  const router = useRouter();
  const { c } = useTheme();
  const { setFeeling } = useProfile();
  const [stage, setStage] = useState<'welcome' | 'intro' | 'transform' | 'progress' | 'goal' | 'quiz' | 'voice' | 'result'>('welcome');
  const [i, setI] = useState(0);
  const [chosen, setChosen] = useState<Feeling | null>(null);
  const [goalHours, setGoalHours] = useState(SLEEP_GOAL_DEFAULT);
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

  // ---- constellation welcome (the entry) ----
  if (stage === 'welcome') {
    return (
      <Screen contentStyle={{ flex: 1, paddingTop: 8, paddingBottom: 28 }}>
        <TwinkleStar top={70} left="16%" size={14} delay={0} />
        <TwinkleStar top={120} left="74%" size={20} delay={350} />
        <TwinkleStar top={190} left="40%" size={12} delay={700} />
        <TwinkleStar top={150} left="88%" size={14} delay={1100} />
        <TwinkleStar top={250} left="10%" size={16} delay={500} />
        <TwinkleStar top={300} left="64%" size={12} delay={900} />
        <TwinkleStar top={360} left="28%" size={18} delay={1400} />
        <TwinkleStar top={420} left="82%" size={13} delay={200} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View entering={FadeInDown.duration(dur.screen)}>
            <AppText variant="display" tone="title" style={{ textAlign: 'center', fontSize: 34, lineHeight: 40 }}>
              Welcome
            </AppText>
          </Animated.View>
          <Animated.View entering={FadeInDown.duration(dur.screen).delay(120)}>
            <AppText variant="body" tone="muted" style={{ textAlign: 'center', maxWidth: 300, marginTop: 14, alignSelf: 'center' }}>
              Let’s begin your journey to calmer evenings and deeper, more restful nights.
            </AppText>
          </Animated.View>
        </View>
        <Pressable
          onPress={() => setStage('intro')}
          onPressIn={lightTap}
          accessibilityRole="button"
          accessibilityLabel="Begin"
          style={({ pressed }) => [
            { alignSelf: 'center', width: 78, height: 78, borderRadius: 39, backgroundColor: c.ctaBg, alignItems: 'center', justifyContent: 'center', ...c.shadow },
            pressed ? { transform: [{ scale: 0.94 }], opacity: 0.9 } : null,
          ]}>
          <Feather name="arrow-right" size={28} color={c.ctaText} />
        </Pressable>
        <Pressable onPress={finish} accessibilityRole="button" style={{ alignItems: 'center', paddingVertical: 14, marginTop: 8 }}>
          <AppText variant="label" tone="muted">
            I already have an account. <AppText variant="label" style={{ color: c.textAccent }}>Sign in</AppText>
          </AppText>
        </Pressable>
      </Screen>
    );
  }

  // ---- first-7-nights rhythm (animated draw; the real calm-nights mechanic) ----
  if (stage === 'progress') {
    return (
      <Screen contentStyle={{ flex: 1, paddingTop: 8, paddingBottom: 28 }}>
        <AmbientMotes />
        <OnboardingHeader onSkip={finish} />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Animated.View entering={FadeInDown.duration(dur.screen)}>
            <AppText variant="display" tone="title" style={{ textAlign: 'center' }}>
              Your first 7 nights
            </AppText>
          </Animated.View>
          <Animated.View entering={FadeInDown.duration(dur.screen).delay(90)}>
            <AppText variant="body" tone="muted" style={{ textAlign: 'center', maxWidth: 330, marginTop: 12, alignSelf: 'center' }}>
              A gentle week to settle into the ritual. Each calm night earns a star — seven builds the rhythm.
            </AppText>
          </Animated.View>
          <Animated.View entering={FadeIn.duration(dur.screen).delay(180)} style={{ marginTop: 40, alignItems: 'center' }}>
            <WeekChart />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: 300, paddingHorizontal: 10, marginTop: 6 }}>
              <AppText variant="label" tone="muted">Night 1</AppText>
              <AppText variant="label" tone="muted">Night 4</AppText>
              <AppText variant="label" tone="muted">Night 7</AppText>
            </View>
          </Animated.View>
        </View>
        <PrimaryButton label="Continue" onPress={() => setStage('goal')} />
      </Screen>
    );
  }

  // ---- before/after transformation (aspirational, not a measured claim) ----
  if (stage === 'transform') {
    return (
      <Screen contentStyle={{ flex: 1, paddingTop: 8, paddingBottom: 28 }}>
        <AmbientMotes />
        <OnboardingHeader onSkip={finish} />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Animated.View entering={FadeInDown.duration(dur.screen)}>
            <AppText variant="display" tone="title" style={{ textAlign: 'center' }}>
              A calmer you, a week from now
            </AppText>
          </Animated.View>
          <Animated.View entering={FadeInDown.duration(dur.screen).delay(90)}>
            <AppText variant="body" tone="muted" style={{ textAlign: 'center', maxWidth: 330, marginTop: 12, alignSelf: 'center' }}>
              A few minutes of wind-down each evening, and busy nights start to feel lighter.
            </AppText>
          </Animated.View>
          <Animated.View entering={FadeIn.duration(dur.reveal).delay(150)} style={{ height: 340, marginTop: 24 }}>
            <TwinkleStar top={16} left="14%" size={18} delay={0} />
            <TwinkleStar top={66} left="84%" size={22} delay={500} />
            <TwinkleStar top={244} left="88%" size={15} delay={900} />
            <TwinkleStar top={300} left="9%" size={14} delay={1300} />
            <TransformCard cover="dawnWoods" label="You in a week" style={{ position: 'absolute', top: 0, right: 6, transform: [{ rotate: '4deg' }], zIndex: 2 }} />
            <TransformCard cover="rainfall" label="You today" dim style={{ position: 'absolute', bottom: 0, left: 6, transform: [{ rotate: '-4deg' }], zIndex: 1 }} />
            <ArrowBadge style={{ position: 'absolute', top: 148, alignSelf: 'center', zIndex: 3 }} />
          </Animated.View>
        </View>
        <PrimaryButton label="Continue" onPress={() => setStage('progress')} />
      </Screen>
    );
  }

  // ---- nightly sleep-hours goal (a real saved preference, not a tracked metric) ----
  if (stage === 'goal') {
    return (
      <Screen contentStyle={{ flex: 1, paddingTop: 8, paddingBottom: 28 }}>
        <AmbientMotes />
        <OnboardingHeader onSkip={finish} />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Animated.View entering={FadeInDown.duration(dur.screen)}>
            <AppText variant="display" tone="title" style={{ textAlign: 'center' }}>
              Your nightly sleep goal
            </AppText>
          </Animated.View>
          <Animated.View entering={FadeInDown.duration(dur.screen).delay(90)}>
            <AppText variant="body" tone="muted" style={{ textAlign: 'center', maxWidth: 330, marginTop: 12, alignSelf: 'center' }}>
              Most adults do best on 7 to 9 hours. We’ll keep your goal in mind as you build a calmer evening rhythm.
            </AppText>
          </Animated.View>
          <Animated.View entering={FadeInDown.duration(dur.screen).delay(180)} style={{ marginTop: 44 }}>
            <SleepGoalDial value={goalHours} onChange={setGoalHours} />
          </Animated.View>
        </View>
        <PrimaryButton
          label="Continue"
          onPress={() => {
            setSleepGoalHours(goalHours);
            setStage('quiz');
          }}
        />
      </Screen>
    );
  }

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

      <PrimaryButton label={last ? 'Get started' : 'Next'} onPress={() => (last ? setStage('transform') : setI((v) => v + 1))} />
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
