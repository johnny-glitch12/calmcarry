import { type ImageSourcePropType } from 'react-native';

/**
 * AI-generated, background-removed illustration icons for the onboarding
 * "what can we help with" options, keyed by goal id. Entries are added as each
 * transparent PNG is produced (nano_banana_pro → background remover → assets).
 * A goal with no entry here falls back to a Feather glyph chip in the funnel, so
 * this map can fill in incrementally without breaking the flow.
 */
export const GOAL_ICONS: Record<string, ImageSourcePropType> = {
  'fall-asleep': require('../../assets/images/onboarding/goal-fall-asleep.png'),
  'stay-asleep': require('../../assets/images/onboarding/goal-stay-asleep.png'),
  'wake-refreshed': require('../../assets/images/onboarding/goal-wake-refreshed.png'),
  'quiet-mind': require('../../assets/images/onboarding/goal-quiet-mind.png'),
  routine: require('../../assets/images/onboarding/goal-routine.png'),
};
