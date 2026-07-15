import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, View } from 'react-native';

import { Appear, AppText, Crossfade, GlowOrb, PressableScale, PrimaryButton, Reveal, Screen, SelectionOverlay, SwapText } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { TRACKS } from '@/content/library';
import { PRICING, PRIVACY_URL, SUBSCRIPTION_URL, TERMS_URL, TRIAL_DAYS, type PlanId } from '@/content/store';
import { track } from '@/lib/analytics';
import { api } from '@/lib/api';
import { lightTap } from '@/lib/haptics';
import { fetchLocalizedPrices, iapSupported, introOfferEligible, purchaseSubscription, restoreSubscription } from '@/lib/iap';
import { scheduleTrialEndingReminder } from '@/lib/reminders';
import { hasParentPin, parentRecentlyVerified } from '@/lib/parentGate';
import { brand, useTheme } from '@/theme';

const INCLUDED = [
  'The full guided session & sleep-tale library',
  'Multi-week gentle programs',
  'The full sound machine, so you can mix and save your own',
  'Shared access for the whole household',
  'Fresh sessions and music every month',
];

function PlanCard({
  id,
  price,
  note,
  sub,
  selected,
  onSelect,
}: {
  id: PlanId;
  price: string;
  note: string | null;
  sub: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const { c } = useTheme();
  const p = PRICING[id];
  return (
    <PressableScale
      onPress={onSelect}
      onPressIn={lightTap}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${p.label}, ${price} ${p.per}`}
      scaleTo={0.98}
      dimTo={0.95}>
      <View
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 16,
          padding: 16,
          // Resting look. borderWidth is CONSTANT (2) between states - the selected
          // fill/border color eases in via the overlay, so there's no 1px shift.
          backgroundColor: c.surface,
          borderWidth: 2,
          borderColor: c.line,
        }}>
        <SelectionOverlay
          active={selected}
          style={{ borderRadius: 16, borderWidth: 2, borderColor: c.accent, backgroundColor: c.panelStrong }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <AppText variant="h3" tone="title" numberOfLines={1}>
                {p.label}
              </AppText>
              {note ? (
                <Appear style={{ flexShrink: 1, minWidth: 0 }}>
                  <AppText variant="caption" style={{ color: c.textAccent, textTransform: 'none', letterSpacing: 0 }} numberOfLines={1}>
                    {note}
                  </AppText>
                </Appear>
              ) : null}
            </View>
            <SwapText trigger={sub} style={{ marginTop: 4 }}>
              <AppText variant="label" tone="muted" numberOfLines={1}>
                {sub}
              </AppText>
            </SwapText>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <SwapText trigger={price}>
              <AppText variant="bodyMedium" tone="title" numberOfLines={1}>
                {price}
              </AppText>
            </SwapText>
            <AppText variant="label" tone="muted">
              {p.per}
            </AppText>
          </View>
          <View
            style={{
              position: 'relative',
              overflow: 'hidden',
              width: 22,
              height: 22,
              borderRadius: 11,
              borderWidth: 2,
              borderColor: c.line,
              marginLeft: 14,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <SelectionOverlay active={selected} style={{ borderRadius: 11, borderWidth: 2, borderColor: c.accent }} />
            <Crossfade
              active={selected}
              style={{ width: 13, height: 13 }}
              front={<Feather name="check" size={13} color={c.accent} />}
              back={null}
            />
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

export function CalmPlan() {
  const { c } = useTheme();
  const router = useRouter();
  // contextual paywall: when a locked-content tap brought the user here (unlock?id=x),
  // acknowledge WHY they're here - the ask lands better as an answer than a pitch
  const { id } = useLocalSearchParams<{ id?: string }>();
  const contextTrack = id ? TRACKS[id] : undefined;
  const { activatePremium, isPremium, token } = useAuth();
  const [plan, setPlan] = useState<PlanId>('annual');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [prices, setPrices] = useState<Partial<Record<PlanId, string>>>({});
  // true until StoreKit says otherwise - the store itself is the final gate,
  // we only stop PROMISING the trial when we know this Apple ID already used it
  const [trialEligible, setTrialEligible] = useState(true);
  const mounted = useRef(true);
  // Concrete first-renewal date for the disclosure - "from July 15" beats "after the
  // trial" for surprise-charge trust. "from", not "on": the store receipt owns the
  // exact renewal instant, so we bound it honestly without asserting the minute.
  // Computed in the mount effect (not render) to keep render pure.
  const [trialEnds, setTrialEnds] = useState('');
  useEffect(() => {
    track('paywall_view');
    setTrialEnds(
      new Date(Date.now() + TRIAL_DAYS * 86_400_000).toLocaleDateString(undefined, { month: 'long', day: 'numeric' }),
    );
    return () => {
      mounted.current = false;
    };
  }, []);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const live = !!token && token !== 'local';

  // Localized store prices for UK/CA/AU so the paywall never shows a USD string
  // that mismatches what StoreKit/Play charges. Falls back to the static PRICING.
  // Deliberately NOT gated on a backend session - reading product prices is pure
  // StoreKit/Play, and a signed-out browser deserves the same honest numbers.
  useEffect(() => {
    let alive = true;
    if (iapSupported) {
      fetchLocalizedPrices().then((p) => alive && setPrices(p)).catch(() => {});
      // Intro offers apply once per subscription group - a lapsed subscriber is
      // charged immediately, so promising THEM a free trial would be a lie.
      introOfferEligible().then((ok) => alive && setTrialEligible(ok)).catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, []);
  const display = (id: PlanId): { price: string; note: string | null; sub: string } => {
    const p = PRICING[id];
    const localized = prices[id];
    if (!localized) return { price: p.price, note: p.note as string | null, sub: p.sub };
    // localized price found → drop the USD-derived note/sub to avoid wrong amounts
    return { price: localized, note: id === 'annual' ? 'Best value' : null, sub: id === 'annual' ? 'Billed yearly' : 'Billed monthly' };
  };

  // Buy: on a real device the StoreKit/Play purchase yields a receipt the backend
  // validates; premium unlocks only when validation succeeds (no offline freebie).
  // On web / dev (no native store) we fall back to a dev grant for testing.
  const subscribe = async () => {
    if (busy || isPremium) return;
    // Signed-out (or local-fallback) session in a production build: no purchase
    // branch can run, so say the honest thing and route to sign-in instead of the
    // "couldn't complete the purchase, try again" lie that can never succeed.
    if (!live && !__DEV__) {
      setNote('Sign in first so your plan follows your account.');
      router.push('/auth' as Href);
      return;
    }
    // Child safety (COPPA): when a parent PIN exists, a grown-up must pass the gate
    // (PIN entry, intent-scoped) before any purchase. The gate returns here; the
    // 'purchase'-scoped verify window lets the retap through.
    if ((await hasParentPin()) && !parentRecentlyVerified('purchase')) {
      router.push('/parent-gate?intent=purchase' as Href);
      return;
    }
    setBusy(true);
    setNote(null);
    let ok = false;
    let failReason: string | undefined;
    if (iapSupported && live) {
      // real native purchase → server-validated receipt
      const r = await purchaseSubscription(plan, token);
      ok = r.ok;
      failReason = r.reason;
      if (!ok && r.reason === 'cancelled') {
        if (mounted.current) setBusy(false);
        return; // user backed out - no error nag
      }
    } else if (live && __DEV__) {
      // DEV/web ONLY: exercise the server validation path (dev-fallback grants without
      // keys). Gated to __DEV__ so a PRODUCTION web build can never fake a receipt -
      // real purchases happen on-device via Apple/Google IAP.
      try {
        const r = await api.billingValidate(token, {
          store: 'apple',
          receipt: `demo-receipt-${Date.now()}`,
          productId: `calmcarry.premium.${plan}`,
        });
        ok = r.isPremium;
      } catch {
        ok = false;
      }
    } else if (__DEV__) {
      ok = true; // dev/offline demo only
    }
    if (ok) {
      await activatePremium();
      track('subscribe_success', { plan });
      // Best-effort pre-charge reminder (a nice-to-have; the disclosure no longer
      // PROMISES it, since a local notification can be denied or fail silently).
      if (plan === 'annual' && trialEligible) scheduleTrialEndingReminder(TRIAL_DAYS, display('annual').price).catch(() => {});
    }
    if (!mounted.current) return;
    setBusy(false);
    if (ok) close();
    else if (failReason === 'validation_failed')
      // They may already have been CHARGED - the unfinished transaction is
      // redelivered and re-validated on the next launch, so never tell them to
      // buy again; point at the path that re-checks instead.
      setNote('Your payment may have gone through but we couldn’t confirm it. It finishes automatically next time you open the app, or tap "Restore purchases".');
    else setNote('We couldn’t complete the purchase. Please try again.');
  };

  // Restore: re-applies an EXISTING entitlement only - never starts a new purchase.
  const restore = async () => {
    if (busy) return;
    if (!live) {
      setNote('Sign in to restore a previous purchase.');
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      // on device, re-read the store's purchases and re-validate; everywhere,
      // also honour an entitlement the backend already has on this account.
      if (iapSupported) {
        const r = await restoreSubscription(token);
        if (r.ok) {
          await activatePremium();
          if (mounted.current) close();
          return;
        }
      }
      const s = await api.billingStatus(token);
      if (s.isPremium) {
        await activatePremium();
        if (mounted.current) close();
        return;
      }
      setNote('No previous purchase found on this account.');
    } catch {
      setNote('Couldn’t reach the store. Try again.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <Screen mode="light" scroll contentStyle={{ paddingTop: 8 }}>
      <PressableScale onPress={close} hitSlop={16} accessibilityRole="button" accessibilityLabel="Close" dimTo={0.85} style={{ alignSelf: 'flex-end' }}>
        <Feather name="x" size={24} color={c.text} />
      </PressableScale>

      <Reveal index={0} style={{ alignItems: 'center', marginTop: 8 }}>
        <GlowOrb size={84} reserveGlow aura />
        <AppText variant="caption" tone="accent" style={{ marginTop: 8 }}>
          CalmCarry Premium
        </AppText>
        <AppText variant="display" tone="title" style={{ marginTop: 4, textAlign: 'center' }}>
          Go deeper, every night
        </AppText>
        <AppText variant="body" tone="muted" style={{ marginTop: 8, textAlign: 'center', maxWidth: 300 }}>
          {contextTrack
            ? `“${contextTrack.title}” is part of Premium, along with the full library, programs, and the whole sound machine. Your free tier stays free.`
            : 'Your free tier stays free. Premium opens the full library, programs, and the whole sound machine.'}
        </AppText>
      </Reveal>

      <Reveal index={1} style={{ marginTop: 24 }}>
        <View style={{ gap: 12 }}>
          {INCLUDED.map((item) => (
            <View key={item} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Feather name="check" size={18} color={c.textAccent} />
              <AppText variant="bodyMedium" style={{ flex: 1, color: c.text }}>
                {item}
              </AppText>
            </View>
          ))}
        </View>
      </Reveal>

      <Reveal index={2} style={{ marginTop: 24, gap: 12 }}>
        <PlanCard id="annual" {...display('annual')} selected={plan === 'annual'} onSelect={() => setPlan('annual')} />
        <PlanCard id="monthly" {...display('monthly')} selected={plan === 'monthly'} onSelect={() => setPlan('monthly')} />
      </Reveal>

      <Reveal index={3} style={{ marginTop: 20, gap: 10 }}>
        {/* honest-billing beats - the exact pains BetterSleep-style apps inflict */}
        <View style={{ gap: 8, marginBottom: 2 }}>
          {['One subscription covers your whole household', 'Cancel in one tap, anytime. No email, no phone call'].map((t) => (
            <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather name="shield" size={14} color={c.textAccent} />
              <AppText variant="label" tone="muted" style={{ flex: 1, textTransform: 'none', letterSpacing: 0 }}>
                {t}
              </AppText>
            </View>
          ))}
        </View>
        <Appear key={`cta-${plan}`}>
          <PrimaryButton
            label={
              isPremium
                ? 'You’re premium ✓'
                : plan === 'annual'
                  ? trialEligible
                    ? `Start your ${TRIAL_DAYS}-day free trial`
                    : `Subscribe at ${display('annual').price}${PRICING.annual.per}`
                  : `Start monthly at ${display('monthly').price}${PRICING.monthly.per}`
            }
            onPress={subscribe}
            loading={busy}
            disabled={isPremium}
          />
        </Appear>
        {note ? (
          <Appear>
            <AppText variant="label" style={{ color: brand.coral, textAlign: 'center', textTransform: 'none', letterSpacing: 0 }}>
              {note}
            </AppText>
          </Appear>
        ) : null}
        {/* required subscription disclosure */}
        <Appear key={`disclosure-${plan}`}>
          <AppText variant="caption" tone="muted" style={{ textAlign: 'center', textTransform: 'none', letterSpacing: 0, lineHeight: 16, marginTop: 4 }}>
            {plan === 'annual'
              ? trialEligible
                ? `Free for ${TRIAL_DAYS} days, then auto-renews at ${display('annual').price}${PRICING.annual.per}${trialEnds ? ` from ${trialEnds}` : ''} unless cancelled. Cancel anytime in your Apple or Google account settings. Billed through your Apple or Google account.`
                : `Auto-renews at ${display('annual').price}${PRICING.annual.per} until cancelled. The free trial applies once per account and yours has been used. Cancel anytime in your Apple or Google account settings. Billed through your Apple or Google account.`
              : `Auto-renews at ${display('monthly').price}${PRICING.monthly.per} until cancelled. Cancel anytime in your Apple or Google account settings. Billed through your Apple or Google account.`}
          </AppText>
        </Appear>
        {/* the way out: a single, full-width quiet dismiss right under the button - not lost among the legal links */}
        <PressableScale onPress={close} accessibilityRole="button" hitSlop={12} dimTo={0.85} style={{ alignItems: 'center', paddingVertical: 14 }}>
          <AppText variant="bodyMedium" tone="muted" style={{ textTransform: 'none', letterSpacing: 0 }}>
            Maybe later
          </AppText>
        </PressableScale>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
          <PressableScale onPress={restore} accessibilityRole="button" hitSlop={12} dimTo={0.85} style={{ paddingVertical: 8 }}>
            <AppText variant="label" tone="muted">Restore purchases</AppText>
          </PressableScale>
          <PressableScale onPress={() => Linking.openURL(TERMS_URL).catch(() => {})} accessibilityRole="button" hitSlop={12} dimTo={0.85} style={{ paddingVertical: 8 }}>
            <AppText variant="label" tone="muted">Terms</AppText>
          </PressableScale>
          <PressableScale onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})} accessibilityRole="button" hitSlop={12} dimTo={0.85} style={{ paddingVertical: 8 }}>
            <AppText variant="label" tone="muted">Privacy</AppText>
          </PressableScale>
          {/* the cancel path lives at the point of sale, not buried in Account -
              the disclosure names store settings; this link actually opens them */}
          <PressableScale onPress={() => Linking.openURL(SUBSCRIPTION_URL).catch(() => {})} accessibilityRole="button" hitSlop={12} dimTo={0.85} style={{ paddingVertical: 8 }}>
            <AppText variant="label" tone="muted">Manage subscription</AppText>
          </PressableScale>
        </View>
      </Reveal>
    </Screen>
  );
}
