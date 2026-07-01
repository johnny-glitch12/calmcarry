import { Easing } from 'react-native-reanimated';

/**
 * Motion spec — DESIGN_SYSTEM.md §4, tuned for a SLEEP app: motion should feel
 * slow, smooth and unhurried, never snappy. Animate transform + opacity ONLY,
 * on the UI thread (Reanimated worklets). Never animate from scale(0); start
 * scale 0.95 + opacity 0. Entrances glide in gently (gentle easing + generous
 * duration); only direct press feedback stays quick so taps feel responsive.
 * Wrap loops in useReducedMotion().
 */

export const ease = {
  // easeOutCubic — a gentle glide with LOW peak velocity. The old expo curve
  // (0.16,1,0.3,1) whipped in fast then coasted, which reads as "snappy / too
  // fast"; cubic starts softer, so entrances feel smooth and unhurried.
  out: Easing.bezier(0.215, 0.61, 0.355, 1),
  inOut: Easing.bezier(0.42, 0, 0.58, 1), // symmetric easeInOut — gentle at both ends, no mid "snap"
  sine: Easing.inOut(Easing.sin), // breathing
} as const;

export const spring = {
  // Slightly overdamped: settles smoothly with no bounce. Lower stiffness than
  // the old snappy 90 gives a longer, calmer settle.
  damping: 18,
  stiffness: 62,
} as const;

export const dur = {
  press: 160, // press feedback stays snappy so taps feel responsive (never slow this)
  sheet: 400,
  modal: 560,
  screen: 780, // calm cross-fade / entrance — a slow, settled glide (a sleep app should breathe)
  breath: 4800,
  // long, deliberate "signature" durations:
  draw: 1200, // a stroke/line drawing on
  reveal: 1750, // a gauge/curve filling on its own
  aura: 6000, // one slow GlowOrb aura ripple (reduced-motion-guarded when looped; low amplitude)
} as const;

/** Press feedback scale (DESIGN_SYSTEM §4). */
export const PRESS_SCALE = 0.97;

/** Stagger step for list/section entrances — a calm, graceful cascade. */
export const STAGGER = 120;
