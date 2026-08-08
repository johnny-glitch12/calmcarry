import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { usePathname } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { audioSources } from '@/content/audio';
import { type CoverKey } from '@/content/covers';
import { TRACKS, trackLoops } from '@/content/library';
import { useAuth } from '@/features/auth/AuthProvider';
import { getJSON, remove, setJSON } from '@/lib/store';

// One mixer layer = one loopable track (keyed by its track id, so two beds that
// share an audio file each get their own fader). 0 = off, 1 = low, 2 = med, 3 = full.
export type MixSound = { id: string; label: string; cover: CoverKey; premium: boolean };
export type MixGroup = { key: string; label: string; sounds: MixSound[] };
export type SavedMix = { name: string; levels: Record<string, number> };

// §6.1: the sound machine keeps a small free tier. Rain is the flagship free bed
// here even though the "Rainfall" TRACK is a premium Player track - the sound
// machine and the Player gate independently (ocean / brown / the kids ocean are
// already free by their own flags, so this list only needs to free rain).
const FREE_MIX_IDS = new Set<string>(['rainfall']);

// Legacy shares/saves keyed by the old AudioKey palette (rain / ocean / ...) still
// arrive from already-published community posts + older cc.mixes. Map them onto
// the canonical track ids so a saved blend from before this change still loads.
// 'drone' (the old "Soft hum") has no loopable track and is simply dropped.
const LEGACY_KEY_MAP: Record<string, string> = {
  rain: 'rainfall',
  ocean: 'slow-tide',
  brown: 'brown-noise',
  pink: 'pink-noise',
  white: 'white-noise',
  fire: 'fireside',
  birdsong: 'dawn-chorus',
  green: 'green-noise',
};

// The whole loopable catalog, grouped by kind. Built once at module load from the
// content library so the palette grows with the CMS, never by hand. Finite pieces
// (guided sessions, breathing, timed music) are excluded by trackLoops.
export const MIX_CATALOG: MixGroup[] = (() => {
  const groups: Record<string, MixGroup> = {
    nature: { key: 'nature', label: 'Nature', sounds: [] },
    noise: { key: 'noise', label: 'Noise & hums', sounds: [] },
    music: { key: 'music', label: 'Music', sounds: [] },
  };
  for (const id of Object.keys(TRACKS)) {
    const t = TRACKS[id];
    if (!trackLoops(t)) continue;
    const g = t.category === 'noise' ? 'noise' : t.category === 'music' ? 'music' : 'nature';
    groups[g].sounds.push({
      id,
      label: t.title,
      cover: t.cover,
      premium: !!t.locked && !FREE_MIX_IDS.has(id),
    });
  }
  return [groups.nature, groups.noise, groups.music].filter((g) => g.sounds.length > 0);
})();

// Flat, deterministic order for the anchor pick + mix naming.
export const CATALOG_ORDER: string[] = MIX_CATALOG.flatMap((g) => g.sounds.map((s) => s.id));
const KNOWN_IDS = new Set(CATALOG_ORDER);

/** Normalise an incoming (possibly legacy) mix key to a catalog track id, or null. */
function normalizeMixKey(k: string): string | null {
  if (KNOWN_IDS.has(k)) return k;
  const mapped = LEGACY_KEY_MAP[k];
  return mapped && KNOWN_IDS.has(mapped) ? mapped : null;
}

// Full-screen routes that own the audio while they're up (they have their own
// player). The mix DUCKS - pauses - under them, and resumes when a tab is back.
const DUCK_ROUTES = ['/player', '/wind-down', '/sos'];

type PlaybackValue = {
  /** track id → level (0..3). Only toggled ids appear. */
  levels: Record<string, number>;
  /** ids currently playing (level > 0), in catalog order */
  activeLayers: string[];
  anyOn: boolean;
  /** user-paused via the mini-player (distinct from a route duck) */
  paused: boolean;
  toggle: (id: string) => void;
  setVolume: (id: string, level: number) => void;
  togglePause: () => void;
  stopAll: () => void;
  /** sleep timer in minutes (0 = off) */
  sleepMinutes: number;
  setSleepTimer: (mins: number) => void;
  mixes: SavedMix[];
  saveMix: () => void;
  /** load a saved mix; result reports whether anything played and how many paid sounds
   *  were blocked, so the caller can offer the paywall for a fully-locked mix */
  loadMix: (m: SavedMix) => ApplyLevelsResult;
  /** apply a mix from a saved chip or a shared community card (re-gated + clamped) */
  applyExternalLevels: (incoming: Record<string, number>) => ApplyLevelsResult;
};

