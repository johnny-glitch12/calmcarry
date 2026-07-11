import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { Appear, AppText, FormField, GlowOrb, PressableScale, PrimaryButton, Reveal, Screen, SelectionOverlay, StatusChip, SwapText } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { api } from '@/lib/api';
import { lightTap } from '@/lib/haptics';
import { brand, dur, ease, fonts, useTheme } from '@/theme';

const LABEL = { fontFamily: fonts.medium, fontSize: 13 } as const;

type ApiDevice = { id: string; serial: string; model?: string };

const ISSUES = ["Won't power on", 'Battery life', 'Physical damage', 'Sound / audio', 'Other'];

function IssueChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const p = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    p.value = reduced ? (selected ? 1 : 0) : withTiming(selected ? 1 : 0, { duration: dur.press, easing: ease.press });
  }, [selected, reduced, p]);
  const activeStyle = useAnimatedStyle(() => ({ opacity: p.value }));
  const restStyle = useAnimatedStyle(() => ({ opacity: 1 - p.value }));
  return (
    <PressableScale
      onPress={onPress}
      onPressIn={lightTap}
      hitSlop={{ top: 4, bottom: 4 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      scaleTo={0.96}
      dimTo={0.95}>
      <View
        style={{
          position: 'relative',
          overflow: 'hidden',
          paddingHorizontal: 14,
          minHeight: 36,
          paddingVertical: 8,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.line,
        }}>
        <SelectionOverlay
          active={selected}
          style={{ borderRadius: 18, borderWidth: 1, borderColor: c.accent, backgroundColor: c.accent }}
        />
        {/* label color crossfades white↔text via two stacked layers — Crossfade isn't
            usable here (it absolute-positions both children, collapsing this
            content-sized chip's width), so mirror Segmented's shared-value pattern */}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Animated.Text numberOfLines={1} style={[LABEL, { color: c.text }, restStyle]}>
            {label}
          </Animated.Text>
          <Animated.Text numberOfLines={1} style={[LABEL, { color: '#FFFFFF', position: 'absolute' }, activeStyle]}>
            {label}
          </Animated.Text>
        </View>
      </View>
    </PressableScale>
  );
}

export function ReplacementClaim() {
  const { c } = useTheme();
  const router = useRouter();
  const { token } = useAuth();
  const [issue, setIssue] = useState<string | null>(null);
  const [desc, setDesc] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [device, setDevice] = useState<ApiDevice | null>(null);
  // "couldn't check" must never read as "you have no device" (offline ≠ unregistered)
  const [deviceLoadFailed, setDeviceLoadFailed] = useState(false);
  // ...and "still loading" must not read as "unregistered" either (slow network)
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  // load the household's registered device so the claim is filed against a real one
  // (on focus, so a device registered moments ago is picked up on return)
  useFocusEffect(
    useCallback(() => {
      if (!token || token === 'local') return;
      let alive = true;
      setDeviceLoading(true);
      api
        .devices(token)
        .then((list) => {
          if (alive) {
            setDevice(((list as ApiDevice[]) ?? [])[0] ?? null);
            setDeviceLoadFailed(false);
            setDeviceLoading(false);
          }
        })
        .catch(() => {
          if (alive) {
            setDeviceLoadFailed(true);
            setDeviceLoading(false);
          }
        });
      return () => {
        alive = false;
      };
    }, [token])
  );

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/device');
  };

  const submit = async () => {
    if (!issue) {
      setError('Pick what went wrong so we can route your claim.');
      return;
    }
    if (!token || token === 'local') {
      setError('Sign in to file a warranty claim.');
      return;
    }
    if (!device) {
      setError('Register your Glow Orb first so we can file a claim against it.');
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      const r = await api.createClaim(token, device.id, { type: issue, description: desc });
      setReference(r.reference);
      setDone(true);
    } catch (e) {
      // a network error (no status) reads differently from a server rejection
      const status = (e as { status?: number })?.status;
      setError(
        status
          ? 'We couldn’t submit your claim. Please try again or email support.'
          : 'We couldn’t reach our servers. Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const deviceTitle = device?.model ?? 'CalmCarry · Glow Orb';
  const deviceSubtitle = device
    ? `${device.serial} · warranty active`
    : deviceLoading
      ? 'Checking your account…'
      : deviceLoadFailed
        ? 'We couldn’t check your device just now. Try again in a moment'
        : 'Register your device to file a claim';

  return (
    <Screen mode="light" scroll contentStyle={done ? { alignItems: 'center', paddingTop: 48 } : undefined}>
      {done ? (
        <Appear key="done" style={{ alignItems: 'center', alignSelf: 'stretch' }}>
          <GlowOrb size={132} reserveGlow burst>
            <Feather name="check" size={40} color="#FFFFFF" />
          </GlowOrb>
          <Reveal index={0} style={{ alignItems: 'center', marginTop: 12 }}>
            <AppText variant="h1" tone="title">
              Claim submitted
            </AppText>
          </Reveal>
          <Reveal index={1} style={{ alignItems: 'center', marginTop: 10 }}>
            <AppText variant="body" tone="muted" style={{ textAlign: 'center', maxWidth: 300 }}>
              Our support team will email you within 2 business days with next steps for your Glow Orb.
            </AppText>
          </Reveal>
          <Reveal index={2} style={{ marginTop: 16 }}>
            <StatusChip label={`Reference ${reference ?? ''}`} icon="file-text" confirm />
          </Reveal>
          <Reveal index={3} style={{ alignSelf: 'stretch', marginTop: 28 }}>
            <PrimaryButton label="Done" onPress={back} />
          </Reveal>
        </Appear>
      ) : (
        <Appear key="form">
          <Reveal index={0}>
            <PressableScale onPress={back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" dimTo={0.85} style={{ marginBottom: 16 }}>
              <Feather name="chevron-left" size={26} color={c.text} />
            </PressableScale>
            <AppText variant="caption" tone="muted">
              Support
            </AppText>
            <AppText variant="h1" tone="title" style={{ marginTop: 6 }}>
              Report an issue
            </AppText>
          </Reveal>

          {/* device row */}
          <Reveal index={1} style={{ marginTop: 20 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 14,
                borderRadius: 16,
                backgroundColor: c.panel,
                borderWidth: 1,
                borderColor: c.panelStrong,
              }}>
              <Feather name="box" size={18} color={c.textAccent} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <SwapText trigger={deviceTitle}>
                  <AppText variant="cardTitle" tone="title" numberOfLines={1}>
                    {deviceTitle}
                  </AppText>
                </SwapText>
                <SwapText trigger={deviceSubtitle}>
                  <AppText variant="label" tone="muted" numberOfLines={2}>
                    {deviceSubtitle}
                  </AppText>
                </SwapText>
              </View>
            </View>
          </Reveal>

          {/* issue type */}
          <Reveal index={2} style={{ marginTop: 24 }}>
            <AppText variant="label" tone="muted" style={{ marginBottom: 10 }}>
              What went wrong?
            </AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {ISSUES.map((it) => (
                <IssueChip key={it} label={it} selected={issue === it} onPress={() => setIssue(it)} />
              ))}
            </View>
            {error ? (
              <Appear>
                <AppText variant="caption" style={{ color: brand.coral, marginTop: 8, textTransform: 'none' }}>
                  {error}
                </AppText>
              </Appear>
            ) : null}
          </Reveal>

          <Reveal index={3} style={{ marginTop: 24 }}>
            <FormField
              label="Describe the issue"
              value={desc}
              onChangeText={setDesc}
              placeholder="Tell us what's happening…"
              multiline
            />
          </Reveal>

          <Reveal index={4} style={{ marginTop: 28 }}>
            <PrimaryButton label="Submit claim" onPress={submit} loading={busy} />
          </Reveal>
        </Appear>
      )}
    </Screen>
  );
}
