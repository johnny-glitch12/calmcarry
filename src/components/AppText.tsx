import { Text, type TextProps } from 'react-native';

import { type as typeScale, useTheme } from '@/theme';

type Variant = keyof typeof typeScale;
type Tone = 'title' | 'text' | 'muted' | 'dim' | 'accent' | 'cta';

/**
 * The single text primitive. Enforces §7 type discipline: two families
 * (Montserrat headings / Poppins body), a deliberate scale, color from the theme.
 * Use this everywhere instead of bare <Text> so typography stays consistent.
 */
export function AppText({
  variant = 'body',
  tone = 'text',
  style,
  ...props
}: TextProps & { variant?: Variant; tone?: Tone }) {
  const { c } = useTheme();
  const toneColor: Record<Tone, string> = {
    title: c.title,
    text: c.text,
    muted: c.muted,
    dim: c.dim,
    accent: c.textAccent, // text-accent meets WCAG AA; c.accent stays for icons/fills
    cta: c.ctaText,
  };
  return <Text {...props} style={[typeScale[variant], { color: toneColor[tone] }, style]} />;
}
