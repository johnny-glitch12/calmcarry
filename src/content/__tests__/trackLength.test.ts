import { TRACKS, trackLoops, type Track } from '../library';

/**
 * `duration` is DISPLAY COPY - nothing in the player reads it. A finite track ends
 * either when its audio file runs out (didJustFinish) or at `lengthSec`, whichever
 * comes first. So any finite track that advertises a time MUST carry a lengthSec,
 * or the label is a promise the app does not keep.
 *
 * REGRESSION GUARD: moving box-breathing off its 180s narrated file onto the shared
 * 422s `drone` bed silently turned an advertised "3 min" session into 7m02s -
 * including day 2 of the free "first 7 nights" programme. A green suite missed it
 * because no test related the label to the audio.
 */

// Measured with ffprobe 2026-07-24; keep in sync if an asset is replaced.
const ASSET_SECONDS: Partial<Record<string, number>> = {
  drone: 422.0,
  guidedBox: 180.0,
  guidedRest: 240.0,
  guidedLetGo: 240.0,
  gymnopedie: 204.8,
};

/**
 * How far a finite track may run past its label before it needs a hard cap.
 * A recorded piece rarely lands exactly on a round minute, and hard-cutting music
 * mid-phrase is worse for the listener than a few seconds of overrun - Gymnopédie
 * is 3m25s against a "3 min" label (+14%) and should be allowed to finish. What is
 * NOT acceptable is a track running materially longer than sold: the drone-backed
 * pacers ran 422s against "3 min" (+134%). 25% is the line between "rounded" and
 * "not the session you were promised".
 */
const OVERRUN_TOLERANCE = 1.25;

const parseAdvertisedSeconds = (duration: string): number | null => {
  const m = /^(\d+)\s*min$/.exec(duration.trim());
  return m ? parseInt(m[1], 10) * 60 : null;
};

const finiteTracks = Object.values(TRACKS).filter((t) => !trackLoops(t));

describe('advertised duration vs what actually plays', () => {
  it('has finite tracks to check', () => {
    expect(finiteTracks.length).toBeGreaterThan(0);
  });

  it.each(finiteTracks.map((t) => [t.id, t] as [string, Track]))(
    '%s does not overrun the time it advertises',
    (_id, track) => {
      const advertised = parseAdvertisedSeconds(track.duration);
      if (advertised == null) return; // no time promised (e.g. "loops"), nothing to enforce

      const assetLen = ASSET_SECONDS[track.audio];
      // If the bed runs materially longer than the promise, lengthSec MUST cap it.
      if (assetLen != null && assetLen > advertised * OVERRUN_TOLERANCE) {
        expect(track.lengthSec).toBeDefined();
        expect(track.lengthSec).toBeLessThanOrEqual(advertised + 1);
      }

      // And when lengthSec is set it must match the label, not contradict it.
      if (track.lengthSec != null) {
        expect(Math.abs(track.lengthSec - advertised)).toBeLessThanOrEqual(1);
      }
    },
  );

  it('every drone-backed breathing pacer is capped to its advertised 3 minutes', () => {
    const pacers = Object.values(TRACKS).filter((t) => t.category === 'breathing' && t.audio === 'drone');
    expect(pacers.length).toBeGreaterThanOrEqual(4);
    for (const p of pacers) {
      expect(p.duration).toBe('3 min');
      expect(p.lengthSec).toBe(180);
    }
  });

  it('lengthSec is never set on a looping track (it would cut an all-night bed short)', () => {
    for (const t of Object.values(TRACKS)) {
      if (trackLoops(t)) expect(t.lengthSec).toBeUndefined();
    }
  });
});
