/* eslint-disable @typescript-eslint/no-require-imports -- React Native bundles static assets via require() */
import { type AudioSource } from 'expo-audio';

/**
 * Bundled royalty-free / public-domain audio (CC0 except the piano, CC BY 3.0).
 * Bundled rather than streamed so playback is reliable offline and on web (no
 * CORS). Production swaps these for Glowco's licensed library via the CMS/CDN.
 */
export type AudioKey =
  | 'ocean' | 'rain' | 'forest' | 'drone' | 'piano' | 'gymnopedie' | 'fire' | 'waves'
  | 'birdsong' | 'brown' | 'pink' | 'white'
  | 'guidedBox' | 'guidedRest' | 'guidedLetGo';

export const audioSources: Record<AudioKey, AudioSource> = {
  ocean: require('../../assets/audio/ocean.mp3'),
  rain: require('../../assets/audio/rain.mp3'),
  forest: require('../../assets/audio/forest.mp3'),
  drone: require('../../assets/audio/drone.ogg'),
  piano: require('../../assets/audio/piano.mp3'),
  gymnopedie: require('../../assets/audio/gymnopedie.mp3'),
  fire: require('../../assets/audio/fire.mp3'),
  waves: require('../../assets/audio/waves.mp3'),
  birdsong: require('../../assets/audio/birdsong.mp3'),
  brown: require('../../assets/audio/brown-noise.mp3'),
  pink: require('../../assets/audio/pink-noise.mp3'),
  white: require('../../assets/audio/white-noise.mp3'),
  // Voiced guided sessions — narration mixed over a soft ambient bed (replaces the
  // old silent drone). Synthesized VO for now; Glowco can swap in human recordings.
  guidedBox: require('../../assets/audio/guided-box-breathing.mp3'),
  guidedRest: require('../../assets/audio/guided-deep-rest.mp3'),
  guidedLetGo: require('../../assets/audio/guided-letting-go.mp3'),
};

/** Required attribution for the CC BY tracks (shown in Account). */
export const AUDIO_CREDITS =
  'Attribution (CC BY 3.0): “Prelude in C” — Kevin MacLeod (incompetech.com); “Campfire” — Glaneur de sons; “Water on Rocks” — Dsw4 (Wikimedia Commons). “Gymnopédie No. 1” (Erik Satie), the dawn birdsong, and the rain / ocean / forest / drone ambiences are CC0 / public domain. The brown / pink / white noise beds are generated in-house (royalty-free). Guided-session narration is AI-synthesized voice.';
