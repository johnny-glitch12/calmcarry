import { PROGRAMS, TRACKS } from '../library';

/**
 * Guard the trust promise: the FREE "first 7 nights" starter arc must never include a
 * locked/premium track (a free user has to be able to finish all 7 nights). This test
 * fails loudly if anyone re-points a step at a paid track.
 */
describe('first-week free starter arc', () => {
  const program = PROGRAMS['first-week'];

  it('exists and is not itself locked', () => {
    expect(program).toBeTruthy();
    expect(program.locked).toBeFalsy();
  });

  it('every step resolves to a FREE track', () => {
    for (const step of program.steps) {
      expect(step.trackId).toBeTruthy();
      const track = TRACKS[step.trackId as string];
      expect(track).toBeTruthy();
      expect(track.locked ?? false).toBe(false);
    }
  });
});
