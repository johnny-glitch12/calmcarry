/* Generate the three bedtime voice previews (Maya / Orion / Luna) with ElevenLabs.
 *
 * Usage:
 *   1) Put the key in .env.elevenlabs at the repo root (gitignored):
 *        ELEVENLABS_API_KEY=sk_...
 *      (or export ELEVENLABS_API_KEY in the shell)
 *   2) node scripts/gen-voices.mjs [outDir]
 *
 * Writes raw mp3s to outDir (default: scratch ./voice-out) — re-encode into
 * assets/audio/ afterwards (mono 96k) to match the bundled asset profile.
 * The key is never logged.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const API = 'https://api.elevenlabs.io';

function loadKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  for (const p of ['.env.elevenlabs', '../.env.elevenlabs']) {
    if (existsSync(p)) {
      const m = readFileSync(p, 'utf8').match(/ELEVENLABS_API_KEY\s*=\s*(\S+)/);
      if (m) return m[1].trim();
    }
  }
  console.error('No key. Put ELEVENLABS_API_KEY=sk_... in .env.elevenlabs (gitignored) or the env.');
  process.exit(1);
}

const KEY = loadKey();
const H = { 'xi-api-key': KEY };

// One consistent bedtime line across all three, so they're comparable in the picker.
const SCRIPT =
  "Let's slow things down for a moment. Take a slow breath in... and let it go. " +
  "You don't have to carry today into tonight. Just settle in. I'll guide you from here.";

// App personas → preferred ElevenLabs premade voices (by name, with fallbacks),
// picked for bedtime register: warm/soft, calm/low, gentle/airy.
const PERSONAS = [
  { file: 'voice-maya.mp3', label: 'Maya (warm & soft)', prefer: ['Matilda', 'Rachel', 'Sarah'] },
  { file: 'voice-orion.mp3', label: 'Orion (calm & low)', prefer: ['George', 'Brian', 'Daniel'] },
  { file: 'voice-luna.mp3', label: 'Luna (gentle & airy)', prefer: ['Lily', 'Alice', 'Charlotte'] },
];

// Calm delivery: high stability (even pacing), low style exaggeration.
const VOICE_SETTINGS = { stability: 0.62, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true };
const MODEL = 'eleven_multilingual_v2';

async function main() {
  const outDir = process.argv[2] || './voice-out';
  mkdirSync(outDir, { recursive: true });

  const sub = await fetch(`${API}/v1/user/subscription`, { headers: H });
  if (!sub.ok) {
    console.error(`Key rejected (${sub.status}). Is it valid / rotated?`);
    process.exit(1);
  }
  const subJson = await sub.json();
  console.log(`Key OK. Characters: ${subJson.character_count}/${subJson.character_limit} used.`);

  const vres = await fetch(`${API}/v2/voices?page_size=100`, { headers: H });
  const voices = (await vres.json()).voices ?? [];
  const byName = (n) => voices.find((v) => v.name?.toLowerCase() === n.toLowerCase());

  for (const p of PERSONAS) {
    const voice = p.prefer.map(byName).find(Boolean);
    if (!voice) {
      console.error(`No voice found for ${p.label} (tried ${p.prefer.join(', ')}) — pick manually from /v2/voices.`);
      continue;
    }
    console.log(`${p.label} → ${voice.name}`);
    const res = await fetch(`${API}/v1/text-to-speech/${voice.voice_id}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { ...H, 'content-type': 'application/json' },
      body: JSON.stringify({ text: SCRIPT, model_id: MODEL, voice_settings: VOICE_SETTINGS }),
    });
    if (!res.ok) {
      console.error(`  TTS failed for ${voice.name}: ${res.status} ${(await res.text()).slice(0, 200)}`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(join(outDir, p.file), buf);
    console.log(`  wrote ${join(outDir, p.file)} (${(buf.length / 1024).toFixed(0)} KB)`);
  }
}

main().catch((e) => {
  console.error(String(e).slice(0, 300));
  process.exit(1);
});
