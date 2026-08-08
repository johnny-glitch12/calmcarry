import { api } from '../api';
import { setKidsActive, KidsModeBlockedError } from '../kidsMode';

/**
 * No AUTHENTICATED request leaves the device while a child profile is active.
 *
 * The app promises parents, and tells the App Store, that Kids Mode makes no network
 * requests. The review found several that did: entitlement re-validation on every
 * foreground, the prefs sync, Kids Home focus calls - each an account-authenticated
 * request carrying the parent's bearer token. Rather than trust every call site to
 * remember its own guard (two already forgot), the API client itself refuses to
 * transmit an authenticated request when Kids Mode is active.
 */
const okJson = { ok: true, isPremium: false };
let fetchMock: jest.Mock;

beforeEach(() => {
  fetchMock = jest.fn(async () => ({ ok: true, status: 200, json: async () => okJson }));
  (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
  setKidsActive(false); // start adult; each test opts into kids
});

describe('API client honours Kids Mode', () => {
  it('an authenticated call in kids mode is blocked and never reaches the network', async () => {
    setKidsActive(true);
    await expect(api.billingStatus('real-token')).rejects.toBeInstanceOf(KidsModeBlockedError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('the SAME call in adult mode goes through', async () => {
    // POSITIVE CONTROL: proves the block is conditional, not a blanket failure that
    // would make every test above pass for the wrong reason.
    setKidsActive(false);
    await api.billingStatus('real-token');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('an UNauthenticated call is allowed even in kids mode', async () => {
    // sign-in / register / token refresh carry no account context and no child data,
    // and are how a session is established or recovered - blocking them would strand
    // the app, and they leak nothing.
    setKidsActive(true);
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ contentId: 'x' }) });
    await api.recommend('wired'); // no token argument
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a device-only (local) session is not treated as an authenticated account', async () => {
    setKidsActive(true);
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => okJson });
    // 'local' has no server account behind it, so it is not blocked
    await api.getPrefs('local');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('leaving kids mode restores authenticated calls', async () => {
    setKidsActive(true);
    await expect(api.billingStatus('real-token')).rejects.toBeInstanceOf(KidsModeBlockedError);
    setKidsActive(false);
    await api.billingStatus('real-token');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
