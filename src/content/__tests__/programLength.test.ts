import { PROGRAMS, programLength, TRACKS } from '../library';

/**
 * The honesty contract for programs: the advertised "<n>-week reset" / "<n> nights"
 * label is DERIVED from the steps, and the steps must actually be there. Before
 * this rule, "The 3 a.m. Reset" was sold as a 2-week reset with 5 nights inside
 * and "Evening Wind-down" as a 3-week reset with 3.
 */
describe('program length honesty', () => {
  const programs = Object.values(PROGRAMS);

  it('every advertised label matches the actual steps count', () => {
    for (const p of programs) {
      const label = programLength(p);
      const week = label.match(/^(\d+)-week reset$/);
      const nights = label.match(/^(\d+) nights$/);
      expect(week || nights).toBeTruthy();
      if (week) expect(p.steps.length).toBe(Number(week[1]) * 7);
      if (nights) expect(p.steps.length).toBe(Number(nights[1]));
    }
  });

  it('steps run day 1..n with no gaps (the label counts real nights)', () => {
    for (const p of programs) {
      p.steps.forEach((step, i) => expect(step.day).toBe(i + 1));
    }
  });

  it('every step resolves to a bundled track', () => {
    for (const p of programs) {
      for (const step of p.steps) {
        expect(step.trackId).toBeTruthy();
        expect(TRACKS[step.trackId as string]).toBeTruthy();
      }
    }
  });

  it('the paid resets deliver the length they are sold at', () => {
    expect(PROGRAMS['night-reset'].steps).toHaveLength(14); // 2-week reset
    expect(PROGRAMS['evening-ritual'].steps).toHaveLength(21); // 3-week reset
  });
});
