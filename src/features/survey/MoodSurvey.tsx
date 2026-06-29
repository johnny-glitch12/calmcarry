import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AppText, GlowOrb, Reveal, Screen } from '@/components';
import { FEELING_MAP, useProfile, type Feeling, type Intent } from '@/features/profile/ProfileProvider';
import { dur, ease, PRESS_SCALE, useTheme } from '@/theme';

// STEP 1 — "How are you arriving tonight?" SAFE WORDS ONLY (build plan §3/§14):
// never "anxious"/"insomnia"/clinical terms. Forward-looking, no symptom tracking.
const FEELINGS: { key: Feeling; label: string; hint: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'racing', label: 'My mind’s racing', hint: 'Lots of thoughts, hard to slow', icon: 'zap' },
  { key: 'cant-switch-off', label: 'I can’t switch off', hint: 'Still in the day', icon: 'power' },
  { key: 'wired-tired', label: 'Wired but tired', hint: 'Tired body, busy head', icon: 'battery-charging' },
  { key: 'wound-up', label: 'I’m wound up', hint: 'Tense, on edge', icon: 'rotate-cw' },
  { key: 'heavy-day', label: 'It’s been a heavy day', hint: 'Carrying a lot', icon: 'cloud' },
  { key: 'quiet', label: 'I just want quiet', hint: 'Somewhere calm to rest', icon: 'feather' },
];

// STEP 2 — "What would feel good right now?" (always ≥1 free option, §6)
const INTENTS: { intent: Intent; label: string; hint: string; icon: keyof typeof Feather.glyphMap }[] = [
  { intent: 'sleep', label: 'Wind down for sleep', hint: 'Ease into a calm night', icon: 'moon' },
  { intent: 'reset', label: 'A quick reset', hint: 'A couple of minutes to steady', icon: 'wind' },
  { intent: 'sounds', label: 'Just calm sounds', hint: 'Layer a soundscape', icon: 'music' },
  { intent: 'suggest', label: 'Suggest something', hint: 'Let CalmCarry choose', icon: 'compass' },
];

/** A calm, tappable row: gentle scale-0.97 + light haptic on press (§4). */
function TapRow({
  icon,
  label,
  hint,
  highlight,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  hint: string;
  highlight?: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const press = (to: number) => {
    scale.value = withTiming(to, { duration: dur.press, easing: ease.out });
  };
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        press(PRESS_SCALE);
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }}
      onPressOut={() => press(1)}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Animated.View
        style={[
          style,
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            paddingHorizontal: 16,
            paddingVertical: 16,
            borderRadius: 16,
            backgroundColor: highlight ? c.panelStrong : c.surface,
            borderWidth: 1,
            borderColor: highlight ? c.accent : c.line,
            ...c.shadow,
          },
        ]}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.panel, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name={icon} size={18} color={c.textAccent} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyMedium" tone="title">
            {label}
          </AppText>
          <AppText variant="label" tone="muted" style={{ marginTop: 2 }}>
            {hint}
          </AppText>
        </View>
        <Feather name="chevron-right" size={18} color={c.accent} />
      </Animated.View>
    </Pressable>
  );
}

function CheckInBody({
  step,
  feeling,
  onFeeling,
  onIntent,
  onSkip,
}: {
  step: 'feeling' | 'intent';
  feeling: Feeling | null;
  onFeeling: (f: Feeling) => void;
  onIntent: (i: Intent) => void;
  onSkip: () => void;
}) {
  const recommendedIntent = feeling ? FEELING_MAP[feeling].intent : null;
  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Pressable onPress={onSkip} hitSlop={{ top: 13, bottom: 13, left: 12, right: 12 }} accessibilityRole="button">
          <AppText variant="label" tone="muted">
            Skip
          </AppText>
        </Pressable>
      </View>

      <Reveal index={0} style={{ alignItems: 'center', marginTop: 8 }}>
        <GlowOrb size={96} reserveGlow aura />
      </Reveal>

      {/* keyed by step so the stagger re-runs as a gentle settle on each step */}
      <View key={step}>
        <Reveal index={1} style={{ marginTop: 8 }}>
          <AppText variant="caption" tone="accent">
            Check in
          </AppText>
          <AppText variant="display" tone="title" style={{ marginTop: 8 }}>
            {step === 'feeling' ? 'How are you arriving tonight?' : 'What would feel good right now?'}
          </AppText>
          <AppText variant="body" tone="muted" style={{ marginTop: 8 }}>
            {step === 'feeling'
              ? 'There’s no wrong answer. It just helps us pick, so tap whatever fits.'
              : feeling
                ? `${FEELING_MAP[feeling].line} Here’s what we’d reach for. There’s always a free option.`
                : 'One tap and we’ll cue something. There’s always a free option.'}
          </AppText>
        </Reveal>

        <View style={{ gap: 12, marginTop: 24 }}>
          {step === 'feeling'
            ? FEELINGS.map((f, i) => (
                <Reveal key={f.key} index={i + 2}>
                  <TapRow icon={f.icon} label={f.label} hint={f.hint} onPress={() => onFeeling(f.key)} />
                </Reveal>
              ))
            : INTENTS.map((opt, i) => (
                <Reveal key={opt.intent} index={i + 2}>
                  <TapRow
                    icon={opt.icon}
                    label={opt.label}
                    hint={opt.hint}
                    highlight={opt.intent === recommendedIntent}
                    onPress={() => onIntent(opt.intent)}
                  />
                </Reveal>
              ))}
        </View>
      </View>
    </>
  );
}

export function MoodSurvey() {
  const router = useRouter();
  const { setFeeling, setIntent, dismissCheckIn } = useProfile();
  const [step, setStep] = useState<'feeling' | 'intent'>('feeling');
  const [chosen, setChosen] = useState<Feeling | null>(null);

  const pickFeeling = (f: Feeling) => {
    setFeeling(f); // also seeds the matching intent, so stopping here still tailors
    setChosen(f);
    setStep('intent');
  };
  const pickIntent = (i: Intent) => {
    setIntent(i);
    dismissCheckIn();
    router.replace('/');
  };
  const skip = () => {
    dismissCheckIn();
    router.replace('/');
  };

  return (
    <Screen scroll contentStyle={{ paddingTop: 8 }}>
      <CheckInBody step={step} feeling={chosen} onFeeling={pickFeeling} onIntent={pickIntent} onSkip={skip} />
    </Screen>
  );
}
