import { Feather } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, FormField, GlowOrb, Logo, PrimaryButton, Reveal, Screen } from '@/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { brand, useTheme } from '@/theme';

WebBrowser.maybeCompleteAuthSession();

// PLACEHOLDER Google OAuth client ids — set the real ones from Google Cloud Console
// via EXPO_PUBLIC_GOOGLE_* env. Apple needs no key here (uses the app's capability).
const GOOGLE = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? 'PLACEHOLDER.apps.googleusercontent.com',
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? 'PLACEHOLDER.apps.googleusercontent.com',
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? 'PLACEHOLDER.apps.googleusercontent.com',
};
// Only surface the Google button once real client ids are set — never a dead button.
const googleConfigured = !GOOGLE.webClientId.startsWith('PLACEHOLDER');

export function SignIn() {
  const { c } = useTheme();
  const router = useRouter();
  const { signIn, register, socialSignIn } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const isSignup = mode === 'signup';

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  // Sign in with Apple — native iOS only (web/Android: hidden via appleAvailable)
  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  // Sign in with Google (expo-auth-session) — returns an id_token we verify server-side
  const [, googleResponse, googlePrompt] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE.webClientId,
    iosClientId: GOOGLE.iosClientId,
    androidClientId: GOOGLE.androidClientId,
  });

  const social = async (provider: 'apple' | 'google', idToken: string) => {
    setBusy(true);
    setError(null);
    try {
      await socialSignIn(provider, idToken);
      router.replace('/');
    } catch {
      setError('Social sign-in isn’t available yet — try email, or add the provider keys.');
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
      if (cred.identityToken) await social('apple', cred.identityToken);
    } catch {
      /* user cancelled the Apple sheet */
    }
  };

  const submit = async () => {
    if (busy) return;
    if (!email.trim() || !password || (isSignup && !name.trim())) {
      setError('Please fill in every field.');
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
          ? 'We couldn’t create that account — try a different email.'
          : 'That email or password doesn’t look right.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen mode="light" scroll contentStyle={{ paddingTop: 8 }}>
      <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" style={{ alignSelf: 'flex-start' }}>
        <Feather name="x" size={24} color={c.text} />
      </Pressable>

      <Reveal index={0} style={{ alignItems: 'center', marginTop: 24 }}>
        <GlowOrb size={84} reserveGlow aura />
        <Logo size="lg" tagline style={{ marginTop: 14 }} />
        <AppText variant="body" tone="muted" style={{ marginTop: 10, textAlign: 'center' }}>
          {isSignup ? 'Create your Glow account' : 'Sign in to sync your Glow account'}
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
            <Pressable onPress={() => googlePrompt()} accessibilityRole="button" disabled={busy} accessibilityLabel="Continue with Google">
              <View style={{ height: 52, borderRadius: 8, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <Feather name="chrome" size={18} color={c.text} />
                <AppText variant="bodyMedium" tone="title">
                  Continue with Google
                </AppText>
              </View>
            </Pressable>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
            <AppText variant="label" tone="muted">
              or use email
            </AppText>
            <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
          </View>
        </Reveal>
      ) : null}

      <Reveal index={2} style={{ marginTop: 32, gap: 16 }}>
        {isSignup ? (
          <FormField label="Your name" value={name} onChangeText={setName} placeholder="First name" icon="user" autoComplete="name" />
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
        {error ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Feather name="alert-circle" size={15} color={brand.coral} />
            <AppText variant="label" style={{ color: brand.coral, textTransform: 'none', letterSpacing: 0 }}>
              {error}
            </AppText>
          </View>
        ) : null}
      </Reveal>

      <Reveal index={3} style={{ marginTop: 24 }}>
        <PrimaryButton label={isSignup ? 'Create account' : 'Sign in'} onPress={submit} loading={busy} />
      </Reveal>

      <Reveal index={4} style={{ alignItems: 'center', marginTop: 24 }}>
        <Pressable
          onPress={() => {
            setMode(isSignup ? 'signin' : 'signup');
            setError(null);
          }}
          hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
          accessibilityRole="button"
          style={{ paddingVertical: 4 }}>
          <AppText variant="label" tone="muted">
            {isSignup ? 'Already have an account? ' : 'New here? '}
            <AppText variant="label" style={{ color: c.textAccent }}>
              {isSignup ? 'Sign in' : 'Create an account'}
            </AppText>
          </AppText>
        </Pressable>
      </Reveal>
    </Screen>
  );
}
