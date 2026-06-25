import { Image } from 'expo-image';
import { View, type ViewStyle } from 'react-native';

import { brand, useTheme } from '@/theme';

import { AppText } from './AppText';

// The official CalmCarry wordmark (The Glow Company). Sage on light surfaces,
// white on the night theme. Trimmed from the supplied brand PNG; aspect 1000:566.
const WORDMARK_SAGE = require('../../assets/brand/wordmark-sage.png');
const WORDMARK_WHITE = require('../../assets/brand/wordmark-white.png');
const ASPECT = 566 / 1000;

type Size = 'sm' | 'md' | 'lg';
const WIDTH: Record<Size, number> = { sm: 96, md: 132, lg: 184 };

/**
 * The CalmCarry brand lockup — the real "calm CARRY™" wordmark, theme-aware so
 * it reads cleanly on both the cream day theme and the deep-eucalyptus night
 * theme. Optional "by The Glow Company" tagline beneath.
 */
export function Logo({
  size = 'md',
  tagline = false,
  style,
}: {
  size?: Size;
  tagline?: boolean;
  style?: ViewStyle;
}) {
  const { isNight } = useTheme();
  const w = WIDTH[size];
  const h = Math.round(w * ASPECT);
  return (
    <View style={[{ alignItems: 'center' }, style]}>
      <Image
        source={isNight ? WORDMARK_WHITE : WORDMARK_SAGE}
        style={{ width: w, height: h }}
        contentFit="contain"
        transition={0}
        accessible
        accessibilityLabel="CalmCarry"
        accessibilityIgnoresInvertColors
      />
      {tagline ? (
        <AppText
          variant="caption"
          tone="muted"
          style={{ marginTop: 6, letterSpacing: 1.2, color: isNight ? brand.sage : brand.sageHover }}>
          BY THE GLOW COMPANY
        </AppText>
      ) : null}
    </View>
  );
}
