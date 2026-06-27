import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, Share, Switch, View } from 'react-native';

import { AppText, GlowOrb, Reveal, Screen, SectionHeader, Segmented, StatusChip } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/ProfileProvider';
import { AUDIO_CREDITS } from '@/content/audio';
import { SUBSCRIPTION_URL, SUPPORT_URL } from '@/content/store';
import { track } from '@/lib/analytics';
import { api } from '@/lib/api';
import { hasParentPin, parentRecentlyVerified } from '@/lib/parentGate';
import { hasPushOptIn, pushSupported, setPushOptIn } from '@/lib/push';
import { REMINDER_TIMES, remindersSupported, setBedtimeReminder } from '@/lib/reminders';
import { getJSON, setJSON } from '@/lib/store';
import { brand, useColorSchemePref, useTheme, type SchemePref } from '@/theme';

const SCHEMES: SchemePref[] = ['light', 'dark', 'system'];

type RowProps = {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value?: string;
  toggle?: boolean;
  onToggle?: (v: boolean) => void;
  onPress?: () => void;
  last?: boolean;
};

function SettingRow({ icon, label, value, toggle, onToggle, onPress, last }: RowProps) {
  const { c, isNight } = useTheme();
  const offTrack = isNight ? 'rgba(255,255,255,0.18)' : 'rgba(72,84,83,0.20)';
  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 15,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.line,
      }}>
      <Feather name={icon} size={18} color={c.accent} />
      <AppText variant="bodyMedium" tone="title" style={{ flex: 1, fontSize: 15 }}>
        {label}
      </AppText>
      {toggle !== undefined ? (
        <Switch
          value={toggle}
          onValueChange={onToggle}
          accessibilityLabel={label}
          trackColor={{ false: offTrack, true: c.accent }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={offTrack}
        />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {value ? (
            <AppText variant="label" tone="muted">
              {value}
            </AppText>
          ) : null}
          <Feather name="chevron-right" size={18} color={c.accent} />
        </View>
      )}
    </View>
  );

  if (toggle !== undefined) return <View style={{ paddingHorizontal: 16 }}>{content}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={{ paddingHorizontal: 16 }}>
      {content}
    </Pressable>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View
      style={{
        borderRadius: 18,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.line,
        ...c.shadow,
      }}>
      {children}
    </View>
  );
}

