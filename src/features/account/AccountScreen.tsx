import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform, Share, Switch, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Appear, AppText, Card, Dimmable, FormField, GlowOrb, PressableScale, Reveal, Screen, SectionHeader, Segmented, StatusChip, SwapText } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/ProfileProvider';
import { AUDIO_CREDITS } from '@/content/audio';
import { SUBSCRIPTION_URL, SUPPORT_URL } from '@/content/store';
import { iapSupported, restoreSubscription } from '@/lib/iap';
import { getAnalyticsOptOut, setAnalyticsOptOut, track } from '@/lib/analytics';
import { api } from '@/lib/api';
import { hasCoppaConsent } from '@/lib/consent';
import { lightTap } from '@/lib/haptics';
import { clearParentPin, hasParentPin, parentRecentlyVerified } from '@/lib/parentGate';
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

/** Email-verification nudge (soft gate; nothing is blocked on it). One tap emails
 *  a 6-digit code, the field appears inline, success thanks and fades away. Only
 *  rendered for real signed-in accounts whose email is unverified. */
function VerifyEmailCard({ token, onDone }: { token: string; onDone: () => void }) {
  const { c } = useTheme();
  const [step, setStep] = useState<'offer' | 'code' | 'done'>('offer');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.sendEmailVerification(token);
      setStep('code');
    } catch {
      setError('We couldn’t send the code just now. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (busy) return;
    if (code.trim().length !== 6) {
      setError('Enter the 6-digit code from the email.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.verifyEmail(token, code.trim());
      setStep('done');
      setTimeout(onDone, 1600); // a beat to read the thank-you, then fade out
    } catch {
      setError('That code doesn’t look right. Check the email and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Animated.View entering={FadeIn.duration(dur.sheet)} exiting={FadeOut.duration(dur.sheet)}>
      <Card variant="surface" radius={18}>
        <Appear key={step} enter={dur.sheet}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Feather name={step === 'done' ? 'check-circle' : 'mail'} size={16} color={c.textAccent} />
            <AppText variant="cardTitle" tone="title" style={{ flex: 1 }}>
              {step === 'done' ? 'Email verified. Thank you.' : 'Verify your email'}
            </AppText>
          </View>
          {step !== 'done' ? (
            <AppText variant="caption" tone="muted" style={{ marginTop: 6, textTransform: 'none', letterSpacing: 0, lineHeight: 18 }}>
              {step === 'offer'
                ? 'A quick code keeps your account recoverable if you ever forget your password.'
                : 'We emailed you a 6-digit code. It expires in 15 minutes.'}
            </AppText>
          ) : null}
          {step === 'code' ? (
            <View style={{ marginTop: 12 }}>
              <FormField
                label="6-digit code"
                value={code}
                onChangeText={setCode}
                placeholder="123456"
                icon="hash"
                keyboardType="number-pad"
                autoCapitalize="none"
                autoComplete="one-time-code"
              />
            </View>
          ) : null}
          {error ? (
            <Appear>
              <AppText variant="label" style={{ color: brand.coral, textTransform: 'none', letterSpacing: 0, marginTop: 8 }}>
                {error}
              </AppText>
            </Appear>
          ) : null}
          {step !== 'done' ? (
            <PressableScale
              onPress={step === 'offer' ? send : confirm}
              onPressIn={lightTap}
              disabled={busy}
              accessibilityRole="button"
              dimTo={0.9}
              scaleTo={0.98}
              style={{
                marginTop: 12,
                alignSelf: 'flex-start',
                paddingHorizontal: 16,
                minHeight: 44,
                justifyContent: 'center',
                borderRadius: 12,
                backgroundColor: c.panel,
                borderWidth: 1,
                borderColor: c.lineSage,
                opacity: busy ? 0.6 : 1,
              }}>
              <AppText variant="bodyMedium" tone="accent">
                {step === 'offer' ? 'Email me a code' : 'Confirm'}
              </AppText>
            </PressableScale>
          ) : null}
        </Appear>
      </Card>
    </Animated.View>
  );
}

export function AccountScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const { user, isPremium, token, status, signOut, changePassword, activatePremium } = useAuth();
  const [restoring, setRestoring] = useState(false);

  // Apple 3.1.1: a restore path must be reachable outside the paywall too. Re-applies
  // an EXISTING entitlement only - never starts a purchase. Mirrors the paywall's
  // restore: re-read the store's purchases and re-validate (this needs no CalmCarry
  // account - the purchase belongs to the Apple/Google account, 5.1.1(v)), then with
  // a session also honour an entitlement the backend already holds on this account.
  const restorePurchases = useCallback(async () => {
    if (restoring) return;
    const live = !!token && token !== 'local';
    setRestoring(true);
    try {
      let storeReason: string | undefined;
      if (iapSupported) {
        const r = await restoreSubscription(live ? token : null);
        if (r.ok) {
          await activatePremium(live ? undefined : r.expiresAt ?? null);
          Alert.alert('Purchases restored', 'Your CalmCarry Premium is active again.');
          return;
        }
        storeReason = r.reason;
      }
      if (live) {
        const s = await api.billingStatus(token);
        if (s.isPremium) {
          await activatePremium();
          Alert.alert('Purchases restored', 'Your CalmCarry Premium is active on this account.');
          return;
        }
        Alert.alert('Nothing to restore', 'We couldn’t find a previous purchase on this account. If you subscribed with a different Apple ID, sign in with that account.');
        return;
      }
      // an unreachable store ('iap_unavailable') is not "no purchase found" -
      // never tell a possibly-paying user a definitive no on a flaky network
      if (storeReason === 'iap_unavailable') {
        Alert.alert('Couldn’t reach the store', 'Please check your connection and try again.');
        return;
      }
      Alert.alert('Nothing to restore', 'We couldn’t find a previous purchase for this Apple or Google account. If you subscribed under a CalmCarry account, sign in and try again.');
    } catch {
      Alert.alert('Couldn’t reach the store', 'Please check your connection and try again.');
    } finally {
      setRestoring(false);
    }
  }, [restoring, token, activatePremium]);
  const isGuest = status === 'guest' || !token;
  const { mode, enterKids: enterKidsMode } = useProfile();
  const [reminder, setReminder] = useState(false);
  // email-verification nudge - only when the backend confirms the email is unverified
  const [needsVerify, setNeedsVerify] = useState(false);
  useEffect(() => {
    // guest/local sessions never render the card (see the render gate), so no reset needed
    if (!token || token === 'local') return;
    let alive = true;
    api
      .me(token)
      .then((r) => alive && setNeedsVerify(r.user.emailVerified === false))
      .catch(() => {
        /* offline - no nudge */
      });
    return () => {
      alive = false;
    };
  }, [token]);
  // change-password (signed-in) - inline expandable row state
  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNext, setPwNext] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const onChangePassword = async () => {
    if (pwBusy) return;
    if (pwNext.length < 8) {
      setPwMsg({ text: 'New password needs at least 8 characters.', ok: false });
      return;
    }
    setPwBusy(true);
    setPwMsg(null);
    try {
      await changePassword(pwCurrent, pwNext);
      setPwCurrent('');
      setPwNext('');
      setPwMsg({ text: 'Password updated. Other devices were signed out.', ok: true });
      setTimeout(() => {
        setPwOpen(false);
        setPwMsg(null);
      }, 1800);
    } catch {
      setPwMsg({ text: 'That current password doesn’t look right.', ok: false });
    } finally {
      setPwBusy(false);
    }
  };
  const [voiceName, setVoiceName] = useState('Maya');
  useFocusEffect(
    useCallback(() => {
      getVoice().then((k) => setVoiceName(voiceByKey(k).name));
    }, []),
  );
  const [reminderIdx, setReminderIdx] = useState(1); // default 9:30 PM
  const [recap, setRecap] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  // true when an enable attempt failed because OS notification permission is off
  const [notifDenied, setNotifDenied] = useState(false);
  const [autoplay, setAutoplay] = useState(true);
  const [analyticsOn, setAnalyticsOn] = useState(true);
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
      setAnalyticsOn(!(await getAnalyticsOptOut())); // toggle reads as "sharing on"
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
  // scheduled (permission granted) - never a toggle that quietly does nothing.
  const toggleReminder = async (v: boolean) => {
    const t = REMINDER_TIMES[reminderIdx];
    const scheduled = await setBedtimeReminder(v, t.hour, t.minute);
    setReminder(scheduled);
    setJSON('cc.reminder', scheduled);
    // the toggle snapping back with no words is a dead end - say WHY it stayed off
    setNotifDenied(v && !scheduled);
  };
  // weekly recap - same honesty rule: ON only if one is actually scheduled
  const toggleRecap = async (v: boolean) => {
    const scheduled = await setWeeklyRecapReminder(v);
    setRecap(scheduled);
    setJSON('cc.weeklyRecap', scheduled);
    setNotifDenied(v && !scheduled);
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
  // gentle remote reminders - opt-in only; shows ON only if a device token actually
  // registered (push.ts persists 'cc.push' itself). Permission is requested only here.
  const togglePush = async (v: boolean) => {
    setPushOn(await setPushOptIn(v, token));
  };
  const toggleAutoplay = (v: boolean) => {
    setAutoplay(v);
    setJSON('cc.autoplay', v);
  };
  // GDPR/PDPL: v = "share analytics on"; opt-out is the inverse. setAnalyticsOptOut
  // also drops anything already buffered, so switching off stops sends immediately.
  const toggleAnalytics = async (v: boolean) => {
    setAnalyticsOn(v);
    await setAnalyticsOptOut(!v);
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
    // The local wipe may only follow a CONFIRMED server deletion - wiping on a
    // timeout/500 would show the user "deleted" while their account and data
    // live on (a false erasure confirmation, and the Apple revoke never ran).
    // 401/404 mean the server no longer recognizes this session/account, so
    // there is nothing left to delete remotely.
    // ONLY a confirmed server deletion (or a 404 = the account is already gone) may
    // license the local wipe + the "permanently deleted" claim.
    // A 401 must NOT count: JwtAuthGuard returns it for an expired/invalid token,
    // which says nothing about whether the account still exists - a warm app whose
    // 7-day access token lapsed would have wiped the phone, told the user their data
    // was erased, and left the real account (and the Apple revoke) untouched.
    // A device-only ('local') session likewise has nothing to delete remotely, but it
    // also has no server account to erase, so we must not claim server erasure.
    let serverGone = false;
    const deviceOnly = !token || token === 'local';
    if (!deviceOnly && token) {
      try {
        await api.deleteAccount(token);
        serverGone = true;
      } catch (e) {
        const status = (e as { status?: number })?.status;
        if (status === 404) serverGone = true; // already erased server-side
      }
    }
    if (!deviceOnly && !serverGone) {
      setDeleting(false);
      setConfirmDelete(false);
      Alert.alert(
        'Couldn’t delete your account',
        'Your account still exists and nothing was removed. Please sign in again and retry, so we can confirm the deletion with our server.',
      );
      return;
    }
    await clearAll(); // permanent deletion must leave nothing personal on the device
    await clearParentPin(); // the Keychain outlives AsyncStorage.clear() AND reinstalls
    await signOut();
    router.replace('/auth');
  };

  // GDPR / UK-GDPR / AU APP 12 data-access export - hand the user their own data.
  const onExport = async () => {
    if (!token || token === 'local') return;
    // Child safety (COPPA): the export hands over the WHOLE account as plain text -
    // email, name, session history, purchases. It is exactly as sensitive as deleting
    // the account, so it takes the same parent gate. Without this it was the one
    // account control a child could operate; a child in Kids Mode is also blocked by
    // the API chokepoint, but an unlocked adult session left on the phone is the real
    // case, and the gate is what covers it.
    if ((await hasParentPin()) && !parentRecentlyVerified('export')) {
      router.push('/parent-gate?intent=export' as Href);
      return;
    }
    try {
      const data = await api.exportMe(token);
      await Share.share({ message: JSON.stringify(data, null, 2) });
    } catch {
      Alert.alert('Couldn’t export right now', 'Please check your connection and try again in a moment.');
    }
  };

  // entering kids requires a parent PIN to exist first (so a child can't create one and walk out)
  const enterKids = async () => {
    // COPPA consent is captured on the Family screen (this screen has no consent UI), so
    // a first-time entry with no consent on file is routed there to set Kids mode up.
    if (!(await hasCoppaConsent())) {
      router.push('/family' as Href);
      return;
    }
    if (await hasParentPin()) {
      await enterKidsMode();
      router.replace('/');
    } else {
      router.push('/parent-gate?intent=enterKids' as Href);
    }
  };

  return (
    <Screen mode="light" scroll tabBarSpacing>
      {/* profile - for guests the whole header is the sign-in affordance (before
          this, "Sign in to sync your account" was dead text and the only path to
          /auth was the coral Sign out button) */}
      <Reveal index={0}>
        <PressableScale
          onPress={isGuest ? () => router.push('/auth' as Href) : undefined}
          disabled={!isGuest}
          accessibilityRole={isGuest ? 'button' : undefined}
          accessibilityLabel={isGuest ? 'Sign in to your account' : undefined}
          scaleTo={isGuest ? 0.99 : 1}
          dimTo={isGuest ? 0.9 : 1}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <GlowOrb size={56} reserveGlow breathing={false} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="h1Compact" tone="title" numberOfLines={1}>
                {user?.name ?? 'Welcome'}
              </AppText>
              <AppText variant="label" tone={isGuest ? 'accent' : 'muted'} style={{ marginTop: 2 }} numberOfLines={1}>
                {user?.email ?? 'Sign in to sync your account'}
              </AppText>
            </View>
            {isGuest ? <Feather name="chevron-right" size={18} color={c.accent} /> : null}
          </View>
        </PressableScale>
      </Reveal>

      {/* Offline-session honesty: signIn/register fall back to a device-only session
          when the backend is unreachable, and nothing used to say so - the user
          believed a server account existed until a sign-out lost everything. Store
          builds only: dev/web use the same 'local' sentinel for the demo login. */}
      {token === 'local' && Platform.OS !== 'web' && !__DEV__ ? (
        <Reveal index={1} style={{ marginTop: 16 }}>
          <View
            style={{
              borderRadius: 14,
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.line,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}>
            <Feather name="cloud-off" size={16} color={c.textAccent} />
            <AppText variant="label" tone="muted" style={{ flex: 1, textTransform: 'none', letterSpacing: 0 }}>
              This session lives only on this phone - we couldn’t reach our server when you signed in. Sign in again when you’re online to sync it.
            </AppText>
          </View>
        </Reveal>
      ) : null}

      {/* email verification nudge - real accounts only, and only while unverified */}
      {needsVerify && token && token !== 'local' ? (
        <Reveal index={1} style={{ marginTop: 16 }}>
          <VerifyEmailCard token={token} onDone={() => setNeedsVerify(false)} />
        </Reveal>
      ) : null}

      {/* entitlement */}
      <Reveal index={1} style={{ marginTop: 24 }}>
        {/* For premium users the card is not a link - an accidental brush shouldn't eject them to
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

      {/* mode - NIGHT-FIRST: the adult app is the night theme by identity (no theme
          picker); only the kids surface keeps a soft daytime look */}
      <Reveal index={2} style={{ marginTop: 28 }}>
        <SectionHeader kicker="Who’s it for" title="Mode" />
        <AppText variant="label" tone="muted" style={{ marginBottom: 10, textTransform: 'none', letterSpacing: 0 }}>
          Kids mode shows gentle sounds chosen for younger ears.
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
          {/* gentle remote reminders - opt-in, account-tied; native + signed-in adults only.
              never shown in kids mode (notifications are for the parent account) */}
          {pushSupported && mode !== 'kids' && token && token !== 'local' ? (
            <SettingRow icon="heart" label="Gentle reminders" toggle={pushOn} onToggle={togglePush} />
          ) : null}
          {/* bedtime reminder is a real local notification - native only, so hide on web.
              Also hidden in kids mode (same rule as push above): a child must not be able
              to trigger the OS notification-permission dialog */}
          {remindersSupported && mode !== 'kids' ? (
            <SettingRow icon="bell" label="Bedtime reminder" toggle={reminder} onToggle={toggleReminder} />
          ) : null}
          {remindersSupported && mode !== 'kids' && reminder ? (
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
          {/* weekly recap - one Sunday-evening note pointing at the calm-nights card */}
          {remindersSupported && mode !== 'kids' ? (
            <SettingRow icon="calendar" label="Weekly calm recap" toggle={recap} onToggle={toggleRecap} />
          ) : null}
          {notifDenied ? (
            <Appear enter={dur.sheet}>
              <PressableScale
                onPress={() => Linking.openSettings().catch(() => {})}
                accessibilityRole="button"
                dimTo={0.9}
                style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.line }}>
                <AppText variant="meta" tone="muted" accessibilityLiveRegion="polite">
                  Notifications are turned off for CalmCarry in your phone’s settings. Tap here to open them.
                </AppText>
              </PressableScale>
            </Appear>
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
          {/* GDPR/PDPL opt-out of first-party anonymous usage analytics (kids are never
              tracked regardless). Default on; turning it off drops any queued events. */}
          {/* Label must match the published privacy policy verbatim ("Settings, then
              'Usage & activity data'") - a reviewer or regulator follows that
              instruction. Also honest about scope: the toggle gates the
              account-linked session records too, not only anonymous events. */}
          <SettingRow icon="bar-chart-2" label="Usage & activity data" toggle={analyticsOn} onToggle={toggleAnalytics} />
          {token && token !== 'local' ? (
            <SettingRow
              icon="key"
              label="Change password"
              onPress={() => {
                setPwOpen((o) => !o);
                setPwMsg(null);
              }}
            />
          ) : null}
          {token && token !== 'local' && pwOpen ? (
            <Appear enter={dur.sheet} layout style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: c.line, gap: 12 }}>
              <FormField
                label="Current password"
                value={pwCurrent}
                onChangeText={setPwCurrent}
                placeholder="••••••••"
                icon="lock"
                autoCapitalize="none"
                secureTextEntry
                autoComplete="current-password"
              />
              <FormField
                label="New password"
                value={pwNext}
                onChangeText={setPwNext}
                placeholder="••••••••"
                icon="lock"
                autoCapitalize="none"
                secureTextEntry
                autoComplete="new-password"
              />
              {pwMsg ? (
                <Appear>
                  <AppText
                    variant="label"
                    style={{ color: pwMsg.ok ? c.textAccent : brand.coral, textTransform: 'none', letterSpacing: 0 }}>
                    {pwMsg.text}
                  </AppText>
                </Appear>
              ) : null}
              <PressableScale
                onPress={onChangePassword}
                onPressIn={lightTap}
                disabled={pwBusy}
                accessibilityRole="button"
                dimTo={0.9}
                scaleTo={0.98}
                style={{
                  alignSelf: 'flex-start',
                  paddingHorizontal: 16,
                  minHeight: 44,
                  justifyContent: 'center',
                  borderRadius: 12,
                  backgroundColor: c.panel,
                  borderWidth: 1,
                  borderColor: c.lineSage,
                  opacity: pwBusy ? 0.6 : 1,
                }}>
                <AppText variant="bodyMedium" tone="accent">
                  Update password
                </AppText>
              </PressableScale>
            </Appear>
          ) : null}
          {token && token !== 'local' ? (
            <SettingRow icon="download" label="Export my data" onPress={onExport} />
          ) : null}
          {/* Apple 3.1.1: restore reachable from Settings, not only the paywall. Shown to
              non-premium accounts (a premium account has nothing to restore). */}
          {!isPremium ? (
            <SettingRow
              icon="refresh-ccw"
              label={restoring ? 'Restoring…' : 'Restore purchases'}
              onPress={restoring ? undefined : restorePurchases}
            />
          ) : null}
          <SettingRow icon="help-circle" label="Help & support" onPress={() => Linking.openURL(SUPPORT_URL).catch(() => {})} />
          <SettingRow icon="info" label="About CalmCarry" onPress={() => router.push('/about' as Href)} last />
        </Group>
      </Reveal>

      <Reveal index={5} style={{ marginTop: 24 }}>
        {/* guests get a real Sign in action here - not a coral "Sign out" that
            confusingly happens to route to auth */}
        <PressableScale
          onPress={isGuest ? () => router.push('/auth' as Href) : onSignOut}
          onPressIn={lightTap}
          accessibilityRole="button"
          dimTo={0.6}
          style={{ alignItems: 'center', paddingVertical: 14 }}>
          <AppText variant="bodyMedium" style={isGuest ? { color: c.textAccent } : { color: brand.coral }}>
            {isGuest ? 'Sign in' : 'Sign out'}
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
        {/* Account & data deletion - required by App Store 5.1.1(v) + COPPA/GDPR */}
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
        {/* honest deletion terms - surfaced once the action is armed (GDPR 17(3)/CCPA):
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
