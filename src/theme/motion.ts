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
  press: 140,
  sheet: 240,
  modal: 320,
  screen: 420, // calm cross-fade between screens — slower than the RN default for a settled feel
  breath: 4000,
  // long, deliberate "signature" durations (documented exceptions to the <300ms UI cap):
  draw: 600, // a stroke/check drawing on (authenticity)
  reveal: 900, // a gauge/score filling on its own (sleep summary)
  aura: 4800, // one slow GlowOrb aura ripple. One-shot on appear; if looped it MUST be reduced-motion-guarded + low-amplitude (opacity ≤ ~0.18, scale travel ≤ ~0.35), transform/opacity only.
} as const;

/** Press feedback scale (DESIGN_SYSTEM §4). */
export const PRESS_SCALE = 0.97;

/** Stagger step for list/section entrances (40–60ms). */
export const STAGGER = 50;
