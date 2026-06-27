/**
 * Cover-art registry. Soft hand-painted watercolour illustrations (Recraft 4.1,
 * locked to the brand eucalyptus/sage palette with soft peach accents) — one
 * cohesive light, airy fine-art set, standing in for the licensed artwork Glowco
 * supplies in production (V1_SCOPE: Glowco provides all media/brand assets). §7.
 */
export const covers = {
  slowTide: require('../../assets/covers/slow-tide.webp'),
  rainfall: require('../../assets/covers/rainfall.webp'),
  boxBreathing: require('../../assets/covers/box-breathing.webp'),
  deepRest: require('../../assets/covers/deep-rest.webp'),
  lettingGo: require('../../assets/covers/letting-go.webp'),
  forestStream: require('../../assets/covers/forest-stream.webp'),
  penguinVoyage: require('../../assets/covers/penguin-voyage.webp'),
  spaMusic: require('../../assets/covers/spa-music.webp'),
  gymnopedie: require('../../assets/covers/gymnopedie.webp'),
  shoreline: require('../../assets/covers/shoreline.webp'),
  fireside: require('../../assets/covers/fireside.webp'),
  dawnWoods: require('../../assets/covers/dawn-woods.webp'),
  brownNoise: require('../../assets/covers/brown-noise.webp'),
  pinkNoise: require('../../assets/covers/pink-noise.webp'),
  whiteNoise: require('../../assets/covers/white-noise.webp'),
} as const;

export type CoverKey = keyof typeof covers;
