import { getJSON, setJSON } from './store';

/**
 * Real, gentle program progress (build plan: "gentle, non-clinical progress —
 * never a streak you can fail"). We store which step-days the user has completed
 * per program; a step is marked done when its session is actually played. Nothing
 * resets or penalises — it only ever fills in.
 */
const KEY = 'cc.programProgress';
type ProgressMap = Record<string, number[]>;

export async function getProgramDone(programId: string): Promise<number[]> {
  const map = await getJSON<ProgressMap>(KEY, {});
  return Array.isArray(map?.[programId]) ? map[programId] : [];
}

export async function markProgramStepDone(programId: string, day: number): Promise<void> {
  const map = await getJSON<ProgressMap>(KEY, {});
  const days = Array.isArray(map?.[programId]) ? map[programId] : [];
  if (days.includes(day)) return;
  const next: ProgressMap = { ...map, [programId]: [...days, day].sort((a, b) => a - b) };
  await setJSON(KEY, next);
}
