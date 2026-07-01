import { Easing } from 'react-native-reanimated';

/**
 * Motion spec — DESIGN_SYSTEM.md §4 (Emil × Cinema-Mobile × RN-stack).
 * Animate transform + opacity ONLY, on the UI thread (Reanimated worklets).
 * Never animate from scale(0); start scale 0.95 + opacity 0.
 * UI animations < 300ms; exit faster than enter. Wrap loops in useReducedMotion().
 */

export const ease = {
  out: Easing.bezier(0.16, 1, 0.3, 1), // enter / standard
  inOut: Easing.bezier(0.45, 0, 0.55, 1), // symmetric — gentle sine-like, low peak velocity (no mid "snap")
  sine: Easing.inOut(Easing.sin), // breathing
} as const;

export const spring = {
  damping: 20,
  stiffness: 90,
} as const;

export const dur = {
  press: 160, // press feedback stays snappy so taps feel responsive
  sheet: 320,
  modal: 440,
  screen: 640, // calm cross-fade / entrance — slow + settled (a sleep app should breathe)
  breath: 4200,
  // long, deliberate "signature" durations:
  draw: 950, // a stroke/line drawing on
  reveal: 1400, // a gauge/curve filling on its own
  aura: 5200, // one slow GlowOrb aura ripple (reduced-motion-guarded when looped; low amplitude)
} as const;

/** Press feedback scale (DESIGN_SYSTEM §4). */
export const PRESS_SCALE = 0.97;

/** Stagger step for list/section entrances — a calm, noticeable cascade. */
export const STAGGER = 90;
