import { type AudioKey } from './audio';
import { type CoverKey } from './covers';

export type TrackCategory = 'soundscape' | 'meditation' | 'story' | 'breathing';

export type Track = {
  id: string;
  title: string;
  subtitle: string;
  cover: CoverKey;
  duration: string;
  category: TrackCategory;
  /** which bundled audio file plays for this track */
  audio: AudioKey;
  /** paid — unlocked by the Calm Plan bundle (no in-app purchase) */
  locked?: boolean;
};

export const TRACKS: Record<string, Track> = {
  'slow-tide': { id: 'slow-tide', title: 'Slow Tide', subtitle: 'Ocean swell · low drone', cover: 'slowTide', duration: '20 min', category: 'soundscape', audio: 'ocean' },
  rainfall: { id: 'rainfall', title: 'Rainfall on Canvas', subtitle: 'Steady rain · distant thunder', cover: 'rainfall', duration: '45 min', category: 'soundscape', audio: 'rain', locked: true },
  forest: { id: 'forest', title: 'Eucalyptus Forest', subtitle: 'Birdsong · soft stream', cover: 'forestStream', duration: 'loops', category: 'soundscape', audio: 'forest', locked: true },
  'box-breathing': { id: 'box-breathing', title: 'Box Breathing', subtitle: 'Breathe with the pulse · 4-4-4-4', cover: 'boxBreathing', duration: '3 min', category: 'breathing', audio: 'guidedBox' },
  'deep-rest': { id: 'deep-rest', title: 'Deep Body Relaxation', subtitle: 'Guided · settle the body', cover: 'deepRest', duration: '4 min', category: 'meditation', audio: 'guidedRest', locked: true },
  'letting-go': { id: 'letting-go', title: 'Letting Go of Your Day', subtitle: 'Guided · for busy minds', cover: 'lettingGo', duration: '4 min', category: 'meditation', audio: 'guidedLetGo', locked: true },
  // Honest until Glowco supplies real narration: this is a calm OCEAN soundscape for
  // little ones (it plays the ocean bed), NOT a 27-min narrated tale. Loops gently.
  penguin: { id: 'penguin', title: "A Penguin's Ocean", subtitle: 'Calm ocean · ages 4+', cover: 'penguinVoyage', duration: 'loops', category: 'soundscape', audio: 'ocean' },
  spa: { id: 'spa', title: 'Spa Piano', subtitle: 'Playlist · soft keys', cover: 'spaMusic', duration: '60 min', category: 'soundscape', audio: 'piano', locked: true },
  gymnopedie: { id: 'gymnopedie', title: 'Gymnopédie No. 1', subtitle: 'Erik Satie · solo piano', cover: 'gymnopedie', duration: '3 min', category: 'soundscape', audio: 'gymnopedie' },
  shoreline: { id: 'shoreline', title: 'Shoreline', subtitle: 'Waves washing over rock', cover: 'shoreline', duration: 'loops', category: 'soundscape', audio: 'waves', locked: true },
  fireside: { id: 'fireside', title: 'Fireside', subtitle: 'A slow, crackling campfire', cover: 'fireside', duration: 'loops', category: 'soundscape', audio: 'fire', locked: true },
  'dawn-chorus': { id: 'dawn-chorus', title: 'Dawn Chorus', subtitle: 'Birdsong · open woodland', cover: 'dawnWoods', duration: 'loops', category: 'soundscape', audio: 'birdsong', locked: true },
  'brown-noise': { id: 'brown-noise', title: 'Brown Noise', subtitle: 'Deep, even masking', cover: 'brownNoise', duration: 'loops', category: 'soundscape', audio: 'brown' },
  'pink-noise': { id: 'pink-noise', title: 'Pink Noise', subtitle: 'Soft, balanced hush', cover: 'pinkNoise', duration: 'loops', category: 'soundscape', audio: 'pink', locked: true },
  'white-noise': { id: 'white-noise', title: 'White Noise', subtitle: 'Bright, steady cover', cover: 'whiteNoise', duration: 'loops', category: 'soundscape', audio: 'white', locked: true },
};

export type Program = {
  id: string;
  title: string;
  subtitle: string;
  cover: CoverKey;
  weeks: number;
  /** the avatar this reset is mapped to (build plan §4) */
  avatar: string;
  steps: { day: number; title: string; trackId?: string }[];
  locked?: boolean;
};

