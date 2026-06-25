import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import type { ThemeMode } from './colors';

export type SchemePref = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'cc.colorScheme';

type Ctx = {
  /** the user's choice */
  pref: SchemePref;
  setPref: (p: SchemePref) => void;
  /** resolved theme for ADAPTIVE screens ('system' follows the OS) */
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

/**
 * App-level appearance preference. CalmCarry is light-by-day / dark-for-sleep
 * by design; this lets a user force the whole adaptive (utility) surface to the
 * dark eucalyptus theme too. Sleep screens (<Screen mode="night">) stay dark
 * regardless. Default follows the OS. (In-memory for now — persist with a
 * storage layer when one lands.)
 */
export function ColorSchemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<SchemePref>('system');
  const [hydrated, setHydrated] = useState(false);
  const os = useRNColorScheme(); // 'light' | 'dark' | null

  // load the saved preference once on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark' || v === 'system') setPrefState(v);
      })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  const setPref = useCallback((p: SchemePref) => {
    setPrefState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  }, []);

  const effective = useMemo<ThemeMode>(() => {
    const resolved = pref === 'system' ? (os === 'dark' ? 'dark' : 'light') : pref;
    return resolved === 'dark' ? 'night' : 'light';
  }, [pref, os]);

  const value = useMemo(
    () => ({ pref, setPref, effective, hydrated }),
    [pref, setPref, effective, hydrated]
  );
  return <ColorSchemeContext.Provider value={value}>{children}</ColorSchemeContext.Provider>;
}

export function useColorSchemePref() {
  return useContext(ColorSchemeContext);
}
