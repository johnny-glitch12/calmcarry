import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import type { ThemeMode } from './colors';

export type SchemePref = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'cc.colorScheme';

type Ctx = {
  /** the user's choice */
  pref: SchemePref;
  setPref: (p: SchemePref) => void;
  /** resolved theme for ADAPTIVE screens (no explicit choice = night after dark) */
  effective: ThemeMode;
  /** true once the saved preference has loaded (or failed) from storage */
  hydrated: boolean;
};

const ColorSchemeContext = createContext<Ctx>({
  pref: 'system',
  setPref: () => {},
  effective: 'light',
  hydrated: false,
});

/** wind-down window: 20:00-05:00 local. getHours is web-safe (no crash on web). */
function inNightWindow(): boolean {
  const h = new Date().getHours();
  return h >= 20 || h < 5;
}

/**
 * Appearance for ADAPTIVE screens. An explicit Light/Dark choice is honored
 * exactly and is never overridden. With no choice ('system') the app follows the
 * clock: night during the wind-down window (20:00-05:00) so the whole surface
 * feels like night after dark, light by day. The window is re-checked on return
 * to foreground, not on a ticking timer. Sleep screens still force night via
 * <Screen mode="night"> regardless of this.
 */
export function ColorSchemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<SchemePref>('system');
  const [hydrated, setHydrated] = useState(false);
  // 'system' users only: night after dark. Re-evaluated on foreground so an
  // evening reopen crosses into night, without a background clock running.
  const [nightWindow, setNightWindow] = useState(inNightWindow);

  // load the saved preference once on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark' || v === 'system') setPrefState(v);
      })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  // re-check the clock when the app returns to the foreground (AppState 'active')
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setNightWindow(inNightWindow());
    });
    return () => sub.remove();
  }, []);

  const setPref = useCallback((p: SchemePref) => {
    setPrefState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  }, []);

  // explicit choice wins; 'system' follows the clock (night after dark).
  const effective = useMemo<ThemeMode>(() => {
    if (pref === 'light') return 'light';
    if (pref === 'dark') return 'night';
    return nightWindow ? 'night' : 'light';
  }, [pref, nightWindow]);

  const value = useMemo(
    () => ({ pref, setPref, effective, hydrated }),
    [pref, setPref, effective, hydrated]
  );
  return <ColorSchemeContext.Provider value={value}>{children}</ColorSchemeContext.Provider>;
}

export function useColorSchemePref() {
  return useContext(ColorSchemeContext);
}
