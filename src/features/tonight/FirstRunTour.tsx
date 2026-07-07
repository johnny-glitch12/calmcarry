import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Appear, AppText, PressableScale, PrimaryButton } from '@/components';
import { dur, useTheme } from '@/theme';

// Mason: one-time walkthrough, simple and straight to the point. Three short
// cards over a dim scrim, shown ONCE after the first landing on Home (persisted
// by the caller). No spotlight cut-outs, no gimmicks — read, tap, done.
const STEPS = [
  {
    title: 'One pick, every night',
    body: 'Home suggests a single session each evening. Tap the big card to play it, or start the full 20-minute wind-down below it.',
  },
  {
    title: 'Library and sound machine',
    body: 'Library holds every sound, story, and session. Listen is the sound machine: layer rain, fire, and noise, and set a sleep timer.',
  },
  {
    title: 'Your Glow Orb',
    body: 'Rest the Orb in your palm while audio plays and breathe with its glow. Kids Mode and settings live in the Profile tab.',
  },
];

export function FirstRunTour({ onDone }: { onDone: () => void }) {
  const { c } = useTheme();
  const [i, setI] = useState(0);
  const last = i === STEPS.length - 1;
  const step = STEPS[i];
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        // literal scrim (image/overlay context): dim the app behind the tour card
        { backgroundColor: 'rgba(11,19,18,0.74)', justifyContent: 'flex-end', padding: 20, paddingBottom: 44 },
      ]}>
      <Appear key={i} enter={dur.sheet} exit={dur.exit}>
        <View style={{ borderRadius: 20, padding: 20, backgroundColor: c.bg, borderWidth: 1, borderColor: c.lineSage, ...c.shadow }}>
          <AppText variant="caption" tone="accent">
            Quick tour · {i + 1} of {STEPS.length}
          </AppText>
          <AppText variant="h2" tone="title" style={{ marginTop: 8 }}>
            {step.title}
          </AppText>
          <AppText variant="body" tone="muted" style={{ marginTop: 8 }}>
            {step.body}
          </AppText>
          <View style={{ marginTop: 18 }}>
            <PrimaryButton label={last ? 'Let’s begin' : 'Next'} onPress={() => (last ? onDone() : setI(i + 1))} />
          </View>
          <PressableScale
            onPress={onDone}
            accessibilityRole="button"
            accessibilityLabel="Skip the tour"
            dimTo={0.6}
            hitSlop={8}
            style={{ alignItems: 'center', paddingVertical: 12, marginTop: 2 }}>
            <AppText variant="label" tone="dim" style={{ textTransform: 'none', letterSpacing: 0 }}>
              Skip
            </AppText>
          </PressableScale>
        </View>
      </Appear>
    </View>
  );
}
