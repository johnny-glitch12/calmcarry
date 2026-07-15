import { Feather } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Image } from 'expo-image';
import * as Google from 'expo-auth-session/providers/google';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, View, type GestureResponderEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Appear, AppText, Crossfade, FlowTransition, FormField, Logo, PressableScale, PrimaryButton, Reveal, Screen, SelectionOverlay, SwapText } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { api } from '@/lib/api';
import { lightTap } from '@/lib/haptics';
import { PRIVACY_URL, TERMS_URL } from '@/content/store';
import { dur, ease, useTheme } from '@/theme';

WebBrowser.maybeCompleteAuthSession();

// Animated AppText so an inline link can dim on press without a wrapping
// Animated.View (which would break the flowing sentence out of its text line).
const AnimatedAppText = Animated.createAnimatedComponent(AppText);

/**
 * InlineLink - a tappable word inside flowing prose (Terms / Privacy Policy).
 * Mirrors PressableScale's press feedback (opacity dim to 0.85, dur.press,
 * ease.press) but stays an inline Text node so it wraps with the sentence.
 * Reduced-motion snaps (no animation), and the press itself always fires.
 */
function InlineLink({ label, url }: { label: string; url: string }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);
  const s = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const drive = (pressed: boolean) => {
    if (reduced) return;
    opacity.value = withTiming(pressed ? 0.85 : 1, { duration: dur.press, easing: ease.press });
  };
  return (
    <AnimatedAppText
      variant="caption"
      // caption uppercases; inside a flowing sentence the links must match the
      // sentence case around them (was rendering "TERMS and PRIVACY POLICY")
      style={[{ color: c.textAccent, textTransform: 'none', letterSpacing: 0 }, s]}
      suppressHighlighting
      accessibilityRole="link"
      onPressIn={(_e: GestureResponderEvent) => drive(true)}
      onPressOut={(_e: GestureResponderEvent) => drive(false)}
      onPress={() => WebBrowser.openBrowserAsync(url)}>
      {label}
    </AnimatedAppText>
  );
}

// PLACEHOLDER Google OAuth client ids - set the real ones from Google Cloud Console
// via EXPO_PUBLIC_GOOGLE_* env. Apple needs no key here (uses the app's capability).
const GOOGLE = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? 'PLACEHOLDER.apps.googleusercontent.com',
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? 'PLACEHOLDER.apps.googleusercontent.com',
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? 'PLACEHOLDER.apps.googleusercontent.com',
};
// Only surface the Google button once real client ids are set - never a dead button.
const googleConfigured = !GOOGLE.webClientId.startsWith('PLACEHOLDER');

