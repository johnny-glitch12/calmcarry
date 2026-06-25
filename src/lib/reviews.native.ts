import * as StoreReview from 'expo-store-review';

import { getCalmNights } from './calmNights';
import { getJSON, setJSON } from './store';

/**
 * Ask for an App Store / Play review at the natural PEAK-END moment (the gentle
 * close after a wind-down), and only when the user has clearly gotten value:
 *  - never in Kids mode
 *  - never on first use — at least MIN_NIGHTS earned calm nights
 *  - at most ONCE, ever (the OS also rate-limits, but we never re-ask ourselves)
 * Wrapped so a review prompt can never disrupt the calm close-out.
 */
const PROMPTED_KEY = 'cc.reviewPrompted';
const MIN_NIGHTS = 3;

export async function maybeRequestReview(opts: { kids: boolean }): Promise<void> {
  if (opts.kids) return;
  if (await getJSON<boolean>(PROMPTED_KEY, false)) return;
  if ((await getCalmNights()) < MIN_NIGHTS) return;
  try {
    if (await StoreReview.isAvailableAsync()) {
      await StoreReview.requestReview();
      await setJSON(PROMPTED_KEY, true);
    }
  } catch {
    /* never let a review prompt break the wind-down */
  }
}