export function AccountScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const { pref, setPref } = useColorSchemePref();
  const { user, isPremium, token, signOut } = useAuth();
  const { mode, setMode } = useProfile();
  const [reminder, setReminder] = useState(false);
  const [reminderIdx, setReminderIdx] = useState(1); // default 9:30 PM
  const [pushOn, setPushOn] = useState(false);
  const [autoplay, setAutoplay] = useState(true);
  const [anonymous, setAnonymous] = useState(true); // community anonymity — ON by default (§6)
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [renewAt, setRenewAt] = useState<string | null>(null);

  // hydrate persisted preferences
  useEffect(() => {
    (async () => {
      setReminder(await getJSON('cc.reminder', false));
      setReminderIdx(await getJSON('cc.reminderTimeIdx', 1));
      setPushOn(await hasPushOptIn());
      setAutoplay(await getJSON('cc.autoplay', true));
      setAnonymous(await getJSON('cc.anonymous', true));
    })();
  }, []);

  // Show the next charge date IN-APP (BetterSleep hides it; opacity is what fuels
  // their surprise-charge complaints). Premium + signed-in only; offline-safe.
  useEffect(() => {
    if (!isPremium || !token || token === 'local') return;
    let alive = true;
    api
      .billingStatus(token)
      .then((s) => alive && setRenewAt(s.expiresAt ?? null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [isPremium, token]);

  // schedules a REAL daily local notification; only shows ON if one was actually
  // scheduled (permission granted) — never a toggle that quietly does nothing.
  const toggleReminder = async (v: boolean) => {
    const t = REMINDER_TIMES[reminderIdx];
    const scheduled = await setBedtimeReminder(v, t.hour, t.minute);
    setReminder(scheduled);
    setJSON('cc.reminder', scheduled);
  };
  // let the user choose their wind-down time; reschedule live if the reminder is on
  const cycleReminderTime = async () => {
    const next = (reminderIdx + 1) % REMINDER_TIMES.length;
    setReminderIdx(next);
    setJSON('cc.reminderTimeIdx', next);
    if (reminder) {
      const t = REMINDER_TIMES[next];
      await setBedtimeReminder(true, t.hour, t.minute);
    }
  };
  // gentle remote reminders — opt-in only; shows ON only if a device token actually
  // registered (push.ts persists 'cc.push' itself). Permission is requested only here.
  const togglePush = async (v: boolean) => {
    setPushOn(await setPushOptIn(v, token));
  };
  const toggleAutoplay = (v: boolean) => {
    setAutoplay(v);
    setJSON('cc.autoplay', v);
  };
  const toggleAnonymous = (v: boolean) => {
    setAnonymous(v);
    setJSON('cc.anonymous', v);
  };

  const onSignOut = async () => {
    await signOut();
    router.replace('/auth');
  };

  // Permanent account + data deletion (Apple 5.1.1(v) / COPPA / GDPR). Two-step
  // confirm so it can't be tapped by accident; then the server erases everything.
  const onDeleteAccount = async () => {
    // Child safety (COPPA): when a parent PIN exists, a grown-up must pass the gate
    // (PIN entry, intent-scoped) before this irreversible action. The gate returns
    // here; the 'deleteAccount'-scoped verify window lets it through.
    if ((await hasParentPin()) && !parentRecentlyVerified('deleteAccount')) {
      router.push('/parent-gate?intent=deleteAccount' as Href);
      return;
    }
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 5000);
      return;
    }
    setDeleting(true);
    try {
      if (token && token !== 'local') await api.deleteAccount(token);
    } catch {
      /* even if the server is unreachable, clear the local session below */
    } finally {
      await signOut();
      router.replace('/auth');
    }
  };

  // GDPR / UK-GDPR / AU APP 12 data-access export — hand the user their own data.
  const onExport = async () => {
    if (!token || token === 'local') return;
    try {
      const data = await api.exportMe(token);
      await Share.share({ message: JSON.stringify(data, null, 2) });
    } catch {
      /* offline / unavailable — silent */
    }
  };

  // entering kids requires a parent PIN to exist first (so a child can't create one and walk out)
  const enterKids = async () => {
    if (await hasParentPin()) {
      setMode('kids');
      router.replace('/');
    } else {
      router.push('/parent-gate?intent=enterKids' as Href);
    }
  };

  return (
    <Screen mode="light" scroll tabBarSpacing>
      {/* profile */}
      <Reveal index={0}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <GlowOrb size={56} reserveGlow breathing={false} />
          <View style={{ flex: 1 }}>
            <AppText variant="h1" tone="title" style={{ fontSize: 22 }}>
              {user?.name ?? 'Welcome'}
            </AppText>
            <AppText variant="label" tone="muted" style={{ marginTop: 2 }}>
              {user?.email ?? 'Sign in to sync your Glow account'}
            </AppText>
          </View>
        </View>
      </Reveal>

      {/* entitlement */}
      <Reveal index={1} style={{ marginTop: 24 }}>
        <Pressable onPress={() => router.push('/unlock')} accessibilityRole="button">
        <View
          style={{
            borderRadius: 20,
            padding: 18,
            backgroundColor: c.panelStrong,
            borderWidth: 1,
            borderColor: c.lineSage,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Feather name="award" size={18} color={c.textAccent} />
            <AppText variant="h2" tone="title" style={{ fontSize: 18, color: c.textAccent }}>
              {isPremium ? 'CalmCarry Premium' : 'Free tier'}
            </AppText>
          </View>
          <AppText variant="body" tone="text" style={{ marginTop: 6 }}>
            {isPremium
              ? 'Premium is on — the full library, programs and the whole sound machine, shared across your household.'
              : 'Unlock the full library, programs and sound machine with CalmCarry Premium.'}
          </AppText>
          {isPremium && renewAt ? (
            <AppText variant="label" tone="muted" style={{ marginTop: 8, textTransform: 'none', letterSpacing: 0 }}>
              Renews {new Date(renewAt).toLocaleDateString()} · manage anytime, one tap
            </AppText>
          ) : null}
          <View style={{ marginTop: 12 }}>
            <StatusChip
              label={isPremium ? 'Premium active' : 'Go Premium'}
              icon={isPremium ? 'unlock' : 'lock'}
            />
          </View>
        </View>
        </Pressable>
      </Reveal>

      {/* appearance + mode */}
      <Reveal index={2} style={{ marginTop: 28 }}>
        <SectionHeader kicker="Appearance" title="Theme" />
        <Segmented
          options={['Light', 'Dark', 'System']}
          value={SCHEMES.indexOf(pref)}
          onChange={(i) => setPref(SCHEMES[i])}
        />
        <AppText variant="label" tone="muted" style={{ marginTop: 20, marginBottom: 10 }}>
          Mode — kids mode shows bedtime stories & gentle sounds
        </AppText>
        <Segmented
          options={['Adult', 'Kids']}
          value={mode === 'kids' ? 1 : 0}
          onChange={(i) => {
            if (i === 1) enterKids();
            else if (mode === 'kids') router.push('/parent-gate?intent=exitKids' as Href);
          }}
        />
      </Reveal>

      {/* preferences */}
      <Reveal index={3} style={{ marginTop: 24 }}>
        <SectionHeader kicker="Preferences" title="Sleep & sound" />
        <Group>
          {/* gentle remote reminders — opt-in, account-tied; native + signed-in adults only.
              never shown in kids mode (notifications are for the parent account) */}
          {pushSupported && mode !== 'kids' && token && token !== 'local' ? (
            <SettingRow icon="heart" label="Gentle reminders" toggle={pushOn} onToggle={togglePush} />
          ) : null}
          {/* bedtime reminder is a real local notification — native only, so hide on web */}
          {remindersSupported ? (
            <SettingRow icon="bell" label="Bedtime reminder" toggle={reminder} onToggle={toggleReminder} />
          ) : null}
          {remindersSupported && reminder ? (
            <SettingRow icon="clock" label="Reminder time" value={REMINDER_TIMES[reminderIdx].label} onPress={cycleReminderTime} />
          ) : null}
          <SettingRow icon="play-circle" label="Autoplay sounds" toggle={autoplay} onToggle={toggleAutoplay} />
          <SettingRow icon="eye-off" label="Anonymous in community" toggle={anonymous} onToggle={toggleAnonymous} last />
        </Group>
      </Reveal>

      {/* account */}
      <Reveal index={4} style={{ marginTop: 24 }}>
        <SectionHeader kicker="Account" title="Settings" />
        <Group>
          <SettingRow
            icon="credit-card"
            label="Subscription"
            value={isPremium ? 'Premium' : 'Free'}
            onPress={() => {
              if (isPremium) {
                track('subscription_manage_open'); // §15: cancellation/manage intent (client proxy)
                Linking.openURL(SUBSCRIPTION_URL).catch(() => {});
              } else {
                router.push('/unlock');
              }
            }}
          />
          <SettingRow icon="box" label="My CalmCarry" onPress={() => router.push('/device' as Href)} />
          <SettingRow icon="users" label="Family & devices" onPress={() => router.push('/family')} />
          <SettingRow icon="bell" label="Notifications" onPress={() => Linking.openSettings().catch(() => {})} />
          <SettingRow icon="shield" label="Your data & privacy" onPress={() => router.push('/privacy' as Href)} />
          {token && token !== 'local' ? (
            <SettingRow icon="download" label="Export my data" onPress={onExport} />
          ) : null}
          <SettingRow icon="help-circle" label="Help & support" onPress={() => Linking.openURL(SUPPORT_URL).catch(() => {})} />
          <SettingRow icon="info" label="About CalmCarry" onPress={() => router.push('/about' as Href)} last />
        </Group>
      </Reveal>

      <Reveal index={5} style={{ marginTop: 24 }}>
        <Pressable
          onPress={onSignOut}
          accessibilityRole="button"
          style={{ alignItems: 'center', paddingVertical: 14 }}>
          <AppText variant="bodyMedium" style={{ color: brand.coral }}>
            Sign out
          </AppText>
        </Pressable>
        {/* Account & data deletion — required by App Store 5.1.1(v) + COPPA/GDPR */}
        <Pressable
          onPress={onDeleteAccount}
          disabled={deleting}
          accessibilityRole="button"
          accessibilityLabel={confirmDelete ? 'Confirm permanent account deletion' : 'Delete account'}
          style={{ alignItems: 'center', paddingVertical: 12, opacity: deleting ? 0.5 : 1 }}>
          <AppText variant="label" style={{ color: confirmDelete ? brand.coral : c.dim, textTransform: 'none', letterSpacing: 0 }}>
            {deleting
              ? 'Deleting…'
              : confirmDelete
                ? isPremium
                  ? 'Tap again to delete everything. Your subscription bills through the App Store / Google Play — cancel it there too.'
                  : 'Tap again to permanently delete your account & data'
                : 'Delete account'}
          </AppText>
        </Pressable>
      </Reveal>

      <Reveal index={6} style={{ marginTop: 8 }}>
        <AppText
          variant="caption"
          tone="dim"
          style={{ textAlign: 'center', textTransform: 'none', letterSpacing: 0, lineHeight: 15 }}>
          {AUDIO_CREDITS}
        </AppText>
      </Reveal>
    </Screen>
  );
}
