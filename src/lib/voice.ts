import AsyncStorage from '@react-native-async-storage/async-storage';

import { type AudioKey } from '@/content/audio';

/** A bedtime-voice preference. The picker previews each voice (real TTS samples)
 *  and remembers the pick. NOTE: guided sessions today play a single fixed
 *  narration - this choice does NOT change what currently plays. It is stored so
 *  that once per-voice guided sets are produced, the saved choice selects which
 *  one plays. Until then it is a preview + preference, not a live control. */
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

/** The raw stored choice, or null if the user never picked one - prefs sync uses
 *  this to tell "chose the default" apart from "never chose" before adopting a
 *  value from another device. */
export async function getStoredVoice(): Promise<VoiceKey | null> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v && VOICES.some((x) => x.key === v) ? (v as VoiceKey) : null;
  } catch {
    return null;
  }
}
