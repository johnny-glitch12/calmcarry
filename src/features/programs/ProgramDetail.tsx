import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Appear, AppText, Card, Crossfade, PressableScale, PrimaryButton, Reveal, Screen, SelectionOverlay, SwapText } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { covers } from '@/content/covers';
import { PROGRAMS, TRACKS, type Program } from '@/content/library';
import { lightTap } from '@/lib/haptics';
import { getProgramDone } from '@/lib/programs';
import { dur, ease, fonts, useTheme } from '@/theme';

export function ProgramDetail() {
  const { c } = useTheme();
  const router = useRouter();
  const { isPremium } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  // fall back to the FREE starter arc (not a locked premium program) for a bad/legacy link
  const program = (id && PROGRAMS[id]) || PROGRAMS['first-week'];
  const locked = !!program.locked && !isPremium;

  // real completion state — null until the first load resolves, so the CTA label
  // and counter can hold (and then swap) instead of flashing a wrong initial value
  const [done, setDone] = useState<number[] | null>(null);
  useFocusEffect(
    useCallback(() => {
      getProgramDone(program.id).then(setDone);
    }, [program.id])
  );
  const doneList = done ?? [];

  const open = (day: number, trackId?: string) => {
    if (locked) return router.push(`/unlock?id=${program.id}` as Href);
    if (!trackId) return;
    router.push(`/player?id=${trackId}&program=${program.id}&day=${day}` as Href);
  };
  // "Begin" resumes at the first night not yet done (else night 1)
  const nextStep = program.steps.find((s) => !doneList.includes(s.day)) ?? program.steps[0];
  const ctaLabel =
    doneList.length === 0
      ? 'Begin program'
      : doneList.length >= program.steps.length
        ? 'Revisit a night'
        : `Continue · night ${nextStep.day}`;

  const back = () => (router.canGoBack() ? router.back() : router.replace('/sounds'));

  return (
    <Screen mode="light" scroll>
      <Reveal index={0}>
        <PressableScale
          onPress={back}
          onPressIn={lightTap}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
          dimTo={0.85}
          style={{ marginBottom: 16 }}>
          <Feather name="chevron-left" size={26} color={c.text} />
        </PressableScale>
        <Image
          source={covers[program.cover]}
          style={{ width: '100%', height: 180, borderRadius: 20 }}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
        <AppText variant="caption" tone="accent" style={{ marginTop: 18 }}>
          {program.weeks}-week reset · for {program.avatar}
        </AppText>
        <AppText variant="display" tone="title" style={{ marginTop: 6 }}>
          {program.title}
        </AppText>
        <AppText variant="body" tone="muted" style={{ marginTop: 4 }}>
          {program.subtitle}
        </AppText>
      </Reveal>

      <Reveal index={1} style={{ marginTop: 20 }}>
        {locked ? (
          <Appear key="locked">
            <PrimaryButton label="Unlock with Premium" onPress={() => router.push(`/unlock?id=${program.id}` as Href)} />
          </Appear>
        ) : (
          // Render immediately using the default (doneList = []) so there's no empty
          // gap while the local completion state loads; key on the label so the real
          // value (0→N nights, night N→N+1) crossfades in instead of hard-swapping.
          <Appear key={ctaLabel}>
            <PrimaryButton label={ctaLabel} onPress={() => open(nextStep.day, nextStep.trackId)} />
          </Appear>
        )}
      </Reveal>

      <Reveal index={2} style={{ marginTop: 32 }}>
        <AppText variant="caption" tone="accent" style={{ marginBottom: 4 }}>
          The plan
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <AppText variant="h2" tone="title">
            Your nightly steps
          </AppText>
          {!locked ? (
            <SwapText trigger={doneList.length}>
              <AppText variant="label" tone="muted">
                {doneList.length} of {program.steps.length} nights
              </AppText>
            </SwapText>
          ) : null}
        </View>
        <View style={{ gap: 12 }}>
          {program.steps.map((step) => (
            <StepRow
              key={step.day}
              step={step}
              isDone={doneList.includes(step.day)}
              locked={locked}
              onPress={() => open(step.day, step.trackId)}
            />
          ))}
        </View>
      </Reveal>
    </Screen>
  );
}

/**
 * DayBadge — the leading circle. On completion the fill eases from the resting
 * panel tint to the CTA fill (interpolateColor) while the day-number crossfades
 * to a check. Reduced motion snaps to the end state.
 */
function DayBadge({ day, isDone }: { day: number; isDone: boolean }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const p = useSharedValue(isDone ? 1 : 0);
  useEffect(() => {
    p.value = reduced ? (isDone ? 1 : 0) : withTiming(isDone ? 1 : 0, { duration: dur.press, easing: ease.inOut });
  }, [isDone, reduced, p]);
  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], [c.panel, c.ctaBg]),
  }));
  return (
    <Animated.View
      style={[
        { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
        bgStyle,
      ]}>
      <Crossfade
        active={isDone}
        style={{ width: 42, height: 42 }}
        front={<Feather name="check" size={18} color={c.ctaText} style={{ transform: [{ scale: 0.95 }] }} />}
        back={
          <AppText style={{ fontFamily: fonts.display, fontSize: 16, color: c.textAccent }}>{day}</AppText>
        }
      />
    </Animated.View>
  );
}

/**
 * StepRow — one nightly step. Keeps the Card on a fixed `surface` look and eases
 * the "done" panel tint in via a SelectionOverlay (so the surface→panel flip never
 * hard-cuts). The trailing glyph crossfades play↔revisit; the day badge handles its
 * own fill + number↔check transition.
 */
function StepRow({
  step,
  isDone,
  locked,
  onPress,
}: {
  step: Program['steps'][number];
  isDone: boolean;
  locked: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const t = step.trackId ? TRACKS[step.trackId] : undefined;
  return (
    <PressableScale
      onPress={onPress}
      onPressIn={lightTap}
      accessibilityRole="button"
      accessibilityState={{ selected: isDone }}
      dimTo={0.95}
      scaleTo={0.98}>
      <View style={{ position: 'relative', borderRadius: 16 }}>
        {/* panel look eased in over the resting surface Card — constant borderWidth so no layout shift */}
        <SelectionOverlay
          active={isDone}
          style={{ borderRadius: 16, borderWidth: 1, borderColor: c.lineSage, backgroundColor: c.panel }}
        />
        <Card variant="surface" padding={14} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <DayBadge day={step.day} isDone={isDone} />
          <View style={{ flex: 1 }}>
            <AppText variant="cardTitle" tone="title" numberOfLines={2}>
              {step.title}
            </AppText>
            {t ? (
              <AppText variant="label" tone="muted" style={{ marginTop: 2 }} numberOfLines={1}>
                {t.title} · {t.duration}
              </AppText>
            ) : null}
          </View>
          {locked ? (
            <Feather name="lock" size={16} color={c.accent} />
          ) : (
            <Crossfade
              active={isDone}
              style={{ width: 16, height: 16 }}
              front={<Feather name="rotate-ccw" size={16} color={c.accent} />}
              back={<Feather name="play" size={16} color={c.accent} />}
            />
          )}
        </Card>
      </View>
    </PressableScale>
  );
}
