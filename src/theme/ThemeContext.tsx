import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { themes, type ThemeColors, type ThemeMode } from './colors';

/**
 * CalmCarry is a HYBRID: light by day (utility screens), a brand-derived
 * deep-eucalyptus NIGHT theme for wind-down/player/sleep screens. Theme is
 * therefore PER-SCREEN, not driven by the OS color scheme — each screen wraps
 * its subtree in <ThemeProvider mode="light|night">.
 */

type ThemeValue = {
  mode: ThemeMode;
  isNight: boolean;
  c: ThemeColors;
};

const ThemeContext = createContext<ThemeValue>({
  mode: 'light',
  isNight: false,
  c: themes.light,
});

export function ThemeProvider({
  mode = 'light',
  children,
}: {
  mode?: ThemeMode;
  children: ReactNode;
}) {
  const value = useMemo<ThemeValue>(
    // kids "cozy dusk" is a DARK surface too, so dark-aware components (off-track
    // switch fills, error tints, etc.) should treat it like night
    () => ({ mode, isNight: mode === 'night' || mode === 'kids', c: themes[mode] }),
    [mode]
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
