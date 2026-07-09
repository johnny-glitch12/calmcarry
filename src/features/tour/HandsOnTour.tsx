import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { Appear, AppText, PressableScale, PrimaryButton } from '@/components';
import { getTourTarget, subscribeTourTargets } from '@/lib/tourTargets';
import { dur, useTheme } from '@/theme';

/**
 * Hands-on first-run walkthrough (Mason: simple, straight to the point — but you
 * DO it, not just read it). A dim scrim with a spotlight hole over the real UI:
 * the first step shows tonight's pick, then the user must actually tap the
 * Library and Listen tabs to move on — the tour narrates the screen they just
 * opened. Rendered ABOVE the tab bar (tabs layout), so nothing cuts through it.
 */
type Step = {
  target: string;
  kicker: string;
  title: string;
  body: string;
  /** 'next' = Next button; 'done' = final button; a pathname = tap the real control */
  advance: 'next' | 'done' | `/${string}`;
};

const STEPS: Step[] = [
  {
    target: 'home-hero',
    kicker: 'Quick tour · 1 of 4',
    title: 'One pick, every night',
    body: 'Home suggests a single session each evening. The big card plays it; the button beneath starts the full 20-minute wind-down.',
    advance: 'next',
  },
  {
    target: 'tab-sounds',
    kicker: 'Quick tour · 2 of 4',
    title: 'Your turn: open the Library',
    body: 'Tap the glowing tab. Every sound, story and session lives there.',
    advance: '/sounds',
  },
  {
    target: 'tab-listen',
    kicker: 'Quick tour · 3 of 4',
    title: 'Now the sound machine',
    body: 'Tap Listen. Layer rain, fire and noise, and set a sleep timer for the night.',
    advance: '/listen',
  },
  {
    target: 'tab-you',
    kicker: 'Quick tour · 4 of 4',
    title: 'That’s the whole app',
    body: 'Kids Mode, reminders and your account live in Profile, behind this tab. Sleep well.',
    advance: 'done',
  },
];

const SCRIM = 'rgba(11,19,18,0.78)';
const PAD = 6; // breathing room between the target and the spotlight edge

export function HandsOnTour({ onDone }: { onDone: () => void }) {
  const { c } = useTheme();
  const { width: W, height: H } = useWindowDimensions();
  const pathname = usePathname();
  const [i, setI] = useState(0);
  // re-render when a target re-measures (tab pill grows when it gains focus)
  const [, setTick] = useState(0);
  useEffect(() => subscribeTourTargets(() => setTick((t) => t + 1)), []);

  const step = STEPS[i];

  // hands-on advancement: the step completes when the user really lands there
  useEffect(() => {
    if (!step || !step.advance.startsWith('/')) return;
    if (pathname !== step.advance) return;
    // a beat so the new screen settles under the spotlight before the copy changes
    const id = setTimeout(() => setI((v) => v + 1), 420);
    return () => clearTimeout(id);
  }, [pathname, step]);

  if (!step) return null;

  const raw = getTourTarget(step.target);
  const rect = raw
    ? {
        x: Math.max(0, raw.x - PAD),
        y: Math.max(0, raw.y - PAD),
        w: Math.min(W, raw.width + PAD * 2),
        h: raw.height + PAD * 2,
      }
    : null;
  const interactive = step.advance.startsWith('/');

  // card above the target when the target sits in the lower half (the tabs), below it otherwise
  const cardAbove = rect ? rect.y + rect.h / 2 > H / 2 : false;
  const cardPos = rect
    ? cardAbove
      ? { bottom: H - rect.y + 14 }
      : { top: rect.y + rect.h + 14 }
    : { top: H * 0.3 };

  const block = { backgroundColor: SCRIM } as const;

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="box-none">
      {rect ? (
        <>
          {/* scrim in four slabs around the spotlight hole — everywhere else absorbs
              the tap, so during a hands-on step the ONLY tappable thing is the real
              control (plus Skip). Pressables (not plain Views) so touches are eaten. */}
          <Pressable style={[{ position: 'absolute', top: 0, left: 0, right: 0, height: rect.y }, block]} />
          <Pressable style={[{ position: 'absolute', top: rect.y + rect.h, left: 0, right: 0, bottom: 0 }, block]} />
          <Pressable style={[{ position: 'absolute', top: rect.y, left: 0, width: rect.x, height: rect.h }, block]} />
          <Pressable
            style={[{ position: 'absolute', top: rect.y, left: rect.x + rect.w, right: 0, height: rect.h }, block]}
          />
          {/* look-only steps keep the hole visible but not tappable */}
          {!interactive ? (
            <Pressable style={{ position: 'absolute', top: rect.y, left: rect.x, width: rect.w, height: rect.h }} />
          ) : null}
          {/* the spotlight ring */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: rect.y,
              left: rect.x,
              width: rect.w,
              height: rect.h,
              borderRadius: 22,
              borderWidth: 2,
              borderColor: c.accent,
              ...c.shadow,
            }}
          />
        </>
      ) : (
        // target not measured (shouldn't happen) — plain scrim, centered card below
        <Pressable style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, block]} />
      )}

      <View style={[{ position: 'absolute', left: 20, right: 20 }, cardPos]} pointerEvents="box-none">
        <Appear key={i} enter={dur.sheet} exit={dur.exit}>
          <View style={{ borderRadius: 20, padding: 20, backgroundColor: c.bg, borderWidth: 1, borderColor: c.lineSage, ...c.shadow }}>
            <AppText variant="caption" tone="accent">
              {step.kicker}
            </AppText>
            <AppText variant="h2" tone="title" style={{ marginTop: 8 }}>
              {step.title}
            </AppText>
            <AppText variant="body" tone="muted" style={{ marginTop: 8 }}>
              {step.body}
            </AppText>
            {!interactive ? (
              <View style={{ marginTop: 18 }}>
                <PrimaryButton
                  label={step.advance === 'done' ? 'Let’s begin' : 'Next'}
                  onPress={() => (step.advance === 'done' ? onDone() : setI(i + 1))}
                />
              </View>
            ) : null}
            {/* hands-on steps: the real tap is the primary action, but nobody gets
                held hostage — a quiet way past this step without doing it */}
            {interactive ? (
              <PressableScale
                onPress={() => setI(i + 1)}
                accessibilityRole="button"
                accessibilityLabel="Skip this step"
                dimTo={0.6}
                hitSlop={8}
                style={{ alignItems: 'center', paddingVertical: 12, marginTop: 8 }}>
                <AppText variant="label" tone="muted" style={{ textTransform: 'none', letterSpacing: 0 }}>
                  Skip this step
                </AppText>
              </PressableScale>
            ) : null}
            <PressableScale
              onPress={onDone}
              accessibilityRole="button"
              accessibilityLabel="Skip the tour"
              dimTo={0.6}
              hitSlop={8}
              style={{ alignItems: 'center', paddingVertical: 12, marginTop: interactive ? 0 : 2 }}>
              <AppText variant="label" tone="dim" style={{ textTransform: 'none', letterSpacing: 0 }}>
                Skip tour
              </AppText>
            </PressableScale>
          </View>
        </Appear>
      </View>
    </View>
  );
}
