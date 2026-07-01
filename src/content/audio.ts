/* eslint-disable @typescript-eslint/no-require-imports -- React Native bundles static assets via require() */
import { type AudioSource } from 'expo-audio';

/**
 * Bundled royalty-free / public-domain audio (CC0 except the piano, CC BY 3.0).
 * Bundled rather than streamed so playback is reliable offline and on web (no
 * CORS). Production swaps these for Glowco's licensed library via the CMS/CDN.
 */
export type AudioKey =
  | 'ocean' | 'rain' | 'forest' | 'drone' | 'piano' | 'gymnopedie' | 'fire' | 'waves'
  | 'birdsong' | 'brown' | 'pink' | 'white' | 'green'
  | 'guidedBox' | 'guidedRest' | 'guidedLetGo'
  | 'voiceMaya' | 'voiceOrion' | 'voiceLuna';

export const audioSources: Record<AudioKey, AudioSource> = {
  ocean: require('../../assets/audio/ocean.mp3'),
  rain: require('../../assets/audio/rain.mp3'),
  forest: require('../../assets/audio/forest.mp3'),
  drone: require('../../assets/audio/drone.mp3'), // mp3, not ogg — iOS won't decode .ogg
  piano: require('../../assets/audio/piano.mp3'),
  gymnopedie: require('../../assets/audio/gymnopedie.mp3'),
  fire: require('../../assets/audio/fire.mp3'),
  waves: require('../../assets/audio/waves.mp3'),
  birdsong: require('../../assets/audio/birdsong.mp3'),
  brown: require('../../assets/audio/brown-noise.mp3'),
  pink: require('../../assets/audio/pink-noise.mp3'),
  white: require('../../assets/audio/white-noise.mp3'),
  green: require('../../assets/audio/green-noise.mp3'), // generated in-house: pink base, mid-500Hz emphasis

  // Voiced guided sessions — narration mixed over a soft ambient bed (replaces the
  // old silent drone). Synthesized VO for now; Glowco can swap in human recordings.
  guidedBox: require('../../assets/audio/guided-box-breathing.mp3'),
  guidedRest: require('../../assets/audio/guided-deep-rest.mp3'),
  guidedLetGo: require('../../assets/audio/guided-letting-go.mp3'),
  // Bedtime-voice PREVIEW samples for the voice picker (AI-generated TTS — ByteDance Seed Audio).
  voiceMaya: require('../../assets/audio/voice-maya.mp3'),
  voiceOrion: require('../../assets/audio/voice-orion.mp3'),
  voiceLuna: require('../../assets/audio/voice-luna.mp3'),
};

/** Required attribution for the CC BY tracks (shown in Account). */
export const AUDIO_CREDITS =
  'Attribution (CC BY 3.0): “Prelude in C” by Kevin MacLeod (incompetech.com); “Campfire” by Glaneur de sons; “Water on Rocks” by Dsw4 (Wikimedia Commons). “Gymnopédie No. 1” (Erik Satie), the dawn birdsong, and the rain / ocean / forest / drone ambiences are CC0 / public domain. The brown / pink / white / green noise beds are generated in-house (royalty-free). Guided-session narration and the bedtime-voice previews are AI-generated (synthesized) voice, pending human recordings.';
