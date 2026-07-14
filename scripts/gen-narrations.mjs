/* Generate the three guided-session narrations with ElevenLabs (voice: Brian -
 * deep, resonant, comforting) and write raw narration mp3s to outDir. Mixing
 * over the ambient bed happens afterwards with ffmpeg (see gen-narrations.sh
 * steps in RUNBOOK or the session that produced them).
 *
 * Usage: node scripts/gen-narrations.mjs [outDir]   (key from .env.elevenlabs)
 * Scripts are docs/SESSION_SCRIPTS.md #4 / #5 / #1 verbatim, [pause] → SSML break.
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
  console.error('No key (.env.elevenlabs).');
  process.exit(1);
}
const KEY = loadKey();
const H = { 'xi-api-key': KEY };

const B = '<break time="1.8s" />';
const b = '<break time="1.0s" />';

const SESSIONS = [
  {
    file: 'narration-box.mp3',
    text: `Let's breathe together in a slow, steady square. We'll use the pulsing in your palm to keep the rhythm. ${B} Rest the CalmCarry in your palm and set it to a level that feels good - there, but not loud. ${B} Notice the gentle pulsing. We'll move with it, side by side. ${B} Breathe in for four… two, three, four. ${B} Now hold, gently, for four… two, three, four. ${B} Breathe out for four… two, three, four. ${B} And hold, soft and easy, for four… two, three, four. ${B} That's one full side of the square. Let's go around again, slower this time. In… ${B} hold… ${B} out… ${B} hold. ${B} If you lose count, no worries at all. The pulsing in your hand is still there to bring you back. ${B} A few more rounds at your own pace. Feel your busy mind beginning to quiet. ${b} Lovely. Just keep breathing the square.`,
  },
  {
    file: 'narration-rest.mp3',
    text: `Find a comfortable spot, sitting or lying down. We're going to travel slowly through the body and let it soften, piece by piece. ${B} Rest the CalmCarry in your palm. Set it to a level that feels good - a gentle pulsing you can return to anytime. ${B} Start at the top of your head. Let your forehead smooth out. Unclench your jaw. ${B} Let your shoulders melt down. Feel them release the day. ${B} Notice the gentle pulsing in your hand, and let that softness spread up your arm. ${B} Soften your chest. Let your belly rise and fall on its own, no effort needed. ${B} Let your hips grow heavy. Your legs, loose and warm. ${B} All the way down to your feet. Let them go completely. ${B} Now feel your whole body at once - held, heavy, settled. The pulsing in your palm keeps gentle time. ${B} There's nowhere to be but here. Rest in it as long as you'd like.`,
  },
  {
    file: 'narration-letgo.mp3',
    text: `Welcome. There's nothing to get right here. You've made it to the end of the day, and that's enough. ${B} Let your eyes close whenever they're ready. Settle your shoulders down, away from your ears. ${B} Rest the CalmCarry in your palm, and let your hand grow heavy. Set it to a level that feels good to you - soft enough to fade into the background. ${B} Notice the gentle pulsing in the centre of your palm. You don't have to hold onto it. Just let it be there, like a small, steady companion. ${B} Now, a slow breath in… and a longer breath out. ${b} Again - in… and let it go. ${B} If your mind is still busy, that's alright. Let the thoughts drift past like cars on a far-off road. You don't need to follow them. ${B} Feel the warmth where the device rests. Feel your weight sinking into the bed beneath you. ${B} Stay here as long as you like. The pulsing will keep you company. Goodnight.`,
  },
];

const SETTINGS = { stability: 0.45, similarity_boost: 0.75, style: 0.28, use_speaker_boost: true }; // 0.7/0.08 read monotone ("robotic" per Mason); this keeps calm but human

async function main() {
  const outDir = process.argv[2] || './narration-out';
  mkdirSync(outDir, { recursive: true });
  const vres = await fetch(`${API}/v1/voices`, { headers: H });
  const voices = (await vres.json()).voices ?? [];
  const brian = voices.find((v) => v.name?.toLowerCase().startsWith('brian -'));
  if (!brian) {
    console.error('Brian voice not found');
    process.exit(1);
  }
  for (const s of SESSIONS) {
    const res = await fetch(`${API}/v1/text-to-speech/${brian.voice_id}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { ...H, 'content-type': 'application/json' },
      body: JSON.stringify({ text: s.text, model_id: 'eleven_multilingual_v2', voice_settings: SETTINGS }),
    });
    if (!res.ok) {
      console.error(`${s.file}: ${res.status} ${(await res.text()).slice(0, 160)}`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(join(outDir, s.file), buf);
    console.log(`${s.file} (${(buf.length / 1024).toFixed(0)} KB)`);
  }
}
main().catch((e) => {
  console.error(String(e).slice(0, 200));
  process.exit(1);
});
