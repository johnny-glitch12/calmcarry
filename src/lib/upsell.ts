import { getJSON, setJSON } from './store';

/**
 * Gentle, honest membership reminders for free users (how good freemium apps nudge,
 * minus the dark patterns). Rules that keep it a nudge, not a nag — and that a sleep
 * app in particular MUST respect (nagging at bedtime is counter-productive):
 *
 *  - Never for a brand-new user — let them settle in for a couple of days first.
 *  - At most one nudge per COOLDOWN (a soft, dismissible Home card — never a forced
 *    modal, and never on the player/wind-down where calm must not be interrupted).
 *  - Backs OFF each time it's declined; after HARD_STOP "not now"s it goes quiet for
 *    a long stretch (respect the "no").
 *  - If the user actually opens the paywall, rest it without counting a decline.
 *
 * All state is local (cc.upsell). Purely advisory; entitlement is the source of truth.
 */

const KEY = 'cc.upsell';
const DAY = 86_400_000;
const MIN_AGE = 2 * DAY; // let a new user find their footing before any nudge
const COOLDOWN = 5 * DAY; // minimum gap between nudges
const HARD_STOP = 3; // after this many "not now"s, back right off
const LONG_REST = 45 * DAY; // the quiet stretch once they've clearly declined
const ENGAGE_REST = 10 * DAY; // rest after they open the paywall themselves

type UpsellState = {
  firstConsideredAt?: number;
  lastShownAt?: number;
  shownCount?: number;
  dismissCount?: number;
  snoozedUntil?: number;
};

async function read(): Promise<UpsellState> {
  return (await getJSON<UpsellState>(KEY, {})) ?? {};
}
async function write(next: UpsellState): Promise<void> {
  await setJSON(KEY, next);
}

/** True only when it's tasteful to surface the Calm Plan nudge right now. Anchors the
 *  "age" clock on first call and returns false, so the very first session is never
 *  interrupted. The caller checks `!isPremium && !kids` itself. */
export async function shouldShowUpsell(): Promise<boolean> {
  const now = Date.now();
  const s = await read();
  if (s.firstConsideredAt === undefined) {
    await write({ ...s, firstConsideredAt: now });
    return false;
  }
  if (now - s.firstConsideredAt < MIN_AGE) return false; // too new
  if (s.snoozedUntil && now < s.snoozedUntil) return false; // snoozed / backed off
  if ((s.dismissCount ?? 0) >= HARD_STOP) return false; // they've declined enough
  if (s.lastShownAt && now - s.lastShownAt < COOLDOWN) return false; // within cooldown
  return true;
}

/** Record that the nudge was shown (starts the cooldown). */
export async function recordUpsellShown(): Promise<void> {
  const s = await read();
  await write({ ...s, lastShownAt: Date.now(), shownCount: (s.shownCount ?? 0) + 1 });
}

/** "Not now" — count the decline and back off further each time. */
export async function dismissUpsell(): Promise<void> {
  const s = await read();
  const n = (s.dismissCount ?? 0) + 1;
  const rest = n >= HARD_STOP ? LONG_REST : n * 7 * DAY;
  await write({ ...s, dismissCount: n, snoozedUntil: Date.now() + rest, lastShownAt: Date.now() });
}

/** They opened the paywall themselves — rest the nudge WITHOUT counting a decline. */
export async function restUpsellAfterEngage(): Promise<void> {
  const s = await read();
  await write({ ...s, snoozedUntil: Date.now() + ENGAGE_REST, lastShownAt: Date.now() });
}
