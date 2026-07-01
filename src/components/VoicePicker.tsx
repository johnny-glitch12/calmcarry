import { Feather } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { audioSources } from '@/content/audio';
import { lightTap } from '@/lib/haptics';
import { getVoice, setVoice, VOICES, type VoiceKey } from '@/lib/voice';
import { dur, ease, useTheme } from '@/theme';

import { AppText } from './AppText';

/**
 * VoiceRow — one selectable voice row. Owns its own animated press scale so the
 * press feedback glides (dur.press + ease.out) instead of snapping instantly,
 * matching CoverCard / LibraryCard. Transform + opacity only.
 */
function VoiceRow({
  active,
  onPress,
  accessibilityLabel,
  style,
  children,
}: {
  active: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  style: object;
  children: ReactNode;
}) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));
  const press = (pressed: boolean) => {
    scale.value = withTiming(pressed ? 0.98 : 1, { duration: dur.press, easing: ease.out });
    opacity.value = withTiming(pressed ? 0.92 : 1, { duration: dur.press, easing: ease.out });
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        press(true);
        lightTap();
      }}
      onPressOut={() => press(false)}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={accessibilityLabel}>
      <Animated.View style={[style, animStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

/**
 * VoicePicker — choose the guided-session voice. Each row plays a real bedtime
 * sample on tap (so you hear it before choosing) and the pick is persisted.
 * Used both in onboarding and in Settings. Press feedback + haptics.
 */
export function VoicePicker({ onChange }: { onChange?: (v: VoiceKey) => void }) {
  const { c } = useTheme();
  const [sel, setSel] = useState<VoiceKey | null>(null);

  useEffect(() => {
    getVoice().then(setSel);
  }, []);

  // one player per sample (fixed set → hooks stay top-level)
  const maya = useAudioPlayer(audioSources.voiceMaya);
  const orion = useAudioPlayer(audioSources.voiceOrion);
  const luna = useAudioPlayer(audioSources.voiceLuna);
  const players: Record<VoiceKey, ReturnType<typeof useAudioPlayer>> = { maya, orion, luna };

  // stop every preview when the picker unmounts
  useEffect(
    () => () => {
      (Object.values(players) as ReturnType<typeof useAudioPlayer>[]).forEach((p) => {
        try {
          p.pause();
        } catch {
          /* noop */
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const pick = (k: VoiceKey) => {
    lightTap();
    setSel(k);
    setVoice(k);
    onChange?.(k);
    // preview: stop all, replay the chosen from the top
    (Object.keys(players) as VoiceKey[]).forEach((key) => {
      try {
        players[key].pause();
      } catch {
        /* noop */
      }
    });
    try {
      players[k].seekTo(0);
      players[k].play();
    } catch {
      /* noop */
    }
  };

  return (
    <View style={{ gap: 12 }}>
      {VOICES.map((v) => {
        const active = v.key === sel;
        return (
          <VoiceRow
            key={v.key}
            active={active}
            onPress={() => pick(v.key)}
            accessibilityLabel={`${v.name}, ${v.tag}. Tap to hear and choose.`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              padding: 16,
              borderRadius: 16,
              backgroundColor: active ? c.panel : c.surface,
              borderWidth: 1,
              borderColor: active ? c.textAccent : c.line,
              ...c.shadow,
            }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? c.textAccent : c.panel,
              }}>
              <Feather name={active ? 'volume-2' : 'play'} size={18} color={active ? '#FFFFFF' : c.textAccent} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="bodyMedium" tone="title" numberOfLines={1}>
                {v.name}
              </AppText>
              <AppText variant="label" tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>
                {v.tag} · tap to hear
              </AppText>
            </View>
            {active ? <Feather name="check" size={20} color={c.textAccent} /> : null}
          </VoiceRow>
        );
      })}
    </View>
  );
}
