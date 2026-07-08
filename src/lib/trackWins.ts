import { getJSON, setJSON } from './store';

/**
 * "Worked before" memory — the behavioural stand-in for a settle rating. We never
 * ask "did it work?" (the plan forbids symptom tracking); instead, a wind-down
 * that reaches its natural end (gentle auto-end, sleep timer, or a ≥60s listen —
 * the same definition analytics uses for `completed`) quietly counts as a win for
 * that track. The recommender then leans toward tracks that have carried this
 * household to the end before. Local-only, never synced.
 */
const KEY = 'cc.trackWins';
const CAP = 9; // enough to say "reliably works"; stops one binge from dominating forever

export async function getTrackWins(): Promise<Record<string, number>> {
  return getJSON<Record<string, number>>(KEY, {});
}

export async function recordTrackWin(trackId: string): Promise<void> {
  try {
    const wins = await getJSON<Record<string, number>>(KEY, {});
    wins[trackId] = Math.min((wins[trackId] ?? 0) + 1, CAP);
    await setJSON(KEY, wins);
  } catch {
    /* storage unavailable — losing a win is harmless */
  }
}
