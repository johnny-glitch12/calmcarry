/**
 * One-shot, in-memory handoff for "load this community mix". Set when a user taps a
 * shared mix card on the Community tab, then consumed exactly once by the Listen
 * tab. Deliberately NOT persisted - a shared mix should never resurface on a later
 * app open, and nothing here touches storage or the network.
 */
let pending: Record<string, number> | null = null;

export function setPendingMix(levels: Record<string, number>): void {
  pending = levels;
}

/** Return the pending mix (if any) and clear it, so it's applied only once. */
export function takePendingMix(): Record<string, number> | null {
  const p = pending;
  pending = null;
  return p;
}
