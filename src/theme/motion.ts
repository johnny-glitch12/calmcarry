import { Easing } from 'react-native-reanimated';

/**
 * Motion spec - DESIGN_SYSTEM.md §4, tuned to design-engineering craft:
 * RESTRAINT over showiness (few signature moments, stillness elsewhere), but
 * RESPONSIVENESS in every interaction. The core insight: users watch the START
 * of an animation most closely - a slow start reads as lag, not calm. So
 * everything leads with movement (ease-out) and gets its calm from the long,
 * soft DECELERATION, never from a sluggish attack.
 *
 * Rules: transform + opacity ONLY, on the UI thread. Exit faster than enter
 * (~2/3). Never scale(0) - start ≥0.95 + opacity 0. Frequency governs presence:
 * actions felt dozens of times a day animate minimally (press = fast feedback
 * only); occasional moments (modals, entrances) get the standard treatment;
 * rare moments (splash, reveal) may take their time. No gratuitous always-on
 * loops; wrap any loop in useReducedMotion().
 */

export const ease = {
  // Interaction feedback (press, toggles, instant UI response): a STRONG
  // ease-out - moves immediately, settles fast. The interface answers the
  // finger with zero perceived latency.
  press: Easing.bezier(0.23, 1, 0.32, 1),
  // Entrances / reveals: easeOutCubic - leads with visible movement (no
  // sluggish attack) then decelerates long and soft. Calm lives in the landing.
  out: Easing.bezier(0.215, 0.61, 0.355, 1),
  // On-screen movement between two visible states (slides, morphs, cross-moves):
  // symmetric in-out, gentle at both ends.
  inOut: Easing.bezier(0.45, 0, 0.55, 1),
  sine: Easing.inOut(Easing.sin), // breathing
} as const;

export const spring = {
  // Gentle + overdamped: settles with no bounce and no snap, but not a drawn-out
  // wobble. Restraint over showiness.
  damping: 18,
  stiffness: 64,
} as const;

export const dur = {
  press: 150, // tap feedback - instant-feeling (100–160ms band)
  exit: 200, // leaving states (fade-outs, dismissals) - always quicker than arrival
  nav: 260, // route / tab transition - quick + clean, not a showy glide
  sheet: 300,
  modal: 420,
  // Entrance - arrives promptly, lands softly. Calm ≠ slow to start.
  screen: 460,
  breath: 5000,
  // "signature" durations - kept restrained:
  draw: 950, // a stroke/line drawing on
  reveal: 1100, // a gauge/curve filling on its own
  aura: 6000, // one slow GlowOrb aura ripple (reduced-motion-guarded when looped; low amplitude)
} as const;

/** Press feedback scale (DESIGN_SYSTEM §4). */
export const PRESS_SCALE = 0.97;

/** Stagger step for entrances - a subtle, quick cascade (30–80ms band). */
export const STAGGER = 60;