export function SignIn() {
  const { c } = useTheme();
  const router = useRouter();
  const { signIn, register, socialSignIn } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  // forgot-password sub-flow (emailed 6-digit code -> new password -> signed in)
  const [forgot, setForgot] = useState<null | 'email' | 'code'>(null);
  const [fpCode, setFpCode] = useState('');
  const [fpNew, setFpNew] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // iOS has no live regions - announce auth errors so screen-reader users hear them
  useEffect(() => {
    if (error) AccessibilityInfo.announceForAccessibility(error);
  }, [error]);
  // Age assurance for account creation (App Store 5.1.1 / Play): the account holder
  // must confirm they're an adult. Child use happens via COPPA-consented kid profiles.
  const [adult, setAdult] = useState(false);
  // Optimistically assume Apple sign-in on iOS so the social block is present on
  // first paint - the async check below only ever narrows it, avoiding a layout
  // shove that would push the email form down when it resolves.
  const [appleAvailable, setAppleAvailable] = useState(Platform.OS === 'ios');
  const isSignup = mode === 'signup';

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  // Sign in with Apple - native iOS only (web/Android: hidden via appleAvailable)
  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  // Sign in with Google (expo-auth-session) - returns an id_token we verify server-side
  const [, googleResponse, googlePrompt] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE.webClientId,
    iosClientId: GOOGLE.iosClientId,
    androidClientId: GOOGLE.androidClientId,
  });

  const social = async (provider: 'apple' | 'google', idToken: string, authorizationCode?: string, name?: string) => {
    setBusy(true);
    setError(null);
    try {
      await socialSignIn(provider, idToken, authorizationCode, name);
      router.replace('/');
    } catch {
      setError('That sign-in didn’t go through. Email works too.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const idToken = googleResponse.params?.id_token;
      if (idToken) social('google', idToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleResponse]);

  const onApple = async () => {
    try {
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (cred.identityToken) {
        // Apple sends fullName ONLY on the very first authorization - the id token
        // never carries it, so dropping it here would greet Hide-My-Email users by
        // their relay address ("xk3j9q2m") forever. Forward it while we have it.
        const name = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(' ') || undefined;
        await social('apple', cred.identityToken, cred.authorizationCode ?? undefined, name);
      }
    } catch (e) {
      // Only a user cancel of the Apple sheet may stay silent; anything else
      // (entitlement/iCloud/transient) must not read as a dead button.
      if ((e as { code?: string })?.code !== 'ERR_REQUEST_CANCELED') {
        setError('That sign-in didn’t go through. Email works too.');
      }
    }
  };

  const submit = async () => {
    if (busy) return;
    if (!email.trim() || !password || (isSignup && !name.trim())) {
      setError('Please fill in every field.');
      return;
    }
    if (isSignup && !adult) {
      setError('Please confirm you’re 18 or older to create an account.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (isSignup) {
        await register(email.trim(), password, name.trim());
        // new accounts run the first-run owner match (§6/§10); returning users go straight in
        router.replace('/claim-device');
      } else {
        await signIn(email.trim(), password);
        router.replace('/');
      }
    } catch {
      setError(
        isSignup
          ? 'We couldn’t create that account. Try a different email.'
          : 'That email or password doesn’t look right.',
      );
    } finally {
      setBusy(false);
    }
  };

  // forgot-password: email a 6-digit code, then trade code + new password for a
  // session (the server signs the user in; we reuse signIn for the provider state)
  const submitForgot = async () => {
    if (busy) return;
    setError(null);
    if (forgot === 'email') {
      if (!email.trim()) {
        setError('Enter your email first.');
        return;
      }
      setBusy(true);
      try {
        await api.forgotPassword(email.trim());
        setForgot('code');
      } catch {
        setError('We couldn’t send the code just now. Try again in a moment.');
      } finally {
        setBusy(false);
      }
      return;
    }
    if (fpCode.trim().length !== 6 || fpNew.length < 8) {
      setError('Enter the 6-digit code and a new password of at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      await api.resetPassword(email.trim(), fpCode.trim(), fpNew);
      await signIn(email.trim(), fpNew);
      router.replace('/');
    } catch {
      setError('That code doesn’t look right. Check the email and try again.');
    } finally {
      setBusy(false);
    }
  };

  // auth is a MODAL - modal presentation reports a small top inset, so add explicit
  // top padding or the close-X + orb sit cramped against the sheet's top edge.
  return (
    <Screen mode="light" scroll contentStyle={{ paddingTop: 28 }}>
      <PressableScale onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" dimTo={0.85} style={{ alignSelf: 'flex-start' }}>
        <Feather name="x" size={24} color={c.text} />
      </PressableScale>

      <Reveal index={0} style={{ alignItems: 'center', marginTop: 24 }}>
        {/* the device itself (Mason: show the Glow Orb on login) - the watercolour
            hands-cradling-the-orb illustration, same art language as the covers */}
        <Image
          source={require('../../../assets/images/onboarding/pricing-orb.png')}
          style={{ width: 180, height: 150, marginBottom: -8 }}
          contentFit="contain"
          accessibilityIgnoresInvertColors
        />
        <Logo size="lg" tagline style={{ marginTop: 8 }} />
        <SwapText trigger={forgot ?? mode} style={{ marginTop: 10 }}>
          <AppText variant="body" tone="muted" style={{ textAlign: 'center' }}>
            {forgot ? 'Reset your password' : isSignup ? 'Create your CalmCarry account' : 'Sign in to your CalmCarry account'}
          </AppText>
        </SwapText>
        {/* device significance (Mason): the app exists FOR the Glow Orb */}
        <AppText
          variant="caption"
          tone="dim"
          style={{ textAlign: 'center', marginTop: 8, textTransform: 'none', letterSpacing: 0, lineHeight: 17, maxWidth: 300 }}>
          Made for your Glow Orb: the app guides the wind-down, the device does the rest. Signing in registers it and keeps your calm plan across devices.
        </AppText>
      </Reveal>

      {appleAvailable || googleConfigured ? (
        <Reveal index={1} style={{ marginTop: 28, gap: 12 }}>
          {appleAvailable ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={8}
              style={{ height: 52, width: '100%' }}
              onPress={onApple}
            />
          ) : null}
          {googleConfigured ? (
            <PressableScale onPress={() => googlePrompt()} accessibilityRole="button" disabled={busy} accessibilityLabel="Continue with Google">
              <View style={{ minHeight: 52, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <Feather name="chrome" size={18} color={c.text} />
                <AppText variant="bodyMedium" tone="title">
                  Continue with Google
                </AppText>
              </View>
            </PressableScale>
          ) : null}
          {/* Age affirmation for social sign-in: the email path has an explicit
              18+ checkbox before it creates an account; Apple/Google create one in
              one tap, so the same affirmation must be visible here (App Store 5.1.1 /
              Play age assurance - the account holder is an adult; kids use COPPA
              profiles under them). */}
          <AppText
            variant="caption"
            tone="muted"
            style={{ textAlign: 'center', textTransform: 'none', letterSpacing: 0, lineHeight: 17 }}>
            By continuing with Apple or Google you confirm you’re 18 or older and agree to our{' '}
            <InlineLink label="Terms" url={TERMS_URL} />
            {' and '}
            <InlineLink label="Privacy Policy" url={PRIVACY_URL} />
            .
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
            <AppText variant="label" tone="muted">
              or use email
            </AppText>
            <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
          </View>
        </Reveal>
      ) : null}

      <Reveal index={2} style={{ marginTop: 32 }}>
        <FlowTransition style={{ gap: 16 }}>
          {isSignup && forgot === null ? (
            <Appear>
              <FormField label="Your name" value={name} onChangeText={setName} placeholder="First name" icon="user" autoComplete="name" />
            </Appear>
          ) : null}
          <FormField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            icon="mail"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          {forgot === null ? (
            <FormField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              icon="lock"
              autoCapitalize="none"
              secureTextEntry
              autoComplete={isSignup ? 'new-password' : 'current-password'}
            />
          ) : null}
          {forgot === 'code' ? (
            <Appear>
              <View style={{ gap: 16 }}>
                <AppText variant="caption" tone="muted" style={{ textTransform: 'none', letterSpacing: 0, lineHeight: 18 }}>
                  If that email has an account, a 6-digit code is on its way. It expires in 15 minutes.
                </AppText>
                <FormField
                  label="6-digit code"
                  value={fpCode}
                  onChangeText={setFpCode}
                  placeholder="123456"
                  icon="hash"
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  autoComplete="one-time-code"
                />
                <FormField
                  label="New password"
                  value={fpNew}
                  onChangeText={setFpNew}
                  placeholder="••••••••"
                  icon="lock"
                  autoCapitalize="none"
                  secureTextEntry
                  autoComplete="new-password"
                />
              </View>
            </Appear>
          ) : null}
          {!isSignup && forgot === null ? (
            <PressableScale
              onPress={() => {
                setForgot('email');
                setError(null);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
              accessibilityRole="button"
              dimTo={0.85}
              style={{ alignSelf: 'flex-start' }}>
              <AppText variant="label" style={{ color: c.textAccent }}>
                Forgot password?
              </AppText>
            </PressableScale>
          ) : null}
          {isSignup ? (
            <Appear>
              <PressableScale
                onPress={() => {
                  lightTap();
                  setAdult((a) => !a);
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: adult }}
                accessibilityLabel="I’m 18 or older"
                hitSlop={8}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
                {/* box fill + check both EASE in on toggle (motion doctrine - no hard snap) */}
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 8,
                    borderWidth: 1.5,
                    borderColor: c.line,
                    overflow: 'hidden',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <SelectionOverlay active={adult} style={{ borderRadius: 8, backgroundColor: c.accent }} />
                  <Crossfade
                    style={{ width: 15, height: 15 }}
                    active={adult}
                    front={<Feather name="check" size={15} color={c.ctaText} />}
                    back={<View />}
                  />
                </View>
                <AppText variant="label" tone="muted" style={{ textTransform: 'none', letterSpacing: 0, flex: 1 }}>
                  I’m 18 or older
                </AppText>
              </PressableScale>
            </Appear>
          ) : null}
          {error ? (
            <Appear>
              <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Feather name="alert-circle" size={15} color={c.danger} />
                <AppText variant="label" style={{ color: c.danger, textTransform: 'none', letterSpacing: 0 }}>
                  {error}
                </AppText>
              </View>
            </Appear>
          ) : null}
        </FlowTransition>
      </Reveal>

      <Reveal index={3} style={{ marginTop: 24 }}>
        {/* CTA copy is mode-dependent; crossfade the button on toggle so the label
            doesn't swap in a single frame (SwapText can't wrap PrimaryButton's
            string `label`, so a keyed Appear carries the dip-and-swap). */}
        <Appear key={forgot ?? mode}>
          <PrimaryButton
            label={forgot === 'email' ? 'Email me a code' : forgot === 'code' ? 'Set new password' : isSignup ? 'Create account' : 'Sign in'}
            onPress={forgot ? submitForgot : submit}
            loading={busy}
          />
        </Appear>
        {/* Terms + Privacy acceptance (App Store / Play requirement) - implicit via "by continuing" */}
        <AppText
          variant="caption"
          tone="muted"
          style={{ textAlign: 'center', marginTop: 14, textTransform: 'none', letterSpacing: 0, lineHeight: 17 }}>
          By continuing you agree to our{' '}
          <InlineLink label="Terms" url={TERMS_URL} />
          {' and '}
          <InlineLink label="Privacy Policy" url={PRIVACY_URL} />
          .
        </AppText>
      </Reveal>

      <Reveal index={4} style={{ alignItems: 'center', marginTop: 24 }}>
        <PressableScale
          onPress={() => {
            if (forgot) {
              setForgot(null);
              setFpCode('');
              setFpNew('');
            } else {
              setMode(isSignup ? 'signin' : 'signup');
            }
            setError(null);
          }}
          hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
          accessibilityRole="button"
          dimTo={0.85}
          style={{ paddingVertical: 4 }}>
          <SwapText trigger={forgot ?? mode}>
            <AppText variant="label" tone="muted">
              {forgot ? '' : isSignup ? 'Already have an account? ' : 'New here? '}
              <AppText variant="label" style={{ color: c.textAccent }}>
                {forgot ? 'Back to sign in' : isSignup ? 'Sign in' : 'Create an account'}
              </AppText>
            </AppText>
          </SwapText>
        </PressableScale>
      </Reveal>
    </Screen>
  );
}
