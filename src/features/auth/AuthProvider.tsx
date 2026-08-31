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
import { AppState, Platform } from 'react-native';

import { track } from '@/lib/analytics';
import { api, setTokenRefresher, type ApiEntitlement, type ApiUser } from '@/lib/api';
import { clearAudioSourceCache } from '@/lib/audioSource';
import { currentStoreEntitlement, iapSupported, initIapListener, restoreSubscription } from '@/lib/iap';
import { isKidsActive } from '@/lib/kidsMode';
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
  /** Sign in with a verified Apple/Google identity token (backend creates/resumes
   *  the account). `created` is true when this call CREATED the account - the
   *  caller routes brand-new accounts through the first-run owner match. */
  socialSignIn: (provider: 'apple' | 'google', idToken: string, authorizationCode?: string, name?: string) => Promise<{ created: boolean }>;
  signOut: () => Promise<void>;
  /** change password while signed in - adopts the fresh session pair the server
   *  returns (it revokes every other device's refresh token) */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** unlock premium after a store purchase. With a server session the receipt was
   *  already validated server-side; a GUEST purchase (5.1.1(v): no account required
   *  to buy) passes the store's own expiry so the local entitlement self-bounds. */
  activatePremium: (expiresAt?: string | null) => Promise<void>;
};

const FREE: ApiEntitlement = { tier: 'free', status: 'active' };
const CALM: ApiEntitlement = { tier: 'calm_plan', status: 'active' };

/** Is this entitlement live premium? A cached calm_plan self-expires at `expiresAt`
 *  even OFFLINE - so "buy one month, then stay offline" can't keep premium forever
 *  (the server is the online source of truth; this bounds the offline window). A
 *  missing/malformed expiry means "no expiry" (fail-open: never lock out a valid
 *  premium user on a bad date - the comp/preview session has no expiry by design). */
function isLivePremium(e: ApiEntitlement): boolean {
  if (e.tier !== 'calm_plan' || e.status !== 'active') return false;
  if (!e.expiresAt) return true;
  const t = Date.parse(e.expiresAt);
  return Number.isNaN(t) || t > Date.now();
}

// Demo login for the gated WEB preview (stakeholder walkthroughs). Credentials come
// ONLY from build-time env (EXPO_PUBLIC_COMP_EMAIL / EXPO_PUBLIC_COMP_PASSWORD in the
// untracked .env.local that `npm run build:site` reads) - no literal ships in source,
// and the native store profiles never set these vars, so on a shipped binary both
// resolve to '' and the branch below is unmatchable.
const COMP_EMAIL = (process.env.EXPO_PUBLIC_COMP_EMAIL ?? '').trim().toLowerCase();
const COMP_PASSWORD = process.env.EXPO_PUBLIC_COMP_PASSWORD ?? '';
const COMP_LOGIN = !!COMP_EMAIL && !!COMP_PASSWORD && (Platform.OS === 'web' || __DEV__);

