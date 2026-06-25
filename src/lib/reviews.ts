/**
 * In-app store review — web/default stub. The real implementation lives in
 * reviews.native.ts (expo-store-review is a native-only affordance). Metro picks
 * the .native.ts file on device and this no-op on web, keeping expo-store-review
 * out of the web bundle (same isolation pattern as iap.ts / monitoring.ts).
 */
export async function maybeRequestReview(_opts: { kids: boolean }): Promise<void> {
  /* no-op on web */
}
