import { Tabs } from 'expo-router';

import { TabBar } from '@/components';
import { dur } from '@/theme';

export default function TabsLayout() {
  return (
    // Tab switches cross-fade FAST (dur.tab) with an OVERLAP curve — never a hard
    // cut, but never a laggy dissolve either. The built-in 'fade' preset makes
    // both scenes half-transparent at the midpoint, so the dark root bled through
    // as a visible dim-blink; this interpolator holds each scene fully opaque
    // through the middle (combined coverage never drops), so the new tab simply
    // materializes over the old one. Each screen still does its one-time entrance
    // on first open (Reveal) — this only shapes the switch itself.
    <Tabs
      screenOptions={{
        headerShown: false,
        // freezeOnBlur is deliberately OFF: combined with the custom fade
        // transitionSpec it can leave the INCOMING scene frozen (blank) on native
        // after the tab switches — reported as "Listen not loading" in kids mode
        // (Listen is the heaviest first mount, so the freeze race shows there
        // first). The sound machine must keep living across tab switches anyway.
        animation: 'fade',
        transitionSpec: { animation: 'timing', config: { duration: dur.tab } },
        sceneStyleInterpolator: ({ current }) => ({
          sceneStyle: {
            // progress: 0 = focused, ±1 = adjacent. Full opacity by 45% of the
            // way in/out → the two scenes overlap opaque mid-switch (no dip).
            opacity: current.progress.interpolate({
              inputRange: [-1, -0.55, 0, 0.55, 1],
              outputRange: [0, 1, 1, 1, 0],
            }),
          },
        }),
      }}
      tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="sounds" options={{ title: 'Library' }} />
      <Tabs.Screen name="listen" options={{ title: 'Listen' }} />
      <Tabs.Screen name="community" options={{ title: 'Community' }} />
      <Tabs.Screen name="you" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
