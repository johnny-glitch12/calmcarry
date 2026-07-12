import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Platform, View } from 'react-native';

import { AppText, GlowOrb, PressableScale, Reveal, Screen } from '@/components';
import { CrisisSupport } from '@/features/about/CrisisSupport';
import { useAuth } from '@/features/auth/AuthProvider';
import { FEELING_MAP, useProfile, type Feeling } from '@/features/profile/ProfileProvider';
import { TRACKS } from '@/content/library';
import { useTheme } from '@/theme';

// "How are you arriving tonight?" SAFE WORDS ONLY (build plan §3/§14):
// never "anxious"/"insomnia"/clinical terms. Forward-looking, no symptom tracking.
// One tap picks a feeling AND starts the tailored session — the answer IS the start.
const FEELINGS: { key: Feeling; label: string; hint: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'racing', label: 'My mind’s racing', hint: 'Lots of thoughts, hard to slow', icon: 'zap' },
  { key: 'cant-switch-off', label: 'I can’t switch off', hint: 'Still in the day', icon: 'power' },
  { key: 'wired-tired', label: 'Wired but tired', hint: 'Tired body, busy head', icon: 'battery-charging' },
  { key: 'wound-up', label: 'I’m wound up', hint: 'Tense, on edge', icon: 'rotate-cw' },
  { key: 'heavy-day', label: 'It’s been a heavy day', hint: 'Carrying a lot', icon: 'cloud' },
  { key: 'quiet', label: 'I just want quiet', hint: 'Somewhere calm to rest', icon: 'feather' },
];

/** A calm, tappable row: gentle scale + light haptic on press (§4), via PressableScale. */
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
  return (
    <PressableScale
      onPress={onPress}
      onPressIn={() => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
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
      }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.panel, alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={icon} size={18} color={c.textAccent} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="bodyMedium" tone="title">
          {label}
        </AppText>
        <AppText variant="meta" tone="muted" style={{ marginTop: 2 }}>
          {hint}
        </AppText>
      </View>
      <Feather name="chevron-right" size={18} color={c.accent} />
    </PressableScale>
  );
}

function CheckInBody({ onFeeling, onSkip }: { onFeeling: (f: Feeling) => void; onSkip: () => void }) {
  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <PressableScale
          onPress={onSkip}
          hitSlop={16}
          accessibilityRole="button"
          dimTo={0.85}
          style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
          <AppText variant="bodyMedium" tone="muted">
            Skip
          </AppText>
        </PressableScale>
      </View>

      <Reveal index={0} style={{ alignItems: 'center', marginTop: 8 }}>
        <GlowOrb size={96} reserveGlow aura />
      </Reveal>

      <Reveal index={1} style={{ marginTop: 8 }}>
        <AppText variant="caption" tone="accent">
          Check in
        </AppText>
        <AppText variant="display" tone="title" style={{ marginTop: 8 }}>
          How are you arriving tonight?
        </AppText>
        <AppText variant="body" tone="muted" style={{ marginTop: 8 }}>
          Tap whatever fits and we’ll start something calm.
        </AppText>
      </Reveal>

      <View style={{ gap: 12, marginTop: 24 }}>
        {FEELINGS.map((f, i) => (
          <Reveal key={f.key} index={i + 2}>
            <TapRow icon={f.icon} label={f.label} hint={f.hint} onPress={() => onFeeling(f.key)} />
          </Reveal>
        ))}
      </View>

      {/* The check-in is where someone names a hard night — the right moment for a
          quiet signpost below the choices (calm styling, never an alarm). */}
      <Reveal index={FEELINGS.length + 2} style={{ marginTop: 32 }}>
        <CrisisSupport />
      </Reveal>
    </>
  );
}

export function MoodSurvey() {
  const router = useRouter();
  const { setFeeling, dismissCheckIn } = useProfile();
  const { isPremium } = useAuth();

  // One tap: record the feeling (which also seeds the matching intent) AND start
  // the tailored session. Answering IS starting — the user never lands back on Home
  // to hunt for a sound. FEELING_MAP carries the track we'd reach for — but the
  // same anti-bait rule as the Home hero applies: a free user answering the
  // check-in must land on a track that PLAYS, never on a 60s preview that fades
  // into the paywall mid-drift. FEELING_MAP carries a free fallback for that.
  const pickFeeling = (f: Feeling) => {
    setFeeling(f);
    dismissCheckIn();
    const pick = FEELING_MAP[f];
    const locked = !!TRACKS[pick.track]?.locked && !isPremium;
    router.replace(`/player?id=${locked ? pick.freeTrack : pick.track}`);
  };
  const skip = () => {
    dismissCheckIn();
    router.replace('/');
  };

  return (
    <Screen mode="night" scroll contentStyle={{ paddingTop: 8 }}>
      <CheckInBody onFeeling={pickFeeling} onSkip={skip} />
    </Screen>
  );
}
