import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Share, Switch, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Appear, AppText, Card, Dimmable, GlowOrb, PressableScale, Reveal, Screen, SectionHeader, Segmented, StatusChip, SwapText } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/ProfileProvider';
import { AUDIO_CREDITS } from '@/content/audio';
import { SUBSCRIPTION_URL, SUPPORT_URL } from '@/content/store';
import { track } from '@/lib/analytics';
import { api } from '@/lib/api';
import { lightTap } from '@/lib/haptics';
import { hasParentPin, parentRecentlyVerified } from '@/lib/parentGate';
import { hasPushOptIn, pushSupported, setPushOptIn } from '@/lib/push';
import { REMINDER_TIMES, remindersSupported, setBedtimeReminder, setWeeklyRecapReminder } from '@/lib/reminders';
import { getVoice, voiceByKey } from '@/lib/voice';
import { clearAll, getJSON, setJSON } from '@/lib/store';
import { brand, dur, useTheme } from '@/theme';

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
      <AppText variant="cardTitle" tone="title" style={{ flex: 1, minWidth: 0 }} numberOfLines={1}>
        {label}
      </AppText>
      {toggle !== undefined ? (
        <Switch
          value={toggle}
          onValueChange={onToggle}
          accessible={false}
          importantForAccessibility="no"
          pointerEvents="none"
          trackColor={{ false: offTrack, true: c.accent }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={offTrack}
        />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {value ? (
            <SwapText trigger={value}>
              <AppText variant="label" tone="muted" numberOfLines={1}>
                {value}
              </AppText>
            </SwapText>
          ) : null}
          <Feather name="chevron-right" size={18} color={c.accent} />
        </View>
      )}
    </View>
  );

  if (toggle !== undefined)
    return (
      <PressableScale
        onPress={() => onToggle?.(!toggle)}
        onPressIn={lightTap}
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: toggle }}
        dimTo={0.94}
        style={{ paddingHorizontal: 16 }}>
        {content}
      </PressableScale>
    );
  return (
    <PressableScale
      onPress={onPress}
      onPressIn={lightTap}
      accessibilityRole="button"
      dimTo={0.94}
      style={{ paddingHorizontal: 16 }}>
      {content}
    </PressableScale>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return (
    <Card variant="surface" radius={18} padding={0}>
      {children}
    </Card>
  );
}

