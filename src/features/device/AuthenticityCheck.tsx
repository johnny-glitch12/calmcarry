import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Appear, AppText, GlowOrb, PrimaryButton, Reveal, Screen, StatusChip, SwapText } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { api } from '@/lib/api';
import { dur, ease, useTheme } from '@/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// checkmark in a 24×24 viewBox; L is a touch over its true length so it starts hidden
const CHECK_PATH = 'M5 12.5 L10 17.5 L19 7';
const CHECK_LEN = 28;

type ApiDevice = { id: string; serial: string; model?: string; warrantyStatus?: string; warrantyMonths?: number };
type Phase = 'checking' | 'authentic' | 'unverified';

/** The sage check that strokes on (strokeDashoffset reveal) + a soft scale settle. */
function DrawOnCheck({ size, draw }: { size: number; draw: SharedValue<number> }) {
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CHECK_LEN * (1 - draw.value),
  }));
  const containerStyle = useAnimatedStyle(() => ({
    // eased fade tied to the stroke (full by ~25%) — no 1-frame pop-on, hidden at rest
    opacity: Math.min(1, draw.value * 4),
    transform: [{ scale: 0.95 + 0.05 * draw.value }],
  }));
  return (
    <Animated.View style={[{ width: size, height: size }, containerStyle]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <AnimatedPath
          d={CHECK_PATH}
          stroke="#FFFFFF"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray={CHECK_LEN}
          animatedProps={animatedProps}
        />
      </Svg>
    </Animated.View>
  );
}

/**
 * AuthenticityCheck — the device-registration TRUST moment (§4, §7 Peak). It is
 * HONEST: it confirms the Glow Orb actually registered to this account (warranty +
 * replacement support), NOT a cryptographic genuineness proof — we have no
 * manufactured-serial registry yet, so we never claim "genuine/verified authentic"
 * from a registration alone. Registered → sage check + real device on file;
 * no device → an invitation to register. (When Glowco supplies a serial registry,
 * upgrade the copy + a server `verified` flag.)
 */
