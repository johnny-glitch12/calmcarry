/**
 * Cover-art registry. These are AI-generated CONCEPT covers (Higgsfield /
 * Recraft 4.1, locked to the brand eucalyptus palette) standing in for the
 * licensed artwork Glowco supplies in production (V1_SCOPE: Glowco provides
 * all media/brand assets). One cohesive painterly style (§7).
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
} as const;

export type CoverKey = keyof typeof covers;
