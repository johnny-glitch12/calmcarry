import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Appear, AppText, PressableScale, PrimaryButton, Screen } from '@/components';
import { lightTap } from '@/lib/haptics';
import { dur, ease, useTheme } from '@/theme';

import { Grounding } from './Grounding';
import { PutDownDay } from './PutDownDay';
import { SighPacer } from './SighPacer';

type Stage = 'breathe' | 'ground' | 'putdown';

/**
 * SOS - the 3am panic ladder. One tap lands DIRECTLY in a haptic-paced
 * physiological sigh (no menus between a spiking person and the first breath).
 * After ~6 sighs a quiet "Something else?" offers two more rungs (5-4-3-2-1
 * grounding, a put-the-day-down note), and every rung ends the same way:
 * "Drift back" into the wind-down with a free looping track. Clock-free and
 * near-black by design. No hotline numbers (client decision) - just a dim
 * acknowledgement that help lines exist.
 */
export function Sos() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [stage, setStage] = useState<Stage>('breathe');
  const [offerReady, setOfferReady] = useState(false);

  // the options fade in slowly; their space is reserved from first paint so the
  // orb never reflows mid-breath when they arrive
  const offer = useSharedValue(0);
  useEffect(() => {
    if (offerReady) {
      offer.value = reduced ? 1 : withTiming(1, { duration: dur.modal, easing: ease.inOut });
    }
  }, [offerReady, reduced, offer]);
  const offerStyle = useAnimatedStyle(() => ({ opacity: offer.value }));

  // every rung hands off to the same soft landing: the wind-down, on the free
  // looping rescue track - never a paywall at the bottom of the ladder
  const driftBack = () => router.replace('/wind-down?id=slow-tide');
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen mode="night">
      {/* the one quiet exit - always visible, never part of the ladder */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-start', paddingTop: 4 }}>
        <QuietClose onPress={close} />
      </View>

      <View style={{ flex: 1 }}>
        {stage === 'breathe' ? (
          <Appear style={{ flex: 1 }}>
            <SighPacer onOfferReady={() => setOfferReady(true)} />
            <View pointerEvents={offerReady ? 'auto' : 'none'}>
              <Animated.View style={[{ gap: 10, paddingBottom: 4 }, offerStyle]}>
                <AppText variant="caption" tone="dim" style={{ textAlign: 'center', marginBottom: 2 }}>
                  Something else?
                </AppText>
                <OptionRow
                  title="5-4-3-2-1 grounding"
                  sub="Come back to the room, one sense at a time"
                  onPress={() => setStage('ground')}
                />
                <OptionRow
                  title="Put the day down"
                  sub="Park tomorrow’s thoughts until morning"
                  onPress={() => setStage('putdown')}
                />
                <PrimaryButton label="Drift back" onPress={driftBack} style={{ marginTop: 2 }} />
              </Animated.View>
            </View>
          </Appear>
        ) : stage === 'ground' ? (
          <Appear style={{ flex: 1 }}>
            <Grounding onDriftBack={driftBack} />
          </Appear>
        ) : (
          <Appear style={{ flex: 1 }}>
            <PutDownDay onDriftBack={driftBack} />
          </Appear>
        )}
      </View>

      {/* crisis line: an acknowledgement, not a directory - deliberately unlinked */}
      <AppText
        variant="meta"
        tone="dim"
        style={{ textAlign: 'center', paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12) + 4 }}>
        If tonight feels like too much, help lines exist. You deserve support.
      </AppText>
    </Screen>
  );
}

/** Same look as the wind-down's close control - the room's familiar door out. */
function QuietClose({ onPress }: { onPress: () => void }) {
  const { c } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      onPressIn={lightTap}
      accessibilityRole="button"
      accessibilityLabel="Leave SOS"
      hitSlop={8}
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.panelStrong,
        borderWidth: 1,
        borderColor: c.lineSage,
      }}>
      <Feather name="chevron-down" size={20} color={c.accent} />
    </PressableScale>
  );
}

/** A quiet choice row - dimmer than a button on purpose; the ladder's rungs
 *  should invite, never demand. */
function OptionRow({ title, sub, onPress }: { title: string; sub: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      onPressIn={lightTap}
      accessibilityRole="button"
      accessibilityLabel={title}
      scaleTo={0.98}
      style={{
        borderRadius: 16,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.line,
        paddingVertical: 14,
        paddingHorizontal: 16,
      }}>
      <AppText variant="cardTitle" tone="title">
        {title}
      </AppText>
      <AppText variant="meta" tone="muted" style={{ marginTop: 2 }}>
        {sub}
      </AppText>
    </PressableScale>
  );
}
