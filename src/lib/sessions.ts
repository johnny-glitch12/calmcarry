import { getAnalyticsOptOut } from './analytics';
import { api } from './api';
import { getJSON, KEYS, setJSON } from './store';

export type SessionEntry = {
  contentId?: string;
  deviceId?: string;
  at: string;
};

/**
 * Record THAT a session ran (for activation/completion analytics, §15) - never a
 * mood/settle rating (the plan forbids symptom tracking & mood history). Always
 * persists locally so the app works offline; also posts to the backend when a
 * real token is present. Fire-and-forget - never throws to the caller.
 */
export async function logSession(
  token: string | null,
  entry: { contentId?: string; deviceId?: string }
): Promise<void> {
  try {
    const logs = await getJSON<SessionEntry[]>(KEYS.logs, []);
    await setJSON(KEYS.logs, [{ ...entry, at: new Date().toISOString() }, ...logs].slice(0, 100));
  } catch {
    /* ignore */
  }
  // The SERVER copy is account-linked (session_logs.ownerId, retained ~13 months), so
  // it is usage analytics and must honour the same opt-out as track(). Without this
  // the Settings toggle silenced track() while every play still uploaded an
  // account-linked listening history - making the in-app "no profile is built about
  // you" promise false. The LOCAL copy above always persists: it powers recents,
  // program progress and calm nights, and never leaves the device.
  if (token && token !== 'local' && !(await getAnalyticsOptOut())) {
    try {
      await api.log(token, entry);
    } catch {
      /* offline - already saved locally */
    }
  }
}
