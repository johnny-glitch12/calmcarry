import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

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
 * NIGHT-FIRST identity: CalmCarry is a sleep product, and the adult app is the
 * deep-eucalyptus night theme everywhere, always - one cohesive world, like the
 * best sleep apps, not a utility that happens to have a dark mode. `effective`
 * therefore always resolves 'night'. The light palette still exists for the
 * KIDS daytime surface (<Screen mode="day">), which stays soft on purpose.
 * The pref plumbing is kept so the choice is one line to revisit.
 */
export function ColorSchemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<SchemePref>('system');
  const [hydrated, setHydrated] = useState(false);

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

  // night-first: the adaptive surface is always the night theme (see doc above).
  // `pref`/`os` intentionally no longer influence it.
  const effective = useMemo<ThemeMode>(() => 'night', []);

  const value = useMemo(
    () => ({ pref, setPref, effective, hydrated }),
    [pref, setPref, effective, hydrated]
  );
  return <ColorSchemeContext.Provider value={value}>{children}</ColorSchemeContext.Provider>;
}

export function useColorSchemePref() {
  return useContext(ColorSchemeContext);
}
