import { Feather } from '@expo/vector-icons';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Image as RNImage, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Appear, AppText, Crossfade, DragDismiss, PressableScale, ProgressRing, Screen, SelectionOverlay, SwapText } from '@/components';
import { lightTap } from '@/lib/haptics';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/profile/ProfileProvider';
import { SleepyStars } from '@/features/kids/SleepyStars';
import { SlidePuzzle } from '@/features/kids/SlidePuzzle';
import { audioSources } from '@/content/audio';
import { covers } from '@/content/covers';
import { TRACKS, WELLNESS_DISCLAIMER, trackLoops } from '@/content/library';
import { markFirstAudio, track as logEvent } from '@/lib/analytics';
import { resolveAudioSource } from '@/lib/audioSource';
import { markCalmNightToday } from '@/lib/calmNights';
import { isFavorite, toggleFavorite } from '@/lib/favorites';
import { markProgramStepDone } from '@/lib/programs';
import { pushRecent } from '@/lib/recents';
import { logSession } from '@/lib/sessions';
import { getJSON, KEYS, setJSON } from '@/lib/store';
import { recordTrackWin } from '@/lib/trackWins';
import { dur, ease, useTheme } from '@/theme';

// Sleep / auto-stop timer options (minutes; 0 = off). Soundscapes otherwise loop
// all night with no way to stop short of force-closing the app.
const SLEEP_OPTIONS = [0, 15, 30, 45, 60] as const;

// Sensation-honest cues, rotated through the session. Two sets: the orb cues are
// shown ONLY when a device is registered on this account (cc.devices cache) -
// "Notice the gentle pulse in your palm" told non-owners to feel hardware they
// don't have. Everyone else gets honest breath-and-body guidance.
const DEVICE_CUES = [
  'Rest your Glow Orb in your palm',
  'Set it to a level that feels good',
  'Notice the gentle pulse in your palm',
  'Let your breath follow the circle',
];
const BREATH_CUES = [
  'Let your breath follow the circle',
  'Drop your shoulders on the out-breath',
  'Unclench your jaw, soften your gaze',
  'Let the sound carry you',
];
// kid sessions speak kid: no jaws, no gazes - words a four-year-old can follow
const KID_CUES = [
  'Snuggle in and get comfy',
  'A big, slow breath in',
  'And let it drift back out',
  'Let the sound tuck you in',
];

function PlayPause({ paused, onPress }: { paused: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const p = useSharedValue(paused ? 1 : 0);
  const reduced = useReducedMotion();
  useEffect(() => {
    p.value = reduced ? (paused ? 1 : 0) : withTiming(paused ? 1 : 0, { duration: dur.press, easing: ease.out });
  }, [paused, reduced, p]);
  const playS = useAnimatedStyle(() => ({ opacity: p.value }));
  const pauseS = useAnimatedStyle(() => ({ opacity: 1 - p.value }));
  return (
    <PressableScale
      onPress={onPress}
      onPressIn={lightTap}
      accessibilityRole="button"
      accessibilityLabel={paused ? 'Play' : 'Pause'}
      hitSlop={8}
      style={{
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.ctaBg,
      }}>
      <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, pauseS]}>
        <Feather name="pause" size={26} color={c.ctaText} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, playS]}>
        <Feather name="play" size={26} color={c.ctaText} style={{ marginLeft: 3 }} />
      </Animated.View>
    </PressableScale>
  );
}

