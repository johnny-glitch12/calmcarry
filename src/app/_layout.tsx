import '../global.css';

import { Feather } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Redirect, Stack, usePathname, useRootNavigationState, useRouter, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BrandSplash } from '@/components';
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
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  captureError(error);
  return <ErrorScreen retry={retry} />;
}

/**
 * The retry screen fades in (a hard cut at a moment the app is already jarring
 * would compound it) and its button answers the finger with a soft press-scale.
 * Deliberately self-contained: only reanimated core + literal values, so it stays
 * independent of the theme/fonts that may have been what failed.
 */
function ErrorScreen({ retry }: { retry: () => void }) {
  const reduced = useReducedMotion();
  const mount = useSharedValue(reduced ? 1 : 0);
  const press = useSharedValue(1);
  useEffect(() => {
    if (!reduced) mount.value = withTiming(1, { duration: 460, easing: Easing.out(Easing.cubic) });
  }, [reduced, mount]);
  const fade = useAnimatedStyle(() => ({ opacity: mount.value }));
  const btn = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  const drive = (to: number) => {
    if (!reduced) press.value = withTiming(to, { duration: 150, easing: Easing.out(Easing.cubic) });
  };
  return (
    <Animated.View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#D3EDEA' }, fade]}>
      <Text style={{ fontSize: 20, fontWeight: '600', color: '#485453', textAlign: 'center', marginBottom: 8 }}>
        Let’s take a breath
      </Text>
      <Text style={{ fontSize: 15, color: '#5C6968', textAlign: 'center', marginBottom: 28, lineHeight: 22, maxWidth: 300 }}>
        Something hiccuped on our end. Nothing you did. Let’s try that again.
      </Text>
      <AnimatedPressable
        onPress={retry}
        onPressIn={() => drive(0.96)}
        onPressOut={() => drive(1)}
        accessibilityRole="button"
        accessibilityLabel="Try again"
        style={[{ backgroundColor: '#426768', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 8 }, btn]}>
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Try again</Text>
      </AnimatedPressable>
    </Animated.View>
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
  // Load Feather's glyph font through expo-font (not @expo/vector-icons' own web
  // loader, which doesn't respect the export base path) so icons render in the
  // static /app build instead of falling back to tofu squares.
  const [fontsLoaded, fontError] = useFonts({ ...fontMap, ...Feather.font });
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  // the CalmCarry brand reveal plays once per cold start, over the first route
  const [showBrand, setShowBrand] = useState(true);
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
      {/* default = a calm cross-fade between screens — unhurried (dur.modal) so a
          scene change doesn't snap; still well short of a crawling glide */}
      <Stack screenOptions={{ headerShown: false, animation: 'fade', animationDuration: dur.modal }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      {/* wind-down rises like a player expanding from the mini-player (§4 stand-in).
          gestureEnabled OFF: the screen's own DragDismiss pan (finger-tracking,
          velocity release) is the single dismissal system — no double gesture. */}
      <Stack.Screen
        name="wind-down"
        options={{ presentation: 'modal', animation: 'slide_from_bottom', animationDuration: dur.modal, gestureEnabled: false }}
      />
      {/* content player — rises like the wind-down */}
      <Stack.Screen
        name="player"
        options={{ presentation: 'modal', animation: 'slide_from_bottom', animationDuration: dur.modal, gestureEnabled: false }}
      />
      {/* card-push drill-downs */}
      <Stack.Screen name="device" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
      <Stack.Screen name="authenticity" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
      <Stack.Screen name="claim-device" options={{ animation: 'slide_from_right', gestureEnabled: false }} />
      <Stack.Screen name="register-device" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
      <Stack.Screen name="replacement-claim" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
      <Stack.Screen name="shop" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
      <Stack.Screen name="about" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
      <Stack.Screen name="voice" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
      <Stack.Screen name="privacy" options={{ animation: 'slide_from_right', gestureEnabled: true }} />
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
      {/* CalmCarry brand reveal — overlays the first route on cold start, then fades */}
      {showBrand ? <BrandSplash onDone={() => setShowBrand(false)} /> : null}
    </>
  );
}
