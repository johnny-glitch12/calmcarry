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
  socialSignIn: (provider: 'apple' | 'google', idToken: string, authorizationCode?: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** change password while signed in — adopts the fresh session pair the server
   *  returns (it revokes every other device's refresh token) */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** unlock premium. DEMO stand-in for an Apple/Google IAP — production validates
   *  the store receipt server-side before setting the entitlement. */
  activatePremium: () => Promise<void>;
};

const FREE: ApiEntitlement = { tier: 'free', status: 'active' };
const CALM: ApiEntitlement = { tier: 'calm_plan', status: 'active' };

/** Is this entitlement live premium? A cached calm_plan self-expires at `expiresAt`
 *  even OFFLINE — so "buy one month, then stay offline" can't keep premium forever
 *  (the server is the online source of truth; this bounds the offline window). A
 *  missing/malformed expiry means "no expiry" (fail-open: never lock out a valid
 *  premium user on a bad date — the comp/preview session has no expiry by design). */
function isLivePremium(e: ApiEntitlement): boolean {
  if (e.tier !== 'calm_plan' || e.status !== 'active') return false;
  if (!e.expiresAt) return true;
  const t = Date.parse(e.expiresAt);
  return Number.isNaN(t) || t > Date.now();
}

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
  changePassword: async () => {},
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
        // A 'local' token is the OFFLINE sentinel — it has NO server to confirm it, so a
        // persisted 'local' session can only ever be FREE (premium requires a validated
        // purchase). Force FREE on restore so a planted cc.token='local' +
        // cc.entitlement=calm_plan can't grant permanent, un-reconcilable premium
        // (api.me('local') 401s and the refresh/re-validation paths skip 'local').
        const unverifiableLocal = savedToken === 'local';
        setToken(savedToken);
        setUser(savedUser);
        setEntitlement(unverifiableLocal ? FREE : savedEnt);
        setStatus('authed');
        if (unverifiableLocal) setJSON(KEYS.entitlement, FREE);
        // best-effort refresh; ignore if backend is down
        try {
          const me = await api.me(savedToken);
          if (!alive) return;
          setUser(me.user);
          setEntitlement(me.entitlement);
          setBackendUp(true);
          setJSON(KEYS.user, me.user);
          setJSON(KEYS.entitlement, me.entitlement);
        } catch (e) {
          // Expired access token (7d) + a stored refresh token (60d) → rotate and
          // retry ONCE, so a returning user never sits on a dead session where
          // every authed call silently 401s. Network errors (no .status) still
          // mean offline — keep the cached session untouched.
          const status = (e as { status?: number })?.status;
          if (status === 401 && savedToken !== 'local') {
            try {
              const rt = await secureGet(KEYS.refresh);
              if (!rt) throw e;
              const rotated = await api.refresh(rt);
              if (!alive) return;
              setToken(rotated.token);
              await secureSet(KEYS.token, rotated.token);
              if (rotated.refreshToken) await secureSet(KEYS.refresh, rotated.refreshToken);
              const me = await api.me(rotated.token);
              if (!alive) return;
              setUser(me.user);
              setEntitlement(me.entitlement);
              setBackendUp(true);
              setJSON(KEYS.user, me.user);
              setJSON(KEYS.entitlement, me.entitlement);
            } catch {
              // the refresh token is dead too — this is a real signed-out state,
              // not offline; clear the session instead of faking "signed in"
              if (!alive) return;
              setToken(null);
              setUser(null);
              setEntitlement(FREE);
              setStatus('guest');
              await Promise.all([secureDelete(KEYS.token), secureDelete(KEYS.refresh), remove(KEYS.user, KEYS.entitlement, KEYS.devices)]);
            }
          }
          /* otherwise offline — keep cached session */
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
        const ent: ApiEntitlement = {
          tier: r.isPremium ? 'calm_plan' : 'free',
          status: 'active',
          expiresAt: r.expiresAt ?? null,
        };
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
      const { token: t, refreshToken: rt, user: u } = await api.login(email, password);
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
      if (rt) await secureSet(KEYS.refresh, rt);
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
      const { token: t, refreshToken: rt, user: u } = await api.register(email, password, name);
      setToken(t);
      setUser(u);
      setEntitlement(FREE); // new accounts start free
      setBackendUp(true);
      setStatus('authed');
      track('sign_up');
      await Promise.all([secureSet(KEYS.token, t), setJSON(KEYS.user, u), setJSON(KEYS.entitlement, FREE)]);
      if (rt) await secureSet(KEYS.refresh, rt);
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

  const socialSignIn = useCallback(async (provider: 'apple' | 'google', idToken: string, authorizationCode?: string) => {
    // backend verifies the token, creates/resumes the household, returns our JWT
    const { token: t, refreshToken: rt, user: u } = await api.social(provider, idToken, authorizationCode);
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
    if (rt) await secureSet(KEYS.refresh, rt);
  }, []);

  const signOut = useCallback(async () => {
    // revoke the refresh token server-side (real logout, not just local) — best-effort
    try {
      const rt = await secureGet(KEYS.refresh);
      if (rt) api.logout(rt).catch(() => {});
    } catch {
      /* secure store unavailable — still clear locally */
    }
    clearAudioSourceCache(); // drop any signed CDN URLs so the next account re-resolves cleanly
    setToken(null);
    setUser(null);
    setEntitlement(FREE);
    setStatus('guest');
    // KEYS.devices: the device-presence cache drives orb-aware ritual copy — a
    // signed-out phone must never keep claiming the previous account's orb
    await Promise.all([secureDelete(KEYS.token), secureDelete(KEYS.refresh), remove(KEYS.user, KEYS.entitlement, KEYS.devices)]);
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!token || token === 'local') throw new Error('offline');
      const r = await api.changePassword(token, currentPassword, newPassword);
      // adopt the fresh pair — every previous refresh token (all devices) is now revoked
      setToken(r.token);
      await secureSet(KEYS.token, r.token);
      if (r.refreshToken) await secureSet(KEYS.refresh, r.refreshToken);
    },
    [token],
  );

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
      isPremium: isLivePremium(entitlement),
      backendUp,
      signIn,
      register,
      socialSignIn,
      signOut,
      changePassword,
      activatePremium,
    }),
    [status, user, token, entitlement, backendUp, signIn, register, socialSignIn, signOut, changePassword, activatePremium]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