export function Player() {
  const router = useRouter();
  const { token, isPremium } = useAuth();
  const { mode } = useProfile();
  // Player is always night mode, so `c` resolves to the night theme - read the
  // palette from tokens instead of hardcoding the night hex throughout.
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { id, program, day } = useLocalSearchParams<{ id?: string; program?: string; day?: string }>();
  const track = (id && TRACKS[id]) || TRACKS['slow-tide'];
  // Locked premium tracks give a free user a short PREVIEW, then route to the paywall.
  // Gate on ENTITLEMENT ONLY - kids mode is NOT an exemption (a free profile could
  // switch to kids and play the whole locked catalogue, incl. via a deep link
  // calmcarry://player?id=<locked>; this preview gate is the single enforcement point).
  const isPreview = !!track.locked && !isPremium;
  const PREVIEW_MS = 60_000;

  const player = useAudioPlayer(audioSources[track.audio]);
  const status = useAudioPlayerStatus(player);
  const progress = useSharedValue(0);
  const loggedRef = useRef(false);
  const startedAtRef = useRef<number | null>(null); // wall-clock at session_start (for durationSec)
  const completedRef = useRef(false); // session_complete fired once
  const [showPuzzle, setShowPuzzle] = useState(false); // kids-only slide-puzzle overlay

  // allow playback in silent mode + keep playing with the screen off / app backgrounded
  // (sleep apps must run all night - build plan §12). doNotMix: our audio is the
  // primary sound AND lock-screen controls require it (expo-audio v56 docs).
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' }).catch(() => {});
  }, []);

  // Lock-screen presence: title + artwork + play/pause with the phone locked -
  // exactly when a sleep app is used. ALSO load-bearing on Android: without an
  // active lock-screen session, background playback is cut after ~3 minutes
  // (expo-audio v56 docs). Remote pause flips the player's own state, which
  // useAudioPlayerStatus already mirrors into the UI.
  useEffect(() => {
    try {
      const art = RNImage.resolveAssetSource(covers[track.cover])?.uri;
      player.setActiveForLockScreen(
        true,
        { title: track.title, artist: 'CalmCarry', ...(art ? { artworkUrl: art } : {}) },
        { showSeekBackward: false, showSeekForward: false },
      );
    } catch {
      /* platform without lock-screen support - playback itself is unaffected */
    }
    return () => {
      try {
        player.clearLockScreenControls();
      } catch {
        /* player already released */
      }
    };
  }, [player, track.title, track.cover]);

  // Loop everything sold as "loops" (noise colors, fans, ambient blends) plus all
  // soundscapes. Guided sessions, sleep tales and breathing exercises must play
  // once and end gently (§6 "gentle end") - never restart.
  const loops = trackLoops(track);
  useEffect(() => {
    player.loop = loops;
    player.volume = 1;
    let cancelled = false;
    (async () => {
      // Resolve a CMS/CDN streaming source BEFORE the first play, with a guaranteed
      // bundled fallback (§11). The effect runs once per player (i.e. once per track),
      // and resolveAudioSource caches per track id - so a track resolves exactly once
      // and the swap always happens before playback begins, never mid-night (§12).
      // COPPA: a child profile must never cause a request. resolveAudioSource asks
      // the server for a signed URL, carrying the parent's token plus the exact
      // track id - so the server would learn, in real time, which title a child
      // chose and when, tied to the account. Nothing is stored, but the promise we
      // publish is about not RECEIVING it. Kids play the bundled asset that already
      // ships in the binary (the same fallback used offline), so playback is
      // unchanged and the claim becomes true.
      if (mode !== 'kids') {
        try {
          const src = await resolveAudioSource(track, token);
          if (!cancelled && src && src !== audioSources[track.audio]) {
            player.replace(src);
            player.loop = loops;
            player.volume = 1;
          }
        } catch {
          /* stay on the bundled asset */
        }
      }
      const auto = await getJSON('cc.autoplay', true);
      if (!cancelled && auto) player.play();
    })();
    return () => {
      cancelled = true;
      try {
        player.pause();
      } catch {
        /* player already released */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  // drive the ring from the real playback position
  useEffect(() => {
    if (status.duration > 0) {
      // short + linear so the ring TRACKS the real playback clock (a longer eased
      // tween trails the true position and rubber-bands on scrub)
      progress.value = withTiming(Math.min(status.currentTime / status.duration, 1), {
        duration: 240,
        easing: Easing.linear,
      });
    }
  }, [status.currentTime, status.duration, progress]);

  // record the listen once it's underway (local always; backend if signed in).
  // Any real session earns today's "calm night" (once/day) - adults and kids alike -
  // and pushes the track to "recently played" so it's easy to pick up again.
  useEffect(() => {
    if (!loggedRef.current && status.playing) {
      loggedRef.current = true;
      startedAtRef.current = Date.now();
      // COPPA: never send a child's listening to the backend, and keep their plays
      // out of the (adult) recents/recommender. The local calm-night star count is
      // device-only and stays on for kids.
      if (mode !== 'kids') {
        logSession(token, { contentId: track.id });
        pushRecent(track.id).catch(() => {});
      }
      logEvent('session_start', { contentId: track.id, category: track.category });
      markFirstAudio(); // time-to-first-audio: fires once per cold start
      markCalmNightToday().catch(() => {});
      // mark this program night complete once it's actually playing (real progress)
      if (program && day) markProgramStepDone(program, Number(day)).catch(() => {});
    }
  }, [status.playing, token, track.id, track.category, mode, program, day]);

  // surface a load failure (e.g. a CDN source that never loads) instead of a dead,
  // silent play button. Bundled assets load instantly, so this only trips on a
  // genuinely broken/streamed source after a grace period.
  const [loadFailed, setLoadFailed] = useState(false);
  useEffect(() => {
    if (status.isLoaded) {
      if (loadFailed) setLoadFailed(false);
      return;
    }
    const id = setTimeout(() => setLoadFailed((prev) => (status.isLoaded ? prev : true)), 8000);
    return () => clearTimeout(id);
  }, [status.isLoaded, loadFailed]);
  const retryLoad = () => {
    setLoadFailed(false);
    try {
      // fall back to the guaranteed-local bundled asset and try again
      player.replace(audioSources[track.audio]);
      player.loop = loops;
      player.volume = 1;
      player.play();
    } catch {
      /* released */
    }
  };

  // saved / favourite state for this track
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let alive = true;
    isFavorite(track.id).then((v) => alive && setSaved(v));
    return () => {
      alive = false;
    };
  }, [track.id]);
  const onToggleSave = () => {
    // Defence in depth behind the render gate: favourites leave the device on the
    // account's prefs sync, so a kid profile must never be able to write one - not via
    // a stale render, a deep link, or a mode change while this screen is mounted.
    if (mode === 'kids') return;
    lightTap();
    toggleFavorite(track.id).then(setSaved).catch(() => {});
  };

  // breathing pacer + rotating honest cues - the guided-session feel. A track's
  // breathPattern drives the EXACT rhythm (e.g. Box Breathing 4-4-4-4, 4-7-8, the
  // cyclic sigh); every other track rides the ambient 4s-in / 6s-out default so the
  // guide never contradicts a track's own count.
  const reduced = useReducedMotion();
  const bp = track.breathPattern;
  const inMs = (bp?.inhale ?? 4) * 1000;
  const holdInMs = (bp?.holdIn ?? 0) * 1000;
  const outMs = (bp?.exhale ?? 6) * 1000;
  const holdOutMs = (bp?.holdOut ?? 0) * 1000;
  const isBreathTrack = track.category === 'breathing';
  // an optional, soft haptic at the top of each in- and out-breath, breathing tracks
  // only. Web-guarded (no vibration API); never throws. Under reduced motion the
  // pacer is paused, so this never fires.
  const breathTick = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
  }, []);
  const breath = useSharedValue(0);
  // the exhale ripple - released once per breath at the top of the out-breath,
  // expanding + dissolving over the full out-breath ("letting the day go").
  // Rests at 1 (fully dissolved = invisible); each exhale rewinds it to 0.
  const ripple = useSharedValue(1);
  const [phase, setPhase] = useState<'in' | 'holdIn' | 'out' | 'holdOut'>('in');
  const [cueIdx, setCueIdx] = useState(0);
  // orb-hold cues only for accounts with a registered device (cc.devices cache);
  // default to the honest breath set so a non-owner is never told to feel hardware.
  // KIDS always get breath cues, device or not: the app must never be the thing
  // instructing a child to hold the microcurrent device without a parent present
  // (conservative default pending counsel, docs/ORB_ROADMAP.md; a parent can still
  // hand the orb over themselves).
  const [cues, setCues] = useState<string[]>(BREATH_CUES);
  useEffect(() => {
    if (mode === 'kids') {
      setCues(KID_CUES);
      return;
    }
    let alive = true;
    getJSON<unknown[]>(KEYS.devices, []).then((l) => {
      if (alive && Array.isArray(l) && l.length > 0) setCues(DEVICE_CUES);
    });
    return () => {
      alive = false;
    };
  }, [mode]);

  useEffect(() => {
    if (reduced) {
      breath.value = 0.45;
      return;
    }
    // in-breath (0→1) · hold expanded · out-breath (1→0) · hold contracted, then
    // repeat. Holds are folded into the following segment's delay so the halo parks
    // at its peak/floor for the count. Default (no pattern) is a plain 4s/6s in/out.
    breath.value = withRepeat(
      holdOutMs > 0
        ? withSequence(
            withTiming(1, { duration: inMs, easing: ease.sine }),
            withDelay(holdInMs, withTiming(0, { duration: outMs, easing: ease.sine })),
            withDelay(holdOutMs, withTiming(0, { duration: 1 }))
          )
        : withSequence(
            withTiming(1, { duration: inMs, easing: ease.sine }),
            withDelay(holdInMs, withTiming(0, { duration: outMs, easing: ease.sine }))
          ),
      -1,
      false
    );
    return () => cancelAnimation(breath);
  }, [reduced, breath, inMs, holdInMs, outMs, holdOutMs]);

  useEffect(() => {
    if (reduced) return;
    // Walk the breath's phases on the SAME clock as the halo: in → (hold) → out →
    // (hold) → repeat. Holds only appear when the pattern has them; the ambient
    // default is a plain in/out. One timer at a time, so cleanup can't leave a
    // stale phase pending.
    const steps: { phase: 'in' | 'holdIn' | 'out' | 'holdOut'; ms: number }[] = [
      { phase: 'in', ms: inMs },
    ];
    if (holdInMs > 0) steps.push({ phase: 'holdIn', ms: holdInMs });
    steps.push({ phase: 'out', ms: outMs });
    if (holdOutMs > 0) steps.push({ phase: 'holdOut', ms: holdOutMs });

    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const advance = () => {
      const step = steps[i];
      setPhase(step.phase);
      if (step.phase === 'out') {
        // release one ripple at the top of the exhale - it expands and dissolves
        // over the full out-breath, reaching the night ring as it disappears
        ripple.value = 0;
        ripple.value = withTiming(1, { duration: outMs, easing: ease.out });
      }
      // soft haptic at the top of each in- and out-breath (breathing tracks only)
      if ((step.phase === 'in' || step.phase === 'out') && isBreathTrack) breathTick();
      timer = setTimeout(() => {
        i = (i + 1) % steps.length;
        advance();
      }, step.ms);
    };
    advance();
    return () => {
      clearTimeout(timer);
      cancelAnimation(ripple);
      ripple.value = 1; // rest dissolved (invisible)
    };
  }, [reduced, ripple, inMs, holdInMs, outMs, holdOutMs, isBreathTrack, breathTick]);

  useEffect(() => {
    if (reduced) return; // honor reduced motion - no auto-rotating cue text
    const id = setInterval(() => setCueIdx((i) => (i + 1) % cues.length), 13000);
    return () => clearInterval(id);
  }, [reduced, cues.length]);

  // gentle amplitude - a subtle breath, not a 32%/2× pulse you stare at all night
  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.12 }],
    opacity: 0.12 + breath.value * 0.1,
  }));
  // a crisp drawn ring riding the breath - gives the soft halo a designed edge
  const breathRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.1 }],
    opacity: 0.18 + breath.value * 0.22,
  }));
  // the exhale ripple: expands from the breath ring to the night ring (300) and
  // dissolves as it arrives - invisible at rest (ripple = 1 → opacity 0)
  const rippleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + ripple.value * 0.22 }],
    opacity: (1 - ripple.value) * 0.3,
  }));
  // the cover itself breathes with the guide - barely (2%), like a chest rising
  const coverStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.02 }],
  }));

  const paused = !status.playing;
  const toggle = () => {
    if (status.playing) player.pause();
    else player.play();
  };

  const close = () => {
    if (fadeRef.current) clearTimeout(fadeRef.current);
    try {
      player.pause();
    } catch {
      /* ignore */
    }
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  // End the session GENTLY (build plan §6): ramp volume to silence over ~1.4s,
  // pause, then land on the peak-end check-in instead of a frozen, silent frame.
  // Used by both didJustFinish (guided sessions/tales/breathing) and the sleep timer.
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endingRef = useRef(false);

  // Fire the §15 activation event exactly once, on the FIRST exit path taken
  // (gentle auto-end, sleep timer, or manual close). reachedEnd distinguishes a
  // completed wind-down from an early leave; a ≥60s listen also counts as complete.
  const fireComplete = useCallback(
    (reachedEnd: boolean) => {
      if (completedRef.current || !loggedRef.current) return;
      completedRef.current = true;
      const durationSec = startedAtRef.current ? Math.round((Date.now() - startedAtRef.current) / 1000) : undefined;
      const completed = reachedEnd || (durationSec ?? 0) >= 60;
      // a completed wind-down is the honest "it worked" - remember it so the
      // recommender can lean toward tracks that carried this household before
      if (completed) void recordTrackWin(track.id);
      getJSON('cc.firstSessionDone', false).then((done) => {
        logEvent('session_complete', {
          contentId: track.id,
          category: track.category,
          completed,
          durationSec,
          first: !done,
        });
        if (!done) setJSON('cc.firstSessionDone', true);
      });
    },
    [track.id, track.category],
  );

  const endSession = useCallback(() => {
    if (endingRef.current) return;
    endingRef.current = true;
    fireComplete(true); // the session reached a gentle end
    let v = 1;
    const step = () => {
      v -= 0.1;
      try {
        player.volume = Math.max(v, 0);
      } catch {
        /* player released */
      }
      if (v > 0) {
        fadeRef.current = setTimeout(step, 130);
      } else {
        try {
          player.pause();
        } catch {
          /* ignore */
        }
        // a child must never land on the adult "were you settled?" check-in - send
        // kids back to their own home instead
        router.replace((mode === 'kids' ? '/' : '/check-in') as Href);
      }
    };
    step();
  }, [player, router, fireComplete, mode]);

  // Guided sessions, sleep tales and breathing must play once and END - not freeze
  // on a silent 100% ring. Anything that loops is excluded (didJustFinish should
  // never fire for a looping player, but a dropped loop flag mid-swap must not
  // shove a check-in screen at someone drifting off).
  useEffect(() => {
    if (status.didJustFinish && !loops) endSession();
  }, [status.didJustFinish, loops, endSession]);

  // ENFORCED SESSION LENGTH. `duration` is display copy; a finite track whose bed is
  // longer than advertised (the breathing pacers ride the 7m02s `drone`) would
  // otherwise run until the FILE ends - a "3 min" session playing seven. Ends the
  // session gently at the advertised deadline. Wall-clock + AppState recheck, same
  // pattern as the sleep timer below, so backgrounding can't overrun it.
  const lengthSec = track.lengthSec;
  // Count DOWN the enforced length against actual playback, banking the remainder on
  // pause - exactly like the preview clock below. It used to arm a wall-clock timeout
  // at mount that fired even while PAUSED: pause a "3 min" breathing exercise and, 3
  // minutes later, it faded out and jumped to the check-in while you were still paused
  // and mid-breath. The countdown now only runs while playing.
  const lengthLeftRef = useRef(lengthSec ? lengthSec * 1000 : 0);
  const lengthEndAtRef = useRef<number | null>(null);
  useEffect(() => {
    if (!lengthSec || lengthSec <= 0 || loops || !status.playing) {
      lengthEndAtRef.current = null;
      return;
    }
    const startedAt = Date.now();
    lengthEndAtRef.current = startedAt + lengthLeftRef.current;
    let id = setTimeout(() => endSession(), lengthLeftRef.current);
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active' || endingRef.current || lengthEndAtRef.current == null) return;
      clearTimeout(id);
      const remaining = lengthEndAtRef.current - Date.now();
      if (remaining <= 0) endSession();
      else id = setTimeout(() => endSession(), remaining);
    });
    return () => {
      clearTimeout(id);
      sub.remove();
      lengthEndAtRef.current = null;
      // bank what's left so a pause/resume doesn't restart the full length
      lengthLeftRef.current = Math.max(0, lengthLeftRef.current - (Date.now() - startedAt));
    };
  }, [lengthSec, loops, status.playing, endSession]);

  // Sleep / auto-stop timer. A timer is a PER-SESSION choice and always starts Off.
  // It used to be restored from a persisted `cc.sleepTimerMin` on every session, so a
  // 20-minute timer set once silently armed on every later, unrelated session - a quick
  // daytime breathing session would cut out after 20 minutes with nothing on screen
  // having asked for it. The user sets it fresh each time they want it.
  const [sleepMin, setSleepMin] = useState(0);
  const sleepEndAtRef = useRef<number | null>(null); // absolute end time (for bg recompute)
  useEffect(() => {
    if (sleepMin <= 0) {
      sleepEndAtRef.current = null;
      return;
    }
    // The setTimeout is the foreground path only - it is suspended while the app
    // is backgrounded (audio keeps playing). On return to foreground, recompute
    // against the absolute end time: fade NOW if it already passed, else re-arm
    // the remainder (same pattern as wind-down's endAtRef).
    sleepEndAtRef.current = Date.now() + sleepMin * 60_000;
    let id = setTimeout(() => endSession(), sleepMin * 60_000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active' || endingRef.current || sleepEndAtRef.current == null) return;
      clearTimeout(id);
      const remaining = sleepEndAtRef.current - Date.now();
      if (remaining <= 0) endSession();
      else id = setTimeout(() => endSession(), remaining);
    });
    return () => {
      clearTimeout(id);
      sub.remove();
    };
  }, [sleepMin, endSession]);
  useEffect(() => () => { if (fadeRef.current) clearTimeout(fadeRef.current); }, []);
  // Count completion on any other exit (manual close / back / swipe-dismiss / nav away).
  // Hold the LATEST fireComplete in a ref and run on UNMOUNT ONLY ([] deps) so a
  // mid-session track change can't fire a stale-track completion or run the cleanup early.
  const fireCompleteRef = useRef(fireComplete);
  useEffect(() => {
    fireCompleteRef.current = fireComplete;
  });
  useEffect(() => () => fireCompleteRef.current(false), []);

  // Free preview: gently fade to the paywall after 60s - "you've felt it, now keep it"
  // instead of a closed door. Never logs a completion.
  const runPreviewFade = useCallback(() => {
    completedRef.current = true; // a preview is not a completed session
    if (fadeRef.current) clearTimeout(fadeRef.current);
    let v = 1;
    const step = () => {
      v -= 0.12;
      try {
        player.volume = Math.max(v, 0);
      } catch {
        /* released */
      }
      if (v > 0) fadeRef.current = setTimeout(step, 110);
      else {
        try {
          player.pause();
        } catch {
          /* ignore */
        }
        router.replace(`/unlock?id=${track.id}` as Href);
      }
    };
    step();
  }, [player, router, track.id]);

  // Count 60s of ACTUAL playback, not wall-clock: a preview that is paused or still
  // buffering must not burn the clock, so a user who heard little/nothing is never
  // paywalled. The countdown only runs while status.playing, and banks the remainder.
  const previewLeftRef = useRef(PREVIEW_MS);
  const previewEndAtRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isPreview || !status.playing) {
      previewEndAtRef.current = null;
      return;
    }
    const startedAt = Date.now();
    // Absolute deadline + AppState recheck, exactly like the sleep timer above.
    // Premium audio ships bundled in the free binary and the signed-URL 403 falls
    // back to that bundled asset, so this fade is the ONLY thing gating a locked
    // track. A bare setTimeout is suspended while the phone is locked (background
    // playback keeps the audio going), which handed a free user the paid catalogue
    // all night - the one hole the sleep timer 40 lines up already defends against.
    previewEndAtRef.current = startedAt + previewLeftRef.current;
    let id = setTimeout(runPreviewFade, previewLeftRef.current);
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active' || previewEndAtRef.current == null) return;
      clearTimeout(id);
      const remaining = previewEndAtRef.current - Date.now();
      if (remaining <= 0) runPreviewFade();
      else id = setTimeout(runPreviewFade, remaining);
    });
    return () => {
      clearTimeout(id);
      sub.remove();
      previewEndAtRef.current = null;
      // Bank the unused remainder: a preview that was paused or buffering must not
      // burn the clock, so someone who heard little is never paywalled early.
      previewLeftRef.current = Math.max(0, previewLeftRef.current - (Date.now() - startedAt));
    };
  }, [isPreview, status.playing, runPreviewFade]);

  const cycleSleep = () => {
    const i = (SLEEP_OPTIONS as readonly number[]).indexOf(sleepMin);
    // From Off, jump straight to a sane 30-min timer - one groggy tap gets the app's own
    // "won't loop all night" promise, instead of four taps through 15 → 30. The full
    // cycle (30 → 45 → 60 → Off → 30) is still reachable from there.
    const next = sleepMin === 0 ? 30 : SLEEP_OPTIONS[(i + 1) % SLEEP_OPTIONS.length];
    setSleepMin(next);
    lightTap();
  };

  return (
    <DragDismiss onDismiss={close}>
      <Screen
        mode="night"
        backdrop={
          // immersive scene: the track's own artwork fills the screen under a deep
          // night scrim - dark enough for 3am eyes, alive enough to feel like a place
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Image
              source={covers[track.cover]}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              accessibilityIgnoresInvertColors
            />
            <LinearGradient
              colors={['rgba(14,24,23,0.86)', 'rgba(14,24,23,0.62)', 'rgba(14,24,23,0.94)']}
              locations={[0, 0.45, 1]}
              style={StyleSheet.absoluteFill}
            />
          </View>
        }>
      <View style={{ flex: 1 }}>
        {/* top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
          <PressableScale onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close player" dimTo={0.85}>
            <Feather name="chevron-down" size={28} color={c.text} />
          </PressableScale>
          {/* sleep / auto-stop timer - taps cycle Off → 15 → 30 → 45 → 60 min */}
          <PressableScale
            onPress={cycleSleep}
            hitSlop={14}
            accessibilityRole="button"
            accessibilityLabel={sleepMin ? `Sleep timer set to ${sleepMin} minutes. Tap to change.` : 'Set a sleep timer'}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingVertical: 12,
              paddingHorizontal: 12,
              borderRadius: 18,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: c.lineSage,
            }}>
            <SelectionOverlay
              active={!!sleepMin}
              style={{ borderRadius: 18, borderWidth: 1, borderColor: 'rgba(143,201,190,0.55)', backgroundColor: 'rgba(143,201,190,0.12)' }}
            />
            <Crossfade
              style={{ width: 14, height: 14 }}
              active={!!sleepMin}
              front={<Feather name="moon" size={14} color={c.accent} />}
              back={<Feather name="moon" size={14} color={c.text} />}
            />
            <SwapText trigger={sleepMin}>
              <AppText variant="label" style={{ color: sleepMin ? c.textAccent : c.text }}>
                {sleepMin ? `${sleepMin} min` : 'Sleep timer'}
              </AppText>
            </SwapText>
          </PressableScale>
        </View>

        {isPreview ? (
          <View style={{ alignItems: 'center', marginTop: 8 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: 'rgba(143,201,190,0.45)',
                backgroundColor: 'rgba(143,201,190,0.12)',
              }}>
              <Feather name="lock" size={12} color={c.accent} />
              <AppText variant="label" style={{ color: c.textAccent }}>
                Free preview
              </AppText>
            </View>
          </View>
        ) : null}

        {/* centerpiece - breathing guide + cover inside the playback ring. A ScrollView
            with flexGrow+center: identical (centered) when it fits, but SCROLLS instead of
            overlapping the fixed top bar / controls on short devices or at large font. */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}
          showsVerticalScrollIndicator={false}>
          <View style={{ width: 300, height: 300, alignItems: 'center', justifyContent: 'center' }}>
            <ProgressRing progress={progress} size={300} strokeWidth={3} fill style={{ position: 'absolute' }} />
            {/* breathing halo - expands on the in-breath, settles on the out */}
            <Animated.View
              pointerEvents="none"
              style={[
                { position: 'absolute', width: 232, height: 232, borderRadius: 116, backgroundColor: c.accent },
                haloStyle,
              ]}
            />
            {/* exhale ripple - one ring released per breath, dissolving as it reaches the night ring */}
            <Animated.View
              pointerEvents="none"
              style={[
                { position: 'absolute', width: 244, height: 244, borderRadius: 122, borderWidth: 1.5, borderColor: c.accent },
                rippleStyle,
              ]}
            />
            {/* breath ring - a crisp edge riding the breath */}
            <Animated.View
              pointerEvents="none"
              style={[
                { position: 'absolute', width: 244, height: 244, borderRadius: 122, borderWidth: 1.25, borderColor: c.lineSage },
                breathRingStyle,
              ]}
            />
            {/* cover inside the ring - breathes with the guide */}
            <Animated.View
              style={[{ width: 200, height: 200, borderRadius: 100, overflow: 'hidden', borderWidth: 1, borderColor: c.lineSage }, coverStyle]}>
              <Image source={covers[track.cover]} style={{ width: 200, height: 200 }} contentFit="cover" accessibilityIgnoresInvertColors />
            </Animated.View>
          </View>

          {/* breath pacer */}
          <View style={{ height: 22, marginTop: 28, justifyContent: 'center' }}>
            {!reduced ? (
              // Sentence case, default tracking: the one piece of copy the user follows
              // continuously in the dark should be the easiest to read with tired eyes,
              // not tracked-out all-caps micro type. Crossfades between in/out so the
              // caption breathes with the halo instead of hard-cutting each cycle.
              <SwapText trigger={phase}>
                <AppText variant="label" tone="accent">
                  {phase === 'in' ? 'Breathe in' : phase === 'out' ? 'Breathe out' : 'Hold'}
                </AppText>
              </SwapText>
            ) : null}
          </View>

          <AppText variant="display" tone="title" style={{ marginTop: 6, textAlign: 'center' }}>
            {track.title}
          </AppText>
          <AppText variant="body" tone="muted" style={{ marginTop: 4, textAlign: 'center' }}>
            {track.subtitle}
          </AppText>
          {/* Mason: "more info next to audios" - what this is + when to reach for it */}
          {track.about ? (
            <AppText
              variant="caption"
              tone="dim"
              numberOfLines={3}
              style={{ marginTop: 8, textAlign: 'center', textTransform: 'none', letterSpacing: 0, lineHeight: 17, paddingHorizontal: 10 }}>
              {track.about}
            </AppText>
          ) : null}

          {/* rotating, sensation-honest device cue - or a calm load-failure + retry */}
          {loadFailed ? (
            <Appear key="fail" enter={dur.nav}>
              <PressableScale
                onPress={retryLoad}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Couldn’t load this session. Tap to try again."
                dimTo={0.85}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, minHeight: 44 }}>
                <Feather name="refresh-cw" size={13} color={c.accent} />
                <AppText variant="caption" tone="dim">
                  Couldn’t load this session. Tap to try again.
                </AppText>
              </PressableScale>
            </Appear>
          ) : (
            <Appear key="cue" enter={dur.nav} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, minHeight: 18 }}>
              <Feather name="circle" size={10} color={c.accent} />
              <SwapText trigger={cueIdx}>
                <AppText variant="caption" tone="dim">
                  {cues[cueIdx % cues.length]}
                </AppText>
              </SwapText>
            </Appear>
          )}
        </ScrollView>

        {/* controls - heart (save) · play/pause · matching spacer keeps play centered.
            Screen reserves only left/right insets, so fold in the bottom inset here or
            the play button sits under the Android nav bar / iOS home indicator. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 36, paddingBottom: Math.max(insets.bottom, 12) + 16 }}>
          {/* Saving is an ADULT affordance. The heart used to render for every
              profile, so a child could tap it in Kids Mode - and favourites are synced
              to the server against the account (ProfileProvider's prefs reconcile),
              which made "a child's data never leaves the device" untrue. A kid keeps
              the balancing spacer so the play button stays centred. */}
          {mode === 'kids' ? (
            <View style={{ width: 44, height: 44 }} />
          ) : (
            <PressableScale
              onPress={onToggleSave}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={saved ? 'Remove from saved' : 'Save this session'}
              accessibilityState={{ selected: saved }}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Crossfade
                style={{ width: 24, height: 24 }}
                active={saved}
                front={<Feather name="heart" size={24} color={c.accent} />}
                back={<Feather name="heart" size={24} color={c.text} style={{ opacity: 0.9 }} />}
              />
            </PressableScale>
          )}
          <PlayPause paused={paused} onPress={toggle} />
          {/* Kids get a real game to play WHILE listening (Mason): a slide puzzle of the
              track art. Opens as an overlay - the audio player stays mounted, so sound
              never stops. Adults get the balancing spacer that keeps play centered. */}
          {mode === 'kids' ? (
            <PressableScale
              onPress={() => {
                lightTap();
                setShowPuzzle(true);
              }}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Play a picture puzzle"
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="grid" size={24} color={c.accent} />
            </PressableScale>
          ) : (
            <View style={{ width: 44, height: 44 }} />
          )}
        </View>

        {/* Non-medical wellness disclaimer on GUIDED practices (FTC/TGA) - meditation
            & breathing can read as health claims; soundscapes/music/noise/tales don't. */}
        {track.category === 'meditation' || track.category === 'breathing' ? (
          <AppText
            variant="caption"
            tone="dim"
            style={{ textAlign: 'center', paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 10), fontSize: 11, lineHeight: 15, textTransform: 'none', letterSpacing: 0 }}>
            {WELLNESS_DISCLAIMER}
          </AppText>
        ) : null}
      </View>
      {/* kids "game" layer (Mason): tap the sky over the artwork and soft stars
          bloom + settle out - wind-down mechanics, audio untouched. Rendered LAST
          (on top) but constrained to the art band, clear of the top bar and the
          controls, so it never steals a real tap target. Adults never see it. */}
      {mode === 'kids' ? <SleepyStars /> : null}
      {/* the slide-puzzle game - full-screen overlay above everything; the audio player
          keeps running underneath so the bedtime sound never stops. Kids only. */}
      {mode === 'kids' && showPuzzle ? (
        <SlidePuzzle cover={track.cover} onClose={() => setShowPuzzle(false)} />
      ) : null}
      </Screen>
    </DragDismiss>
  );
}
