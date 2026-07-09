import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { brand, CONTENT_MAX, ThemeProvider, themes, useColorSchemePref, useResponsive, type ThemeMode } from '@/theme';

type Props = {
  /** 'night' = forced night; 'day' = forced light (KIDS daytime only); 'light' =
   *  the adaptive surface — which is night-first, i.e. always night for adults. */
  mode?: ThemeMode | 'day';
  scroll?: boolean;
  children: ReactNode;
  contentStyle?: ViewStyle;
  /** full-screen layer rendered ABOVE the body (e.g. the wind-down dim scrim) */
  overlay?: ReactNode;
  /** full-bleed layer rendered UNDER the body but over the base gradient — the
   *  immersive-scene slot (e.g. the player's full-bleed artwork + scrim) */
  backdrop?: ReactNode;
  /** bottom inset so content clears the floating tab bar */
  tabBarSpacing?: boolean;
  /** grid-heavy screens (Library, Listen, Community) get the WIDER content frame
   *  so tile grids have room for extra columns on tablets; default is the narrow
   *  reading/form column. Both are centered on wide screens. */
  wide?: boolean;
};

/** A soft, STATIC pool of light for atmospheric depth (§3) — sage at night, a
 *  barely perceptible mint by day. Deliberately NOT animated: a drifting-blob +
 *  floating-mote field reads as generic AI-app slop and runs a loop every frame;
 *  a still, soft wash of light is calmer, more premium, and costs nothing. */
function DriftBlob({ size, color, top, left, opacity = 0.1 }: {
  size: number;
  color: string;
  top: number;
  left: number;
  // accepted + ignored so existing call sites don't need editing
  delay?: number;
  range?: number;
  duration?: number;
  opacity?: number;
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top,
        left,
        opacity,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
      }}
    />
  );
}

/**
 * Screen — the foundation. Sets the per-screen theme and paints the
 * atmospheric background: a soft mint wash on light, a deep-eucalyptus gradient
 * with drifting sage blobs on night (DESIGN_SYSTEM §3). Gradients are
 * background-only, never on every card (§7).
 */
export function Screen({ mode = 'light', scroll, children, contentStyle, overlay, backdrop, tabBarSpacing, wide }: Props) {
  // Sleep screens force 'night'; everything else is ADAPTIVE — follows the
  // user's appearance preference (light by day, or dark when dark mode is on).
  const { effective } = useColorSchemePref();
  const resolved: ThemeMode =
    mode === 'night' ? 'night' : mode === 'kids' ? 'kids' : mode === 'day' ? 'light' : effective;
  const c = themes[resolved];
  const isNight = resolved === 'night';
  const isKids = resolved === 'kids';
  // kids "cozy dusk" is a dark surface (its own warm gradient) — treat it like
  // night for the gradient + light status bar, but paint a WARM peach+sage
  // ambient glow instead of the cold night blobs.
  const isDark = isNight || isKids;
  const { isTablet, gutter } = useResponsive();
  const padBottom = tabBarSpacing ? 108 : 24;
  const padH = isTablet ? gutter : 24;
  // TABLET: cap the content column and centre it so text/cards never edge-stretch
  // on a wide screen (the Calm/Headspace pattern), instead of a phone layout
  // spanning an iPad. Grid screens get the wider frame. Phones are unaffected
  // (their width is always below the cap). alignSelf centres the column; the
  // atmospheric gradient + any backdrop still fill the whole screen behind it.
  const columnMax = wide ? CONTENT_MAX.wide : CONTENT_MAX.column;
  const columnStyle: ViewStyle = { width: '100%', maxWidth: columnMax, alignSelf: 'center' };

  // Top clearance: the real device inset (notch / Dynamic Island / camera) plus a
  // calm floor so no-notch devices and in-browser views still breathe. We own the
  // top padding here (not via a SafeAreaView 'top' edge) so a screen's own
  // contentStyle.paddingTop can't accidentally erase the camera clearance.
  const insets = useSafeAreaInsets();
  // clear the notch / Dynamic Island AND leave a calm gap below it — +8 landed
  // headings hard against the island on Dynamic-Island devices (read as "cut off").
  const topInset = Math.max(insets.top, 12) + 16;

  const body = (
    <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
      {/* lift content above the on-screen keyboard so inputs + submit buttons stay visible */}
      <KeyboardAvoidingView
        style={{ flex: 1, paddingTop: topInset }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerStyle={[
              { paddingHorizontal: padH, paddingTop: 0, paddingBottom: padBottom },
              columnStyle,
              contentStyle,
            ]}>
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1, paddingHorizontal: padH, paddingTop: 0 }, columnStyle, contentStyle]}>
            {children}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  return (
    <ThemeProvider mode={resolved}>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {/* atmospheric background */}
        <LinearGradient
          colors={isDark ? c.washGradient : [c.wash, c.bg]}
          locations={isDark ? [0, 1] : [0, 0.38]}
          style={StyleSheet.absoluteFill}
        />
        {isKids ? (
          // warm cozy-dusk glow — a soft peach halo up top + a gentle sage pool,
          // so the kids sky feels warm and lit, not a flat dark panel
          <>
            <DriftBlob size={340} color="#F1C7A3" top={-120} left={-40} opacity={0.13} />
            <DriftBlob size={240} color="#8FC9BE" top={300} left={200} opacity={0.08} />
            <DriftBlob size={180} color="#F1C7A3" top={560} left={-60} opacity={0.06} />
          </>
        ) : isNight ? (
          <>
            <DriftBlob size={260} color="#8FC9BE" top={-40} left={-60} />
            <DriftBlob size={200} color="#6FB4A8" top={320} left={220} />
            <DriftBlob size={160} color="#5E9C92" top={560} left={-40} />
          </>
        ) : (
          // barely-perceptible daytime drift so light mode isn't motion-dead (§7: atmosphere only)
          <>
            <DriftBlob
              size={300}
              color={brand.mint}
              top={-80}
              left={-90}
              range={22}
              duration={26000}
              opacity={0.05}
            />
            <DriftBlob
              size={220}
              color={brand.mintSoft}
              top={120}
              left={210}
              delay={4000}
              range={18}
              duration={28000}
              opacity={0.045}
            />
          </>
        )}
        {/* immersive-scene slot — full-bleed under the content, over the base wash */}
        {backdrop}
        {body}
        {overlay}
      </View>
    </ThemeProvider>
  );
}
