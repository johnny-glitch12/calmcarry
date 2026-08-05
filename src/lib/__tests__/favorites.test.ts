import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getFavorites,
  getFavoritesUpdatedAt,
  reconcileFavorites,
  replaceFavorites,
  toggleFavorite,
} from '../favorites';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('favourites storage', () => {
  it('starts empty and unstamped', async () => {
    expect(await getFavorites()).toEqual([]);
    expect(await getFavoritesUpdatedAt()).toBe(0);
  });

  it('toggles on, then off, and the removal survives a re-read', async () => {
    expect(await toggleFavorite('rain-window')).toBe(true);
    expect(await getFavorites()).toEqual(['rain-window']);

    expect(await toggleFavorite('rain-window')).toBe(false);
    expect(await getFavorites()).toEqual([]);
  });

  it('stamps the list on every edit', async () => {
    const before = Date.now();
    await toggleFavorite('fireside');
    const at = await getFavoritesUpdatedAt();
    expect(at).toBeGreaterThanOrEqual(before);
    expect(at).toBeLessThanOrEqual(Date.now());
  });

  it('adopting a remote list takes the remote stamp, and does NOT restamp to now', async () => {
    // the whole mechanism breaks if adopting looks like editing: this device would
    // win every future comparison and no other device could ever remove anything.
    await replaceFavorites(['a', 'b'], 1000);
    expect(await getFavorites()).toEqual(['a', 'b']);
    expect(await getFavoritesUpdatedAt()).toBe(1000);
  });

  it('ignores a corrupt stamp rather than trusting it', async () => {
    await AsyncStorage.setItem('cc.favorites.updatedAt', JSON.stringify('not-a-number'));
    expect(await getFavoritesUpdatedAt()).toBe(0);
  });
});

describe('reconcileFavorites - the rule that decides if an unsave sticks', () => {
  it('THE BUG: a removal on the newer side is not resurrected by the older side', async () => {
    // device unsaved 'x' at t=200; the server copy still holds it from t=100.
    const { favorites } = reconcileFavorites([], 200, ['x'], 100);
    expect(favorites).toEqual([]);
    // a union would return ['x'] here - that was the shipped behaviour, and it made
    // every unsave silently undo itself on the next app open.
  });

  it('a removal made on the SERVER side propagates down to a stale device', () => {
    const { favorites } = reconcileFavorites(['x'], 100, [], 200);
    expect(favorites).toEqual([]);
  });

  it('an add still propagates in both directions', () => {
    expect(reconcileFavorites(['x'], 200, [], 100).favorites).toEqual(['x']);
    expect(reconcileFavorites([], 100, ['x'], 200).favorites).toEqual(['x']);
  });

  it('carries the newer stamp forward so the next device can compare', () => {
    expect(reconcileFavorites([], 200, ['x'], 100).updatedAt).toBe(200);
    expect(reconcileFavorites(['x'], 100, [], 200).updatedAt).toBe(200);
  });

  it('ties go to the local copy', () => {
    expect(reconcileFavorites(['local'], 500, ['server'], 500).favorites).toEqual(['local']);
  });

  it('legacy data with no stamp on either side falls back to a union', () => {
    // pre-upgrade accounts cannot distinguish an add from a delete, so for that one
    // reconcile keeping a save is the safer error.
    const { favorites, updatedAt } = reconcileFavorites(['a'], 0, ['b'], 0);
    expect(favorites.sort()).toEqual(['a', 'b']);
    expect(updatedAt).toBe(0);
  });

  it('a stamped side beats an unstamped side regardless of direction', () => {
    // an unstamped side has never made a deliberate edit, so it cannot outvote one.
    expect(reconcileFavorites([], 5, ['x'], 0).favorites).toEqual([]);
    expect(reconcileFavorites(['x'], 0, [], 5).favorites).toEqual([]);
  });

  it('preserves order rather than reordering the winning list', () => {
    // favourites are shown most-recent-first; a Set round-trip used to be the only
    // thing guaranteeing order, so assert the winner comes back untouched.
    const { favorites } = reconcileFavorites(['c', 'b', 'a'], 300, ['a'], 100);
    expect(favorites).toEqual(['c', 'b', 'a']);
  });
});

describe('end to end: unsave then reconcile', () => {
  it('an unsaved track stays unsaved after the next sign-in reconcile', async () => {
    await toggleFavorite('rain-window'); // saved
    await toggleFavorite('rain-window'); // unsaved

    const local = await getFavorites();
    const localAt = await getFavoritesUpdatedAt();
    // the server still holds the pre-removal copy, stamped earlier
    const { favorites, updatedAt } = reconcileFavorites(local, localAt, ['rain-window'], localAt - 1000);
    await replaceFavorites(favorites, updatedAt);

    expect(await getFavorites()).toEqual([]);
  });
});
