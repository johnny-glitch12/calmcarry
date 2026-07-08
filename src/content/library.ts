import { type AudioKey } from './audio';
import { type CoverKey } from './covers';

// Broadened toward a BetterSleep-shaped library so the browse rails can scale by
// type. 'soundscape' = nature/ambient scenes; 'music' = instrumental/melodic;
// 'noise' = spectral masking colors. (Frequencies, sleep stories, and ASMR are
// first-classable here too as their real audio is sourced — see SoundsLibrary.)
export type TrackCategory = 'soundscape' | 'music' | 'noise' | 'meditation' | 'story' | 'breathing';

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
  /** one honest sentence: what this is and when to reach for it (shown in the Player) */
  about?: string;
};

export const TRACKS: Record<string, Track> = {
  'slow-tide': { id: 'slow-tide', title: 'Slow Tide', subtitle: 'Ocean swell · low drone', cover: 'slowTide', duration: '20 min', category: 'soundscape', audio: 'ocean',
    about: 'A real ocean recording with a slow, even swell. Good for drifting off, or any moment you want the room to feel bigger and quieter.' },
  rainfall: { id: 'rainfall', title: 'Rainfall on Canvas', subtitle: 'Steady rain · distant thunder', cover: 'rainfall', duration: '45 min', category: 'soundscape', audio: 'rain', locked: true,
    about: 'Steady, unhurried rain with far-off thunder. A favourite for masking street noise while you fall asleep.' },
  forest: { id: 'forest', title: 'Eucalyptus Forest', subtitle: 'Birdsong · soft stream', cover: 'forestStream', duration: 'loops', category: 'soundscape', audio: 'forest', locked: true,
    about: 'Birdsong over a soft stream. Gentler and brighter than rain, suited to daytime resets as much as bedtime.' },
  'box-breathing': { id: 'box-breathing', title: 'Box Breathing', subtitle: 'Breathe with the pulse · 4-4-4-4', cover: 'boxBreathing', duration: '3 min', category: 'breathing', audio: 'guidedBox',
    about: 'A short guided rhythm: in for 4, hold 4, out 4, hold 4, with your Glow Orb in hand. Three minutes to settle a racing moment, day or night.' },
  'deep-rest': { id: 'deep-rest', title: 'Deep Body Relaxation', subtitle: 'Guided · settle the body', cover: 'deepRest', duration: '4 min', category: 'meditation', audio: 'guidedRest', locked: true,
    about: 'A guided sweep of attention from head to toe that lets the body get heavy. Best lying down, lights low.' },
  'letting-go': { id: 'letting-go', title: 'Letting Go of Your Day', subtitle: 'Guided · for busy minds', cover: 'lettingGo', duration: '4 min', category: 'meditation', audio: 'guidedLetGo', locked: true,
    about: 'A short guided wind-down for evenings when the day will not stop replaying. Set the day down before sleep.' },
  // Honest until Glowco supplies real narration: this is a calm OCEAN soundscape for
  // little ones (it plays the ocean bed), NOT a 27-min narrated tale. Loops gently.
  penguin: { id: 'penguin', title: 'Ocean for Little Ones', subtitle: 'Calm ocean waves · ages 4+', cover: 'penguinVoyage', duration: 'loops', category: 'soundscape', audio: 'ocean',
    about: 'The same calm ocean, framed for small ears. Plays gently until you stop it; made for the Kids Mode bedtime.' },
  spa: { id: 'spa', title: 'Spa Piano', subtitle: 'Playlist · soft keys', cover: 'spaMusic', duration: '60 min', category: 'music', audio: 'piano', locked: true,
    about: 'Soft, lyric-free piano. Background calm for reading, unwinding, or easing into the evening.' },
  gymnopedie: { id: 'gymnopedie', title: 'Gymnopédie No. 1', subtitle: 'Erik Satie · solo piano', cover: 'gymnopedie', duration: '3 min', category: 'music', audio: 'gymnopedie',
    about: 'Satie’s slow, famous solo piano piece. Three unhurried minutes; a lovely way to start a wind-down.' },
  shoreline: { id: 'shoreline', title: 'Shoreline', subtitle: 'Waves washing over rock', cover: 'shoreline', duration: 'loops', category: 'soundscape', audio: 'waves', locked: true,
    about: 'Waves breaking close over rock, with more texture than Slow Tide. For when you want the sea near, not distant.' },
  fireside: { id: 'fireside', title: 'Fireside', subtitle: 'A slow, crackling campfire', cover: 'fireside', duration: 'loops', category: 'soundscape', audio: 'fire', locked: true,
    about: 'A real campfire, recorded low and close. Warm company for evenings and slow conversations.' },
  'dawn-chorus': { id: 'dawn-chorus', title: 'Dawn Chorus', subtitle: 'Birdsong · open woodland', cover: 'dawnWoods', duration: 'loops', category: 'soundscape', audio: 'birdsong', locked: true,
    about: 'Early birdsong in open woodland. Brighter than the sleep beds; many use it for gentle mornings and daytime calm.' },
  'brown-noise': { id: 'brown-noise', title: 'Brown Noise', subtitle: 'Deep, even masking', cover: 'brownNoise', duration: 'loops', category: 'noise', audio: 'brown',
    about: 'The deepest of the noise colours: a low, even rumble. Strong at masking traffic, snoring, and hums.' },
  'pink-noise': { id: 'pink-noise', title: 'Pink Noise', subtitle: 'Soft, balanced hush', cover: 'pinkNoise', duration: 'loops', category: 'noise', audio: 'pink', locked: true,
    about: 'A balanced hush between white and brown: softer highs, fuller lows. A comfortable all-night masking bed.' },
  'white-noise': { id: 'white-noise', title: 'White Noise', subtitle: 'Bright, steady cover', cover: 'whiteNoise', duration: 'loops', category: 'noise', audio: 'white', locked: true,
    about: 'Every frequency at once: the brightest, most even cover. Best where sharp, sudden noises are the problem.' },
  // Generated in-house (mid-band emphasis ~ rustling leaves). Cover reuses the
  // forest art until a bespoke green-noise cover is produced.
  'green-noise': { id: 'green-noise', title: 'Green Noise', subtitle: 'Mid-band hush · nature-like', cover: 'forestStream', duration: 'loops', category: 'noise', audio: 'green', locked: true,
    about: 'Noise shaped toward the middle of hearing, closer to wind in leaves than static. A natural-feeling masking bed.' },
  // in-house blends of the real rain/fire/ocean recordings — honest one-tap scenes
  'rain-fire': { id: 'rain-fire', title: 'Rain by the Fire', subtitle: 'Steady rain · a low crackle', cover: 'fireside', duration: 'loops', category: 'soundscape', audio: 'rainFire', locked: true,
    about: 'Our blend of the real rain and campfire recordings: shelter and warmth in one scene.' },
  'rain-ocean': { id: 'rain-ocean', title: 'Rain over the Sea', subtitle: 'Rainfall · slow swell beneath', cover: 'shoreline', duration: 'loops', category: 'soundscape', audio: 'rainOcean', locked: true,
    about: 'Our blend of rainfall over a slow ocean swell: layered, deep, and steady for all-night play.' },
  // new in-house blends + one generated bed (2026-07). Covers reuse existing art
  // until bespoke covers are produced (same precedent as green-noise/rain-fire).
  'rain-forest': { id: 'rain-forest', title: 'Rain in the Forest', subtitle: 'Rainfall through the leaves', cover: 'forestStream', duration: 'loops', category: 'soundscape', audio: 'rainForest', locked: true,
    about: 'Our blend of the real rain and forest recordings: rainfall with birdsong and a soft stream beneath. Sheltered and green.' },
  'beach-fire': { id: 'beach-fire', title: 'Beach Bonfire', subtitle: 'Waves · a close crackle', cover: 'shoreline', duration: 'loops', category: 'soundscape', audio: 'beachFire', locked: true,
    about: 'Our blend of the shoreline and campfire recordings: a small fire close by, the sea a little further out.' },
  'rain-piano': { id: 'rain-piano', title: 'Piano in the Rain', subtitle: 'Soft keys · steady rain', cover: 'rainfall', duration: 'loops', category: 'music', audio: 'rainPiano', locked: true,
    about: 'Soft solo piano over the real rain recording. Music forward, weather behind; a gentle way to end the evening.' },
  fan: { id: 'fan', title: 'Soft Fan', subtitle: 'A steady box-fan hum', cover: 'brownNoise', duration: 'loops', category: 'noise', audio: 'fan', locked: true,
    about: 'A fan hum shaped in-house from brown noise, with the slow wobble of real blades. For everyone who cannot sleep without one.' },
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
