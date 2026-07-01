import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { AppText, FormField, GlowOrb, PressableScale, PrimaryButton, Reveal, Screen, StatusChip } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { api } from '@/lib/api';
import { useTheme } from '@/theme';

// Parse a DD/MM/YYYY (or YYYY-MM-DD) input into an ISO date (YYYY-MM-DD), or null if
// blank/invalid. The server's purchaseDate is @IsOptional+@IsISO8601, which REJECTS
// empty strings and non-ISO formats — so we only ever send a real ISO value.
function toISODate(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  let y: number, mo: number, d: number;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    y = +iso[1];
    mo = +iso[2];
    d = +iso[3];
  } else {
    const m = s.match(/^(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{4})$/);
    if (!m) return null;
    d = +m[1];
    mo = +m[2];
    y = +m[3];
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function RegisterDevice() {
  const { c } = useTheme();
  const router = useRouter();
  const { token } = useAuth();
  const [serial, setSerial] = useState('');
  const [date, setDate] = useState('');
  const [retailer, setRetailer] = useState('');
  const [error, setError] = useState<string | undefined>(); // serial-field error
  const [dateError, setDateError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>(); // submit/network error
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/device');
  };

  const submit = async () => {
    const sn = serial.trim();
    setError(undefined);
    setDateError(undefined);
    setFormError(undefined);
    // Match the server's serial rule (4–40 of [A-Za-z0-9-]); don't be stricter.
    if (sn.length < 4) {
      setError('Enter the serial from the base of your device (e.g. GC-2026-…).');
      return;
    }
    // Purchase date is OPTIONAL — but if entered it MUST be a real date we can send
    // as ISO8601 (the server rejects anything else). Never send a blank/non-ISO value.
    let iso: string | null = null;
    if (date.trim()) {
      iso = toISODate(date);
      if (!iso) {
        setDateError('Use DD / MM / YYYY, e.g. 14 / 02 / 2026.');
        return;
      }
    }
    if (!token || token === 'local') {
      setFormError('Sign in to register your device and activate the warranty.');
      return;
    }
    setBusy(true);
    try {
      // only confirm "warranty active" on a real, server-confirmed registration;
      // omit optional fields entirely rather than sending empty strings
      await api.registerDevice(token, {
        serial: sn,
        ...(iso ? { purchaseDate: iso } : {}),
        ...(retailer.trim() ? { retailer: retailer.trim() } : {}),
      });
      setDone(true);
    } catch {
      setFormError('We couldn’t register that just now. Please check your details and try again.');
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
        <PressableScale onPress={back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" dimTo={0.85} style={{ marginBottom: 16 }}>
          <Feather name="chevron-left" size={26} color={c.text} />
        </PressableScale>
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
          error={dateError}
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
        {formError ? (
          <AppText variant="meta" tone="accent" style={{ textAlign: 'center', marginTop: 12 }}>
            {formError}
          </AppText>
        ) : null}
      </Reveal>
    </Screen>
  );
}