/** Outcome of applying a mix: how many sounds started, and how many paid ones were
 *  skipped because the user isn't premium. applied===0 && blockedPremium>0 = a mix that
 *  is entirely locked for this user. */
export type ApplyLevelsResult = { applied: number; blockedPremium: number };

const PlaybackContext = createContext<PlaybackValue>({
  levels: {},
  activeLayers: [],
  anyOn: false,
  paused: false,
  toggle: () => {},
  setVolume: () => {},
  togglePause: () => {},
  stopAll: () => {},
  sleepMinutes: 0,
  setSleepTimer: () => {},
  mixes: [],
  saveMix: () => {},
  loadMix: () => ({ applied: 0, blockedPremium: 0 }),
  applyExternalLevels: () => ({ applied: 0, blockedPremium: 0 }),
});

/**
 * PlaybackProvider - OWNS the layered sound players for the whole tabs group, so a
 * running mix survives leaving the Listen tab. Players are created lazily (one per
 * track id as it is first toggled on) and kept alive until the tabs group unmounts.
 * The wall-clock sleep timer lives here too, so it ends the night from any tab.
 */
export function PlaybackProvider({ children }: { children: ReactNode }) {
  const { isPremium } = useAuth();
  const pathname = usePathname();
  const ducked = DUCK_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'));

  const [levels, setLevels] = useState<Record<string, number>>({});
  const [sleepMinutes, setSleepMinutes] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [mixes, setMixes] = useState<SavedMix[]>([]);

  // lazily-created players, keyed by track id (kept across tab switches)
  const playersRef = useRef<Map<string, ReturnType<typeof createAudioPlayer>>>(new Map());
  // wall-clock deadline for the sleep timer. A raw setTimeout is suspended while
  // the phone is locked and would never fire at 3am; the ~2s poll below reads this.
  const endAtRef = useRef<number | null>(null);
  const fadeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const anchorRef = useRef<string | null>(null);
  // latest values in refs so the poll / fade closures read current state
  const levelsRef = useRef(levels);
  const duckedRef = useRef(ducked);
  const userPausedRef = useRef(userPaused);
  /** True when WE paused the mix for an OS interruption (call/Siri/alarm), so it can
   *  be resumed on foreground. Never set by a deliberate user pause. */
  const autoPausedRef = useRef(false);
  useEffect(() => {
    levelsRef.current = levels;
    duckedRef.current = ducked;
    userPausedRef.current = userPaused;
  });

  const ensurePlayer = useCallback((id: string) => {
    let p = playersRef.current.get(id);
    if (!p) {
      const track = TRACKS[id];
      if (!track) return null;
      p = createAudioPlayer(audioSources[track.audio]);
      p.loop = true;
      playersRef.current.set(id, p);
    }
    return p;
  }, []);

  // Reflect levels → playback. Iterates the union of live players and level keys so
  // a sound dropped from the set (stopAll / a fresh mix) is paused, not left ringing.
  // While ducked or user-paused, everything pauses; un-ducking resumes the mix.
  useEffect(() => {
    const ids = new Set<string>([...playersRef.current.keys(), ...Object.keys(levels)]);
    ids.forEach((id) => {
      const lvl = levels[id] ?? 0;
      const p = lvl > 0 ? ensurePlayer(id) : playersRef.current.get(id) ?? null;
      if (!p) return;
      try {
        p.volume = lvl / 3;
        if (lvl > 0 && !ducked && !userPaused) p.play();
        else p.pause();
      } catch {
        /* released */
      }
    });
  }, [levels, ducked, userPaused, ensurePlayer]);

  const activeLayers = useMemo(() => CATALOG_ORDER.filter((id) => (levels[id] ?? 0) > 0), [levels]);
  const anyOn = activeLayers.length > 0;

  // Lock-screen session for the mixer. ONE anchor player (the first active sound)
  // carries the OS session - on Android that keeps background audio alive past
  // ~3 minutes (expo-audio v56) and gives the lock screen a real pause. Released
  // while ducked (the Player owns the lock screen then) or user-paused; reclaimed
  // on resume. isLiveStream hides the seek bar - these are endless loops.
  useEffect(() => {
    const first = !ducked && !userPaused ? activeLayers[0] ?? null : null;
    const prev = anchorRef.current;
    if (prev && prev !== first) {
      try {
        playersRef.current.get(prev)?.clearLockScreenControls();
      } catch {
        /* released */
      }
    }
    anchorRef.current = first;
    if (first && first !== prev) {
      try {
        playersRef.current.get(first)?.setActiveForLockScreen(
          true,
          { title: 'Sound machine', artist: 'CalmCarry' },
          { showSeekBackward: false, showSeekForward: false, isLiveStream: true },
        );
      } catch {
        /* platform without lock-screen support */
      }
    }
  }, [activeLayers, ducked, userPaused]);

  const stopAll = useCallback(() => {
    if (fadeRef.current) clearInterval(fadeRef.current);
    fadeRef.current = null;
    setLevels({});
    setSleepMinutes(0);
    setUserPaused(false);
    endAtRef.current = null;
    remove('cc.sleepTimer');
  }, []);

  // At the timer boundary, ramp every active sound to silence over ~3.5s and THEN
  // stop - a hard cut is jarring for someone already drifting off.
  const fadeAndStop = useCallback(() => {
    if (fadeRef.current) clearInterval(fadeRef.current);
    let f = 1;
    fadeRef.current = setInterval(() => {
      f -= 0.08;
      for (const [id, p] of playersRef.current) {
        try {
          p.volume = ((levelsRef.current[id] ?? 0) / 3) * Math.max(f, 0);
        } catch {
          /* released */
        }
      }
      if (f <= 0) stopAll();
    }, 300);
  }, [stopAll]);

  // Background playback + restore a still-running timer / saved mixes on mount.
  // On unmount (tabs group torn down) release every native player.
  useEffect(() => {
    // all-night background playback with the screen off; doNotMix also drives the
    // lock-screen controls (expo-audio v56).
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' }).catch(() => {});
    getJSON<SavedMix[]>('cc.mixes', []).then((m) => setMixes(Array.isArray(m) ? m : []));
    // Do NOT restore the sleep timer as active on a cold start. The mixer's live sound
    // levels are not persisted, and audio does not resume after the app is killed - so
    // restoring the timer left it showing "active, 20 min left" with total silence and
    // nothing to stop. A sleep timer only means something while sound is playing, so a
    // fresh launch clears any stale one. (While the app is merely backgrounded the
    // provider stays mounted and endAtRef keeps the timer running - this only affects a
    // true cold start.)
    remove('cc.sleepTimer');
    const players = playersRef.current;
    return () => {
      if (fadeRef.current) clearInterval(fadeRef.current);
      const a = anchorRef.current;
      if (a) {
        try {
          players.get(a)?.clearLockScreenControls();
        } catch {
          /* released */
        }
      }
      for (const [, p] of players) {
        try {
          p.pause();
        } catch {
          /* released */
        }
        try {
          p.remove();
        } catch {
          /* released */
        }
      }
      players.clear();
    };
  }, []);

  // This ~2s poll is what actually ends the night: background audio keeps the JS
  // runtime alive with the phone locked (where a raw setTimeout is suspended), so
  // it fires the sleep timer at its wall-clock deadline AND notices a lock-screen
  // pause (which only reaches the anchor player) so the whole mix follows with the
  // usual gentle fade. A duck / user-pause is our own doing, so it never mistakes
  // that for a lock-screen stop.
  useEffect(() => {
    if (!anyOn && sleepMinutes <= 0) return;
    const id = setInterval(() => {
      const end = endAtRef.current;
      if (end != null && Date.now() >= end) {
        endAtRef.current = null; // fire once - the fade itself takes ~3.5s
        fadeAndStop();
        return;
      }
      if (duckedRef.current || userPausedRef.current) return;
      const a = anchorRef.current;
      if (!a) return;
      try {
        const p = playersRef.current.get(a);
        if (p && (levelsRef.current[a] ?? 0) > 0 && !p.playing) {
          // The anchor stopped and it was NOT our doing. PAUSE, never destroy.
          // With interruptionMode 'doNotMix' the OS pauses every player on ANY
          // interruption - an incoming call, Siri, an alarm - which produces exactly
          // this signal. Tearing the mix down here wiped the levels, the sleep
          // timer and the persisted deadline, so a 30-second call silently ended
          // the whole night. userPaused preserves all of it (and the deadline check
          // above still fires), so the timer survives and the mix can resume.
          autoPausedRef.current = true;
          setUserPaused(true);
        }
      } catch {
        /* released */
      }
    }, 2000);
    return () => clearInterval(id);
  }, [anyOn, sleepMinutes, fadeAndStop]);

  // With no audio playing the JS runtime (poll included) IS suspended in the
  // background - recheck the deadline the moment the app is foregrounded so an
  // elapsed timer fades right away instead of waiting on the next poll tick.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      const end = endAtRef.current;
      if (end != null && Date.now() >= end) {
        endAtRef.current = null;
        fadeAndStop();
        return;
      }
      // Resume a mix that WE auto-paused for an OS interruption (call/Siri/alarm).
      // Only ever clears our own auto-pause - a deliberate user pause is untouched.
      if (autoPausedRef.current) {
        autoPausedRef.current = false;
        setUserPaused(false);
      }
    });
    return () => sub.remove();
  }, [fadeAndStop]);

  const toggle = useCallback((id: string) => {
    const on = (levelsRef.current[id] ?? 0) > 0;
    if (!on) setUserPaused(false); // turning a sound on resumes a paused mix
    // start at medium, never full - a face-full of max-volume rain at 3am jolts a
    // drowsy user (and a sleeping partner) awake; the level bars still allow one tap up.
    setLevels((prev) => ({ ...prev, [id]: (prev[id] ?? 0) > 0 ? 0 : 2 }));
  }, []);

  const setVolume = useCallback((id: string, level: number) => {
    const clamped = Math.max(0, Math.min(3, level));
    if (clamped > 0) setUserPaused(false);
    setLevels((prev) => ({ ...prev, [id]: clamped }));
  }, []);

  const togglePause = useCallback(() => setUserPaused((p) => !p), []);

  const setSleepTimer = useCallback((mins: number) => {
    setSleepMinutes(mins);
    if (mins > 0) {
      const endAt = Date.now() + mins * 60 * 1000;
      endAtRef.current = endAt;
      setJSON('cc.sleepTimer', { endAt, mins });
    } else {
      endAtRef.current = null;
      remove('cc.sleepTimer');
    }
  }, []);

  // Apply a mix from a saved chip or a shared community card. Only known keys are
  // honoured (legacy AudioKeys mapped), levels clamped, and any premium sound a
  // free user can't access is zeroed - a shared mix can never unlock paid sounds.
  const applyExternalLevels = useCallback(
    (incoming: Record<string, number>): ApplyLevelsResult => {
      const next: Record<string, number> = {};
      let blockedPremium = 0;
      for (const [rawK, v] of Object.entries(incoming)) {
        if (typeof v !== 'number' || v <= 0) continue;
        const id = normalizeMixKey(rawK);
        if (!id) continue;
        const t = TRACKS[id];
        const premium = !!t?.locked && !FREE_MIX_IDS.has(id);
        if (premium && !isPremium) {
          blockedPremium += 1; // a paid sound this free user can't play
          continue;
        }
        next[id] = Math.max(1, Math.min(3, Math.round(v)));
      }
      const applied = Object.keys(next).length;
      // If EVERY sound in the mix was a paid one this user can't play, don't silently
      // set an empty mix (a dead, no-op chip). Leave playback untouched and tell the
      // caller so it can offer the paywall instead.
      if (applied === 0) return { applied: 0, blockedPremium };
      setUserPaused(false);
      setLevels(next);
      return { applied, blockedPremium };
    },
    [isPremium],
  );

  const saveMix = useCallback(() => {
    const active = CATALOG_ORDER.filter((id) => (levelsRef.current[id] ?? 0) > 0);
    if (!active.length) return;
    // name the mix from its active sounds so chips are self-describing ("Rain · Ocean")
    const name = active.slice(0, 3).map((id) => TRACKS[id]?.title ?? 'Sound').join(' · ');
    const savedLevels: Record<string, number> = {};
    active.forEach((id) => (savedLevels[id] = levelsRef.current[id]));
    setMixes((prev) => {
      const nextMixes = [...prev, { name, levels: savedLevels }].slice(-12);
      setJSON('cc.mixes', nextMixes);
      return nextMixes;
    });
  }, []);

  const loadMix = useCallback((m: SavedMix) => applyExternalLevels(m.levels), [applyExternalLevels]);
  // ^ returns ApplyLevelsResult so a caller can route a fully-locked mix to the paywall

  const value = useMemo<PlaybackValue>(
    () => ({
      levels,
      activeLayers,
      anyOn,
      paused: userPaused,
      toggle,
      setVolume,
      togglePause,
      stopAll,
      sleepMinutes,
      setSleepTimer,
      mixes,
      saveMix,
      loadMix,
      applyExternalLevels,
    }),
    [levels, activeLayers, anyOn, userPaused, toggle, setVolume, togglePause, stopAll, sleepMinutes, setSleepTimer, mixes, saveMix, loadMix, applyExternalLevels],
  );

  return <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>;
}

export function usePlayback() {
  return useContext(PlaybackContext);
}
