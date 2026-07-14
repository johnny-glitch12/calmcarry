import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProgramDone, markProgramStepDone } from '../programs';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('program progress (non-failable, real)', () => {
  it('starts empty', async () => {
    expect(await getProgramDone('night-reset')).toEqual([]);
  });

  it('marks a step done and reads it back', async () => {
    await markProgramStepDone('night-reset', 2);
    expect(await getProgramDone('night-reset')).toEqual([2]);
  });

  it('is idempotent - marking the same day twice does not duplicate', async () => {
    await markProgramStepDone('night-reset', 1);
    await markProgramStepDone('night-reset', 1);
    expect(await getProgramDone('night-reset')).toEqual([1]);
  });

  it('keeps days sorted and isolates programs', async () => {
    await markProgramStepDone('night-reset', 3);
    await markProgramStepDone('night-reset', 1);
    await markProgramStepDone('after-school', 2);
    expect(await getProgramDone('night-reset')).toEqual([1, 3]);
    expect(await getProgramDone('after-school')).toEqual([2]);
  });
});
