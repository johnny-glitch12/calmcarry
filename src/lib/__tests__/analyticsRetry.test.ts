import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * A batch the server will reject forever must not be retried forever.
 *
 * flush() treated every failure as transient and kept the buffer. A 400 or 413 - a
 * verdict the server repeats every time - was therefore resent on every schedule()
 * for the life of the install. Worse, a flush always takes events from the HEAD of
 * the buffer, so that one bad batch blocked every event queued behind it too: the
 * queue could never drain again.
 */
const mockTrackEvents = jest.fn(async () => ({ ok: true }));
jest.mock('../api', () => ({ api: { trackEvents: (...a: unknown[]) => mockTrackEvents(...(a as [])) } }));

class HttpError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
  }
}

const BUF_KEY = 'cc.analyticsQueue';

let lastKidsMode: typeof import('../kidsMode');
async function loadQueue(kidsActive = false) {
  let analytics: typeof import('../analytics');
  jest.isolateModules(() => {
    // These tests model a session with a known profile. kidsMode defaults to "a
    // child MIGHT be active" (fail-closed for the boot window), so publish the
    // profile the way ProfileProvider does at runtime before analytics loads.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    lastKidsMode = require('../kidsMode') as typeof import('../kidsMode');
    lastKidsMode.setKidsActive(kidsActive);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    analytics = require('../analytics');
  });
  return analytics!;
}

/** Seed a persisted buffer, then flush it under a given server behaviour. */
async function flushWith(fail: Error | null) {
  await AsyncStorage.clear();
  const a = await loadQueue();
  await a.setAnalyticsOptOut(false);
  await a.track('one');
  await a.track('two');
  mockTrackEvents.mockReset();
  mockTrackEvents.mockImplementation(async () => {
    if (fail) throw fail;
    return { ok: true };
  });
  await a.flush();
  const persisted = JSON.parse((await AsyncStorage.getItem(BUF_KEY)) ?? 'null');
  return { analytics: a, persisted };
}

describe('analytics flush - which failures are worth retrying', () => {
  // a retryable failure calls schedule(), which leaves a real 15s timer holding the
  // process open. None of these tests depend on it firing.
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('a successful flush clears the queue', async () => {
    // POSITIVE CONTROL: proves the harness actually sends and drains.
    const { persisted } = await flushWith(null);
    expect(mockTrackEvents).toHaveBeenCalled();
    expect(persisted).toBeNull();
  });

  it('THE BUG: a definitive 4xx drops the batch instead of looping on it', async () => {
    const { persisted } = await flushWith(new HttpError(400));
    expect(persisted).toBeNull(); // nothing left to retry forever
  });

  it('413 Payload Too Large is also permanent', async () => {
    const { persisted } = await flushWith(new HttpError(413));
    expect(persisted).toBeNull();
  });

  it('a 5xx is kept for the next attempt', async () => {
    const { persisted } = await flushWith(new HttpError(503));
    expect(persisted).toHaveLength(2);
  });

  it('429 Too Many Requests is kept - it explicitly means try later', async () => {
    const { persisted } = await flushWith(new HttpError(429));
    expect(persisted).toHaveLength(2);
  });

  it('408 Request Timeout is kept', async () => {
    const { persisted } = await flushWith(new HttpError(408));
    expect(persisted).toHaveLength(2);
  });

  it('a network error with no status is kept - it never reached the server', async () => {
    const { persisted } = await flushWith(new Error('Network request failed'));
    expect(persisted).toHaveLength(2);
  });

  it('after a permanent reject the queue accepts and sends new events', async () => {
    // the real damage was the head-of-line block: prove the queue recovers
    const { analytics } = await flushWith(new HttpError(400));
    mockTrackEvents.mockReset();
    mockTrackEvents.mockImplementation(async () => ({ ok: true }));
    await analytics.track('after');
    await analytics.flush();
    expect(mockTrackEvents).toHaveBeenCalledTimes(1);
    const sent = mockTrackEvents.mock.calls[0][1] as { name: string }[];
    expect(sent.map((e) => e.name)).toEqual(['after']);
  });

  it('a kid session HOLDS the queue: nothing transmits, nothing is lost', async () => {
    // The kids-mode promise is no network during a child's session - including
    // ADULT events buffered before the profile switch (the batch request carries
    // the install's anonId). This models the exact boot window: analytics' own
    // kidsActive flag still says adult (ProfileProvider hasn't published), so
    // track() buffers - but kidsMode says a kid may be active, so flush() must
    // defer: not send, not drop.
    await AsyncStorage.clear();
    const a = await loadQueue(true);
    await a.setAnalyticsOptOut(false);
    await a.track('buffered-adult-event');
    mockTrackEvents.mockReset();
    mockTrackEvents.mockImplementation(async () => ({ ok: true }));
    await a.flush();
    expect(mockTrackEvents).not.toHaveBeenCalled();

    // the adult takes the device back: the held queue drains intact
    lastKidsMode.setKidsActive(false);
    await a.flush();
    expect(mockTrackEvents).toHaveBeenCalledTimes(1);
    const sent = mockTrackEvents.mock.calls[0][1] as { name: string }[];
    expect(sent.map((e) => e.name)).toEqual(['buffered-adult-event']);
  });
});