const AuthContext = createContext<AuthValue>({
  status: 'loading',
  user: null,
  token: null,
  entitlement: FREE,
  isPremium: false,
  backendUp: false,
  signIn: async () => {},
  register: async () => {},
  socialSignIn: async () => ({ created: false }),
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

  // Callback-safe view of the current entitlement: signIn/register are stable
  // useCallbacks, so reading the state directly there would see the mount-time
  // value - and the guest-purchase carry-over below depends on the LIVE one.
  const entRef = useRef<ApiEntitlement>(FREE);
  useEffect(() => {
    entRef.current = entitlement;
  }, [entitlement]);

  // Session state readable from async continuations and the store listener:
  // a store round-trip can outlive the session it started under, and its result
  // must be judged against the session that exists when it LANDS.
  const tokenRef = useRef<string | null>(null);
  const statusRef = useRef<Status>('loading');
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  /** Store-truth reconcile for entitlements no server vouches for (guest and
   *  offline-'local' sessions, which can hold a signed-out purchase - 5.1.1(v)).
   *  Downgrades only on a definitive 'none' from the store; refreshes the expiry
   *  on 'active' (renewals extend, cancellations lapse); 'unknown' (store
   *  unreachable) is not a verdict and keeps the cached state. */
  const reconcileWithStore = useCallback(() => {
    if (!iapSupported) return;
    // the kids-mode contract: no network while a child profile is active - the
    // store query waits for an adult session (the next adult foreground re-runs it)
    if (isKidsActive()) return;
    void (async () => {
      const s = await currentStoreEntitlement();
      // The verdict may land AFTER the session changed under it (a sign-in
      // completing during the store round-trip). A real session's entitlement is
      // owned by the server paths - never apply a guest verdict over it, and
      // especially never persist FREE over an account's premium.
      const t = tokenRef.current;
      if (t && t !== 'local') return;
      if (s.verdict === 'none') {
        setEntitlement(FREE);
        await setJSON(KEYS.entitlement, FREE);
      } else if (s.verdict === 'active') {
        const ent: ApiEntitlement = { tier: 'calm_plan', status: 'active', expiresAt: s.expiresAt };
        setEntitlement(ent);
        await setJSON(KEYS.entitlement, ent);
      }
    })();
  }, []);

  /** Attach a purchase made while signed out to the account that just appeared.
   *  Deliberately re-reads the CURRENT store transaction (restoreSubscription →
   *  getAvailablePurchases) rather than a stashed purchase-time receipt: a stored
   *  JWS goes stale at the first renewal and the server would grant an already-
   *  expired entitlement. Best-effort - offline just means the next foreground
   *  pass or a manual restore tries again. */
  const linkGuestPurchase = useCallback((t: string) => {
    void (async () => {
      try {
        const r = await restoreSubscription(t);
        if (!r.ok) return;
        const s = await api.billingStatus(t);
        const ent: ApiEntitlement = {
          tier: s.isPremium ? 'calm_plan' : 'free',
          status: 'active',
          expiresAt: s.expiresAt ?? null,
        };
        setEntitlement(ent);
        await setJSON(KEYS.entitlement, ent);
      } catch {
        /* best-effort */
      }
    })();
  }, []);

  /**
   * Give the API layer a way to refresh an expired access token mid-session, so a
   * warm app (the normal case for a nightly sleep app - resumed, not cold-started)
   * recovers instead of silently 401ing on everything after 7 days. Single-flighted
   * inside api.ts; returns null only when the session is genuinely dead.
   */
  useEffect(() => {
    setTokenRefresher(async () => {
      try {
        const rt = await secureGet(KEYS.refresh);
        if (!rt) return null;
        const rotated = await api.refresh(rt);
        setToken(rotated.token);
        await secureSet(KEYS.token, rotated.token);
        if (rotated.refreshToken) await secureSet(KEYS.refresh, rotated.refreshToken);
        return rotated.token;
      } catch (e) {
        // Only a DEFINITIVE rejection means signed-out. A timeout/5xx/429 is
        // transient: keep the session so a Railway blip or a rate-limited hotel IP
        // can't log the user out and lose their local state.
        const status = (e as { status?: number })?.status;
        if (status === 401 || status === 403) {
          setToken(null);
          setUser(null);
          setEntitlement(FREE);
          setStatus('guest');
          await Promise.all([
            secureDelete(KEYS.token),
            secureDelete(KEYS.refresh),
            remove(KEYS.user, KEYS.entitlement, KEYS.devices),
          ]);
        }
        return null;
      }
    });
    return () => setTokenRefresher(null);
  }, []);

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
        // A 'local' token is the OFFLINE sentinel - it has NO server to confirm it. On
        // WEB (no store either) a persisted 'local' session can only ever be FREE, so a
        // planted cc.token='local' + cc.entitlement=calm_plan can't grant permanent,
        // un-reconcilable premium (api.me('local') 401s and the refresh/re-validation
        // paths skip 'local'). On NATIVE a 'local' session may legitimately hold a
        // signed-out store purchase (5.1.1(v)) - keep the cached entitlement (it
        // self-expires via isLivePremium) and let the store reconcile deliver the
        // real verdict. Exception: where the env-gated demo login is live (web
        // preview / dev), the demo session must survive reloads; COMP_LOGIN is
        // always false on a store build.
        const unverifiableLocal = savedToken === 'local' && !COMP_LOGIN && !iapSupported;
        setToken(savedToken);
        setUser(savedUser);
        setEntitlement(unverifiableLocal ? FREE : savedEnt);
        setStatus('authed');
        if (unverifiableLocal) setJSON(KEYS.entitlement, FREE);
        if (savedToken === 'local' && !COMP_LOGIN && !unverifiableLocal && savedEnt.tier === 'calm_plan') {
          reconcileWithStore();
        }
        // Adopting the server's answer must never wipe a signed-out purchase whose
        // account-linking hasn't landed yet (same guard as the foreground handler):
        // server-free + store-active keeps the held entitlement and retries the
        // link; store-unknown is no verdict; only store-'none' lets the server's
        // downgrade through.
        const adoptEntitlement = async (t: string, serverEnt: ApiEntitlement): Promise<ApiEntitlement> => {
          if (isLivePremium(serverEnt) || !isLivePremium(savedEnt) || !iapSupported) return serverEnt;
          const store = await currentStoreEntitlement();
          if (store.verdict === 'none') return serverEnt;
          if (store.verdict === 'active') linkGuestPurchase(t);
          return savedEnt;
        };
        // best-effort refresh; ignore if backend is down
        try {
          const me = await api.me(savedToken);
          if (!alive) return;
          const adopted = await adoptEntitlement(savedToken, me.entitlement);
          if (!alive) return;
          setUser(me.user);
          setEntitlement(adopted);
          setBackendUp(true);
          setJSON(KEYS.user, me.user);
          setJSON(KEYS.entitlement, adopted);
        } catch (e) {
          // Expired access token (7d) + a stored refresh token (60d) → rotate and
          // retry ONCE, so a returning user never sits on a dead session where
          // every authed call silently 401s. Network errors (no .status) still
          // mean offline - keep the cached session untouched.
          const status = (e as { status?: number })?.status;
          if (status === 404 && savedToken !== 'local') {
            // /me 404s when the owner row is GONE (account deleted from another
            // device) while the JWT is still cryptographically valid for days.
            // That is a real signed-out state, not offline - clear the session
            // instead of keeping a ghost account no call can ever serve.
            setToken(null);
            setUser(null);
            setEntitlement(FREE);
            setStatus('guest');
            await Promise.all([secureDelete(KEYS.token), secureDelete(KEYS.refresh), remove(KEYS.user, KEYS.entitlement, KEYS.devices)]);
          } else if (status === 401 && savedToken !== 'local') {
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
              const adopted = await adoptEntitlement(rotated.token, me.entitlement);
              if (!alive) return;
              setUser(me.user);
              setEntitlement(adopted);
              setBackendUp(true);
              setJSON(KEYS.user, me.user);
              setJSON(KEYS.entitlement, adopted);
            } catch (re) {
              if (!alive) return;
              // Only a DEFINITIVE rejection is a signed-out state. This used to clear
              // the session on ANY failure, so a Railway 502, a request timeout, or a
              // 429 from a shared office/hotel IP logged the user out - and could even
              // discard the session the refresh had just issued, because the follow-up
              // /me call shared this catch. Transient failures keep the cached session
              // (the same rule the offline branch below already applies).
              const rs = (re as { status?: number })?.status;
              if (rs !== 401 && rs !== 403) return;
              setToken(null);
              setUser(null);
              setEntitlement(FREE);
              setStatus('guest');
              await Promise.all([secureDelete(KEYS.token), secureDelete(KEYS.refresh), remove(KEYS.user, KEYS.entitlement, KEYS.devices)]);
            }
          }
          /* otherwise offline - keep cached session */
        }
      } else {
        // Signed-out purchases (5.1.1(v)) leave a PAID entitlement with no account
        // behind it. Restore it for native guests - even expired-looking (a renewal
        // may have extended it store-side) - and let the store confirm or retire it.
        // Web guests have no store, so a planted cc.entitlement stays worthless there.
        if (iapSupported && savedEnt.tier === 'calm_plan') {
          setEntitlement(savedEnt);
          reconcileWithStore();
        }
        setStatus('guest');
      }
    })();
    return () => {
      alive = false;
    };
  }, [reconcileWithStore, linkGuestPurchase]);

  // Interrupted purchases (SCA finishing later, Ask to Buy approvals, app killed
  // mid-checkout) are redelivered by the store OUTSIDE any purchase flow - the
  // persistent listener validates + finishes them and refreshes the entitlement,
  // so a charged user unlocks without hunting for "Restore purchases". Wired for
  // GUESTS too (5.1.1(v)): a signed-out redelivery validated on-device arrives
  // here with the store's own expiry and becomes the local entitlement. While the
  // persisted session is still being RESTORED, getToken reports undefined so the
  // listener leaves the event queued - guest-finishing a transaction that belongs
  // to an account would orphan it (finished but never server-validated).
  useEffect(() => {
    tokenRef.current = token; // every change, including sign-out → null
    initIapListener(
      () => (statusRef.current === 'loading' ? undefined : tokenRef.current),
      async (expiresAt) => {
        const t = tokenRef.current;
        if (t && t !== 'local') {
          try {
            const r = await api.billingStatus(t);
            const ent: ApiEntitlement = {
              tier: r.isPremium ? 'calm_plan' : 'free',
              status: 'active',
              expiresAt: r.expiresAt ?? null,
            };
            setEntitlement(ent);
            await setJSON(KEYS.entitlement, ent);
          } catch {
            /* offline - the foreground refresh below will catch up */
          }
          return;
        }
        // Guest / offline-'local' session: the store already delivered the verdict.
        const ent: ApiEntitlement = { tier: 'calm_plan', status: 'active', expiresAt: expiresAt ?? null };
        setEntitlement(ent);
        await setJSON(KEYS.entitlement, ent);
      },
    );
  }, [token]);

  // Re-validate entitlement whenever the app returns to the foreground. Without
  // this, isPremium is frozen at launch - an expired/revoked subscription (changed
  // store-side) would keep unlocking content until the next cold start. Uses
  // /billing/status (the expiry-aware gate), and stays offline-safe.
  useEffect(() => {
    if (!token || token === 'local') return;
    const sub = AppState.addEventListener('change', async (s) => {
      if (s !== 'active') return;
      try {
        const r = await api.billingStatus(token);
        // The account not owning premium is NOT the last word when this device
        // holds a live entitlement: a signed-out purchase whose account-linking
        // hasn't landed yet must not be downgraded. Ask the store - 'active'
        // retries the link, 'unknown' is no verdict; only 'none' (genuinely
        // lapsed/refunded) falls through to the server's downgrade.
        if (!r.isPremium && isLivePremium(entRef.current) && iapSupported) {
          const store = await currentStoreEntitlement();
          if (store.verdict === 'active') {
            linkGuestPurchase(token);
            return;
          }
          if (store.verdict === 'unknown') return;
        }
        const ent: ApiEntitlement = {
          tier: r.isPremium ? 'calm_plan' : 'free',
          status: 'active',
          expiresAt: r.expiresAt ?? null,
        };
        setEntitlement(ent);
        await setJSON(KEYS.entitlement, ent);
      } catch {
        /* offline - keep the cached entitlement */
      }
    });
    return () => sub.remove();
  }, [token, linkGuestPurchase]);

  // Guests (and offline-'local' sessions): the STORE is the source of truth - a
  // held premium is re-checked on foreground so a cancelled/lapsed signed-out
  // subscription retires, and a renewed one refreshes its expiry. The authed
  // equivalent above uses /billing/status instead.
  useEffect(() => {
    if (token && token !== 'local') return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      if (entRef.current.tier === 'calm_plan') reconcileWithStore();
    });
    return () => sub.remove();
  }, [token, reconcileWithStore]);

  const signIn = useCallback(async (email: string, password: string) => {
    // Demo login (web preview / dev only; see COMP_LOGIN above): a local premium
    // session so a stakeholder can walk the full product without a provisioned
    // backend. Passwords trimmed so a stray autocomplete space doesn't drop the
    // demo through to the offline fallback.
    if (COMP_LOGIN && email.trim().toLowerCase() === COMP_EMAIL && password.trim() === COMP_PASSWORD) {
      const u: ApiUser = { email: COMP_EMAIL, name: 'Mason' };
      setToken('local');
      setUser(u);
      setEntitlement(CALM);
      setBackendUp(false);
      setStatus('authed');
      track('sign_in', { method: 'comp' });
      await Promise.all([secureSet(KEYS.token, 'local'), setJSON(KEYS.user, u), setJSON(KEYS.entitlement, CALM)]);
      return;
    }
    try {
      const { token: t, refreshToken: rt, user: u } = await api.login(email, password);
      let ent: ApiEntitlement = FREE;
      try {
        ent = (await api.me(t)).entitlement;
      } catch {
        /* keep FREE until /me confirms - never assume premium */
      }
      // A purchase made signed-out (5.1.1(v)) belongs to the person, not the void:
      // if the account isn't premium but this device holds a live store-backed
      // entitlement, keep it and attach it to the account in the background.
      if (!isLivePremium(ent) && isLivePremium(entRef.current) && iapSupported) {
        ent = entRef.current;
        linkGuestPurchase(t);
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
      // genuine network/offline → a local session so the app stays usable. Premium
      // is never GRANTED offline - but a store-backed guest entitlement this device
      // already holds survives the fallback (the store, not the session, owns it).
      const held = iapSupported && isLivePremium(entRef.current) ? entRef.current : FREE;
      const u: ApiUser = { email, name: nameFromEmail(email) };
      setToken('local');
      setUser(u);
      setEntitlement(held);
      setBackendUp(false);
      setStatus('authed');
      await Promise.all([secureSet(KEYS.token, 'local'), setJSON(KEYS.user, u), setJSON(KEYS.entitlement, held)]);
    }
  }, [linkGuestPurchase]);

  const register = useCallback(async (email: string, password: string, name: string) => {
    // "Buy first, register later" is the flow Apple requires (5.1.1(v)): a live
    // store-backed entitlement held as a guest rides into the new account and gets
    // attached server-side in the background.
    const held = iapSupported && isLivePremium(entRef.current) ? entRef.current : FREE;
    try {
      const { token: t, refreshToken: rt, user: u } = await api.register(email, password, name);
      setToken(t);
      setUser(u);
      setEntitlement(held); // new accounts start free - unless this device already bought
      setBackendUp(true);
      setStatus('authed');
      track('sign_up');
      await Promise.all([secureSet(KEYS.token, t), setJSON(KEYS.user, u), setJSON(KEYS.entitlement, held)]);
      if (rt) await secureSet(KEYS.refresh, rt);
      if (held !== FREE) linkGuestPurchase(t);
    } catch (e) {
      const status = (e as { status?: number })?.status;
      if (status === 409 || status === 400) throw e; // email taken / invalid
      const u: ApiUser = { email, name };
      setToken('local');
      setUser(u);
      setEntitlement(held);
      setBackendUp(false);
      setStatus('authed');
      await Promise.all([secureSet(KEYS.token, 'local'), setJSON(KEYS.user, u), setJSON(KEYS.entitlement, held)]);
    }
  }, [linkGuestPurchase]);

  const socialSignIn = useCallback(async (provider: 'apple' | 'google', idToken: string, authorizationCode?: string, name?: string) => {
    // backend verifies the token, creates/resumes the household, returns our JWT
    const { token: t, refreshToken: rt, user: u, created } = await api.social(provider, idToken, authorizationCode, name);
    let ent: ApiEntitlement = FREE;
    try {
      ent = (await api.me(t)).entitlement;
    } catch {
      /* keep FREE until /me confirms */
    }
    // carry a signed-out purchase into the account (same rule as signIn above)
    if (!isLivePremium(ent) && isLivePremium(entRef.current) && iapSupported) {
      ent = entRef.current;
      linkGuestPurchase(t);
    }
    setToken(t);
    setUser(u);
    setEntitlement(ent);
    setBackendUp(true);
    setStatus('authed');
    track('sign_in', { method: provider });
    await Promise.all([secureSet(KEYS.token, t), setJSON(KEYS.user, u), setJSON(KEYS.entitlement, ent)]);
    if (rt) await secureSet(KEYS.refresh, rt);
    // brand-new accounts run the first-run owner match, same as email sign-up
    return { created: created === true };
  }, [linkGuestPurchase]);

  const signOut = useCallback(async () => {
    // revoke the refresh token server-side (real logout, not just local) - best-effort
    try {
      const rt = await secureGet(KEYS.refresh);
      if (rt) api.logout(rt).catch(() => {});
    } catch {
      /* secure store unavailable - still clear locally */
    }
    clearAudioSourceCache(); // drop any signed CDN URLs so the next account re-resolves cleanly
    setToken(null);
    setUser(null);
    setEntitlement(FREE);
    setStatus('guest');
    // KEYS.devices: the device-presence cache drives orb-aware ritual copy - a
    // signed-out phone must never keep claiming the previous account's orb
    await Promise.all([secureDelete(KEYS.token), secureDelete(KEYS.refresh), remove(KEYS.user, KEYS.entitlement, KEYS.devices)]);
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!token || token === 'local') throw new Error('offline');
      const r = await api.changePassword(token, currentPassword, newPassword);
      // adopt the fresh pair - every previous refresh token (all devices) is now revoked
      setToken(r.token);
      await secureSet(KEYS.token, r.token);
      if (r.refreshToken) await secureSet(KEYS.refresh, r.refreshToken);
    },
    [token],
  );

  const activatePremium = useCallback(async (expiresAt?: string | null) => {
    // No argument = a server-validated session purchase (the foreground
    // /billing/status pass owns the real expiry). A guest purchase passes the
    // store's own expiry so the local entitlement self-bounds offline.
    const ent: ApiEntitlement = expiresAt === undefined ? CALM : { ...CALM, expiresAt };
    setEntitlement(ent);
    await setJSON(KEYS.entitlement, ent);
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
