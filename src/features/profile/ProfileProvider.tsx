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

import { FEELING_MAP, type Feeling, type Intent } from '@/content/feelings';
import { useAuth } from '@/features/auth/AuthProvider';
import { setAnalyticsMode } from '@/lib/analytics';
import { setMonitoringMode } from '@/lib/monitoring';
import { api } from '@/lib/api';
import { clearCoppaConsent, hasCoppaConsent, recordCoppaConsent } from '@/lib/consent';
import { getFavorites, replaceFavorites } from '@/lib/favorites';
import { getStoredSleepGoalHours, setSleepGoalHours } from '@/lib/sleepGoal';
import { getTrackWins } from '@/lib/trackWins';
import { getStoredVoice, setVoice, VOICES, type VoiceKey } from '@/lib/voice';
import { clearRecents, getRecents } from '@/lib/recents';
import { TRACKS } from '@/content/library';
import { explainRecommendation, recommendTracks } from '@/lib/recommend';
import { getJSON, remove, setJSON } from '@/lib/store';

export type AppMode = 'adult' | 'kids';
// Feeling/Intent vocabulary + FEELING_MAP live in src/content/feelings.ts (pure data,
// shared with tests); re-exported here so every existing consumer keeps its import.
export { FEELING_MAP } from '@/content/feelings';
export type { Feeling, Intent } from '@/content/feelings';

/** A member of the household. One subscription covers the whole family (build plan §6). */
export type Profile = { id: string; name: string; type: AppMode };

const KEYS = {
  intent: 'cc.intent',
  lastOpen: 'cc.lastOpen',
  profiles: 'cc.profiles',
  activeId: 'cc.activeProfile',
  legacyMode: 'cc.mode',
  /** Last account signed in ON THIS DEVICE. Persisted so "did the account actually
   *  change?" survives a relaunch and a sign-out, instead of every token→null→token
   *  cycle looking like a new account and wiping the household. */
  lastAccount: 'cc.lastAccount',
} as const;
const CHECKIN_GAP_MS = 12 * 60 * 60 * 1000; // re-offer the check-in only after 12h away

// A fresh household is the adult owner only. Kid profiles are created on demand,
// through the COPPA-consent-gated Kids-mode entry (see enterKids), so no child
// profile is ever pre-seeded.
const DEFAULT_PROFILES: Profile[] = [{ id: 'p-you', name: 'You', type: 'adult' }];

/** Defend against corrupted/old persisted data: keep only well-formed profiles. */
function sanitizeProfiles(raw: unknown): Profile[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (p): p is Profile =>
      !!p &&
      typeof (p as Profile).id === 'string' &&
      typeof (p as Profile).name === 'string' &&
      ((p as Profile).type === 'adult' || (p as Profile).type === 'kids'),
  );
}


type ProfileValue = {
  hydrated: boolean;
  /** the household */
  profiles: Profile[];
  activeProfile: Profile;
  setActiveProfile: (id: string) => void;
  addProfile: (name: string, type: AppMode) => Profile;
  /** Enter Kids mode from any surface: record COPPA consent if absent, ensure a kid
   *  profile exists (creating a neutral "Little one" when the household has none),
   *  then switch to it. Replaces the seeded-kid assumption setMode('kids') relied on. */
  enterKids: () => Promise<void>;
  renameProfile: (id: string, name: string) => void;
  removeProfile: (id: string) => void;
  /** the active profile's type - drives kids vs adult content everywhere */
  mode: AppMode;
  /** switch to the (first) profile of this type - kept for the Adult/Kids toggles + parent gate */
  setMode: (m: AppMode) => void;
  intent: Intent | null;
  setIntent: (i: Intent) => void;
  /** how the user is "arriving" tonight - drives a warmer, tailored recommendation */
  feeling: Feeling | null;
  setFeeling: (f: Feeling) => void;
  needsCheckIn: boolean;
  dismissCheckIn: () => void;
  recommendedTrackId: string;
  /** ranked picks matching the check-in answer (top = recommendedTrackId) */
  recommendedTrackIds: string[];
  /** honest one-line reason for the hero pick (null when nothing personal to say) */
  recommendationReason: string | null;
};

