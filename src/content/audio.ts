import { type AudioSource } from 'expo-audio';

/**
 * Bundled royalty-free / public-domain audio (CC0 except the piano, CC BY 3.0).
 * Bundled rather than streamed so playback is reliable offline and on web (no
 * CORS). Production swaps these for Glowco's licensed library via the CMS/CDN.
 */
export type AudioKey =
  | 'ocean' | 'rain' | 'forest' | 'drone' | 'piano' | 'gymnopedie' | 'fire' | 'waves'
  | 'birdsong' | 'brown' | 'pink' | 'white' | 'green' | 'rainFire' | 'rainOcean'
  | 'rainForest' | 'beachFire' | 'rainPiano' | 'fan'
  | 'ceilingFan' | 'deskFan' | 'airplaneCabin' | 'nightTrain' | 'acHum' | 'nightDrive' | 'tumbleDryer'
  | 'softWind' | 'mountainWind' | 'winterWind' | 'leafWind'
  | 'heartbeat' | 'womb' | 'shush'
  | 'rainWindow' | 'rainTent' | 'rainDistant' | 'rainHeavy' | 'deepSwell' | 'seaDunes' | 'forestDusk' | 'birdsFar' | 'embers'
  | 'pianoFire' | 'pianoSea' | 'pianoBirds' | 'gymnopedieRain' | 'forestCampfire' | 'shoreMorning' | 'firesideHush' | 'stormRolling' | 'theCabin'
  | 'deepBrown' | 'softWhite' | 'warmPink'
  | 'guidedBox' | 'guidedRest' | 'guidedLetGo'
  | 'voiceMaya' | 'voiceOrion' | 'voiceLuna';

export const audioSources: Record<AudioKey, AudioSource> = {
  ocean: require('../../assets/audio/ocean.mp3'),
  rain: require('../../assets/audio/rain.mp3'),
  forest: require('../../assets/audio/forest.mp3'),
  drone: require('../../assets/audio/drone.mp3'), // mp3, not ogg - iOS won't decode .ogg
  piano: require('../../assets/audio/piano.mp3'),
  gymnopedie: require('../../assets/audio/gymnopedie.mp3'),
  fire: require('../../assets/audio/fire.mp3'),
  waves: require('../../assets/audio/waves.mp3'),
  birdsong: require('../../assets/audio/birdsong.mp3'),
  brown: require('../../assets/audio/brown-noise.mp3'),
  pink: require('../../assets/audio/pink-noise.mp3'),
  white: require('../../assets/audio/white-noise.mp3'),
  green: require('../../assets/audio/green-noise.mp3'), // generated in-house: pink base, mid-500Hz emphasis
  // In-house blends of the REAL field recordings above (rain+fire, rain+ocean) -
  // honest one-tap scenes mixed with ffmpeg; loudness-normalized loop beds.
  rainFire: require('../../assets/audio/rain-fire.mp3'),
  rainOcean: require('../../assets/audio/rain-ocean.mp3'),
  rainForest: require('../../assets/audio/rain-forest.mp3'),
  beachFire: require('../../assets/audio/beach-fire.mp3'),
  rainPiano: require('../../assets/audio/rain-piano.mp3'),
  // in-house synthesized box-fan hum (brown noise band-shaped + slow 1Hz wobble)
  fan: require('../../assets/audio/fan.mp3'),

  // 2026-07 library expansion - all in-house: synthesized hums/wind/little-ones
  // beds, shaped variants of the credited recordings, and blends of them
  // (recipes in scripts/gen-sound-variants.sh; regenerable).
  ceilingFan: require('../../assets/audio/ceiling-fan.mp3'),
  deskFan: require('../../assets/audio/desk-fan.mp3'),
  airplaneCabin: require('../../assets/audio/airplane-cabin.mp3'),
  nightTrain: require('../../assets/audio/night-train.mp3'),
  acHum: require('../../assets/audio/ac-hum.mp3'),
  nightDrive: require('../../assets/audio/night-drive.mp3'),
  tumbleDryer: require('../../assets/audio/tumble-dryer.mp3'),
  softWind: require('../../assets/audio/soft-wind.mp3'),
  mountainWind: require('../../assets/audio/mountain-wind.mp3'),
  winterWind: require('../../assets/audio/winter-wind.mp3'),
  leafWind: require('../../assets/audio/leaf-wind.mp3'),
  heartbeat: require('../../assets/audio/heartbeat.mp3'),
  womb: require('../../assets/audio/womb.mp3'),
  shush: require('../../assets/audio/shush.mp3'),
  rainWindow: require('../../assets/audio/rain-window.mp3'),
  rainTent: require('../../assets/audio/rain-tent.mp3'),
  rainDistant: require('../../assets/audio/rain-distant.mp3'),
  rainHeavy: require('../../assets/audio/rain-heavy.mp3'),
  deepSwell: require('../../assets/audio/deep-swell.mp3'),
  seaDunes: require('../../assets/audio/sea-dunes.mp3'),
  forestDusk: require('../../assets/audio/forest-dusk.mp3'),
  birdsFar: require('../../assets/audio/birds-far.mp3'),
  embers: require('../../assets/audio/embers.mp3'),
  pianoFire: require('../../assets/audio/piano-fire.mp3'),
  pianoSea: require('../../assets/audio/piano-sea.mp3'),
  pianoBirds: require('../../assets/audio/piano-birds.mp3'),
  gymnopedieRain: require('../../assets/audio/gymnopedie-rain.mp3'),
  forestCampfire: require('../../assets/audio/forest-campfire.mp3'),
  shoreMorning: require('../../assets/audio/shore-morning.mp3'),
  firesideHush: require('../../assets/audio/fireside-hush.mp3'),
  stormRolling: require('../../assets/audio/storm-rolling.mp3'),
  theCabin: require('../../assets/audio/the-cabin.mp3'),
  deepBrown: require('../../assets/audio/deep-brown.mp3'),
  softWhite: require('../../assets/audio/soft-white.mp3'),
  warmPink: require('../../assets/audio/warm-pink.mp3'),

  // Voiced guided sessions - narration mixed over a soft ambient bed (replaces the
  // old silent drone). Synthesized VO for now; Glowco can swap in human recordings.
  guidedBox: require('../../assets/audio/guided-box-breathing.mp3'),
  guidedRest: require('../../assets/audio/guided-deep-rest.mp3'),
  guidedLetGo: require('../../assets/audio/guided-letting-go.mp3'),
  // Bedtime-voice PREVIEW samples for the voice picker (AI-generated TTS - ByteDance Seed Audio).
  voiceMaya: require('../../assets/audio/voice-maya.mp3'),
  voiceOrion: require('../../assets/audio/voice-orion.mp3'),
  voiceLuna: require('../../assets/audio/voice-luna.mp3'),
};

/** Required attribution for the CC BY tracks (shown in Account). */
export const AUDIO_CREDITS =
  'Attribution (CC BY 3.0): “Prelude in C” by Kevin MacLeod (incompetech.com); “Campfire” by Glaneur de sons; “Water on Rocks” by Dsw4 (Wikimedia Commons). “Gymnopédie No. 1” (Erik Satie), the dawn birdsong, and the rain / ocean / forest / drone ambiences are CC0 / public domain. The brown / pink / white / green noise beds and the fan hum are generated in-house (royalty-free), and the blended scenes (rain + fire / sea / forest / piano) are in-house mixes of the recordings credited above. Guided-session narration and the bedtime-voice previews are AI-generated (synthesized) voice, pending human recordings.';