export function AccountScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const { user, isPremium, token, signOut } = useAuth();
  const { mode, setMode } = useProfile();
  const [reminder, setReminder] = useState(false);
  const [voiceName, setVoiceName] = useState('Maya');
  useFocusEffect(
    useCallback(() => {
      getVoice().then((k) => setVoiceName(voiceByKey(k).name));
    }, []),
  );
  const [reminderIdx, setReminderIdx] = useState(1); // default 9:30 PM
  const [recap, setRecap] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [autoplay, setAutoplay] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [renewAt, setRenewAt] = useState<string | null>(null);

  // hydrate persisted preferences
  useEffect(() => {
    (async () => {
      setReminder(await getJSON('cc.reminder', false));
      setReminderIdx(await getJSON('cc.reminderTimeIdx', 1));
      setRecap(await getJSON('cc.weeklyRecap', false));
      setPushOn(await hasPushOptIn());
      setAutoplay(await getJSON('cc.autoplay', true));
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
  // weekly recap — same honesty rule: ON only if one is actually scheduled
  const toggleRecap = async (v: boolean) => {
    const scheduled = await setWeeklyRecapReminder(v);
    setRecap(scheduled);
    setJSON('cc.weeklyRecap', scheduled);
  };
  // let the user pick their wind-down time from a visible list (no blind tap-to-cycle);
  // reschedule live if the reminder is on
  const pickReminderTime = async (next: number) => {
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
      await clearAll(); // permanent deletion must leave nothing personal on the device
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
      Alert.alert('Couldn’t export right now', 'Please check your connection and try again in a moment.');
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
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="h1Compact" tone="title" numberOfLines={1}>
              {user?.name ?? 'Welcome'}
            </AppText>
            <AppText variant="label" tone="muted" style={{ marginTop: 2 }} numberOfLines={1}>
              {user?.email ?? 'Sign in to sync your account'}
            </AppText>
          </View>
        </View>
      </Reveal>

      {/* entitlement */}
      <Reveal index={1} style={{ marginTop: 24 }}>
        {/* For premium users the card is not a link — an accidental brush shouldn't eject them to
            the OS billing screen. Manage lives explicitly in the Subscription row below. Free users
            still tap through to unlock. */}
        <PressableScale
          onPress={() => (isPremium ? undefined : router.push('/unlock'))}
          onPressIn={isPremium ? undefined : lightTap}
          disabled={isPremium}
          accessibilityRole={isPremium ? undefined : 'button'}
          scaleTo={isPremium ? 1 : 0.98}
          dimTo={isPremium ? 1 : 0.95}>
        <View
          style={{
            borderRadius: 20,
            padding: 18,
            backgroundColor: c.panelStrong,
            borderWidth: 1,
            borderColor: c.lineSage,
          }}>
          {/* crossfade the whole card body when entitlement flips (purchase/restore),
              so title/body/chip morph rather than hard-swapping behind the modal */}
          <Appear key={isPremium ? 'premium' : 'free'} enter={dur.sheet}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather name="award" size={18} color={c.textAccent} />
              <AppText variant="h3" tone="accent">
                {isPremium ? 'CalmCarry Premium' : 'Free tier'}
              </AppText>
            </View>
            <AppText variant="body" tone="text" style={{ marginTop: 6 }}>
              {isPremium
                ? 'Premium is on. You have the full library, programs and the whole sound machine, shared across your household.'
                : 'Unlock the full library, programs and sound machine with CalmCarry Premium.'}
            </AppText>
            {isPremium && renewAt ? (
              <Appear enter={dur.sheet}>
                <AppText variant="meta" tone="muted" style={{ marginTop: 8 }}>
                  Renews {new Date(renewAt).toLocaleDateString()} · manage anytime, one tap
                </AppText>
              </Appear>
            ) : null}
            <View style={{ marginTop: 12 }}>
              <StatusChip
                label={isPremium ? 'Premium active' : 'Go Premium'}
                icon={isPremium ? 'unlock' : 'lock'}
              />
            </View>
          </Appear>
        </View>
        </PressableScale>
      </Reveal>

      {/* mode — NIGHT-FIRST: the adult app is the night theme by identity (no theme
          picker); only the kids surface keeps a soft daytime look */}
      <Reveal index={2} style={{ marginTop: 28 }}>
        <SectionHeader kicker="Who's it for" title="Mode" />
        <AppText variant="label" tone="muted" style={{ marginBottom: 10, textTransform: 'none', letterSpacing: 0 }}>
          Kids mode shows bedtime stories and gentle sounds.
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
            <Appear enter={dur.sheet} layout style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: c.line, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Feather name="clock" size={18} color={c.accent} />
                <AppText variant="cardTitle" tone="title">
                  Reminder time
                </AppText>
              </View>
              <Segmented
                options={REMINDER_TIMES.map((t) => t.label)}
                value={reminderIdx}
                onChange={pickReminderTime}
              />
            </Appear>
          ) : null}
          {/* weekly recap — one Sunday-evening note pointing at the calm-nights card */}
          {remindersSupported ? (
            <SettingRow icon="calendar" label="Weekly calm recap" toggle={recap} onToggle={toggleRecap} />
          ) : null}
          <SettingRow icon="mic" label="Guided voice" value={voiceName} onPress={() => router.push('/voice' as Href)} />
          <SettingRow icon="play-circle" label="Autoplay sounds" toggle={autoplay} onToggle={toggleAutoplay} last />
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
          <SettingRow icon="sliders" label="Notifications" value="System settings" onPress={() => Linking.openSettings().catch(() => {})} />
          <SettingRow icon="shield" label="Your data & privacy" onPress={() => router.push('/privacy' as Href)} />
          {token && token !== 'local' ? (
            <SettingRow icon="download" label="Export my data" onPress={onExport} />
          ) : null}
          <SettingRow icon="help-circle" label="Help & support" onPress={() => Linking.openURL(SUPPORT_URL).catch(() => {})} />
          <SettingRow icon="info" label="About CalmCarry" onPress={() => router.push('/about' as Href)} last />
        </Group>
      </Reveal>

      <Reveal index={5} style={{ marginTop: 24 }}>
        <PressableScale
          onPress={onSignOut}
          onPressIn={lightTap}
          accessibilityRole="button"
          dimTo={0.6}
          style={{ alignItems: 'center', paddingVertical: 14 }}>
          <AppText variant="bodyMedium" style={{ color: brand.coral }}>
            Sign out
          </AppText>
        </PressableScale>
        {/* up-front (not buried in the confirm step): deleting the account does NOT cancel the store subscription */}
        {isPremium ? (
          <AppText
            variant="meta"
            tone="dim"
            style={{ textAlign: 'center', marginTop: 6, textTransform: 'none', letterSpacing: 0, lineHeight: 16, paddingHorizontal: 12 }}>
            Deleting your account won’t cancel your subscription. Cancel that in your Apple or Google account settings.
          </AppText>
        ) : null}
        {/* Account & data deletion — required by App Store 5.1.1(v) + COPPA/GDPR */}
        <PressableScale
          onPress={onDeleteAccount}
          onPressIn={lightTap}
          disabled={deleting}
          accessibilityRole="button"
          accessibilityLabel={confirmDelete ? 'Confirm permanent account deletion' : 'Delete account'}
          dimTo={0.6}
          style={{ alignItems: 'center', paddingVertical: 12 }}>
          {/* busy dim eases (a static opacity here is overridden by PressableScale's own
              animated opacity anyway); inner keyed crossfade so arm/disarm never hard-snaps */}
          <Dimmable active={!deleting} dim={0.5}>
            <Animated.View
              key={deleting ? 'deleting' : confirmDelete ? 'confirm' : 'idle'}
              entering={FadeIn.duration(dur.press)}
              exiting={FadeOut.duration(dur.press)}>
              <AppText variant="meta" style={{ color: confirmDelete ? brand.coral : c.dim }}>
                {deleting
                  ? 'Deleting…'
                  : confirmDelete
                    ? 'Tap again to permanently delete your account & data'
                    : 'Delete account'}
              </AppText>
            </Animated.View>
          </Dimmable>
        </PressableScale>
        {/* honest deletion terms — surfaced once the action is armed (GDPR 17(3)/CCPA):
            permanent + immediate, and billing records may be retained where law requires */}
        {confirmDelete && !deleting ? (
          <Appear>
            <AppText
              variant="meta"
              tone="dim"
              style={{ textAlign: 'center', marginTop: 8, textTransform: 'none', letterSpacing: 0, lineHeight: 16, paddingHorizontal: 16 }}>
              This is permanent and immediate. Your profiles, sessions, and saved content are erased right away and can’t be recovered. Billing records may be kept where tax or fraud law requires.
            </AppText>
          </Appear>
        ) : null}
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
