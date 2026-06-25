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

import { useAuth } from '@/features/auth/AuthProvider';
import { api } from '@/lib/api';
import { getJSON, remove, setJSON } from '@/lib/store';

export type AppMode = 'adult' | 'kids';
// Forward-looking check-in intents (build plan §6: "What would feel good right now?").
export type Intent = 'sleep' | 'reset' | 'sounds' | 'suggest';

/** A member of the household. One subscription covers the whole family (build plan §6). */
export type Profile = { id: string; name: string; type: AppMode };

const KEYS = {
  intent: 'cc.intent',
  lastOpen: 'cc.lastOpen',
  profiles: 'cc.profiles',
  activeId: 'cc.activeProfile',
  legacyMode: 'cc.mode',
} as const;
const CHECKIN_GAP_MS = 12 * 60 * 60 * 1000; // re-offer the check-in only after 12h away

const DEFAULT_PROFILES: Profile[] = [
  { id: 'p-you', name: 'You', type: 'adult' },
  { id: 'p-leo', name: 'Leo', type: 'kids' },
];

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

const INTENT_TRACK: Record<Intent, string> = {
  sleep: 'deep-rest',
  reset: 'box-breathing',
  sounds: 'slow-tide', // free taste; full soundscapes are premium
  suggest: 'slow-tide',
};

/**
 * How someone is "arriving" tonight — the gentle feeling step of the check-in.
 * SAFE WORDS ONLY (build plan §3/§14): NEVER "anxious"/"insomnia"/clinical terms.
 * Each maps forward-looking → an intent + a recommended track + a warm line
 * (no symptom tracking, no history — it only tailors the next recommendation).
 */
export type Feeling = 'racing' | 'cant-switch-off' | 'wired-tired' | 'wound-up' | 'heavy-day' | 'quiet';

export const FEELING_MAP: Record<Feeling, { intent: Intent; track: string; line: string }> = {
  racing: { intent: 'reset', track: 'box-breathing', line: 'Let’s slow the spin.' },
  'cant-switch-off': { intent: 'sleep', track: 'deep-rest', line: 'We’ll help you set the day down.' },
  'wired-tired': { intent: 'sleep', track: 'slow-tide', line: 'Tired body, busy mind — let’s settle both.' },
  'wound-up': { intent: 'reset', track: 'box-breathing', line: 'A few slow breaths to unwind.' },
  'heavy-day': { intent: 'sleep', track: 'deep-rest', line: 'Somewhere soft to land.' },
  quiet: { intent: 'sounds', track: 'slow-tide', line: 'Just some calm to rest in.' },
};

type ProfileValue = {
  hydrated: boolean;
  /** the household */
  profiles: Profile[];
  activeProfile: Profile;
  setActiveProfile: (id: string) => void;
  addProfile: (name: string, type: AppMode) => void;
  /** the active profile's type — drives kids vs adult content everywhere */
  mode: AppMode;
  /** switch to the (first) profile of this type — kept for the Adult/Kids toggles + parent gate */
  setMode: (m: AppMode) => void;
  intent: Intent | null;
  setIntent: (i: Intent) => void;
  /** how the user is "arriving" tonight — drives a warmer, tailored recommendation */
  feeling: Feeling | null;
  setFeeling: (f: Feeling) => void;
  needsCheckIn: boolean;
  dismissCheckIn: () => void;
  recommendedTrackId: string;
};

const fallback: Profile = DEFAULT_PROFILES[0];

