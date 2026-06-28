import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, FormField, GlowOrb, PrimaryButton, Reveal, Screen, StatusChip } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { api } from '@/lib/api';
import { brand, fonts, useTheme } from '@/theme';

type ApiDevice = { id: string; serial: string; model?: string };

const ISSUES = ["Won't power on", 'Battery life', 'Physical damage', 'Sound / audio', 'Other'];

function IssueChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={{ top: 4, bottom: 4 }} accessibilityRole="button" accessibilityState={{ selected }}>
      <View
        style={{
          paddingHorizontal: 14,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: selected ? c.accent : c.surface,
          borderWidth: 1,
          borderColor: selected ? c.accent : c.line,
        }}>
        <AppText style={{ fontFamily: fonts.medium, fontSize: 13, color: selected ? '#FFFFFF' : c.text }}>
          {label}
        </AppText>
      </View>
    </Pressable>
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
  const [reference, setReference] = useState<string | null>(null);

  // load the household's registered device so the claim is filed against a real one
  // (on focus, so a device registered moments ago is picked up on return)
  useFocusEffect(
    useCallback(() => {
      if (!token || token === 'local') return;
      let alive = true;
      api
        .devices(token)
        .then((list) => {
          if (alive) setDevice(((list as ApiDevice[]) ?? [])[0] ?? null);
        })
        .catch(() => {});
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
          : 'We couldn’t reach our servers — check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Screen mode="light" scroll contentStyle={{ alignItems: 'center', paddingTop: 48 }}>
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
      </Screen>
    );
  }

  return (
    <Screen mode="light" scroll>
      <Reveal index={0}>
        <Pressable onPress={back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={{ marginBottom: 16 }}>
          <Feather name="chevron-left" size={26} color={c.text} />
        </Pressable>
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
          <View style={{ flex: 1 }}>
            <AppText variant="cardTitle" tone="title">
              {device?.model ?? 'CalmCarry · Glow Orb'}
            </AppText>
            <AppText variant="label" tone="muted">
              {device ? `${device.serial} · warranty active` : 'Register your device to file a claim'}
            </AppText>
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
          <AppText variant="caption" style={{ color: brand.coral, marginTop: 8, textTransform: 'none' }}>
            {error}
          </AppText>
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
    </Screen>
  );
}
