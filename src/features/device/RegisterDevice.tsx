import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { AppText, FormField, GlowOrb, PrimaryButton, Reveal, Screen, StatusChip } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { api } from '@/lib/api';
import { useTheme } from '@/theme';

export function RegisterDevice() {
  const { c } = useTheme();
  const router = useRouter();
  const { token } = useAuth();
  const [serial, setSerial] = useState('');
  const [date, setDate] = useState('');
  const [retailer, setRetailer] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/device');
  };

  const submit = async () => {
    if (serial.trim().length < 6) {
      setError('Enter the serial from the base of your device (e.g. GC-2026-…).');
      return;
    }
    if (!token || token === 'local') {
      setError('Sign in to register your device and activate the warranty.');
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      // only confirm "warranty active" on a real, server-confirmed registration
      await api.registerDevice(token, { serial: serial.trim(), purchaseDate: date, retailer });
      setDone(true);
    } catch {
      setError('We couldn’t register that serial. Double-check it and try again.');
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
            You&apos;re registered
          </AppText>
        </Reveal>
        <Reveal index={1} style={{ alignItems: 'center', marginTop: 10 }}>
          <AppText variant="body" tone="muted" style={{ textAlign: 'center', maxWidth: 300 }}>
            Your Glow Orb warranty is active. We&apos;ll email a confirmation to your Glow account.
          </AppText>
        </Reveal>
        <Reveal index={2} style={{ marginTop: 16 }}>
          <StatusChip label="Warranty active · 24 months" icon="shield" confirm />
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
          Warranty
        </AppText>
        <AppText variant="h1" tone="title" style={{ marginTop: 6 }}>
          Register your device
        </AppText>
        <AppText variant="body" tone="muted" style={{ marginTop: 8 }}>
          Activate your 24-month warranty and unlock replacement support.
        </AppText>
      </Reveal>

      <Reveal index={1} style={{ marginTop: 28, gap: 18 }}>
        <FormField
          label="Serial number"
          value={serial}
          onChangeText={setSerial}
          placeholder="GC-2026-08F3-1147"
          icon="hash"
          autoCapitalize="characters"
          error={error}
        />
        <FormField
          label="Purchase date"
          value={date}
          onChangeText={setDate}
          placeholder="DD / MM / YYYY"
          icon="calendar"
          keyboardType="numbers-and-punctuation"
        />
        <FormField
          label="Retailer (optional)"
          value={retailer}
          onChangeText={setRetailer}
          placeholder="theglowcompany.co"
          icon="shopping-bag"
          autoCapitalize="none"
        />
      </Reveal>

      <Reveal index={2} style={{ marginTop: 28 }}>
        <PrimaryButton label="Register device" onPress={submit} loading={busy} />
      </Reveal>
    </Screen>
  );
}
