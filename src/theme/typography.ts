import type { TextStyle } from 'react-native';

/**
 * Typography — The Glow Company design system (build plan §16):
 * HEADINGS = Montserrat, BODY & UI = Poppins. No serif.
 *
 * RN does not synthesize weights reliably, so each style names the exact
 * @expo-google-fonts variant rather than relying on fontWeight.
 */

export const fonts = {
  // Poppins — body & UI
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  // Montserrat — headings & display
  heading: 'Montserrat_600SemiBold',
  display: 'Montserrat_700Bold',
  // dedicated brand-lockup weight (the "calm" wordmark) — heavier than display,
  // used ONLY by the Logo component, never for body/display text.
  logoMark: 'Montserrat_800ExtraBold',
} as const;

/** The font modules to pass to useFonts() in the root layout. */
export const fontMap = {
  Poppins_400Regular: require('@expo-google-fonts/poppins/400Regular/Poppins_400Regular.ttf'),
  Poppins_500Medium: require('@expo-google-fonts/poppins/500Medium/Poppins_500Medium.ttf'),
  Poppins_600SemiBold: require('@expo-google-fonts/poppins/600SemiBold/Poppins_600SemiBold.ttf'),
  Poppins_700Bold: require('@expo-google-fonts/poppins/700Bold/Poppins_700Bold.ttf'),
  Montserrat_600SemiBold: require('@expo-google-fonts/montserrat/600SemiBold/Montserrat_600SemiBold.ttf'),
  Montserrat_700Bold: require('@expo-google-fonts/montserrat/700Bold/Montserrat_700Bold.ttf'),
  Montserrat_800ExtraBold: require('@expo-google-fonts/montserrat/800ExtraBold/Montserrat_800ExtraBold.ttf'),
};

/**
 * Type scale (sp). Headings (display/H1/H2) = Montserrat; everything else =
 * Poppins. Color is applied per-screen from the theme.
 */
export const type = {
  display: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: 0.2,
  },
  h1: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: 0.1,
  },
  h2: {
    fontFamily: fonts.heading,
    fontSize: 20,
    lineHeight: 26,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 26, // ~1.6
  },
  bodyMedium: {
    fontFamily: fonts.medium,
    fontSize: 16,
    lineHeight: 24,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  button: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    letterSpacing: 0.3,
  },
  caption: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.3, // ~0.12em uppercase kicker
    textTransform: 'uppercase',
  },
} satisfies Record<string, TextStyle>;
