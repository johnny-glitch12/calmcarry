/**
 * hasParentPin() must FAIL CLOSED.
 *
 * It decides whether the gate offers "choose a PIN" (no PIN yet) or demands one (PIN
 * exists). A swallowed Keychain read error used to look like "no PIN", so a single
 * transient failure opened the create-a-PIN path - letting a child set a fresh secret
 * and walk out of Kids Mode, and un-gating account deletion, profile removal and
 * purchases at the same time.
 *
 * These drive the real module against a fake expo-secure-store whose read can be made
 * to throw, absent, corrupt, or valid.
 */
let mockGet: (k: string) => Promise<string | null> = async () => null;

jest.mock('expo-secure-store', () => ({
  getItemAsync: (k: string) => mockGet(k),
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
}));

const KEY = 'cc.parentPin';
const valid = JSON.stringify({ hash: 'h', salt: 's', fails: 0, lockedUntil: 0 });

let hasParentPin: typeof import('../parentGate').hasParentPin;
beforeEach(() => {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  hasParentPin = require('../parentGate').hasParentPin;
});

describe('hasParentPin fail-closed', () => {
  it('a genuinely absent key means no PIN (create is allowed)', async () => {
    // POSITIVE CONTROL: without this, "always true" would pass every test below and
    // no parent could ever set a first PIN.
    mockGet = async () => null;
    expect(await hasParentPin()).toBe(false);
  });

  it('a valid record means a PIN exists', async () => {
    mockGet = async () => valid;
    expect(await hasParentPin()).toBe(true);
  });

  it('THE BUG: a read that THROWS is treated as "PIN exists", not "no PIN"', async () => {
    mockGet = async () => {
      throw new Error('keychain unavailable');
    };
    expect(await hasParentPin()).toBe(true);
  });

  it('a corrupt record is treated as "PIN exists", never as absent', async () => {
    mockGet = async () => '{not json';
    expect(await hasParentPin()).toBe(true);
  });

  it('only reads the parent-PIN key', async () => {
    const seen: string[] = [];
    mockGet = async (k) => {
      seen.push(k);
      return null;
    };
    await hasParentPin();
    expect(seen).toEqual([KEY]);
  });
});
