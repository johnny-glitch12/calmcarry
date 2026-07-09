/**
 * Tiny registry of on-screen rects for the hands-on tour. Real UI (the Home
 * hero, tab-bar items) measures itself into here; the tour overlay subscribes
 * and draws its spotlight around the live positions. No context, no re-render
 * coupling — the couple of writers and one reader stay fully decoupled.
 */
export type TargetRect = { x: number; y: number; width: number; height: number };

const targets = new Map<string, TargetRect>();
const subs = new Set<() => void>();

export function setTourTarget(key: string, rect: TargetRect): void {
  targets.set(key, rect);
  subs.forEach((f) => f());
}

export function getTourTarget(key: string): TargetRect | null {
  return targets.get(key) ?? null;
}

export function subscribeTourTargets(f: () => void): () => void {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}