const ProfileContext = createContext<ProfileValue>({
  hydrated: false,
  profiles: DEFAULT_PROFILES,
  activeProfile: fallback,
  setActiveProfile: () => {},
  addProfile: () => {},
  mode: 'adult',
  setMode: () => {},
  intent: null,
  setIntent: () => {},
  feeling: null,
  setFeeling: () => {},
  needsCheckIn: false,
  dismissCheckIn: () => {},
  recommendedTrackId: 'slow-tide',
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>(DEFAULT_PROFILES);
  const [activeId, setActiveId] = useState<string>(DEFAULT_PROFILES[0].id);
  const [intent, setIntentState] = useState<Intent | null>(null);
  const [feeling, setFeelingState] = useState<Feeling | null>(null);
  const [needsCheckIn, setNeedsCheckIn] = useState(false);
  const { token, user } = useAuth();

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
      const list = clean.length ? clean : DEFAULT_PROFILES;
      setProfiles(list);
      // if persisted data was corrupt/partial, re-persist the clean list
      if (clean.length !== (Array.isArray(savedProfiles) ? savedProfiles.length : -1)) {
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
      // NOTE: `feeling` is intentionally NOT persisted — the nightly check-in is
      // forward-looking and must never become a stored mood log (build plan §3/§14).
      const now = Date.now();
      setNeedsCheckIn(prevOpen == null || now - prevOpen > CHECKIN_GAP_MS);
      setJSON(KEYS.lastOpen, now);
      setHydrated(true);
    })();
  }, []);

  // Once signed in, the backend household is the source of truth — adopt it so
  // profiles sync across devices. Offline-safe: failure keeps the local set.
  useEffect(() => {
    if (!hydrated || !token || token === 'local') return;
    let alive = true;
    api
      .profiles(token)
      .then((list) => {
        if (!alive || !Array.isArray(list)) return;
        const mapped = sanitizeProfiles(list.map((p) => ({ id: p.id, name: p.name, type: p.type })));
        if (!mapped.length) return;
        setProfiles(mapped);
        setJSON(KEYS.profiles, mapped);
        setActiveId((cur) =>
          mapped.some((p) => p.id === cur) ? cur : (mapped.find((p) => p.type === 'adult') ?? mapped[0]).id,
        );
      })
      .catch(() => {
        /* offline — keep the local household */
      });
    return () => {
      alive = false;
    };
  }, [hydrated, token]);

  // When the signed-in ACCOUNT changes (sign-out, or switching users), wipe the
  // previous account's household + check-in state so account B never sees account
  // A's profiles. Keyed on the stable account id (email), not the raw token, so a
  // token refresh for the same account does NOT reset. The first observation after
  // hydration is the boot state and is adopted without wiping the local data.
  const accountRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!hydrated) return;
    const account = !token || token === 'local' ? null : (user?.email ?? token);
    const prev = accountRef.current;
    accountRef.current = account;
    if (prev === undefined || prev === account) return; // boot, or same account
    // account changed → drop the previous household; backend sync re-populates if signed in
    setProfiles(DEFAULT_PROFILES);
    setActiveId(DEFAULT_PROFILES[0].id);
    setIntentState(null);
    setFeelingState(null);
    setNeedsCheckIn(false);
    setJSON(KEYS.profiles, DEFAULT_PROFILES);
    setJSON(KEYS.activeId, DEFAULT_PROFILES[0].id);
    remove(KEYS.intent);
  }, [hydrated, token, user?.email]);

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

  const addProfile = useCallback((name: string, type: AppMode) => {
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
    // persist to the household on the backend (best-effort; next sync reconciles ids)
    const t = tokenRef.current;
    if (t && t !== 'local') api.createProfile(t, { name: profile.name, type }).catch(() => {});
  }, []);

  const setIntent = useCallback((i: Intent) => {
    setIntentState(i);
    setJSON(KEYS.intent, i);
  }, []);

  // Picking a feeling also seeds the matching intent, so the recommendation is
  // tailored even if the user stops after the first (feeling) tap. The feeling
  // stays in memory only (never persisted — no mood log); the intent it seeds is
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

  const recommendedTrackId = useMemo(() => {
    if (mode === 'kids') return 'penguin';
    // a chosen feeling tailors the pick most precisely; else fall back to intent
    if (feeling) return FEELING_MAP[feeling].track;
    return intent ? INTENT_TRACK[intent] : 'slow-tide';
  }, [mode, intent, feeling]);

  const value = useMemo<ProfileValue>(
    () => ({
      hydrated,
      profiles,
      activeProfile,
      setActiveProfile,
      addProfile,
      mode,
      setMode,
      intent,
      setIntent,
      feeling,
      setFeeling,
      needsCheckIn,
      dismissCheckIn,
      recommendedTrackId,
    }),
    [hydrated, profiles, activeProfile, setActiveProfile, addProfile, mode, setMode, intent, setIntent, feeling, setFeeling, needsCheckIn, dismissCheckIn, recommendedTrackId]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  return useContext(ProfileContext);
}
