import AsyncStorage from '@react-native-async-storage/async-storage';

import { type AudioKey } from '@/content/audio';

/** The narration voice for guided sessions. The picker previews each (real TTS
 *  samples); the chosen voice is what guided sessions use as their voiced sets
 *  are produced per voice. */
export type VoiceKey = 'maya' | 'orion' | 'luna';

export type Voice = { key: VoiceKey; name: string; tag: string; sample: AudioKey };

export const VOICES: Voice[] = [
  { key: 'maya', name: 'Maya', tag: 'Warm & soft', sample: 'voiceMaya' },
  { key: 'orion', name: 'Orion', tag: 'Calm & low', sample: 'voiceOrion' },
  { key: 'luna', name: 'Luna', tag: 'Gentle & airy', sample: 'voiceLuna' },
];

export const DEFAULT_VOICE: VoiceKey = 'maya';
const KEY = 'cc.voice';

export function voiceByKey(k: VoiceKey): Voice {
  return VOICES.find((v) => v.key === k) ?? VOICES[0];
}

export async function getVoice(): Promise<VoiceKey> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v && VOICES.some((x) => x.key === v) ? (v as VoiceKey) : DEFAULT_VOICE;
  } catch {
    return DEFAULT_VOICE;
  }
}

export async function setVoice(v: VoiceKey): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, v);
  } catch {
    /* best-effort */
  }
}
