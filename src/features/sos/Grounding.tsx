import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, PrimaryButton, SwapText } from '@/components';
import { lightTap } from '@/lib/haptics';

type GroundStep = { count: number; sense: string; hint: string };

// 5-4-3-2-1: one sense per screen, nothing to read ahead. The order is the
// classic descending count - each step is smaller than the last on purpose.
const STEPS: readonly GroundStep[] = [
  { count: 5, sense: 'you can see', hint: 'Name them slowly. Shapes and shadows count.' },
  { count: 4, sense: 'you can feel', hint: 'The sheets. The air. Your own breath.' },
  { count: 3, sense: 'you can hear', hint: 'Even a quiet room hums.' },
  { count: 2, sense: 'you can smell', hint: 'Take your time with this one.' },
  { count: 1, sense: 'you can taste', hint: 'Nearly there.' },
];

/**
 * Grounding - tap-through 5-4-3-2-1 cards. The WHOLE screen is the tap target
 * (no small button to aim for in the dark); each advance gets the standard
 * light tap so progress is felt, not just seen.
 */
export function Grounding({ onDriftBack }: { onDriftBack: () => void }) {
  const [idx, setIdx] = useState(0);
  const done = idx >= STEPS.length;

  const advance = () => {
    lightTap();
    setIdx((v) => v + 1);
  };

  if (done) {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <AppText variant="h1" tone="title" style={{ textAlign: 'center' }}>
            You came back
          </AppText>
          <AppText variant="body" tone="muted" style={{ textAlign: 'center', maxWidth: 300 }}>
            You are here, in the room, in the dark. That is enough.
          </AppText>
        </View>
        <PrimaryButton label="Drift back" onPress={onDriftBack} style={{ marginBottom: 8 }} />
      </View>
    );
  }

  const step = STEPS[idx];
  const noun = step.count === 1 ? 'thing' : 'things';
  return (
    <Pressable
      onPress={advance}
      accessibilityRole="button"
      accessibilityLabel={`${step.count} ${noun} ${step.sense}. ${step.hint} Tap for the next sense.`}
      style={{ flex: 1 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <SwapText trigger={idx} style={{ alignItems: 'center' }}>
          <AppText variant="display" tone="accent" style={{ fontSize: 54, lineHeight: 62 }}>
            {step.count}
          </AppText>
          <AppText variant="h2" tone="title" style={{ marginTop: 8, textAlign: 'center' }}>
            {noun} {step.sense}
          </AppText>
          <AppText variant="body" tone="muted" style={{ marginTop: 10, textAlign: 'center', maxWidth: 300 }}>
            {step.hint}
          </AppText>
        </SwapText>
      </View>
      <AppText variant="meta" tone="dim" style={{ textAlign: 'center', paddingBottom: 16 }}>
        Tap anywhere when you are ready
      </AppText>
    </Pressable>
  );
}
