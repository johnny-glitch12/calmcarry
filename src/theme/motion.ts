import { Easing } from 'react-native-reanimated';

/**
 * Motion spec — DESIGN_SYSTEM.md §4, tuned for a SLEEP app: motion should feel
 * slow, smooth and unhurried — NOTHING sudden. Everything eases gently in AND
 * out (low velocity at both ends), never shooting in or snapping to a stop.
 * Animate transform + opacity ONLY, on the UI thread. Never animate from
 * scale(0); start scale 0.95 + opacity 0. Wrap loops in useReducedMotion().
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
  // Very gentle + overdamped: eases to rest slowly with no bounce and no sudden
  // snap. Low stiffness = a long, soft settle.
  damping: 16,
  stiffness: 46,
} as const;

export const dur = {
  press: 220, // tap feedback — soft, not a sudden snap (still connected to the finger)
  nav: 560, // route / tab transition — a slow, deliberate glide (not a quick shift)
  sheet: 480,
  modal: 680,
  // Entrance glide — slow + calm; content eases in, it doesn't appear suddenly.
  screen: 900,
  breath: 5600,
  // long, deliberate "signature" durations:
  draw: 1500, // a stroke/line drawing on
  reveal: 2000, // a gauge/curve filling on its own
  aura: 7000, // one slow GlowOrb aura ripple (reduced-motion-guarded when looped; low amplitude)
} as const;

/** Press feedback scale (DESIGN_SYSTEM §4). */
export const PRESS_SCALE = 0.97;

/** Stagger step for list/section entrances — a slow, graceful cascade. */
export const STAGGER = 130;
