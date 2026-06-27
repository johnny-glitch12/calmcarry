import '../global.css';

import { useFonts } from 'expo-font';
import { Redirect, Stack, usePathname, useRootNavigationState, useRouter, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/features/auth/AuthProvider';
import { ProfileProvider, useProfile } from '@/features/profile/ProfileProvider';
import { startAnalytics, track } from '@/lib/analytics';
import { captureError, initMonitoring } from '@/lib/monitoring';
import { getOnboarded } from '@/lib/onboarding';
import { ColorSchemeProvider, dur, fontMap, ThemeProvider, useColorSchemePref } from '@/theme';

initMonitoring(); // native: Sentry (gated on a real DSN); web: no-op
SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * App-wide error boundary (expo-router). A render crash anywhere shows this calm
 * retry screen instead of a white screen, and reports the error to monitoring.
 * Uses plain RN primitives + literal brand colours so it works even if the theme
 * or fonts were the thing that failed.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  captureError(error);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#D3EDEA' }}>
      <Text style={{ fontSize: 20, fontWeight: '600', color: '#485453', textAlign: 'center', marginBottom: 8 }}>
        Let’s take a breath
      </Text>
      <Text style={{ fontSize: 15, color: '#5C6968', textAlign: 'center', marginBottom: 28, lineHeight: 22, maxWidth: 300 }}>
        Something hiccuped on our end. Nothing you did — let’s try that again.
      </Text>
      <Pressable
        onPress={retry}
        accessibilityRole="button"
        accessibilityLabel="Try again"
        style={{ backgroundColor: '#426768', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 8 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Try again</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ColorSchemeProvider>
        <RootTheme>
          <AuthProvider>
            <ProfileProvider>
              <SafeAreaProvider>
                <RootNav />
              </SafeAreaProvider>
            </ProfileProvider>
          </AuthProvider>
        </RootTheme>
      </ColorSchemeProvider>
    </GestureHandlerRootView>
  );
}

/** Root theme context = the user's resolved appearance (light by day / dark for
 *  sleep). Without this, a screen body's useTheme() (which runs ABOVE its own
 *  <Screen>'s ThemeProvider) would fall back to the default light context and
 *  paint light surfaces under dark-mode text. Per-screen <Screen mode> still
 *  overrides this for the sleep screens. */
function RootTheme({ children }: { children: ReactNode }) {
  const { effective } = useColorSchemePref();
  return <ThemeProvider mode={effective}>{children}</ThemeProvider>;
}

// The ONLY routes reachable while a child profile is active. Everything else
// (settings, billing, store, community, search, programs, learn) is an adult
// surface — kids mode redirects to home. The parent gate is the sole exit.
const KID_ALLOWED = ['/', '/sounds', '/listen', '/player', '/parent-gate'];

/** Authoritative child-safety guard — not just tab filtering. Blocks every
 *  adult route (in-app push OR deep link) whenever a kid profile is active. */
function KidsGuard() {
  const { mode, hydrated } = useProfile();
  const pathname = usePathname();
  // synchronous redirect during render — an adult route can't paint a frame in Kids mode
  if (hydrated && mode === 'kids' && !KID_ALLOWED.includes(pathname)) {
    return <Redirect href="/" />;
  }
  return null;
}

function RootNav() {
  const [fontsLoaded, fontError] = useFonts(fontMap);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const { hydrated: schemeHydrated } = useColorSchemePref();
  const { hydrated: profileHydrated, mode } = useProfile();
  const router = useRouter();
  const navState = useRootNavigationState();
  const didRedirect = useRef(false);

  useEffect(() => {
    getOnboarded().then(setOnboarded);
    startAnalytics(); // load the durable event buffer + attach the background-flush hook
  }, []);

  // §15 funnel top — fire ONLY once the active profile is known AND it isn't a kid.
  // Guarding on `mode` at the call site is race-proof (it doesn't depend on the
  // ProfileProvider→setAnalyticsMode effect having run yet), so a child profile's
  // open is never recorded (COPPA). openedRef keeps it to a single fire.
  const openedRef = useRef(false);
  useEffect(() => {
    if (profileHydrated && mode !== 'kids' && !openedRef.current) {
      openedRef.current = true;
      track('app_open');
    }
  }, [profileHydrated, mode]);

  // On native, hold the splash until we know the route + theme + ACTIVE PROFILE so
  // first paint is correct. Waiting on profile hydration is a child-safety gate:
  // it stops an adult frame painting before a persisted KID profile is restored.
  // On web (SSR/preview) render as soon as fonts are ready so HTML isn't blank.
  const ready =
    (fontsLoaded || fontError) &&
    (Platform.OS === 'web' || (onboarded !== null && schemeHydrated && profileHydrated));

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // first run → onboarding, exactly once, after the navigator mounts
  useEffect(() => {
    if (!navState?.key || didRedirect.current) return;
    if (onboarded === false) {
      didRedirect.current = true;
      router.replace('/onboarding');
    }
  }, [navState?.key, onboarded, router]);

  if (!ready) {
    return null;
  }

  return (
    <>
      <KidsGuard />
      {/* default = a slow, calm cross-fade between screens (§4 calm motion) */}
      <Stack screenOptions={{ headerShown: false, animation: 'fade', animationDuration: dur.screen }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      {/* wind-down rises like a player expanding from the mini-player (§4 stand-in) */}
      <Stack.Screen
        name="wind-down"
        options={{ presentation: 'modal', animation: 'slide_from_bottom', animationDuration: dur.modal, gestureEnabled: true }}
      />
      {/* content player — rises like the wind-down */}
      <Stack.Screen
        name="player"
        options={{ presentation: 'modal', animation: 'slide_from_bottom', animationDuration: dur.modal, gestureEnabled: true }}
      />
      {/* card-push drill-downs */}
      <Stack.Screen name="device" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
      <Stack.Screen name="authenticity" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
      <Stack.Screen name="claim-device" options={{ animation: 'slide_from_right', gestureEnabled: false }} />
      <Stack.Screen name="register-device" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
      <Stack.Screen name="replacement-claim" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
      <Stack.Screen name="shop" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
      <Stack.Screen name="about" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
      <Stack.Screen name="parent-gate" options={{ presentation: 'modal', animation: 'slide_from_bottom', animationDuration: dur.modal }} />
      <Stack.Screen name="program" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
      <Stack.Screen name="learn" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
      <Stack.Screen name="learn-article" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
      <Stack.Screen name="watch" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
      <Stack.Screen name="family" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
      <Stack.Screen name="caregivers" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
      <Stack.Screen name="search" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
      {/* full takeovers */}
      <Stack.Screen name="survey" options={{ animation: 'fade', animationDuration: dur.modal }} />
      <Stack.Screen name="check-in" options={{ animation: 'fade', animationDuration: dur.modal }} />
      <Stack.Screen name="auth" options={{ presentation: 'modal', animation: 'slide_from_bottom', animationDuration: dur.modal }} />
      <Stack.Screen name="unlock" options={{ presentation: 'modal', animation: 'slide_from_bottom', animationDuration: dur.modal, gestureEnabled: true }} />
      </Stack>
    </>
  );
}
