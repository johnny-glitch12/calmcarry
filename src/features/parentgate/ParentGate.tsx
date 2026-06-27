import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { AppText, GlowOrb, Reveal, Screen } from '@/components';
import { useProfile } from '@/features/profile/ProfileProvider';
import {
  authenticateBiometric,
  biometricAvailable,
  checkParentPin,
  hasParentPin,
  markParentVerified,
  parentPinLockSeconds,
  setParentPin,
} from '@/lib/parentGate';
import { ease, themes, useTheme } from '@/theme';

type Phase = 'loading' | 'create' | 'confirm' | 'enter';
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

function tap() {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
}

function Dots({ count, error }: { count: number; error: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 16, marginTop: 28 }}>
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={{
            width: 16,
            height: 16,
            borderRadius: 8,
            borderWidth: 2,
            borderColor: error ? '#EF626C' : c.accent,
            backgroundColor: i < count ? (error ? '#EF626C' : c.accent) : 'transparent',
          }}
        />
      ))}
    </View>
  );
}

export function ParentGate() {
  const router = useRouter();
  // this screen is always night — read night tokens directly so the keypad never
  // inherits the (possibly light) root theme context above its <Screen>.
  const c = themes.night;
  const { setMode } = useProfile();
  const { intent } = useLocalSearchParams<{ intent?: string }>();

  const [phase, setPhase] = useState<Phase>('loading');
  const [entry, setEntry] = useState('');
  const [first, setFirst] = useState('');
  const [error, setError] = useState(false);
  const shake = useSharedValue(0);
  const reduced = useReducedMotion();
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const [lockSeconds, setLockSeconds] = useState(0);
  const [bioAvailable, setBioAvailable] = useState(false);
  const bioTried = useRef(false);
  useEffect(() => {
    hasParentPin().then(async (has) => {
      setPhase(has ? 'enter' : 'create');
      if (has) {
        setLockSeconds(await parentPinLockSeconds());
        // plan §13/§9: Face ID / Touch ID is an accepted gate alongside the PIN
        setBioAvailable(await biometricAvailable());
      }
    });
  }, []);

  // tick down an active lockout so the keypad re-enables when it expires
  useEffect(() => {
    if (lockSeconds <= 0) return;
    const t = setInterval(() => setLockSeconds((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, [lockSeconds]);

  // never fall back to /you (a settings/billing tab a child must not reach) — home is kid-safe
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  // Purchases & account deletion are high-consequence: they require a real PIN
  // entry (never PIN creation, never biometrics — OS biometrics can't tell a parent
  // from a child on a shared device).
  const highConsequence = intent === 'purchase' || intent === 'deleteAccount';

  const succeed = () => {
    if (intent === 'exitKids') {
      // Reaching succeed() means either the existing PIN was entered (the gate showed
      // 'enter' and required it) OR no PIN existed (gate showed 'create'). Either way
      // release to adult — a parent must never get stuck in Kids mode. When a PIN
      // exists the gate already enforced entering it, so this is not a bypass.
      setMode('adult');
      close();
    } else if (intent === 'enterKids') {
      // PIN was just created in the adult context → now safe to enter kids
      setMode('kids');
      router.replace('/');
    } else if (intent === 'purchase') {
      // verified for a purchase → return to the paywall; subscribe() now proceeds
      router.replace('/unlock');
    } else if (intent === 'deleteAccount') {
      // verified for deletion → back to the account screen to complete it
      close();
    } else {
      close(); // setup / verify only
    }
  };

  // Face ID / Touch ID path (plan §13/§9 "PIN or biometric"). PIN stays the fallback.
  // Not offered for purchase/delete — those require the PIN specifically.
  const tryBiometric = async () => {
    if (highConsequence) return;
    if (await authenticateBiometric('Unlock CalmCarry')) {
      markParentVerified(intent ?? '');
      succeed();
    }
  };

  // offer biometrics automatically once when entering an existing gate (not locked,
  // not a high-consequence action)
  useEffect(() => {
    if (phase !== 'enter' || !bioAvailable || bioTried.current || lockSeconds > 0 || highConsequence) return;
    bioTried.current = true;
    tryBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, bioAvailable, lockSeconds, highConsequence]);

  const fail = () => {
    setError(true);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    // a single soft, eased settle — not a fast 10Hz jitter. Reduced motion skips it
    // entirely (haptic + coral dots already signal the error).
    if (reduced) {
      shake.value = 0;
    } else {
      shake.value = withSequence(
        withTiming(-5, { duration: 60, easing: ease.inOut }),
        withTiming(5, { duration: 60, easing: ease.inOut }),
        withTiming(0, { duration: 80, easing: ease.out })
      );
    }
    setTimeout(() => {
      setEntry('');
      setError(false);
    }, 450);
  };

  const onComplete = async (pin: string) => {
    if (phase === 'create') {
      setFirst(pin);
      setEntry('');
      setPhase('confirm');
    } else if (phase === 'confirm') {
      if (pin === first) {
        await setParentPin(pin);
        await succeed();
      } else {
        setFirst('');
        setPhase('create');
        fail();
      }
    } else {
      // enter — a REAL existing-PIN entry is the only thing that opens the verify
      // window (scoped to THIS intent), so creating a PIN can't authorize a purchase/delete
      const r = await checkParentPin(pin);
      if (r.ok) {
        markParentVerified(intent ?? '');
        await succeed();
      } else {
        if (r.lockedSeconds > 0) setLockSeconds(r.lockedSeconds);
        fail();
      }
    }
  };

  const press = (k: string) => {
    if (k === '') return;
    if (lockSeconds > 0) return; // gate locked after too many wrong tries
    tap();
    if (k === 'del') {
      setEntry((e) => e.slice(0, -1));
      return;
    }
    setEntry((e) => {
      if (e.length >= 4) return e;
      const next = e + k;
      if (next.length === 4) setTimeout(() => onComplete(next), 90);
      return next;
    });
  };

  const title =
    phase === 'create' ? 'Set a parent PIN' : phase === 'confirm' ? 'Confirm your PIN' : 'Enter parent PIN';
  const sub =
    phase === 'enter'
      ? 'Keeps the grown-up areas grown-up.'
      : phase === 'confirm'
        ? 'Type it once more to be sure.'
        : 'A 4-digit code only grown-ups know — it guards leaving Kids mode and the settings, store and community.';

  return (
    <Screen mode="night" contentStyle={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
          <Feather name="x" size={24} color="#9DB7B1" />
        </Pressable>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <GlowOrb size={64} reserveGlow aura>
          <Feather name="lock" size={22} color="#FFFFFF" />
        </GlowOrb>
        <Reveal index={0} style={{ alignItems: 'center', marginTop: 20 }}>
          <AppText variant="h1" tone="title" style={{ textAlign: 'center' }}>
            {title}
          </AppText>
          <AppText variant="body" tone="muted" style={{ textAlign: 'center', marginTop: 8, maxWidth: 300 }}>
            {sub}
          </AppText>
        </Reveal>

        <Animated.View style={shakeStyle}>
          <Dots count={entry.length} error={error} />
        </Animated.View>

        {lockSeconds > 0 ? (
          <AppText variant="label" style={{ color: '#EF626C', marginTop: 16, textAlign: 'center', textTransform: 'none', letterSpacing: 0 }}>
            Too many tries. Try again in {lockSeconds}s.
          </AppText>
        ) : null}

        {/* keypad */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 264, marginTop: 40, justifyContent: 'center', opacity: lockSeconds > 0 ? 0.4 : 1 }}>
          {KEYS.map((k, idx) => (
            <Pressable
              key={idx}
              onPress={() => press(k)}
              disabled={k === '' || lockSeconds > 0}
              accessibilityRole={k === '' ? 'none' : 'button'}
              accessibilityLabel={k === 'del' ? 'Delete' : k || undefined}
              style={{ width: 88, height: 72, alignItems: 'center', justifyContent: 'center' }}>
              {k === 'del' ? (
                <Feather name="delete" size={24} color={c.textAccent} />
              ) : k === '' ? null : (
                <AppText style={{ fontSize: 28, color: c.title }}>{k}</AppText>
              )}
            </Pressable>
          ))}
        </View>

        {/* biometric option (plan §13: "PIN or Face ID") — only when entering an existing
            gate, and never for purchase/delete (those require the PIN specifically) */}
        {phase === 'enter' && bioAvailable && !highConsequence ? (
          <Pressable
            onPress={tryBiometric}
            disabled={lockSeconds > 0}
            accessibilityRole="button"
            accessibilityLabel="Unlock with Face ID or Touch ID"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, padding: 10, opacity: lockSeconds > 0 ? 0.4 : 1 }}>
            <Feather name="unlock" size={18} color={c.textAccent} />
            <AppText variant="bodyMedium" style={{ color: c.textAccent }}>
              Use Face ID / Touch ID
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}
