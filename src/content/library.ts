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

  // ---- 2026-07 expansion: fans & hums (all synthesized in-house) ----
  'ceiling-fan': { id: 'ceiling-fan', title: 'Ceiling Fan', subtitle: 'A slow, deeper turn', cover: 'brownNoise', duration: 'loops', category: 'noise', audio: 'ceilingFan', locked: true,
    about: 'A slower, deeper fan than Soft Fan, shaped in-house. The lazy turn of blades overhead on a warm night.' },
  'desk-fan': { id: 'desk-fan', title: 'Desk Fan', subtitle: 'Small, quick, and bright', cover: 'whiteNoise', duration: 'loops', category: 'noise', audio: 'deskFan', locked: true,
    about: 'A small fast fan close by, shaped in-house. Brighter and busier than the big fans; good for masking chatter.' },
  'airplane-cabin': { id: 'airplane-cabin', title: 'Airplane Cabin', subtitle: 'Cruise-altitude hush', cover: 'pinkNoise', duration: 'loops', category: 'noise', audio: 'airplaneCabin', locked: true,
    about: 'The deep, even rush of a cabin at cruising altitude, built in-house. Many people sleep better on planes; this is why.' },
  'night-train': { id: 'night-train', title: 'Night Train', subtitle: 'A low rolling hum', cover: 'brownNoise', duration: 'loops', category: 'noise', audio: 'nightTrain', locked: true,
    about: 'The low sway of a sleeper carriage, built in-house. Steady motion without going anywhere.' },
  'ac-hum': { id: 'ac-hum', title: 'Air Conditioner', subtitle: 'A soft electrical hum', cover: 'whiteNoise', duration: 'loops', category: 'noise', audio: 'acHum', locked: true,
    about: 'The familiar hum of a window unit, built in-house. A steady mechanical companion for hot nights.' },
  'night-drive': { id: 'night-drive', title: 'Night Drive', subtitle: 'The road from the back seat', cover: 'brownNoise', duration: 'loops', category: 'noise', audio: 'nightDrive', locked: true,
    about: 'The deep, swaying rumble of a car at night, built in-house. The sound every child falls asleep to.' },
  'tumble-dryer': { id: 'tumble-dryer', title: 'Tumble Dryer', subtitle: 'A warm, round rhythm', cover: 'whiteNoise', duration: 'loops', category: 'noise', audio: 'tumbleDryer', locked: true,
    about: 'The warm turning rhythm of a dryer in the next room, built in-house. Oddly comforting; famously so.' },

  // ---- wind & air (synthesized gusts) ----
  'soft-wind': { id: 'soft-wind', title: 'Soft Wind', subtitle: 'Gentle gusts, far off', cover: 'forestStream', duration: 'loops', category: 'soundscape', audio: 'softWind', locked: true,
    about: 'A gentle wind built in-house, rising and settling in slow gusts. Air moving, nothing else.' },
  'mountain-wind': { id: 'mountain-wind', title: 'Mountain Wind', subtitle: 'Deep air over high ground', cover: 'dawnWoods', duration: 'loops', category: 'soundscape', audio: 'mountainWind', locked: true,
    about: 'A deeper, heavier wind built in-house. The sound of high, open country with weather on the way.' },
  'winter-wind': { id: 'winter-wind', title: 'Winter Wind', subtitle: 'Cold and clean', cover: 'whiteNoise', duration: 'loops', category: 'soundscape', audio: 'winterWind', locked: true,
    about: 'A colder, brighter wind built in-house. Best enjoyed from under a heavy blanket.' },
  'leaf-wind': { id: 'leaf-wind', title: 'Wind in the Leaves', subtitle: 'A canopy moving gently', cover: 'forestStream', duration: 'loops', category: 'soundscape', audio: 'leafWind', locked: true,
    about: 'Our nature-shaped noise bed with slow gusts moving through it, like a canopy stirring overhead.' },

  // ---- for little ones (synthesized; the classic baby beds) ----
  heartbeat: { id: 'heartbeat', title: 'Heartbeat', subtitle: 'A slow, steady lub-dub', cover: 'deepRest', duration: 'loops', category: 'soundscape', audio: 'heartbeat', locked: true,
    about: 'A soft, slow heartbeat built in-house. The first sound anyone ever fell asleep to.' },
  womb: { id: 'womb', title: 'Womb Sounds', subtitle: 'Warm hush · a distant heartbeat', cover: 'penguinVoyage', duration: 'loops', category: 'soundscape', audio: 'womb', locked: true,
    about: 'A warm low hush with a distant heartbeat, built in-house. The classic bed for newborns and very small sleepers.' },
  shush: { id: 'shush', title: 'Gentle Shush', subtitle: 'A slow, patient shhh', cover: 'whiteNoise', duration: 'loops', category: 'noise', audio: 'shush', locked: true,
    about: 'A soft shushing rhythm built in-house, at the slow pace a parent settles a baby. It never gets tired.' },

  // ---- shaped variants of our real recordings ----
  'rain-window': { id: 'rain-window', title: 'Rain on the Window', subtitle: 'Inside, looking out', cover: 'rainfall', duration: 'loops', category: 'soundscape', audio: 'rainWindow', locked: true,
    about: 'Our rain recording shaped to sit behind glass: softer edges, a little room around it. You are inside; the weather is not.' },
  'rain-tent': { id: 'rain-tent', title: 'Rain on a Tent', subtitle: 'Canvas overhead', cover: 'rainfall', duration: 'loops', category: 'soundscape', audio: 'rainTent', locked: true,
    about: 'Our rain recording shaped the way canvas carries it: close, round, and patting just above your head.' },
  'rain-distant': { id: 'rain-distant', title: 'Rain, Far Away', subtitle: 'A storm on the horizon', cover: 'rainfall', duration: 'loops', category: 'soundscape', audio: 'rainDistant', locked: true,
    about: 'Our rain recording pushed to the horizon: quiet, low, and wide. Weather you can hear but never feel.' },
  'rain-heavy': { id: 'rain-heavy', title: 'Heavy Rain', subtitle: 'A proper downpour', cover: 'rainfall', duration: 'loops', category: 'soundscape', audio: 'rainHeavy', locked: true,
    about: 'Our rain deepened with a low bed underneath: a straight-down downpour with real weight to it.' },
  'deep-swell': { id: 'deep-swell', title: 'Deep Swell', subtitle: 'Slower, heavier water', cover: 'slowTide', duration: 'loops', category: 'soundscape', audio: 'deepSwell', locked: true,
    about: 'Our shoreline recording slowed and deepened: bigger water moving further out. For heavy-blanket nights.' },
  'sea-dunes': { id: 'sea-dunes', title: 'Sea from the Dunes', subtitle: 'Waves behind the grass', cover: 'shoreline', duration: 'loops', category: 'soundscape', audio: 'seaDunes', locked: true,
    about: 'Our ocean recording heard from behind the dunes: softened, distant, and steady.' },
  'forest-dusk': { id: 'forest-dusk', title: 'Forest at Dusk', subtitle: 'The woods settling down', cover: 'forestStream', duration: 'loops', category: 'soundscape', audio: 'forestDusk', locked: true,
    about: 'Our forest recording shaped for the end of the day: the bright edges soften and the stream carries it.' },
  'birds-far': { id: 'birds-far', title: 'Birds, Far Off', subtitle: 'A distant morning', cover: 'dawnWoods', duration: 'loops', category: 'soundscape', audio: 'birdsFar', locked: true,
    about: 'Our dawn chorus set back across a field: present, but no single bird close enough to wake you.' },
  embers: { id: 'embers', title: 'Dying Embers', subtitle: 'The fire, late', cover: 'fireside', duration: 'loops', category: 'soundscape', audio: 'embers', locked: true,
    about: 'Our campfire shaped down to its last hour: fewer flames, softer crackle, mostly warmth.' },

  // ---- more blends of the credited recordings ----
  'piano-fire': { id: 'piano-fire', title: 'Piano by the Fire', subtitle: 'Soft keys · a close crackle', cover: 'spaMusic', duration: 'loops', category: 'music', audio: 'pianoFire', locked: true,
    about: 'Our blend of the soft piano and the campfire. Music in a warm room.' },
  'piano-sea': { id: 'piano-sea', title: 'Piano by the Sea', subtitle: 'Soft keys · a slow swell', cover: 'slowTide', duration: 'loops', category: 'music', audio: 'pianoSea', locked: true,
    about: 'Our blend of the soft piano over the ocean swell. Unhurried on both counts.' },
  'piano-birds': { id: 'piano-birds', title: 'Morning Keys', subtitle: 'Soft keys · early birdsong', cover: 'dawnWoods', duration: 'loops', category: 'music', audio: 'pianoBirds', locked: true,
    about: 'Our blend of the soft piano with the dawn chorus behind it. A gentler way to come back to the day.' },
  'gymnopedie-rain': { id: 'gymnopedie-rain', title: 'Gymnopédie in the Rain', subtitle: 'Satie · steady rain', cover: 'gymnopedie', duration: 'loops', category: 'music', audio: 'gymnopedieRain', locked: true,
    about: 'Satie’s slow piano piece over our rain recording. Two calm things that belong together.' },
  'forest-campfire': { id: 'forest-campfire', title: 'Forest Campfire', subtitle: 'A fire under the trees', cover: 'fireside', duration: 'loops', category: 'soundscape', audio: 'forestCampfire', locked: true,
    about: 'Our blend of the forest and the campfire: birdsong and stream around you, the fire in front.' },
  'shore-morning': { id: 'shore-morning', title: 'Morning Shoreline', subtitle: 'Waves · first birdsong', cover: 'shoreline', duration: 'loops', category: 'soundscape', audio: 'shoreMorning', locked: true,
    about: 'Our blend of the waves with early birdsong. The beach before anyone else is on it.' },
  'fireside-hush': { id: 'fireside-hush', title: 'Fireside Hush', subtitle: 'The fire · a deep quiet', cover: 'fireside', duration: 'loops', category: 'soundscape', audio: 'firesideHush', locked: true,
    about: 'Our campfire seated on a deep, even hush. The crackle stays; the silence between it gets softer.' },
  'storm-rolling': { id: 'storm-rolling', title: 'Storm Rolling In', subtitle: 'Rain · waves · low weight', cover: 'shoreline', duration: 'loops', category: 'soundscape', audio: 'stormRolling', locked: true,
    about: 'Our blend of rain over breaking waves with a low bed beneath: the hour when the weather arrives.' },
  'the-cabin': { id: 'the-cabin', title: 'The Cabin', subtitle: 'Rain on the roof · a fire · the sea', cover: 'fireside', duration: 'loops', category: 'soundscape', audio: 'theCabin', locked: true,
    about: 'Our three-layer blend: rain on the roof, a fire going, and the sea somewhere below. The warmest place in the library.' },

  // ---- noise variants (synthesized) ----
  'deep-brown': { id: 'deep-brown', title: 'Deep Brown Noise', subtitle: 'Lower than low', cover: 'brownNoise', duration: 'loops', category: 'noise', audio: 'deepBrown', locked: true,
    about: 'Brown noise with everything above a rumble removed. The heaviest blanket we make.' },
  'soft-white': { id: 'soft-white', title: 'Soft White Noise', subtitle: 'The bright edge rounded off', cover: 'whiteNoise', duration: 'loops', category: 'noise', audio: 'softWhite', locked: true,
    about: 'White noise with the harsh top rolled away. All the cover, less of the hiss.' },
  'warm-pink': { id: 'warm-pink', title: 'Warm Pink Noise', subtitle: 'Pink, dimmed for night', cover: 'pinkNoise', duration: 'loops', category: 'noise', audio: 'warmPink', locked: true,
    about: 'Pink noise shaped darker and warmer, in-house. The night-light version of the pink bed.' },
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
      'Find a comfortable spot, rest your Glow Orb in your palm at a level that feels good, and start a wind-down. You may notice your shoulders drop and your breathing slow within the first few minutes.',
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
  // Bounded honesty (pre-mortem: the placebo gap). Plainly credits the evidence-backed
  // part (breath + ritual), positions the orb as a physical anchor with an explicit
  // no-medical-claims line, and carries the app's ONE sanctioned plain-words mention of
  // anxious nights (product decision 2026-07-12: named in exactly one place, non-clinical,
  // safe words everywhere else). The wellness disclaimer auto-renders below every article.
  'what-works': {
    id: 'what-works',
    title: 'What is doing the work?',
    kicker: 'How it works',
    readMins: 2,
    cover: 'deepRest',
    body: [
      'The heart of CalmCarry is the ritual: unhurried sound and slow, steady breathing at the same time each evening. Slow breathing and a consistent wind-down are the parts with real research behind them, and they are free in this app every night.',
      'Your Glow Orb is the physical anchor for that ritual. Something warm and familiar to hold gives a busy mind one simple place to rest, and a habit you can feel in your hand is easier to keep. We make no medical claims for it, and we never will.',
      'When anxious thoughts are what keep you up, the same ritual applies: a slower out-breath, a quiet sound, one thing to hold. Not a cure, just a kinder way to meet the night. If worry feels heavy or constant, please talk to someone you trust or a healthcare professional.',
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
