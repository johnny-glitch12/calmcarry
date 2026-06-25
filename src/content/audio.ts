/* eslint-disable @typescript-eslint/no-require-imports -- React Native bundles static assets via require() */
import { type AudioSource } from 'expo-audio';

/**
 * Bundled royalty-free / public-domain audio (CC0 except the piano, CC BY 3.0).
 * Bundled rather than streamed so playback is reliable offline and on web (no
 * CORS). Production swaps these for Glowco's licensed library via the CMS/CDN.
 */
export type AudioKey = 'ocean' | 'rain' | 'forest' | 'drone' | 'piano';

export const audioSources: Record<AudioKey, AudioSource> = {
  ocean: require('../../assets/audio/ocean.mp3'),
  rain: require('../../assets/audio/rain.mp3'),
  forest: require('../../assets/audio/forest.mp3'),
  drone: require('../../assets/audio/drone.ogg'),
  piano: require('../../assets/audio/piano.mp3'),
};

/** Required attribution for the CC BY piano track (shown in Account). */
export const AUDIO_CREDITS =
  'Piano: “Prelude in C” by Kevin MacLeod (incompetech.com), CC BY 3.0. Other sounds are CC0 / public domain.';
