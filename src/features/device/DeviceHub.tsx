import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Appear, AppText, Card, GlowOrb, PressableScale, Reveal, Screen, SectionHeader, StatusChip, SwapText } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { api } from '@/lib/api';
import { lightTap } from '@/lib/haptics';
import { useTheme } from '@/theme';

type ApiDevice = { id: string; serial: string; model?: string };

function ActionRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      haptic
      accessibilityRole="button"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 16,
        borderRadius: 16,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.line,
        ...c.shadow,
      }}>
      <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: c.panel,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Feather name={icon} size={19} color={c.textAccent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="bodyMedium" tone="title" numberOfLines={1}>
            {title}
          </AppText>
          <AppText variant="label" tone="muted" style={{ marginTop: 2 }} numberOfLines={2}>
            {subtitle}
          </AppText>
        </View>
        <Feather name="chevron-right" size={20} color={c.accent} />
    </PressableScale>
  );
}

/** The on-screen "device twin" — its own component so useTheme() resolves to the
 *  Screen's theme (not the default-light context above it). Mirrors the physical
 *  Glow Orb for app↔device congruency. Data-driven: only shows a serial + a
 *  "Registered" badge when a real device is registered to this account — NOT
 *  "Authentic"/"genuine" (there's no manufactured-serial registry to verify that;
 *  registration ≠ authenticity). No Bluetooth, no sync — honest copy only. */
function DeviceSummaryCard({
  device,
  loading,
  signedIn,
  onPress,
}: {
  device: ApiDevice | null;
  loading: boolean;
  signedIn: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const title = device ? 'CalmCarry · Glow Orb' : signedIn ? 'No Glow Orb registered yet' : 'Your Glow Orb';
  const subtitle = loading
    ? 'Checking your account…'
    : device
      ? `Serial ${device.serial} · rest it in your palm`
      : signedIn
        ? 'Register your device to activate its warranty'
        : 'Sign in to see your registered Glow Orb';
  return (
    <PressableScale
      onPress={onPress}
      onPressIn={lightTap}
      accessibilityRole="button"
      accessibilityLabel={title}
      scaleTo={0.98}
      dimTo={0.96}>
      <Card variant="surface" radius={20} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <GlowOrb size={56} reserveGlow aura={!!device} breathing={!!device} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <SwapText trigger={title}>
            <AppText variant="h3" tone="title" numberOfLines={2}>
              {title}
            </AppText>
          </SwapText>
          <SwapText trigger={subtitle}>
            <AppText variant="label" tone="muted" style={{ marginTop: 2 }} numberOfLines={2}>
              {subtitle}
            </AppText>
          </SwapText>
          {loading ? (
            <Appear key="loading" style={{ marginTop: 8, flexDirection: 'row' }}>
              <ActivityIndicator size="small" color={c.accent} />
            </Appear>
          ) : device ? (
            <Appear key="chip" style={{ marginTop: 8 }}>
              <StatusChip label="Registered & covered" icon="shield" confirm />
            </Appear>
          ) : null}
        </View>
        <Feather name="chevron-right" size={20} color={c.accent} />
      </Card>
    </PressableScale>
  );
}

export function DeviceHub() {
  const router = useRouter();
  const { c } = useTheme();
  const { token } = useAuth();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/you'));

  // real, account-bound device — refetched on focus so a just-registered Orb appears
  const signedIn = !!token && token !== 'local';
  const [device, setDevice] = useState<ApiDevice | null>(null);
  const [loading, setLoading] = useState(signedIn);

  useFocusEffect(
    useCallback(() => {
      if (!signedIn) {
        setDevice(null);
        setLoading(false);
        return;
      }
      let alive = true;
      setLoading(true);
      api
        .devices(token)
        .then((list) => {
          if (!alive) return;
          setDevice(((list as ApiDevice[]) ?? [])[0] ?? null);
        })
        .catch(() => alive && setDevice(null))
        .finally(() => alive && setLoading(false));
      return () => {
        alive = false;
      };
    }, [signedIn, token])
  );

  return (
    <Screen mode="light" scroll>
      <Reveal index={0}>
        <PressableScale onPress={back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" dimTo={0.85} style={{ marginBottom: 8 }}>
          <Feather name="chevron-left" size={26} color={c.text} />
        </PressableScale>
        <AppText variant="caption" tone="muted">
          Your device
        </AppText>
        <AppText variant="h1" tone="title" style={{ marginTop: 6 }}>
          Your Glow Orb
        </AppText>
      </Reveal>

      {/* device summary card — the on-screen twin of the physical orb (data-driven) */}
      <Reveal index={1} style={{ marginTop: 20 }}>
        <DeviceSummaryCard
          device={device}
          loading={loading}
          signedIn={signedIn}
          onPress={() => router.push(device ? '/authenticity' : signedIn ? '/register-device' : '/authenticity')}
        />
      </Reveal>

      {/* buy / replace — hardware is sold on the web store (no IAP for physical goods) */}
      <Reveal index={2} style={{ marginTop: 24 }}>
        <SectionHeader kicker="Get more" title="Add a Glow Orb" />
        <ActionRow
          icon="shopping-bag"
          title="Buy another Glow Orb"
          subtitle="An extra for any room, or a replacement"
          onPress={() => router.push('/shop')}
        />
      </Reveal>

      {/* manage */}
      <Reveal index={3} style={{ marginTop: 28 }}>
        <SectionHeader kicker="Manage" title="Device & warranty" />
        <View style={{ gap: 12 }}>
          {/* one row for the account's actual state — a registered device shows its
              registration; no device shows how to register (never both) */}
          {device ? (
            <Appear key="registered">
              <ActionRow
                icon="shield"
                title="Device registration"
                subtitle="Confirm it's registered &amp; covered"
                onPress={() => router.push('/authenticity')}
              />
            </Appear>
          ) : (
            <Appear key="unregistered">
              <ActionRow
                icon="plus-circle"
                title="Register a device"
                subtitle="Activate your 24-month warranty"
                onPress={() => router.push('/register-device')}
              />
            </Appear>
          )}
          <ActionRow
            icon="tool"
            title="Report an issue"
            subtitle="Start a replacement claim"
            onPress={() => router.push('/replacement-claim')}
          />
          <ActionRow
            icon="book-open"
            title="How to use CalmCarry"
            subtitle="Your first 20 minutes & where to hold it"
            onPress={() => router.push('/learn')}
          />
        </View>
      </Reveal>
    </Screen>
  );
}
