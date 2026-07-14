import { type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

type Variant = 'surface' | 'panel';

/**
 * Card - the ONE surface/panel primitive. Before this, the recipe
 * `{ borderRadius, borderWidth, borderColor, backgroundColor, ...shadow }` was
 * copy-pasted inline across ~17 feature files, and the radius drifted (12/16/18/20).
 * Route every content card/panel through here so the rounding + border + shadow
 * language is one thing.
 *
 *  - surface: an elevated content card (white/elevated bg, hairline, teal shadow)
 *  - panel:   a flat accent panel (mint/sage-tinted bg, sage hairline, no shadow)
 *
 * `padding` defaults to 16; `muted` dims to 0.6 (e.g. a pending/optimistic item);
 * `style` passes through for per-use layout (flexDirection, gap, marginTop, …).
 */
export function Card({
  variant = 'surface',
  padding = 16,
  radius = 16,
  muted = false,
  style,
  children,
}: {
  variant?: Variant;
  padding?: number;
  radius?: number;
  muted?: boolean;
  style?: ViewStyle;
  children?: ReactNode;
}) {
  const { c } = useTheme();
  const skin: ViewStyle =
    variant === 'panel'
      ? { backgroundColor: c.panel, borderColor: c.lineSage }
      : { backgroundColor: c.surface, borderColor: c.line, ...c.shadow };
  return (
    <View style={[{ borderRadius: radius, borderWidth: 1, padding, opacity: muted ? 0.6 : 1 }, skin, style]}>
      {children}
    </View>
  );
}
