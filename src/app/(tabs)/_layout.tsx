import { Tabs, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { TabBar } from '@/components';
import { useProfile } from '@/features/profile/ProfileProvider';
import { HandsOnTour } from '@/features/tour/HandsOnTour';
import { getJSON, setJSON } from '@/lib/store';
import { dur } from '@/theme';

/** One-time hands-on walkthrough (Mason). Lives HERE — above the scenes AND the
 *  tab bar — because its spotlight points at the real tab pills and the user
 *  advances by actually tapping them. Starts on the first Home landing (where
 *  the hero target exists), adults only, persisted like the old card tour. */
function TourGate() {
  const { hydrated, mode } = useProfile();
  const pathname = usePathname();
  // idle → (first Home landing, flag unset) → active → done. Once active it stays
  // mounted across the tab taps the tour asks for; 'done' never re-enters.
  const [phase, setPhase] = useState<'idle' | 'active' | 'done'>('idle');
  useEffect(() => {
    if (phase !== 'idle' || !hydrated || mode === 'kids' || pathname !== '/') return;
    let alive = true;
    getJSON('cc.tourDone', false).then((done) => {
      if (!alive) return;
      setPhase((p) => (p === 'idle' ? (done ? 'done' : 'active') : p));
    });
    return () => {
      alive = false;
    };
  }, [phase, hydrated, mode, pathname]);
  if (phase !== 'active') return null;
  return (
    <HandsOnTour
      onDone={() => {
        setPhase('done');
        setJSON('cc.tourDone', true);
      }}
    />
  );
}

export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
    {/* Tab switches cross-fade FAST (dur.tab) with an OVERLAP curve — never a hard
    // cut, but never a laggy dissolve either. The built-in 'fade' preset makes
    // both scenes half-transparent at the midpoint, so the dark root bled through
    // as a visible dim-blink; this interpolator holds each scene fully opaque
    // through the middle (combined coverage never drops), so the new tab simply
    // materializes over the old one. Each screen still does its one-time entrance
    // on first open (Reveal) — this only shapes the switch itself. */}
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
    <TourGate />
    </View>
  );
}
