/**
 * The one published answer to "is a child profile active right now?"
 *
 * This exists so code far below the React tree - the API client, the analytics queue,
 * the crash reporter - can honour the promise the app makes to parents and to the App
 * Store: in Kids Mode, nothing about the child is transmitted, and the app makes no
 * network requests at all.
 *
 * ProfileProvider is the single writer (setKidsActive), called from the same effect
 * that publishes the analytics and monitoring modes. Everything else only reads.
 * A module-level boolean, not React state, precisely because the readers are not
 * React: the request layer needs a synchronous answer with no hook, no context, no
 * await.
 *
 * Default true is deliberate. If this is read before ProfileProvider has hydrated and
 * published the real value, the safe assumption is "a child might be active" - which
 * blocks a transmit for a few milliseconds at worst, rather than leaking during the
 * window before the mode is known.
 */
let kidsActive = true;

export function setKidsActive(active: boolean): void {
  kidsActive = active;
}

export function isKidsActive(): boolean {
  return kidsActive;
}

/** Thrown when an authenticated request is attempted during a child's session. Callers
 *  already treat a rejected api.* call as "offline, keep local", so this fails safe. */
export class KidsModeBlockedError extends Error {
  constructor() {
    super('Blocked: no network requests are made while a child profile is active.');
    this.name = 'KidsModeBlockedError';
  }
}