const fallback: Profile = DEFAULT_PROFILES[0];

const ProfileContext = createContext<ProfileValue>({
  hydrated: false,
  profiles: DEFAULT_PROFILES,
  activeProfile: fallback,
  setActiveProfile: () => {},
  addProfile: () => fallback,
  enterKids: async () => {},
  renameProfile: () => {},
  removeProfile: () => {},
  mode: 'adult',
  setMode: () => {},
  intent: null,
  setIntent: () => {},
  feeling: null,
  setFeeling: () => {},
  needsCheckIn: false,
  dismissCheckIn: () => {},
  recommendedTrackId: 'slow-tide',
  recommendedTrackIds: ['slow-tide'],
  recommendationReason: null,
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>(DEFAULT_PROFILES);
  const [activeId, setActiveId] = useState<string>(DEFAULT_PROFILES[0].id);
  const [intent, setIntentState] = useState<Intent | null>(null);
  const [feeling, setFeelingState] = useState<Feeling | null>(null);
  const [needsCheckIn, setNeedsCheckIn] = useState(false);
  // recently-played track ids - read once per app open so the recommendation is
  // stable within a session but fresh each open (local-only, never a server profile).
  const [recents, setRecents] = useState<string[]>([]);
  // taste + survey signals for the recommender: saved favourites, and the
  // onboarding answers (goals = what we can help with, moments = when they want
  // help). All local-only, loaded with the rest of the hydrate.
  const [favorites, setFavorites] = useState<string[]>([]);
  const [surveyGoals, setSurveyGoals] = useState<string[]>([]);
  const [surveyMoments, setSurveyMoments] = useState<string[]>([]);
  // completed wind-downs per track - the behavioural "it worked" signal (read once
  // per open, like recents, so recommendations stay stable within a session)
  const [trackWins, setTrackWins] = useState<Record<string, number>>({});
  const { token, user, isPremium } = useAuth();

  // keep latest in refs so setMode/setActiveProfile/addProfile read fresh values.
  // Written in an effect (not during render) so it's React-Compiler safe.
  const profilesRef = useRef(profiles);
  const tokenRef = useRef(token);
  useEffect(() => {
    profilesRef.current = profiles;
    tokenRef.current = token;
  });

  useEffect(() => {
    (async () => {
      const [savedProfiles, savedActive, legacyMode, savedIntent, prevOpen] = await Promise.all([
        getJSON<Profile[]>(KEYS.profiles, DEFAULT_PROFILES),
        getJSON<string | null>(KEYS.activeId, null),
        getJSON<AppMode | null>(KEYS.legacyMode, null),
        getJSON<Intent | null>(KEYS.intent, null),
        getJSON<number | null>(KEYS.lastOpen, null),
      ]);
      const clean = sanitizeProfiles(savedProfiles);
      // One-time cleanup: drop the retired pre-seeded demo kid ("Leo") so existing
      // dev/test installs don't keep a phantom child. Guarded on the EXACT seeded
      // identity (id + name + type) so a real kid a parent added or renamed is untouched.
      const migrated = clean.filter((p) => !(p.id === 'p-leo' && p.name === 'Leo' && p.type === 'kids'));
      const list = migrated.length ? migrated : DEFAULT_PROFILES;
      setProfiles(list);
      // if persisted data was corrupt/partial (or we stripped the demo kid), re-persist
      if (migrated.length !== (Array.isArray(savedProfiles) ? savedProfiles.length : -1)) {
        setJSON(KEYS.profiles, list);
      }
      // resolve active: saved id → else migrate legacy mode → else primary
      let active = list.find((p) => p.id === savedActive)?.id;
      if (!active && legacyMode) active = list.find((p) => p.type === legacyMode)?.id;
      const resolvedId = active ?? list[0].id;
      setActiveId(resolvedId);
      // persist the resolved active + retire the legacy mode key so migration runs once
      if (resolvedId !== savedActive) setJSON(KEYS.activeId, resolvedId);
      if (legacyMode != null) remove(KEYS.legacyMode);
      setIntentState(savedIntent);
      // NOTE: `feeling` is intentionally NOT persisted - the nightly check-in is
      // forward-looking and must never become a stored mood log (build plan §3/§14).
      setRecents(await getRecents());
      setFavorites(await getFavorites());
      setTrackWins(await getTrackWins());
      const survey = await getJSON<{ goals?: string[]; moments?: string[] }>('cc.onboarding', {});
      setSurveyGoals(Array.isArray(survey.goals) ? survey.goals : []);
      setSurveyMoments(Array.isArray(survey.moments) ? survey.moments : []);
      const now = Date.now();
      setNeedsCheckIn(prevOpen == null || now - prevOpen > CHECKIN_GAP_MS);
      setJSON(KEYS.lastOpen, now);
      setHydrated(true);
    })();
  }, []);

  // Once signed in, the backend household is the source of truth - adopt it so
  // profiles sync across devices. Offline-safe: failure keeps the local set.
  useEffect(() => {
    if (!hydrated || !token || token === 'local') return;
    let alive = true;
    api
      .profiles(token)
      .then((list) => {
        if (!alive || !Array.isArray(list)) return;
        const serverProfiles = sanitizeProfiles(list.map((p) => ({ id: p.id, name: p.name, type: p.type })));
        if (!serverProfiles.length) return;
        // Kid profiles are device-local (their names are never uploaded), so the server
        // reconcile must PRESERVE any local kid the server doesn't know about rather than
        // replace it away. Server is the source of truth for adult profiles; local-only
        // kids are kept and appended.
        const localKids = profilesRef.current.filter(
          (p) => p.type === 'kids' && !serverProfiles.some((s) => s.id === p.id),
        );
        const merged = [...serverProfiles, ...localKids];
        setProfiles(merged);
        setJSON(KEYS.profiles, merged);
        setActiveId((cur) =>
          merged.some((p) => p.id === cur) ? cur : (merged.find((p) => p.type === 'adult') ?? merged[0]).id,
        );
      })
      .catch(() => {
        /* offline - keep the local household */
      });
    return () => {
      alive = false;
    };
  }, [hydrated, token]);

  // Cross-device prefs sync - ONE best-effort reconcile per sign-in/app open.
  // Local answers win; the server fills gaps; favourites merge as a union (losing
  // a save is worse than gaining one). The merged set is pushed back so the next
  // device sees it. Feeling is NEVER synced (build plan §3/§14) and the server
  // allow-list would drop it anyway.
  useEffect(() => {
    if (!hydrated || !token || token === 'local') return;
    let alive = true;
    (async () => {
      try {
        const server = await api.getPrefs(token);
        if (!alive) return;
        const sGoals = Array.isArray(server.goals) ? (server.goals as string[]) : [];
        const sMoments = Array.isArray(server.moments) ? (server.moments as string[]) : [];
        const sFavs = Array.isArray(server.favorites) ? (server.favorites as string[]) : [];
        const goals = surveyGoals.length ? surveyGoals : sGoals;
        const moments = surveyMoments.length ? surveyMoments : sMoments;
        const favs = Array.from(new Set([...favorites, ...sFavs]));
        if (!surveyGoals.length && sGoals.length) setSurveyGoals(sGoals);
        if (!surveyMoments.length && sMoments.length) setSurveyMoments(sMoments);
        if (favs.length !== favorites.length) {
          setFavorites(favs);
          await replaceFavorites(favs);
        }
        // persist adopted survey answers so the next open doesn't need the server
        if ((!surveyGoals.length && sGoals.length) || (!surveyMoments.length && sMoments.length)) {
          const survey = await getJSON<Record<string, unknown>>('cc.onboarding', {});
          await setJSON('cc.onboarding', { ...survey, goals, moments });
        }
        // voice + sleep goal: adopt the server value only when this device holds
        // NO explicit choice (a stored default is still a choice; never clobber it)
        const [storedVoice, storedGoal] = await Promise.all([getStoredVoice(), getStoredSleepGoalHours()]);
        const sVoice = typeof server.voice === 'string' && VOICES.some((v) => v.key === server.voice) ? (server.voice as VoiceKey) : null;
        const sGoal = typeof server.sleepGoalHours === 'number' ? server.sleepGoalHours : null;
        if (!storedVoice && sVoice) await setVoice(sVoice);
        if (storedGoal == null && sGoal != null) await setSleepGoalHours(sGoal);
        const push: Record<string, unknown> = { goals, moments, favorites: favs };
        if (storedVoice) push.voice = storedVoice;
        if (storedGoal != null) push.sleepGoalHours = storedGoal;
        await api.putPrefs(token, push);
      } catch {
        /* offline - purely best-effort */
      }
    })();
    return () => {
      alive = false;
    };
    // one reconcile per session: keyed on sign-in only, reading the hydrate-time
    // local values (a mid-session favourite lands on the next open's reconcile)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, token]);

  // When the signed-in ACCOUNT changes (sign-out, or switching users), wipe the
  // previous account's household + check-in state so account B never sees account
  // A's profiles. Keyed on the stable account id (email), not the raw token, so a
  // token refresh for the same account does NOT reset. The first observation after
  // hydration is the boot state and is adopted without wiping the local data.
  const accountRef = useRef<string | null | undefined>(undefined);

  /** Drop the previous account's household. Only ever called for a real A→B switch:
   *  account B must not inherit A's profiles, consent, recents or device cache. */
  const wipeHouseholdForAccountSwitch = useCallback(() => {
    setProfiles(DEFAULT_PROFILES);
    setActiveId(DEFAULT_PROFILES[0].id);
    setIntentState(null);
    setFeelingState(null);
    setNeedsCheckIn(false);
    setRecents([]);
    setJSON(KEYS.profiles, DEFAULT_PROFILES);
    setJSON(KEYS.activeId, DEFAULT_PROFILES[0].id);
    remove(KEYS.intent);
    // COPPA: consent is per-account - never let account B inherit account A's
    // consent (it would skip the consent screen for a new kid profile). Also drop
    // the previous account's on-disk recents (memory was cleared above) and the
    // device-presence cache (account B must not see account A's orb-aware ritual
    // copy - sign-out clears it too, but an in-place account switch skips signOut).
    clearCoppaConsent();
    clearRecents();
    remove('cc.devices'); // KEYS.devices in lib/store (this file's KEYS is profile-local)
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const account = !token || token === 'local' ? null : (user?.email ?? token);
    accountRef.current = account;
    // A SIGN-OUT (or any transient token loss) is NOT an account change. This used to
    // wipe on token→null, and because kid profiles are now device-local - the on-disk
    // copy is the ONLY copy - that permanently destroyed a child's profile and the
    // COPPA consent record, dropping the child into the adult app. Only a genuine
    // switch to a DIFFERENT signed-in account may drop the previous household.
    if (account == null) return;
    let cancelled = false;
    void (async () => {
      // Persisted, so the comparison survives a relaunch: held only in memory, a
      // sign-out followed by signing back into the SAME account looked like
      // "null → account" and wiped the household anyway.
      const last = await getJSON<string | null>(KEYS.lastAccount, null);
      if (cancelled) return;
      await setJSON(KEYS.lastAccount, account);
      if (last == null || last === account) return; // first sign-in here, or same account
      wipeHouseholdForAccountSwitch();
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, token, user?.email, wipeHouseholdForAccountSwitch]);


  const setActiveProfile = useCallback((id: string) => {
    if (!profilesRef.current.some((p) => p.id === id)) return;
    setActiveId(id);
    setJSON(KEYS.activeId, id);
  }, []);

  const setMode = useCallback(
    (m: AppMode) => {
      const target = profilesRef.current.find((p) => p.type === m) ?? profilesRef.current[0];
      if (target) setActiveProfile(target.id);
    },
    [setActiveProfile]
  );

  const addProfile = useCallback((name: string, type: AppMode): Profile => {
    const profile: Profile = {
      id: `p-${type}-${Date.now()}`,
      name: name.trim() || (type === 'kids' ? 'Little one' : 'Me'),
      type,
    };
    setProfiles((prev) => {
      const next = [...prev, profile];
      setJSON(KEYS.profiles, next);
      return next;
    });
    // Persist to the household on the backend (best-effort; next sync reconciles ids).
    // Kid profiles stay DEVICE-LOCAL: a child's name is never sent to the server -
    // it minimizes child PII on the backend and keeps the "kids are never tracked"
    // promise literal. Only adult profiles sync across the household.
    const t = tokenRef.current;
    if (t && t !== 'local' && type === 'adult') api.createProfile(t, { name: profile.name, type }).catch(() => {});
    return profile;
  }, []);

  // Enter Kids mode from any entry point. Restores the two invariants the seeded "Leo"
  // used to provide implicitly: (1) COPPA consent is on file, (2) a kid profile exists -
  // creating a neutral "Little one" (a parent can rename it in Family) when the household
  // has none - then switches to that kid. Consent is recorded only when absent so the
  // original acceptedAt timestamp is preserved. The affirmative, informed consent UI lives
  // in Family.tsx; this backfill guarantees no kid can exist without a consent record.
  const enterKids = useCallback(async () => {
    if (!(await hasCoppaConsent())) await recordCoppaConsent();
    let kid = profilesRef.current.find((p) => p.type === 'kids');
    if (!kid) {
      kid = addProfile('Little one', 'kids');
      // addProfile only queues a setProfiles update; profilesRef syncs in an effect AFTER
      // render, so update it now - otherwise setActiveProfile's membership guard would
      // reject this brand-new id.
      profilesRef.current = [...profilesRef.current, kid];
    }
    setActiveProfile(kid.id);
  }, [addProfile, setActiveProfile]);

  // Rename a profile in place (fixing a typo must NOT require delete+recreate,
  // which would discard the server-side profile id the household sync keys on).
  const renameProfile = useCallback((id: string, name: string) => {
    const clean = name.trim();
    if (!clean) return;
    setProfiles((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, name: clean } : p));
      setJSON(KEYS.profiles, next);
      return next;
    });
    // A kid rename also stays device-local (its name was never uploaded).
    const t = tokenRef.current;
    const isKid = profilesRef.current.find((p) => p.id === id)?.type === 'kids';
    if (t && t !== 'local' && !isKid) api.updateProfile(t, id, { name: clean }).catch(() => {});
  }, []);

  // Remove a profile + its data (COPPA: a parent can delete a child's profile any
  // time). Refuses to remove the last adult / the only profile; switches away if
  // the removed one was active.
  const removeProfile = useCallback((id: string) => {
    // Captured from the ref BEFORE the state update below removes it from the list.
    const wasKid = profilesRef.current.find((p) => p.id === id)?.type === 'kids';
    setProfiles((prev) => {
      const target = prev.find((p) => p.id === id);
      if (!target || prev.length <= 1) return prev;
      if (target.type === 'adult' && prev.filter((p) => p.type === 'adult').length <= 1) return prev;
      const next = prev.filter((p) => p.id !== id);
      setJSON(KEYS.profiles, next);
      setActiveId((cur) => (cur === id ? (next.find((p) => p.type === 'adult') ?? next[0]).id : cur));
      return next;
    });
    // Kid deletes stay device-local too, like create and rename. This was the one
    // ungated path: a kid id is minted locally as `p-kids-<timestamp>`, so
    // DELETE /profiles/p-kids-1785... told the server that a child profile existed
    // and the millisecond it was created. Worse, profiles.id is a uuid column, so
    // that id shape raised a database error, producing a 500 that the exception
    // filter writes to host logs (and Sentry) WITH the path - landing a
    // child-flagged identifier in durable logs. And this is the exact action the
    // children's notice tells a parent to perform. A kid profile has no server
    // record anyway, so skipping the call costs nothing.
    // Read the type BEFORE the state update above removes it from the list.
    const t = tokenRef.current;
    if (t && t !== 'local' && !wasKid) api.deleteProfile(t, id).catch(() => {});
  }, []);

  const setIntent = useCallback((i: Intent) => {
    setIntentState(i);
    setJSON(KEYS.intent, i);
  }, []);

  // Picking a feeling also seeds the matching intent, so the recommendation is
  // tailored even if the user stops after the first (feeling) tap. The feeling
  // stays in memory only (never persisted - no mood log); the intent it seeds is
  // a content preference and is fine to persist.
  const setFeeling = useCallback((f: Feeling) => {
    setFeelingState(f);
    const mappedIntent = FEELING_MAP[f].intent;
    setIntentState(mappedIntent);
    setJSON(KEYS.intent, mappedIntent);
  }, []);

  const dismissCheckIn = useCallback(() => setNeedsCheckIn(false), []);

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeId) ?? profiles[0] ?? fallback,
    [profiles, activeId]
  );
  const mode = activeProfile.type;

  // Publish the active mode so first-party analytics NEVER tracks a child profile
  // (COPPA - kids are never tracked). Keeps the gate out of every call site.
  useEffect(() => {
    setAnalyticsMode(mode);
    setMonitoringMode(mode); // COPPA: pause crash/error reporting in kids mode too
  }, [mode]);

  // RANKED recommendations matching the check-in answer (feeling × intent ×
  // time-of-day × mode). recommendedTrackId is the top pick; recommendedTrackIds
  // powers a "tailored tonight" set. See lib/recommend.
  const recoAnswer = useMemo(
    () => ({
      feeling,
      intent,
      mode,
      hour: new Date().getHours(),
      recentIds: recents,
      favoriteIds: favorites,
      goals: surveyGoals,
      moments: surveyMoments,
      workedBefore: trackWins,
    }),
    [feeling, intent, mode, recents, favorites, surveyGoals, surveyMoments, trackWins]
  );
  const recommendedTrackIds = useMemo(() => recommendTracks(recoAnswer), [recoAnswer]);
  // The HERO / "Begin wind-down" CTA must be free-PLAYABLE for a free, non-kids user -
  // the core nightly loop can't dead-end at a paywall (that's the BetterSleep tease we
  // exist to avoid). Locked picks still sit in recommendedTrackIds for the labelled
  // "More for tonight" upsell rail; premium + kids get the true top pick.
  const recommendedTrackId = useMemo(() => {
    if (mode === 'kids' || isPremium) return recommendedTrackIds[0];
    return recommendedTrackIds.find((id) => !TRACKS[id]?.locked) ?? recommendedTrackIds[0];
  }, [recommendedTrackIds, mode, isPremium]);
  // honest one-liner for WHY the hero pick is suggested (null → generic kicker)
  const recommendationReason = useMemo(
    () => explainRecommendation(recommendedTrackId, recoAnswer),
    [recommendedTrackId, recoAnswer]
  );

  const value = useMemo<ProfileValue>(
    () => ({
      hydrated,
      profiles,
      activeProfile,
      setActiveProfile,
      addProfile,
      enterKids,
      renameProfile,
      removeProfile,
      mode,
      setMode,
      intent,
      setIntent,
      feeling,
      setFeeling,
      needsCheckIn,
      dismissCheckIn,
      recommendedTrackId,
      recommendedTrackIds,
      recommendationReason,
    }),
    [hydrated, profiles, activeProfile, setActiveProfile, addProfile, enterKids, renameProfile, removeProfile, mode, setMode, intent, setIntent, feeling, setFeeling, needsCheckIn, dismissCheckIn, recommendedTrackId, recommendedTrackIds, recommendationReason]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  return useContext(ProfileContext);
}
