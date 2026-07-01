import { Easing } from 'react-native-reanimated';

/**
 * Motion spec — DESIGN_SYSTEM.md §4. RESTRAINT over showiness: motion is subtle,
 * quick and purposeful — enough to feel responsive/alive, never "look at my
 * animation" (that reads as generic AI-app slop). Gentle ease-in-out so nothing
 * snaps, but short durations. Animate transform + opacity ONLY, on the UI thread.
 * No gratuitous always-on loops. Wrap any loop in useReducedMotion().
 */

export const ease = {
  // Smooth easeInOut (sine-like): LOW velocity at BOTH ends, so nothing shoots in
  // or stops abruptly. An easeOut/expo curve starts at max speed — that's what
  // reads as "sudden". This eases gently in AND out, for a slow, unhurried feel.
  out: Easing.bezier(0.37, 0, 0.63, 1),
  inOut: Easing.bezier(0.37, 0, 0.63, 1), // same smooth curve for loops / toggles / slides
  sine: Easing.inOut(Easing.sin), // breathing
} as const;

export const spring = {
  // Gentle + overdamped: settles with no bounce and no snap, but not a drawn-out
  // wobble. Restraint over showiness.
  damping: 18,
  stiffness: 64,
} as const;

export const dur = {
  press: 170, // tap feedback — subtle + responsive
  nav: 260, // route / tab transition — quick + clean, not a showy glide
  sheet: 300,
  modal: 420,
  // Entrance — a subtle, quick settle. NOT a slow showy glide (that reads as
  // "look at my animation" AI-app slop); content should just arrive calmly.
  screen: 460,
  breath: 5000,
  // "signature" durations — kept restrained:
  draw: 950, // a stroke/line drawing on
  reveal: 1100, // a gauge/curve filling on its own
  aura: 6000, // one slow GlowOrb aura ripple (reduced-motion-guarded when looped; low amplitude)
} as const;

/** Press feedback scale (DESIGN_SYSTEM §4). */
export const PRESS_SCALE = 0.97;

/** Stagger step for entrances — a subtle, quick cascade (not a slow theatrical one). */
export const STAGGER = 60;
