import AsyncStorage from '@react-native-async-storage/async-storage';
import { CALM_NIGHTS_GOAL, getCalmNights, markCalmNightToday } from '../calmNights';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('kids calm-nights (earned, capped, non-failable)', () => {
  it('starts at 0 — never a fake default', async () => {
    expect(await getCalmNights()).toBe(0);
  });

  it('earns at most one star per day', async () => {
    expect(await markCalmNightToday()).toBe(1);
    expect(await markCalmNightToday()).toBe(1); // same day → no double count
    expect(await getCalmNights()).toBe(1);
  });

  it('never exceeds the weekly goal', async () => {
    // simulate many earned nights regardless of the daily gate
    await AsyncStorage.setItem('cc.calmNights', JSON.stringify(99));
    expect(await getCalmNights()).toBe(CALM_NIGHTS_GOAL);
  });
});
