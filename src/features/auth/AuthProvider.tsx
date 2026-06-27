import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { track } from '@/lib/analytics';
import { api, type ApiEntitlement, type ApiUser } from '@/lib/api';
import { clearAudioSourceCache } from '@/lib/audioSource';
import { secureDelete, secureGet, secureSet } from '@/lib/secureStore';
import { getJSON, KEYS, remove, setJSON } from '@/lib/store';

type Status = 'loading' | 'authed' | 'guest';

type AuthValue = {
  status: Status;
  user: ApiUser | null;
  token: string | null;
  entitlement: ApiEntitlement;
  isPremium: boolean;
  /** whether the last auth touched the live NestJS backend (vs. local fallback) */
  backendUp: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  /** Sign in with a verified Apple/Google identity token (backend creates/resumes the account) */
  socialSignIn: (provider: 'apple' | 'google', idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** unlock premium. DEMO stand-in for an Apple/Google IAP — production validates
   *  the store receipt server-side before setting the entitlement. */
  activatePremium: () => Promise<void>;
};

const FREE: ApiEntitlement = { tier: 'free', status: 'active' };
const CALM: ApiEntitlement = { tier: 'calm_plan', status: 'active' };

const AuthContext = createContext<AuthValue>({
  status: 'loading',
  user: null,
  token: null,
  entitlement: FREE,
  isPremium: false,
  backendUp: false,
  signIn: async () => {},
  register: async () => {},
  socialSignIn: async () => {},
  signOut: async () => {},
  activatePremium: async () => {},
});

function nameFromEmail(email: string) {
  const handle = email.split('@')[0] ?? 'Sleeper';
  return handle
    .split(/[.\-_]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<ApiUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [entitlement, setEntitlement] = useState<ApiEntitlement>(FREE);
  const [backendUp, setBackendUp] = useState(false);

  // restore a persisted session on launch; refresh from the backend if reachable
  useEffect(() => {
    let alive = true;
    (async () => {
      const [secureToken, savedUser, savedEnt] = await Promise.all([
        secureGet(KEYS.token),
        getJSON<ApiUser | null>(KEYS.user, null),
        getJSON<ApiEntitlement>(KEYS.entitlement, FREE),
      ]);
      // one-time migration: move a legacy AsyncStorage token into secure storage
      let savedToken = secureToken;
      if (!savedToken) {
        const legacy = await getJSON<string | null>(KEYS.token, null);
        if (legacy) {
          savedToken = legacy;
          await secureSet(KEYS.token, legacy);
          await remove(KEYS.token);
        }
      }
      if (!alive) return;
      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(savedUser);
        setEntitlement(savedEnt);
        setStatus('authed');
        // best-effort refresh; ignore if backend is down
        try {
          const me = await api.me(savedToken);
          if (!alive) return;
          setUser(me.user);
          setEntitlement(me.entitlement);
          setBackendUp(true);
          setJSON(KEYS.user, me.user);
          setJSON(KEYS.entitlement, me.entitlement);
        } catch {
          /* offline — keep cached session */
        }
      } else {
        setStatus('guest');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Re-validate entitlement whenever the app returns to the foreground. Without
  // this, isPremium is frozen at launch — an expired/revoked subscription (changed
  // store-side) would keep unlocking content until the next cold start. Uses
  // /billing/status (the expiry-aware gate), and stays offline-safe.
  useEffect(() => {
    if (!token || token === 'local') return;
    const sub = AppState.addEventListener('change', async (s) => {
      if (s !== 'active') return;
      try {
        const r = await api.billingStatus(token);
        const ent: ApiEntitlement = { tier: r.isPremium ? 'calm_plan' : 'free', status: 'active' };
        setEntitlement(ent);
        await setJSON(KEYS.entitlement, ent);
      } catch {
        /* offline — keep the cached entitlement */
      }
    });
    return () => sub.remove();
  }, [token]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { token: t, user: u } = await api.login(email, password);
      let ent: ApiEntitlement = FREE;
      try {
        ent = (await api.me(t)).entitlement;
      } catch {
        /* keep FREE until /me confirms — never assume premium */
      }
      setToken(t);
      setUser(u);
      setEntitlement(ent);
      setBackendUp(true);
      setStatus('authed');
      track('sign_in');
      await Promise.all([secureSet(KEYS.token, t), setJSON(KEYS.user, u), setJSON(KEYS.entitlement, ent)]);
    } catch (e) {
      // wrong credentials → surface to the UI (do NOT log in)
      const status = (e as { status?: number })?.status;
      if (status === 401 || status === 403) throw e;
      // genuine network/offline → a local FREE session so the app stays usable.
      // Premium is NEVER granted offline — it requires a validated purchase.
      const u: ApiUser = { email, name: nameFromEmail(email) };
      setToken('local');
      setUser(u);
      setEntitlement(FREE);
      setBackendUp(false);
      setStatus('authed');
      await Promise.all([secureSet(KEYS.token, 'local'), setJSON(KEYS.user, u), setJSON(KEYS.entitlement, FREE)]);
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    try {
      const { token: t, user: u } = await api.register(email, password, name);
      setToken(t);
      setUser(u);
      setEntitlement(FREE); // new accounts start free
      setBackendUp(true);
      setStatus('authed');
      track('sign_up');
      await Promise.all([secureSet(KEYS.token, t), setJSON(KEYS.user, u), setJSON(KEYS.entitlement, FREE)]);
    } catch (e) {
      const status = (e as { status?: number })?.status;
      if (status === 409 || status === 400) throw e; // email taken / invalid
      const u: ApiUser = { email, name };
      setToken('local');
      setUser(u);
      setEntitlement(FREE);
      setBackendUp(false);
      setStatus('authed');
      await Promise.all([secureSet(KEYS.token, 'local'), setJSON(KEYS.user, u), setJSON(KEYS.entitlement, FREE)]);
    }
  }, []);

  const socialSignIn = useCallback(async (provider: 'apple' | 'google', idToken: string) => {
    // backend verifies the token, creates/resumes the household, returns our JWT
    const { token: t, user: u } = await api.social(provider, idToken);
    let ent: ApiEntitlement = FREE;
    try {
      ent = (await api.me(t)).entitlement;
    } catch {
      /* keep FREE until /me confirms */
    }
    setToken(t);
    setUser(u);
    setEntitlement(ent);
    setBackendUp(true);
    setStatus('authed');
    track('sign_in', { method: provider });
    await Promise.all([secureSet(KEYS.token, t), setJSON(KEYS.user, u), setJSON(KEYS.entitlement, ent)]);
  }, []);

  const signOut = useCallback(async () => {
    clearAudioSourceCache(); // drop any signed CDN URLs so the next account re-resolves cleanly
    setToken(null);
    setUser(null);
    setEntitlement(FREE);
    setStatus('guest');
    await Promise.all([secureDelete(KEYS.token), remove(KEYS.user, KEYS.entitlement)]);
  }, []);

  const activatePremium = useCallback(async () => {
    setEntitlement(CALM);
    await setJSON(KEYS.entitlement, CALM);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      user,
      token,
      entitlement,
      isPremium: entitlement.tier === 'calm_plan' && entitlement.status === 'active',
      backendUp,
      signIn,
      register,
      socialSignIn,
      signOut,
      activatePremium,
    }),
    [status, user, token, entitlement, backendUp, signIn, register, socialSignIn, signOut, activatePremium]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
