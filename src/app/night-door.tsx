import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, GlowOrb, PressableScale, PrimaryButton, Reveal, Screen } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { covers } from '@/content/covers';
import { FREE_RESCUE } from '@/content/feelings';
import { TRACKS } from '@/content/library';
import { getRecents } from '@/lib/recents';
import { useTheme } from '@/theme';


/**
 * The Night Door (pre-mortem: the screen-at-bedtime paradox). Opening the app in
 * wind-down hours (20:00-05:00, hooked in _layout's launch routing) lands HERE: a
 * dimmed, one-tap "Begin wind-down" that resumes the last-played track (or tonight's
 * free pick) - unlock to audio in two taps, no browsing, no reading, phone face-down
 * in seconds. A quiet dismiss drops back to the full Home for anyone who wants to
 * explore. Never shown to kids profiles (KidsGuard + the launch hook both exclude),
 * never over a deep link, once per cold start.
 */
export default function NightDoorScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isPremium } = useAuth();
  const [targetId, setTargetId] = useState<string>(FREE_RESCUE);

  // last-played that is playable for this entitlement, else the free rescue.
  // Same anti-bait rule as the Home hero: the one-tap must PLAY, never paywall.
  useEffect(() => {
    let alive = true;
    getRecents().then((ids) => {
      if (!alive) return;
      const pick = ids.find((id) => TRACKS[id] && (!TRACKS[id].locked || isPremium));
      if (pick) setTargetId(pick);
    });
    return () => {
      alive = false;
    };
  }, [isPremium]);

  const track = TRACKS[targetId] ?? TRACKS[FREE_RESCUE];
  const begin = () => router.replace(`/wind-down?id=${track.id}`);
  const dismiss = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen
      mode="night"
      backdrop={
        // tonight's pick under a deep scrim - the room is already dark; so are we
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Image source={covers[track.cover]} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
          <LinearGradient
            colors={['rgba(14,24,23,0.92)', 'rgba(14,24,23,0.78)', 'rgba(14,24,23,0.96)']}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
        </View>
      }>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Reveal index={0} style={{ alignItems: 'center' }}>
          <GlowOrb size={120} reserveGlow />
          <AppText variant="caption" tone="dim" style={{ marginTop: 4 }}>
            Tonight
          </AppText>
          <AppText variant="display" tone="title" style={{ marginTop: 10, textAlign: 'center' }}>
            {track.title}
          </AppText>
          <AppText variant="body" tone="muted" style={{ marginTop: 6, textAlign: 'center' }}>
            {track.subtitle}
          </AppText>
        </Reveal>
      </View>

      <Reveal index={1} style={{ gap: 4, paddingBottom: Math.max(insets.bottom, 12) + 12 }}>
        <PrimaryButton label="Begin wind-down" onPress={begin} />
        <PressableScale
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Not now, explore tonight"
          hitSlop={8}
          dimTo={0.85}
          style={{ alignItems: 'center', paddingVertical: 14 }}>
          <AppText variant="bodyMedium" tone="muted" style={{ color: c.muted }}>
            Not now
          </AppText>
        </PressableScale>
        {/* the quiet second door - a spiraling night needs the SOS breath, not a
            browse. Dimmer than "Not now" so it never competes with the one-tap
            wind-down; present because the Night Door replaces Home in these hours. */}
        <PressableScale
          onPress={() => router.push('/sos')}
          accessibilityRole="button"
          accessibilityLabel="Need help settling? Start a slow, guided breath."
          hitSlop={8}
          dimTo={0.85}
          style={{ alignItems: 'center', paddingVertical: 10 }}>
          <AppText variant="meta" tone="dim">
            Need help settling?
          </AppText>
        </PressableScale>
      </Reveal>
    </Screen>
  );
}