export const PROGRAMS: Record<string, Program> = {
  // The free starter arc — leads the rail and is composed ENTIRELY of free tracks
  // so a free-tier newcomer can finish all 7 nights without ever hitting the paywall
  // (the honest "earn trust first" answer to BetterSleep gating its onboarding).
  'first-week': {
    id: 'first-week',
    title: 'Your first 7 nights',
    subtitle: 'A gentle, free place to start',
    cover: 'slowTide',
    weeks: 1,
    avatar: 'newcomers',
    steps: [
      { day: 1, title: 'Meet your wind-down', trackId: 'slow-tide' },
      { day: 2, title: 'Slow the spin', trackId: 'box-breathing' },
      { day: 3, title: 'A soft, even hush', trackId: 'brown-noise' },
      { day: 4, title: 'A gentle ocean to drift', trackId: 'penguin' },
      { day: 5, title: 'Something quietly beautiful', trackId: 'gymnopedie' },
      { day: 6, title: 'Steady cover for a busy mind', trackId: 'brown-noise' },
      { day: 7, title: 'Make it your ritual', trackId: 'slow-tide' },
    ],
  },
  'night-reset': {
    id: 'night-reset',
    title: 'The 3 a.m. Reset',
    subtitle: 'Settle the wake-ups',
    cover: 'slowTide',
    weeks: 2,
    avatar: '3 a.m. parent',
    locked: true,
    steps: [
      { day: 1, title: 'Meet the wind-down', trackId: 'slow-tide' },
      { day: 2, title: 'Letting the day go', trackId: 'letting-go' },
      { day: 3, title: 'Back-to-sleep breathing', trackId: 'box-breathing' },
      { day: 4, title: 'Deep body settle', trackId: 'deep-rest' },
      { day: 5, title: 'A longer drift', trackId: 'rainfall' },
    ],
  },
  'after-school': {
    id: 'after-school',
    title: 'After-school Decompress',
    subtitle: 'A gentle landing',
    cover: 'forestStream',
    weeks: 1,
    avatar: 'Carer · kids',
    locked: true,
    steps: [
      { day: 1, title: 'Shake off the day', trackId: 'forest' },
      { day: 2, title: 'Breathing with the pulse', trackId: 'box-breathing' },
      { day: 3, title: 'A gentle ocean wind-down', trackId: 'penguin' },
    ],
  },
  'evening-ritual': {
    id: 'evening-ritual',
    title: 'Evening Wind-down',
    subtitle: 'A gentler evening rhythm',
    cover: 'deepRest',
    weeks: 3,
    avatar: 'routine-builder',
    locked: true,
    steps: [
      { day: 1, title: 'Set the ritual', trackId: 'deep-rest' },
      { day: 2, title: 'Quiet the busy mind', trackId: 'letting-go' },
      { day: 3, title: 'Ocean to sleep', trackId: 'slow-tide' },
    ],
  },
};

export type Article = {
  id: string;
  title: string;
  kicker: string;
  readMins: number;
  cover?: CoverKey;
  body: string[];
  /** optional short clip (build plan §6 "watch & learn"). When present the article
   *  offers a real video player. PLACEHOLDER source today — Glowco supplies finals. */
  videoUrl?: string;
};

/** Required wherever wellness content appears (build plan §10). */
export const WELLNESS_DISCLAIMER =
  'This product is not intended to diagnose, treat, cure, or prevent any disease. Individual results may vary. Consult your healthcare provider before use if you have a medical condition.';

export const LEARN: Record<string, Article> = {
  'first-20': {
    id: 'first-20',
    title: 'Your first 20 minutes',
    kicker: 'How to use',
    readMins: 3,
    cover: 'slowTide',
    // The "watch & learn" video is intentionally omitted until Glowco supplies real
    // footage — we never ship a placeholder/stock clip. Shown as a short read for now.
    body: [
      'Find a comfortable spot, rest your Glow Orb in your palm at a level that feels good, and start a wind-down. Most people notice their shoulders drop and their breathing slow within the first few minutes.',
      'There is nothing to do and nothing to get right. Let the sound carry you. If your mind is busy, that is normal. Just keep returning to the warmth in your hand.',
      'Used a little each evening, the ritual becomes a cue your body learns to recognise: this is the part of the day where we let go.',
    ],
  },
  pc8: {
    id: 'pc8',
    title: 'The point in your palm',
    kicker: 'How it works',
    readMins: 4,
    cover: 'boxBreathing',
    body: [
      'CalmCarry rests against a point in the centre of your palm that calming traditions have turned to for a very long time.',
      'It sends a gentle pulsing (a soft tingling you feel in your palm) that gives your attention something simple and physical to settle on, which helps a busy evening mind find a slower rhythm.',
      'It works beautifully alongside a wind-down session, so your senses (touch, sound, and breath) are all pointing the same calm direction. Set it to a level that feels comfortable and rest it in your palm.',
    ],
  },
  routine: {
    id: 'routine',
    title: 'Building a wind-down routine',
    kicker: 'Ritual',
    readMins: 3,
    cover: 'forestStream',
    body: [
      'Pick a consistent time, dim the lights, and put screens away a little earlier than feels necessary. The routine matters more than any single night.',
      'Pair the Glow Orb with the same sound for a week and your evenings start to run on rails. The cue does the work so you do not have to.',
      'If a night does not settle, let it go. The point is the gentle return, not a perfect score.',
    ],
  },
};