export function AuthenticityCheck() {
  const { c } = useTheme();
  const router = useRouter();
  const { token } = useAuth();
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>('checking');
  const [device, setDevice] = useState<ApiDevice | null>(null);
  const draw = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(() => {
    setPhase('checking');
    // ease the drawn check away rather than snapping it (reduced-motion resets instantly)
    draw.value = reduced ? 0 : withTiming(0, { duration: dur.exit, easing: ease.inOut });
    if (timer.current) clearTimeout(timer.current);

    const reveal = (dev: ApiDevice | null) => {
      setDevice(dev);
      if (dev) {
        setPhase('authentic');
        draw.value = reduced ? 1 : withTiming(1, { duration: dur.draw, easing: ease.out });
      } else {
        setPhase('unverified');
      }
    };

    // can't verify a genuine device without a signed-in account
    if (!token || token === 'local') {
      timer.current = setTimeout(() => reveal(null), reduced ? 0 : 700);
      return;
    }
    // honest check: the account must have a real, registered Glow Orb
    api
      .devices(token)
      .then((list) => {
        const dev = ((list as ApiDevice[]) ?? [])[0] ?? null;
        timer.current = setTimeout(() => reveal(dev), reduced ? 0 : 600);
      })
      .catch(() => {
        timer.current = setTimeout(() => reveal(null), reduced ? 0 : 600);
      });
  }, [draw, reduced, token]);

  useEffect(() => {
    run();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [run]);

  const authentic = phase === 'authentic';
  const checking = phase === 'checking';

  return (
    <Screen mode="light" scroll tabBarSpacing contentStyle={{ alignItems: 'center', paddingTop: 24 }}>
      <SwapText trigger={phase}>
        <AppText variant="caption" tone="accent">
          {authentic ? 'Registered' : checking ? 'Checking' : 'Not registered'}
        </AppText>
      </SwapText>

      {/* orb + check overlay — reserveGlow keeps the halo from bleeding onto the text */}
      <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
        <GlowOrb size={150} reserveGlow aura={checking} breathing={checking} burst={authentic} />
        <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
          <DrawOnCheck size={74} draw={draw} />
        </View>
      </View>

      {authentic ? (
        <Reveal index={0} style={{ alignItems: 'center', marginTop: 8 }}>
          <AppText variant="h1" tone="title">
            Registered to your account
          </AppText>
        </Reveal>
      ) : checking ? (
        <Appear style={{ alignItems: 'center', marginTop: 8 }}>
          <AppText variant="h1" tone="title">
            Checking your device…
          </AppText>
        </Appear>
      ) : (
        <Reveal index={0} style={{ alignItems: 'center', marginTop: 8 }}>
          <AppText variant="h1" tone="title" style={{ textAlign: 'center' }}>
            No device registered yet
          </AppText>
        </Reveal>
      )}

      {authentic ? (
        <Appear key="authentic" style={{ alignSelf: 'stretch', alignItems: 'center' }}>
          <Reveal index={1} style={{ alignItems: 'center', marginTop: 10 }}>
            <AppText variant="body" tone="muted" style={{ textAlign: 'center', maxWidth: 300 }}>
              On file with The Glow Company · warranty &amp; replacement support active
            </AppText>
          </Reveal>

          {/* details — the real device on file, not a placeholder */}
          <Reveal index={2} style={{ alignSelf: 'stretch', marginTop: 24 }}>
            <View
              style={{
                alignSelf: 'stretch',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: c.panelStrong,
                backgroundColor: c.panel,
                padding: 16,
                gap: 12,
              }}>
              <Row label="Model" value={device?.model ?? 'CalmCarry · Glow Orb'} />
              <Row label="Serial" value={device?.serial ?? 'Not on file'} />
              <Row
                label="Warranty"
                value={
                  device?.warrantyStatus === 'active'
                    ? `Active · ${device?.warrantyMonths ?? 24} months`
                    : device?.warrantyStatus
                      ? device.warrantyStatus.charAt(0).toUpperCase() + device.warrantyStatus.slice(1)
                      : 'Not on file'
                }
              />
            </View>
          </Reveal>

          <Reveal index={3} style={{ alignItems: 'center', marginTop: 16 }}>
            <StatusChip label="Registered & covered" icon="shield" confirm />
          </Reveal>

          <Reveal index={4} style={{ alignSelf: 'stretch', marginTop: 20 }}>
            <PrimaryButton label="Check again" variant="secondary" onPress={run} />
          </Reveal>
        </Appear>
      ) : checking ? null : (
        <Appear key="unverified" style={{ alignSelf: 'stretch', alignItems: 'center' }}>
          <Reveal index={1} style={{ alignItems: 'center', marginTop: 10 }}>
            <AppText variant="body" tone="muted" style={{ textAlign: 'center', maxWidth: 320 }}>
              {!token || token === 'local'
                ? 'Sign in and register your Glow Orb to activate its warranty and replacement support.'
                : 'No Glow Orb is registered to this account yet. Register your device to activate its warranty and replacement support.'}
            </AppText>
          </Reveal>
          <Reveal index={2} style={{ alignSelf: 'stretch', marginTop: 24 }}>
            <PrimaryButton label="Register your device" onPress={() => router.push('/register-device')} />
          </Reveal>
          <Reveal index={3} style={{ alignSelf: 'stretch', marginTop: 10 }}>
            <PrimaryButton label="Check again" variant="secondary" onPress={run} />
          </Reveal>
        </Appear>
      )}
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <AppText variant="label" tone="dim">
        {label}
      </AppText>
      <AppText
        variant="label"
        tone="text"
        numberOfLines={1}
        style={{ color: c.textAccent, flexShrink: 1, textAlign: 'right' }}>
        {value}
      </AppText>
    </View>
  );
}
