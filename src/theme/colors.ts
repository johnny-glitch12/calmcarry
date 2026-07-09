/**
 * CalmCarry color tokens — LOCKED to The Glow Company brand.
 * Source: theglowcompany.co live brand tokens (see DESIGN_SYSTEM.md §1).
 * Do NOT invent a palette. tailwind.config.js mirrors these hex values.
 */

export const brand = {
  teal: '#426768', // PRIMARY — deep eucalyptus (emphasis, primary text on light)
  tealDeep: '#365B59', // pressed/active teal
  sage: '#74A5A2', // ACCENT — their button/link color; CTAs, active states
  sageHover: '#466D6A', // sage pressed
  mint: '#D3EDEA', // brand mint — hero washes, accent panels
  mintSoft: '#E7F3F0', // lighter mint tint
  cream: '#F2F1EB', // warm neutral background
  slate: '#485453', // brand text (slate-green)
  white: '#FFFFFF',
  coral: '#EF626C', // their sale/alert color — sparing pops ONLY
} as const;

export const light = {
  bg: '#F4F3ED', // cream-white app base
  wash: '#E7F3F0', // soft mint wash (hero tops, section bands)
  surface: '#FFFFFF', // cards
  title: '#2E3F3E', // headings (deep slate-teal)
  text: '#485453', // body
  muted: '#5C6968', // secondary — opaque, clears WCAG AA (4.5:1) on cream/white/mint
  dim: '#5E6968', // hints / labels — darkened to clear WCAG AA on cream AND mint
  line: 'rgba(72,84,83,0.12)', // hairline
  lineSage: 'rgba(116,165,162,0.35)', // accent edges
  ctaBg: '#426768', // deep eucalyptus teal — white label clears WCAG AA (~6.2:1); sage was 2.75:1
  ctaText: '#FFFFFF',
  // gradient stops for the atmospheric mint wash at the top third
  washGradient: ['#E7F3F0', '#F4F3ED'] as const,
  // tinted-to-teal shadow (never gray) — used as RN shadow props
  shadow: {
    shadowColor: '#426768',
    shadowOpacity: 0.1,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
} as const;

export const night = {
  deep: '#0E1817', // lowest surface / scrim / good-night floor (never pure #000)
  base: '#15231F', // screen base
  elevated: '#1E302D', // cards
  surface: 'rgba(255,255,255,0.05)',
  title: '#EAF2EF',
  text: '#9DB7B1',
  muted: '#8FA8A2', // opaque — readable secondary on the dark base
  dim: '#869F99', // raised so chart axis/legend labels clear contrast
  line: 'rgba(255,255,255,0.08)',
  lineSage: 'rgba(143,201,190,0.30)',
  glow: '#8FC9BE', // luminous sage — the orb glow + progress ring on dark
  ctaBg: '#7FB8AD',
  ctaText: '#15302B',
  // night base gradient (top → floor)
  washGradient: ['#162422', '#0E1817'] as const,
  shadow: {
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
} as const;

export type ThemeMode = 'light' | 'night' | 'kids';

// KIDS "cozy dusk" — the kids surface used to just borrow the adult light/night
// palette (clinical cream bg + a near-black card slab = not a kid's bedtime).
// This is its own warm-dusk identity, still on-brand eucalyptus: a deepening
// dusky teal-green sky, warm off-white text, cozy elevated cards (never black),
// a warm PEACH call-to-action + peach-tinted panels, and a soft peach glow
// (added behind the mascot on KidsHome). Warm, snug, magical — clearly bedtime.
export const kidsDusk = {
  deep: '#152A26', // floor / scrim
  base: '#1B302C', // screen base
  elevated: '#33514B', // cozy cards (warm mid-dusk, not a black slab)
  title: '#F2F5ED', // warm off-white
  text: '#CBD8D1',
  muted: '#A8BCB4', // readable warm secondary on dusk
  dim: '#95ABA3',
  line: 'rgba(255,255,255,0.09)',
  lineSage: 'rgba(143,201,190,0.32)',
  glow: '#8FC9BE',
  peach: '#F1C7A3', // the warmth — CTA, stars, the mascot's halo
  ctaBg: '#F1C7A3', // Start button: soft peach, inviting for a child
  ctaText: '#1B302C',
  washGradient: ['#2E4A44', '#1B302C'] as const,
  shadow: {
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
} as const;

/** Shared shape so primitives can read the same keys in either theme. */
export type ThemeColors = {
  bg: string;
  wash: string;
  surface: string;
  title: string;
  text: string;
  muted: string;
  dim: string;
  line: string;
  lineSage: string;
  ctaBg: string;
  ctaText: string;
  /** luminous accent for ICONS/borders/fills (3:1 ok): sage on light, glow on night */
  accent: string;
  /** accent for TEXT — meets WCAG AA 4.5:1: deep teal on light, glow on night */
  textAccent: string;
  /** subtle accent panel bg (mint wash by day, faint sage on dark) */
  panel: string;
  /** prominent accent panel bg (mint by day, sage-tinted elevated on dark) */
  panelStrong: string;
  /** orb fill/glow color */
  orb: string;
  /** error/destructive text+icons — AA-safe per theme (coral fails AA on cream) */
  danger: string;
  washGradient: readonly [string, string];
  shadow: object;
};

export const themes: Record<ThemeMode, ThemeColors> = {
  light: {
    bg: light.bg,
    wash: light.wash,
    surface: light.surface,
    title: light.title,
    text: light.text,
    muted: light.muted,
    dim: light.dim,
    line: light.line,
    lineSage: light.lineSage,
    ctaBg: light.ctaBg,
    ctaText: light.ctaText,
    accent: brand.sage,
    textAccent: brand.teal,
    panel: brand.mintSoft,
    panelStrong: brand.mint,
    orb: brand.sage,
    // brand coral is only ~2.77:1 on cream — darkened red clears WCAG AA by day
    danger: '#B5303A',
    washGradient: light.washGradient,
    shadow: light.shadow,
  },
  night: {
    bg: night.base,
    wash: night.base,
    surface: night.elevated,
    title: night.title,
    text: night.text,
    muted: night.muted,
    dim: night.dim,
    line: night.line,
    lineSage: night.lineSage,
    ctaBg: night.ctaBg,
    ctaText: night.ctaText,
    accent: night.glow,
    textAccent: night.glow,
    panel: 'rgba(143,201,190,0.08)',
    panelStrong: 'rgba(143,201,190,0.14)',
    orb: night.glow,
    danger: brand.coral, // bright coral clears contrast on the dark base
    washGradient: night.washGradient,
    shadow: night.shadow,
  },
  kids: {
    bg: kidsDusk.base,
    wash: '#2E4A44',
    surface: kidsDusk.elevated,
    title: kidsDusk.title,
    text: kidsDusk.text,
    muted: kidsDusk.muted,
    dim: kidsDusk.dim,
    line: kidsDusk.line,
    lineSage: kidsDusk.lineSage,
    ctaBg: kidsDusk.ctaBg,
    ctaText: kidsDusk.ctaText,
    accent: kidsDusk.glow,
    textAccent: '#9AD6C4', // warm luminous sage — headings/kickers pop on dusk
    panel: 'rgba(241,199,163,0.12)', // peach-tinted soft panel (the stars card) — warmth
    panelStrong: 'rgba(241,199,163,0.18)',
    orb: kidsDusk.glow,
    danger: brand.coral,
    washGradient: kidsDusk.washGradient,
    shadow: kidsDusk.shadow,
  },
};
