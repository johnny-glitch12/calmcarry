import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText, GlowOrb, SwapText } from '@/components';
import { ease } from '@/theme';

/** One step of the sigh. `to` is the wrapper scale the step eases toward;
 *  `haptic` marks the felt cue fired at the step's onset. */
type SighPhase = {
  ms: number;
  to: number;
  label: string;
  haptic?: 'inhale' | 'exhale';
};

// The physiological sigh: a full nose inhale, a short top-up inhale, one long
// slow mouth exhale, then a settle. GlowOrb's paced loop is locked to the
// wind-down's 4s/6s rhythm, so the sigh is driven HERE on a wrapper around a
// still orb - the orb component stays untouched.
const SIGH: readonly SighPhase[] = [
  { ms: 1500, to: 1.06, label: 'Breathe in', haptic: 'inhale' },
  { ms: 1000, to: 1.12, label: 'A little more', haptic: 'inhale' },
  { ms: 6000, to: 1, label: 'Slow out, through your mouth', haptic: 'exhale' },
  { ms: 3000, to: 1, label: 'Rest' },
];

// ~6 sighs (a bit over a minute) before any choice appears - the breathing must
// be the ONLY thing on screen while the body is still spiking.
const OFFER_AFTER_CYCLES = 6;

// Felt cues so the pacing works eyes-closed, phone on the chest: a soft impact
// as each inhale starts, the lightest tick as the exhale begins. Web has no
// haptics - both no-op there and the on-screen copy never promises taps.
function inhaleCue(): void {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
}
function exhaleCue(): void {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
}

/**
 * SighPacer - the first rung of the SOS ladder. Runs the sigh loop forever
 * (someone may just breathe with it until they drift off); after
 * OFFER_AFTER_CYCLES full cycles it tells the parent once, so the quieter
 * options can fade in around it without interrupting the rhythm.
 */
export function SighPacer({ onOfferReady }: { onOfferReady: () => void }) {
  const reduced = useReducedMotion();
  const [label, setLabel] = useState(SIGH[0].label);
  const scale = useSharedValue(1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cycles = useRef(0);
  // latest callback in a ref so the pacer effect never re-arms mid-cycle
  const offerRef = useRef(onOfferReady);
  useEffect(() => {
    offerRef.current = onOfferReady;
  });

  useEffect(() => {
    const run = (i: number) => {
      const phase = SIGH[i];
      setLabel(phase.label);
      if (phase.haptic === 'inhale') inhaleCue();
      else if (phase.haptic === 'exhale') exhaleCue();
      // reduced motion: the orb holds still; haptics + labels carry the pacing
      if (!reduced) scale.value = withTiming(phase.to, { duration: phase.ms, easing: ease.sine });
      timer.current = setTimeout(() => {
        const next = (i + 1) % SIGH.length;
        if (next === 0) {
          cycles.current += 1;
          if (cycles.current === OFFER_AFTER_CYCLES) offerRef.current();
        }
        run(next);
      }, phase.ms);
    };
    run(0);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      cancelAnimation(scale);
    };
  }, [reduced, scale]);

  const sighStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <AppText variant="caption" tone="dim">
        Here with you
      </AppText>
      <Animated.View style={[{ marginTop: 4 }, sighStyle]}>
        <GlowOrb size={200} breathing={false} reserveGlow />
      </Animated.View>
      <SwapText trigger={label} style={{ marginTop: 4, alignItems: 'center' }}>
        <AppText variant="h2" tone="title" style={{ textAlign: 'center', maxWidth: 300 }}>
          {label}
        </AppText>
      </SwapText>
      <AppText variant="body" tone="muted" style={{ marginTop: 10, textAlign: 'center', maxWidth: 300 }}>
        {Platform.OS === 'web'
          ? 'Follow the glow. Two breaths in, one long slow breath out.'
          : 'You can close your eyes. The taps keep time for you.'}
      </AppText>
    </View>
  );
}
